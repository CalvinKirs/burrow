// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { render } from '../../src/content/renderer';

const dom = (html: string) => {
  const el = document.createElement('div');
  el.innerHTML = html;
  return el;
};

describe('render', () => {
  it('extracts headings with unique slug ids', () => {
    const { html, headings } = render('# Hello World\n\n## Setup `npm`\n\n## Hello World\n\n### Über Größe\n');
    expect(headings).toEqual([
      { level: 1, text: 'Hello World', id: 'hello-world' },
      { level: 2, text: 'Setup npm', id: 'setup-npm' },
      { level: 2, text: 'Hello World', id: 'hello-world-1' },
      { level: 3, text: 'Über Größe', id: 'über-größe' },
    ]);
    expect(dom(html).querySelector('h2#setup-npm')).not.toBeNull();
  });

  it('falls back to a generic id for headings without word characters', () => {
    expect(render('# !!!\n').headings[0].id).toBe('section');
  });

  it('tags block elements with their 1-based source line', () => {
    const root = dom(render('# T\n\npara one\n\n- item\n').html);
    expect(root.querySelector('h1')!.getAttribute('data-line')).toBe('1');
    expect(root.querySelector('p')!.getAttribute('data-line')).toBe('3');
    expect(root.querySelector('ul')!.getAttribute('data-line')).toBe('5');
  });

  it('highlights fenced code and keeps the language class', () => {
    const root = dom(render('```js\nconst a = 1;\n```\n').html);
    const code = root.querySelector('pre > code.language-js')!;
    expect(code.querySelector('.hljs-keyword')!.textContent).toBe('const');
    expect(root.querySelector('pre')!.getAttribute('data-line')).toBe('1');
  });

  it('escapes code in unknown languages', () => {
    const root = dom(render('```nope\n<b>x</b>\n```\n').html);
    expect(root.querySelector('pre > code')!.textContent).toBe('<b>x</b>\n');
    expect(root.querySelector('pre b')).toBeNull();
  });

  it('turns mermaid fences into placeholders whose text is the source', () => {
    const root = dom(render('```mermaid\ngraph TD; A-->B;\n```\n').html);
    const block = root.querySelector('pre.bw-mermaid')!;
    expect(block.textContent).toBe('graph TD; A-->B;\n');
  });

  it('escapes raw html by default', () => {
    const root = dom(render('<div class="x">hi</div>\n').html);
    expect(root.querySelector('div.x')).toBeNull();
    expect(root.textContent).toContain('<div class="x">hi</div>');
  });

  it('allows raw html when enabled but still strips scripts and handlers', () => {
    const root = dom(render('<div class="x" onclick="alert(1)">hi</div>\n\n<script>alert(1)</script>\n', { allowHtml: true }).html);
    expect(root.querySelector('div.x')).not.toBeNull();
    expect(root.querySelector('div.x')!.hasAttribute('onclick')).toBe(false);
    expect(root.querySelector('script')).toBeNull();
  });

  it('neutralises javascript: links', () => {
    const root = dom(render('[x](javascript:alert(1))\n').html);
    expect(root.querySelector('a[href^="javascript"]')).toBeNull();
  });

  it('renders task list items as disabled checkboxes', () => {
    const root = dom(render('- [ ] todo\n- [x] done\n- plain\n').html);
    const boxes = root.querySelectorAll<HTMLInputElement>('li.bw-task > input[type=checkbox]');
    expect(boxes.length).toBe(2);
    expect(boxes[0].checked).toBe(false);
    expect(boxes[1].checked).toBe(true);
    expect(boxes[0].disabled).toBe(true);
    expect(root.querySelectorAll('li')[0].textContent!.trim()).toBe('todo');
  });

  it('renders GFM tables and strikethrough', () => {
    const root = dom(render('| a | b |\n|---|---|\n| 1 | 2 |\n\n~~gone~~\n').html);
    expect(root.querySelectorAll('td').length).toBe(2);
    expect(root.querySelector('s')!.textContent).toBe('gone');
  });

  it('skips highlighting for very large documents', () => {
    const src = '```js\nconst a = 1;\n```\n' + 'x'.repeat(2_100_000);
    expect(render(src).html).not.toContain('hljs-keyword');
  });
});
