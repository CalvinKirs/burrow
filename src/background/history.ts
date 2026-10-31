import { assertFileUrl, canonicalUrl, isMarkdown } from '../shared/paths';
import type { HistoryEntry } from '../shared/types';

export const HISTORY_LIMIT = 200;
const KEY = 'readingHistory';

// A single worker owns writes. Serialize read/modify/write operations across tabs.
let pending: Promise<void> = Promise.resolve();

export async function loadHistory(): Promise<HistoryEntry[]> {
  await pending;
  const stored = await chrome.storage.local.get(KEY);
  return (stored[KEY] as HistoryEntry[] | undefined) ?? [];
}

function updateHistory(change: (entries: HistoryEntry[]) => HistoryEntry[]): Promise<void> {
  const next = pending.then(async () => {
    const stored = await chrome.storage.local.get(KEY);
    const entries = (stored[KEY] as HistoryEntry[] | undefined) ?? [];
    await chrome.storage.local.set({ [KEY]: change(entries) });
  });
  // A failed write must not prevent subsequent visits from being recorded.
  pending = next.catch(() => {});
  return next;
}

export function recordVisit(fileUrl: string, title: string): Promise<void> {
  assertFileUrl(fileUrl);
  const url = canonicalUrl(fileUrl);
  if (!isMarkdown(url)) throw new Error('History only supports Markdown files');
  return updateHistory((entries) => [
    { url, title, visitedAt: Date.now() },
    ...entries.filter((entry) => entry.url !== url),
  ].slice(0, HISTORY_LIMIT));
}

export function removeVisit(fileUrl: string): Promise<void> {
  const url = canonicalUrl(fileUrl);
  return updateHistory((entries) => entries.filter((entry) => entry.url !== url));
}

export function clearHistory(): Promise<void> {
  return updateHistory(() => []);
}
