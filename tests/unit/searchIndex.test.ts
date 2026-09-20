import { describe, expect, it } from 'vitest';
import { SearchIndex } from '../../src/background/searchIndex';
import type { FileSource } from '../../src/background/fileSource';
import type { Entry } from '../../src/shared/types';

/** In-memory FileSource built from a { path: content } map rooted at file:///ws/. */
function memSource(files: Record<string, string>, opts: { failRead?: string[]; sizes?: Record<string, number> } = {}): FileSource {
  const root = 'file:///ws/';
  return {
    async listDir(dirUrl) {
      const rel = dirUrl.slice(root.length);
      const seen = new Map<string, Entry>();
      for (const path of Object.keys(files)) {
        if (!path.startsWith(rel)) continue;
        const rest = path.slice(rel.length);
        const [head, ...tail] = rest.split('/');
        const isDir = tail.length > 0;
        seen.set(head, {
          name: head,
          url: dirUrl + head + (isDir ? '/' : ''),
          isDir,
          size: isDir ? 0 : (opts.sizes?.[path] ?? files[path].length),
          mtime: 1,
        });
      }
      return [...seen.values()];
    },
    async readText(fileUrl) {
      const rel = fileUrl.slice(root.length);
      if (opts.failRead?.includes(rel)) throw new Error('boom');
      return files[rel];
    },
  };
}

const build = async (src: FileSource, maxFiles = 2000) => {
  const idx = new SearchIndex(src, { ignore: ['node_modules'], maxFiles });
  await idx.build('file:///ws/');
  return idx;
};

describe('SearchIndex', () => {
  it('crawls recursively and honours ignore rules', async () => {
    const idx = await build(
      memSource({
        'a.md': 'hello rabbit',
        'docs/deep/b.md': 'Rabbit again',
        'node_modules/x/readme.md': 'rabbit',
        '.hidden/c.md': 'rabbit',
        'notes.txt': 'rabbit',
      }),
    );
    expect(idx.indexed).toBe(2);
    expect(idx.query('rabbit').map((h) => h.rel)).toEqual(['a.md', 'docs/deep/b.md']);
  });

  it('is case-insensitive and reports 1-based line numbers', async () => {
    const idx = await build(memSource({ 'a.md': 'one\ntwo RABBIT\nthree' }));
    expect(idx.query('rabbit')).toEqual([{ url: 'file:///ws/a.md', rel: 'a.md', line: 2, snippet: 'two RABBIT' }]);
  });

  it('puts file name hits (line 0) before content hits', async () => {
    const idx = await build(memSource({ 'a.md': 'carrot here', 'carrot.md': 'nothing' }));
    const hits = idx.query('carrot');
    expect(hits[0]).toMatchObject({ rel: 'carrot.md', line: 0 });
    expect(hits[1]).toMatchObject({ rel: 'a.md', line: 1 });
  });

  it('caps hits per file at 5 and total at 200', async () => {
    const many: Record<string, string> = {};
    for (let i = 0; i < 60; i++) many[`f${i}.md`] = Array(10).fill('needle').join('\n');
    const idx = await build(memSource(many));
    const hits = idx.query('needle');
    expect(hits.length).toBe(200);
    expect(hits.filter((h) => h.rel === 'f0.md').length).toBe(5);
  });

  it('stops at maxFiles and flags truncation', async () => {
    const idx = await build(memSource({ 'a.md': 'x', 'b.md': 'x', 'c.md': 'x' }), 2);
    expect(idx.indexed).toBe(2);
    expect(idx.truncated).toBe(true);
  });

  it('skips files larger than 1MB and survives read failures', async () => {
    const idx = await build(
      memSource({ 'big.md': 'needle', 'bad.md': 'needle', 'ok.md': 'needle' }, { sizes: { 'big.md': 2_000_000 }, failRead: ['bad.md'] }),
    );
    expect(idx.query('needle').map((h) => h.rel)).toEqual(['ok.md']);
  });

  it('trims long snippets around the match', async () => {
    const idx = await build(memSource({ 'a.md': 'x'.repeat(500) + 'needle' + 'y'.repeat(500) }));
    const [hit] = idx.query('needle');
    expect(hit.snippet.length).toBeLessThanOrEqual(162);
    expect(hit.snippet).toContain('needle');
  });

  it('starts the snippet shortly before a match that sits deep in the line', async () => {
    const idx = await build(memSource({ 'a.md': '  Set `hops=3` in the config. The secret word is xylophone.' }));
    expect(idx.query('xylophone')[0].snippet).toBe('…secret word is xylophone.');
    expect(idx.query('hops')[0].snippet).toBe('Set `hops=3` in the config. The secret word is xylophone.');
  });

  it('returns nothing for a blank query', async () => {
    const idx = await build(memSource({ 'a.md': 'x' }));
    expect(idx.query('  ')).toEqual([]);
  });
});
