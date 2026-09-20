export interface HitTarget {
  line: number;
  query: string;
}

/** Parses `#bw-line=12&bw-q=needle` fragments produced by the workspace search. */
export function parseHitHash(hash: string): HitTarget | null {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  const line = Number(params.get('bw-line'));
  if (!Number.isInteger(line) || line < 1) return null;
  return { line, query: params.get('bw-q') ?? '' };
}

/** The rendered block that starts closest to, but not after, the given source line. */
export function findBlockForLine(article: HTMLElement, line: number): HTMLElement | null {
  let best: HTMLElement | null = null;
  let bestLine = 0;
  for (const el of article.querySelectorAll<HTMLElement>('[data-line]')) {
    const n = Number(el.dataset.line);
    // `>=` prefers the innermost element when nested blocks start on the same line.
    if (n <= line && n >= bestLine) {
      best = el;
      bestLine = n;
    }
  }
  return best;
}

function clearMarks(article: HTMLElement) {
  for (const mark of article.querySelectorAll('mark.bw-hit')) {
    const parent = mark.parentNode!;
    mark.replaceWith(...mark.childNodes);
    parent.normalize();
  }
  article.querySelector('.bw-flash')?.classList.remove('bw-flash');
}

function markText(block: HTMLElement, query: string): HTMLElement | null {
  const needle = query.toLowerCase();
  if (!needle) return null;
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  let first: HTMLElement | null = null;
  for (const node of nodes) {
    let rest = node;
    for (let at = rest.data.toLowerCase().indexOf(needle); at !== -1; at = rest.data.toLowerCase().indexOf(needle)) {
      const match = rest.splitText(at);
      rest = match.splitText(needle.length);
      const mark = document.createElement('mark');
      mark.className = 'bw-hit';
      match.replaceWith(mark);
      mark.append(match);
      first ??= mark;
    }
  }
  return first;
}

/** Scrolls to the search hit described by the current url fragment, if any. */
export function revealHit(article: HTMLElement, hash: string): boolean {
  const target = parseHitHash(hash);
  if (!target) return false;
  clearMarks(article);
  const block = findBlockForLine(article, target.line);
  if (!block) return false;
  const mark = markText(block, target.query);
  block.classList.add('bw-flash');
  (mark ?? block).scrollIntoView({ block: 'center' });
  return true;
}
