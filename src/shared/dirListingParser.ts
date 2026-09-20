import { canonicalUrl } from './paths';
import type { Entry } from './types';

// One JS string literal, or any run of non-quote characters, so that `);` inside a
// file name does not end the match early.
const ROW = /addRow\(((?:"(?:[^"\\]|\\.)*"|[^")])*)\);/g;

/**
 * Parses the HTML that Chrome generates for `file:///some/dir/`. Each entry is emitted as
 * `addRow(name, url, isDir, size, sizeString, mtime, mtimeString);` with JSON-style literals.
 */
export function parseDirListing(html: string, dirUrl: string): Entry[] {
  if (!/\bstart\("/.test(html)) throw new Error('not a directory listing');
  const base = dirUrl.endsWith('/') ? dirUrl : dirUrl + '/';
  const entries: Entry[] = [];
  for (const m of html.matchAll(ROW)) {
    let args: unknown[];
    try {
      args = JSON.parse(`[${m[1]}]`);
    } catch {
      continue;
    }
    const [name, href, isDir, size, , mtime] = args as [string, string, number, number, string, number];
    if (typeof name !== 'string' || typeof href !== 'string' || name === '..' || name === '.') continue;
    const dir = Boolean(isDir);
    const url = canonicalUrl(base + href.replace(/\/$/, '')) + (dir ? '/' : '');
    entries.push({ name, url, isDir: dir, size: Number(size) || 0, mtime: Number(mtime) || 0 });
  }
  return entries;
}
