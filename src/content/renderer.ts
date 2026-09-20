import DOMPurify from 'dompurify';
import hljs from 'highlight.js/lib/common';
import createMarkdownIt, { type MarkdownIt, type StateCore, type Token } from 'markdown-it';
import type { Heading } from '../shared/types';

export interface RenderOptions {
  allowHtml?: boolean;
}

export interface RenderResult {
  html: string;
  headings: Heading[];
}

const MAX_HIGHLIGHT_CHARS = 2_000_000;

function slugify(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s+/g, '-');
  return slug || 'section';
}

function inlineText(token: Token): string {
  return (token.children ?? [])
    .filter((t) => t.type === 'text' || t.type === 'code_inline')
    .map((t) => t.content)
    .join('');
}

/** Adds ids to headings and records them for the outline. */
function headingRule(headings: Heading[]) {
  return (state: StateCore) => {
    const used = new Map<string, number>();
    state.tokens.forEach((token, i) => {
      if (token.type !== 'heading_open') return;
      const text = inlineText(state.tokens[i + 1]);
      const base = slugify(text);
      const n = used.get(base) ?? 0;
      used.set(base, n + 1);
      const id = n === 0 ? base : `${base}-${n}`;
      token.attrSet('id', id);
      headings.push({ level: Number(token.tag.slice(1)), text, id });
    });
  };
}

/** Records the 1-based source line on block tokens so search hits can scroll to them. */
function lineRule(state: StateCore) {
  for (const token of state.tokens) {
    if (token.map && (token.nesting === 1 || token.type === 'fence' || token.type === 'code_block' || token.type === 'hr')) {
      token.attrSet('data-line', String(token.map[0] + 1));
    }
  }
}

/** GFM task lists: `- [ ]` / `- [x]` become disabled checkboxes. */
function taskListRule(state: StateCore) {
  const tokens = state.tokens;
  for (let i = 2; i < tokens.length; i++) {
    const inline = tokens[i];
    if (inline.type !== 'inline' || tokens[i - 1].type !== 'paragraph_open' || tokens[i - 2].type !== 'list_item_open') continue;
    const first = inline.children?.[0];
    const m = first?.type === 'text' ? /^\[([ xX])\]\s+/.exec(first.content) : null;
    if (!first || !m) continue;
    first.content = first.content.slice(m[0].length);
    const box = new state.Token('html_inline', '', 0);
    box.content = `<input type="checkbox" disabled${m[1] === ' ' ? '' : ' checked'}> `;
    inline.children!.unshift(box);
    tokens[i - 2].attrJoin('class', 'bw-task');
  }
}

function createParser(allowHtml: boolean, highlight: boolean, headings: Heading[]): MarkdownIt {
  const md = createMarkdownIt({ html: allowHtml, linkify: true });
  const escape = md.utils.escapeHtml;

  md.renderer.rules.fence = (tokens, idx) => {
    const token = tokens[idx];
    const lang = token.info.trim().split(/\s+/)[0] ?? '';
    const line = token.attrGet('data-line');
    const lineAttr = line ? ` data-line="${line}"` : '';
    if (lang === 'mermaid') {
      return `<pre class="bw-mermaid"${lineAttr}>${escape(token.content)}</pre>\n`;
    }
    const body =
      highlight && lang && hljs.getLanguage(lang)
        ? hljs.highlight(token.content, { language: lang, ignoreIllegals: true }).value
        : escape(token.content);
    const cls = lang ? ` class="language-${escape(lang)}"` : '';
    return `<pre${lineAttr}><code${cls}>${body}</code></pre>\n`;
  };

  md.core.ruler.push('bw_headings', headingRule(headings));
  md.core.ruler.push('bw_lines', lineRule);
  md.core.ruler.push('bw_tasks', taskListRule);
  return md;
}

export function render(src: string, options: RenderOptions = {}): RenderResult {
  const headings: Heading[] = [];
  const md = createParser(options.allowHtml === true, src.length <= MAX_HIGHLIGHT_CHARS, headings);
  const html = DOMPurify.sanitize(md.render(src), { FORBID_TAGS: ['style', 'form'], ADD_ATTR: ['target'] });
  return { html, headings };
}
