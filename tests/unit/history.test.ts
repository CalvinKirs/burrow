import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearHistory, HISTORY_LIMIT, loadHistory, recordVisit, removeVisit } from '../../src/background/history';

let stored: Record<string, unknown>;
const set = vi.fn(async (values: Record<string, unknown>) => {
  Object.assign(stored, structuredClone(values));
});

beforeEach(() => {
  stored = {};
  set.mockClear();
  vi.stubGlobal('chrome', {
    storage: { local: {
      get: async (key: string) => ({ [key]: structuredClone(stored[key]) }),
      set,
    } },
  });
});

afterEach(() => vi.unstubAllGlobals());

describe('reading history', () => {
  it('starts empty and reads previously persisted entries', async () => {
    expect(await loadHistory()).toEqual([]);
    stored.readingHistory = [{ url: 'file:///notes.md', title: 'Notes', visitedAt: 123 }];
    expect(await loadHistory()).toEqual(stored.readingHistory);
  });

  it('deduplicates encoded paths and fragments, and moves revisits to the front', async () => {
    await recordVisit('file:///Café/notes.md#heading', 'Old title');
    await recordVisit('file:///other.md', 'Other');
    await recordVisit('file:///Caf%C3%A9/notes.md#bw-line=4', 'New title');
    expect(await loadHistory()).toEqual([
      { url: 'file:///Caf%C3%A9/notes.md', title: 'New title', visitedAt: expect.any(Number) },
      { url: 'file:///other.md', title: 'Other', visitedAt: expect.any(Number) },
    ]);
  });

  it('keeps simultaneous visits and limits storage to the latest files', async () => {
    await Promise.all(Array.from({ length: HISTORY_LIMIT + 5 }, (_, i) => recordVisit(`file:///${i}.md`, `${i}`)));
    const entries = await loadHistory();
    expect(entries).toHaveLength(HISTORY_LIMIT);
    expect(entries[0].url).toBe(`file:///${HISTORY_LIMIT + 4}.md`);
    expect(entries.at(-1)?.url).toBe('file:///5.md');
    expect(new Set(entries.map((entry) => entry.url)).size).toBe(HISTORY_LIMIT);
  });

  it('serializes removal and clearing with visits from other tabs', async () => {
    await Promise.all([
      recordVisit('file:///a.md', 'A'),
      recordVisit('file:///b.md', 'B'),
      removeVisit('file:///a.md#heading'),
    ]);
    expect((await loadHistory()).map((entry) => entry.url)).toEqual(['file:///b.md']);
    await Promise.all([clearHistory(), recordVisit('file:///c.md', 'C')]);
    expect((await loadHistory()).map((entry) => entry.url)).toEqual(['file:///c.md']);
    await clearHistory();
    expect(await loadHistory()).toEqual([]);
  });

  it('allows later writes after a storage failure', async () => {
    set.mockRejectedValueOnce(new Error('Storage failed'));
    await expect(recordVisit('file:///a.md', 'A')).rejects.toThrow('Storage failed');
    await recordVisit('file:///b.md', 'B');
    expect((await loadHistory()).map((entry) => entry.url)).toEqual(['file:///b.md']);
  });

  it('rejects remote URLs and non-Markdown files', () => {
    expect(() => recordVisit('https://example.com/notes.md', 'Remote')).toThrow();
    expect(() => recordVisit('file:///notes.txt', 'Text')).toThrow();
  });
});
