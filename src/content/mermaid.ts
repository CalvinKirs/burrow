import { h } from './dom';
import { t } from './i18n';

type MermaidModule = typeof import('../mermaid/index');

let modulePromise: Promise<MermaidModule> | null = null;

function loadModule(): Promise<MermaidModule> {
  modulePromise ??= import(/* @vite-ignore */ chrome.runtime.getURL('mermaid.js'));
  return modulePromise;
}

/** Replaces every `pre.bw-mermaid` placeholder with its diagram. Safe to call again on theme change. */
export async function renderMermaid(article: HTMLElement, dark: boolean): Promise<void> {
  const blocks = [...article.querySelectorAll<HTMLElement>('.bw-mermaid')];
  if (blocks.length === 0) return;
  const { renderDiagram } = await loadModule();
  for (const block of blocks) {
    const source = (block.dataset.source ??= block.textContent ?? '');
    const host = block.closest('.bw-mermaid-failed') ?? block;
    try {
      const figure = h('div.bw-mermaid.bw-mermaid-done', { 'data-line': block.dataset.line });
      figure.dataset.source = source;
      figure.innerHTML = await renderDiagram(source, dark);
      host.replaceWith(figure);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const failed = h('pre.bw-mermaid.bw-mermaid-error', { 'data-line': block.dataset.line }, source);
      failed.dataset.source = source;
      host.replaceWith(h('div.bw-mermaid-failed', {}, failed, h('div.bw-error', {}, t.mermaidError + message)));
      // Mermaid leaves its error graphic in the body when rendering fails.
      document.querySelectorAll('body > [id^="dbw-mermaid-"]').forEach((el) => el.remove());
    }
  }
}
