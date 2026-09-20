import { baseName } from '../shared/paths';
import { loadSettings } from '../shared/settings';
import { mountExplorer } from './explorer';
import { revealHit } from './highlightHit';
import { createLayout } from './layout';
import { renderMermaid } from './mermaid';
import { mountOutline } from './outline';
import { render } from './renderer';
import { t } from './i18n';

const LARGE_FILE_CHARS = 2_000_000;

/** Chrome shows local text files as a single <pre>; anything else is not ours to take over. */
function readSource(): string | null {
  if (!/^text\/(plain|markdown|x-markdown)$/.test(document.contentType)) return null;
  const pre = document.body?.firstElementChild;
  if (!pre || pre.tagName !== 'PRE' || document.body.children.length !== 1) return null;
  return pre.textContent ?? '';
}

function scrollToFragment(article: HTMLElement) {
  if (revealHit(article, location.hash)) return;
  const id = decodeURIComponent(location.hash.slice(1));
  if (id) document.getElementById(id)?.scrollIntoView();
}

async function main() {
  const source = readSource();
  if (source === null) return;

  const settings = await loadSettings();
  const { html, headings } = render(source, { allowHtml: settings.allowHtml });
  const layout = createLayout(source, settings);
  layout.article.innerHTML = html;
  document.title = headings.find((x) => x.level === 1)?.text ?? baseName(location.href);
  if (source.length > LARGE_FILE_CHARS) layout.notice(t.largeFile);

  mountOutline(layout.leftBody, layout.article, headings);
  void mountExplorer(layout.rightBody);

  await renderMermaid(layout.article, layout.isDark()).catch((err) => console.warn('[burrow] mermaid', err));
  layout.onThemeChange((dark) => void renderMermaid(layout.article, dark));

  scrollToFragment(layout.article);
  window.addEventListener('hashchange', () => scrollToFragment(layout.article));
}

void main();
