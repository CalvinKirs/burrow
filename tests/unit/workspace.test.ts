import { describe, expect, it } from 'vitest';
import { addRoot, filterAndSort, removeRootsFor, resolveRoot } from '../../src/background/workspace';
import type { Entry } from '../../src/shared/types';

const e = (name: string, isDir = false): Entry => ({
  name,
  url: 'file:///ws/' + encodeURIComponent(name) + (isDir ? '/' : ''),
  isDir,
  size: 1,
  mtime: 1,
});

describe('resolveRoot', () => {
  it('defaults to the directory of the file', () => {
    expect(resolveRoot('file:///a/b/x.md', [])).toBe('file:///a/b/');
  });

  it('prefers the longest saved root that contains the file', () => {
    const saved = ['file:///a/', 'file:///a/b/', 'file:///z/'];
    expect(resolveRoot('file:///a/b/c/x.md', saved)).toBe('file:///a/b/');
    expect(resolveRoot('file:///a/q/x.md', saved)).toBe('file:///a/');
    expect(resolveRoot('file:///other/x.md', saved)).toBe('file:///other/');
  });

  it('ignores the fragment', () => {
    expect(resolveRoot('file:///a/b/x.md#bw-line=2', [])).toBe('file:///a/b/');
  });
});

describe('filterAndSort', () => {
  const ignore = ['node_modules'];

  it('keeps only markdown files and directories, dropping hidden and ignored entries', () => {
    const out = filterAndSort(
      [e('a.md'), e('b.txt'), e('.git', true), e('.hidden.md'), e('node_modules', true), e('docs', true), e('pic.png')],
      ignore,
    );
    expect(out.map((x) => x.name)).toEqual(['docs', 'a.md']);
  });

  it('sorts directories first, then naturally and case-insensitively', () => {
    const out = filterAndSort([e('b.md'), e('a10.md'), e('a2.md'), e('Zed', true), e('alpha', true), e('B2.md')], ignore);
    expect(out.map((x) => x.name)).toEqual(['alpha', 'Zed', 'a2.md', 'a10.md', 'b.md', 'B2.md']);
  });
});

describe('saved roots', () => {
  it('addRoot replaces saved descendants of the new root', () => {
    expect(addRoot(['file:///a/b/', 'file:///z/'], 'file:///a/')).toEqual(['file:///z/', 'file:///a/']);
    expect(addRoot(['file:///a/'], 'file:///a/')).toEqual(['file:///a/']);
  });

  it('removeRootsFor forgets every root containing the file', () => {
    expect(removeRootsFor(['file:///a/', 'file:///a/b/', 'file:///z/'], 'file:///a/b/x.md')).toEqual(['file:///z/']);
  });
});
