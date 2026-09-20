import { dirOf, isMarkdown, isUnder } from '../shared/paths';
import type { Entry } from '../shared/types';

/** The workspace root for a file: the longest saved root containing it, else its own directory. */
export function resolveRoot(fileUrl: string, savedRoots: string[]): string {
  const dir = dirOf(fileUrl);
  let best = '';
  for (const root of savedRoots) {
    if (isUnder(dir, root) && root.length > best.length) best = root;
  }
  return best || dir;
}

/** Saves `root`, dropping saved roots inside it so the longest-prefix match cannot shadow it. */
export function addRoot(savedRoots: string[], root: string): string[] {
  return [...savedRoots.filter((r) => !isUnder(r, root)), root];
}

/** Forgets every saved root containing `fileUrl`, so its workspace falls back to its own directory. */
export function removeRootsFor(savedRoots: string[], fileUrl: string): string[] {
  const dir = dirOf(fileUrl);
  return savedRoots.filter((r) => !isUnder(dir, r));
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function filterAndSort(entries: Entry[], ignore: string[]): Entry[] {
  const ignored = new Set(ignore);
  return entries
    .filter((e) => !e.name.startsWith('.') && !ignored.has(e.name) && (e.isDir || isMarkdown(e.name)))
    .sort((a, b) => (a.isDir === b.isDir ? collator.compare(a.name, b.name) : a.isDir ? -1 : 1));
}
