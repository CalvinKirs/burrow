import { send } from '../shared/messages';
import { baseName, canonicalUrl, dirOf, isUnder, parentDir } from '../shared/paths';
import { loadSettings, saveSettings } from '../shared/settings';
import type { Entry, Hit } from '../shared/types';
import { h, icon, ICONS } from './dom';
import { parseHitHash } from './highlightHit';
import { t } from './i18n';

const SEARCH_DEBOUNCE_MS = 200;

export function hitUrl(hit: Hit, query: string): string {
  return hit.line === 0 ? hit.url : `${hit.url}#bw-line=${hit.line}&bw-q=${encodeURIComponent(query)}`;
}

export async function mountExplorer(container: HTMLElement): Promise<void> {
  const currentUrl = canonicalUrl(location.href);
  const currentDir = dirOf(currentUrl);
  let root = currentDir;
  let expanded = new Set<string>();
  let searchSeq = 0;

  const rootName = h('span.bw-root-name');
  const upBtn = toolButton(t.rootUp, ICONS.up, moveRootUp);
  const resetBtn = toolButton(t.rootReset, ICONS.home, resetRoot);
  const header = h('div.bw-side-title.bw-explorer-header', {}, rootName, upBtn, resetBtn);
  const input = h('input.bw-search-input', { type: 'search', placeholder: t.searchPlaceholder, spellcheck: 'false' });
  const tree = h('div.bw-tree', { role: 'tree' });
  const results = h('div.bw-results', { hidden: true });
  container.replaceChildren(header, h('div.bw-search', {}, input), tree, results);

  let timer = 0;
  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => void runSearch(false), SEARCH_DEBOUNCE_MS);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    input.value = '';
    void runSearch(false);
  });

  try {
    root = (await send({ type: 'resolveRoot', fileUrl: currentUrl })).root;
  } catch {
    // fall back to the file's own directory
  }
  await loadRoot();

  // Arriving from a search result: keep the query and its results so the next hit is one click away.
  const arrivedFrom = parseHitHash(location.hash)?.query;
  if (arrivedFrom) {
    input.value = arrivedFrom;
    void runSearch(false);
  }

  // Jumping between hits in the same file only changes the fragment; refresh the current-hit marker.
  window.addEventListener('hashchange', () => {
    if (input.value.trim()) void runSearch(false);
  });

  function toolButton(title: string, path: string, onClick: () => void) {
    const b = h('button.bw-btn.bw-btn-small', { type: 'button', title, 'aria-label': title }, icon(path));
    b.addEventListener('click', onClick);
    return b;
  }

  async function loadRoot() {
    rootName.textContent = baseName(root);
    rootName.title = decodeURI(root.replace(/^file:\/\//, ''));
    upBtn.disabled = parentDir(root) === null;
    resetBtn.hidden = root === currentDir;

    const saved = (await loadSettings()).expanded[root] ?? [];
    expanded = new Set(saved);
    // Always reveal the file being read.
    for (let dir: string | null = currentDir; dir && dir !== root && isUnder(dir, root); dir = parentDir(dir)) expanded.add(dir);

    tree.replaceChildren();
    await renderChildren(tree, root, 0);
    tree.querySelector('.bw-current')?.scrollIntoView({ block: 'center' });
  }

  async function moveRootUp() {
    const parent = parentDir(root);
    if (!parent) return;
    await send({ type: 'setRoot', root: parent });
    expanded.add(root);
    await persistExpanded(parent);
    root = parent;
    await loadRoot();
    if (input.value.trim()) void runSearch(false);
  }

  async function resetRoot() {
    await send({ type: 'resetRoot', fileUrl: currentUrl });
    root = currentDir;
    await loadRoot();
    if (input.value.trim()) void runSearch(false);
  }

  async function persistExpanded(forRoot = root) {
    const all = (await loadSettings()).expanded;
    await saveSettings({ expanded: { ...all, [forRoot]: [...expanded] } });
  }

  async function renderChildren(parent: HTMLElement, dirUrl: string, depth: number): Promise<void> {
    let entries: Entry[];
    try {
      entries = (await send({ type: 'listChildren', dirUrl })).entries;
    } catch (err) {
      const retry = h('button.bw-link', { type: 'button' }, t.retry);
      retry.addEventListener('click', () => {
        parent.replaceChildren();
        void renderChildren(parent, dirUrl, depth);
      });
      const detail = err instanceof Error ? err.message : String(err);
      parent.replaceChildren(h('div.bw-error', { title: detail }, `${t.loadFailed} `, retry));
      return;
    }
    if (entries.length === 0) {
      parent.replaceChildren(h('div.bw-muted', {}, t.empty));
      return;
    }
    const nodes = entries.map((entry) => (entry.isDir ? dirNode(entry, depth) : fileNode(entry, depth)));
    parent.replaceChildren(...nodes.map((n) => n.el));
    await Promise.all(nodes.map((n) => n.ready));
  }

  function indent(row: HTMLElement, depth: number) {
    row.style.paddingLeft = `${8 + depth * 14}px`;
  }

  function fileNode(entry: Entry, depth: number) {
    const current = entry.url === currentUrl;
    const row = h(
      `a.bw-row.bw-file${current ? '.bw-current' : ''}`,
      { href: entry.url, title: entry.name, role: 'treeitem' },
      h('span.bw-caret-space'),
      icon(ICONS.file),
      h('span.bw-name', {}, entry.name),
    );
    indent(row, depth);
    return { el: row, ready: Promise.resolve() };
  }

  function dirNode(entry: Entry, depth: number) {
    const caret = icon(ICONS.caret);
    caret.classList.add('bw-caret');
    const row = h('div.bw-row.bw-dir', { title: entry.name, role: 'treeitem', tabindex: '0' }, caret, icon(ICONS.folder), h('span.bw-name', {}, entry.name));
    const children = h('div.bw-children', { role: 'group', hidden: true });
    const el = h('div.bw-node', {}, row, children);
    indent(row, depth);
    let loaded = false;

    const setOpen = async (open: boolean) => {
      row.classList.toggle('bw-open', open);
      row.setAttribute('aria-expanded', String(open));
      children.hidden = !open;
      if (open && !loaded) {
        loaded = true;
        await renderChildren(children, entry.url, depth + 1);
      }
    };
    const toggle = () => {
      const open = Boolean(children.hidden);
      if (open) expanded.add(entry.url);
      else expanded.delete(entry.url);
      void setOpen(open);
      void persistExpanded();
    };
    row.addEventListener('click', toggle);
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggle();
      }
    });
    return { el, ready: expanded.has(entry.url) ? setOpen(true) : Promise.resolve() };
  }

  async function runSearch(rebuild: boolean) {
    const q = input.value.trim();
    const seq = ++searchSeq;
    tree.hidden = q !== '';
    results.hidden = q === '';
    if (!q) return;
    results.replaceChildren(h('div.bw-muted', {}, t.searching));
    try {
      const res = await send({ type: 'search', root, q, rebuild });
      if (seq !== searchSeq) return;
      renderResults(q, res.hits, res.indexed, res.truncated);
    } catch (err) {
      if (seq !== searchSeq) return;
      results.replaceChildren(h('div.bw-error', {}, err instanceof Error ? err.message : String(err)));
    }
  }

  function renderResults(q: string, hits: Hit[], indexed: number, truncated: boolean) {
    const reindex = h('button.bw-link', { type: 'button' }, t.reindex);
    reindex.addEventListener('click', () => void runSearch(true));
    const status = h('div.bw-status', {}, `${t.results(hits.length)} · ${truncated ? t.truncated(indexed) : t.indexed(indexed)} · `, reindex);
    const items: HTMLElement[] = [status];
    if (hits.length === 0) items.push(h('div.bw-muted', {}, t.noResults));

    const shownLine = parseHitHash(location.hash)?.line;
    // File name hits come first, so group by file in order of first appearance.
    const groups = new Map<string, Hit[]>();
    for (const hit of hits) groups.set(hit.url, [...(groups.get(hit.url) ?? []), hit]);
    for (const [url, group] of groups) {
      items.push(h('a.bw-hit-file', { href: url, title: group[0].rel }, icon(ICONS.file), h('span.bw-name', {}, ...markMatches(group[0].rel, q))));
      for (const hit of group) {
        if (hit.line === 0) continue;
        items.push(
          h(
            `a.bw-hit-line${hit.url === currentUrl && hit.line === shownLine ? '.bw-hit-current' : ''}`,
            { href: hitUrl(hit, q), title: hit.snippet },
            h('span.bw-hit-no', {}, String(hit.line)),
            ...markMatches(hit.snippet, q),
          ),
        );
      }
    }
    results.replaceChildren(...items);
  }
}

/** Splits `text` into plain strings and <mark> elements around case-insensitive matches of `q`. */
export function markMatches(text: string, q: string): (Node | string)[] {
  const out: (Node | string)[] = [];
  const lower = text.toLowerCase();
  const needle = q.toLowerCase();
  let pos = 0;
  for (let at = lower.indexOf(needle); needle && at !== -1; at = lower.indexOf(needle, pos)) {
    if (at > pos) out.push(text.slice(pos, at));
    out.push(h('mark.bw-mark', {}, text.slice(at, at + needle.length)));
    pos = at + needle.length;
  }
  if (pos < text.length) out.push(text.slice(pos));
  return out;
}
