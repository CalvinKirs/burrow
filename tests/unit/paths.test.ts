import { describe, expect, it } from 'vitest';
import { baseName, canonicalUrl, dirOf, isMarkdown, isUnder, parentDir, relPath, stripHash } from '../../src/shared/paths';

describe('paths', () => {
  it('dirOf returns the containing directory with a trailing slash', () => {
    expect(dirOf('file:///a/b/x.md')).toBe('file:///a/b/');
    expect(dirOf('file:///a/b/x.md#bw-line=3')).toBe('file:///a/b/');
    expect(dirOf('file:///C:/x/y.md')).toBe('file:///C:/x/');
  });

  it('parentDir walks up and stops at the filesystem root', () => {
    expect(parentDir('file:///a/b/')).toBe('file:///a/');
    expect(parentDir('file:///a/')).toBe('file:///');
    expect(parentDir('file:///')).toBeNull();
  });

  it('isMarkdown matches known extensions case-insensitively', () => {
    for (const n of ['a.md', 'a.MD', 'a.markdown', 'a.mdown', 'a.mkd']) expect(isMarkdown(n)).toBe(true);
    for (const n of ['a.txt', 'md', 'a.md.bak', 'a.mdx']) expect(isMarkdown(n)).toBe(false);
  });

  it('isUnder checks directory containment', () => {
    expect(isUnder('file:///a/b/x.md', 'file:///a/')).toBe(true);
    expect(isUnder('file:///ab/x.md', 'file:///a/')).toBe(false);
  });

  it('relPath is decoded and relative to the root', () => {
    expect(relPath('file:///a/b/c/x.md', 'file:///a/')).toBe('b/c/x.md');
    expect(relPath('file:///a/my%20notes/%C3%A9t%C3%A9.md', 'file:///a/')).toBe('my notes/été.md');
  });

  it('baseName decodes and handles directories', () => {
    expect(baseName('file:///a/my%20notes/')).toBe('my notes');
    expect(baseName('file:///a/%C3%A9t%C3%A9.md')).toBe('été.md');
    expect(baseName('file:///')).toBe('/');
    expect(baseName('file:///a/100%.md')).toBe('100%.md');
  });

  it('canonicalUrl normalises encoding differences and drops the fragment', () => {
    expect(canonicalUrl('file:///a/my notes/(x).md#h')).toBe('file:///a/my%20notes/(x).md');
    expect(canonicalUrl('file:///a/my%20notes/%28x%29.md')).toBe('file:///a/my%20notes/(x).md');
    expect(canonicalUrl('file:///a/%C3%A9t%C3%A9/')).toBe(canonicalUrl('file:///a/été/'));
    expect(canonicalUrl('file:///C:/x/y.md')).toBe('file:///C:/x/y.md');
  });

  it('stripHash removes the fragment', () => {
    expect(stripHash('file:///a/x.md#h')).toBe('file:///a/x.md');
  });
});
