import { describe, expect, it } from 'vitest';
import { parseDirListing } from '../../src/shared/dirListingParser';

const page = (rows: string) => `<!DOCTYPE html>
<html><head><script>
function addRow(name, url, isdir, size, size_string, date_modified, date_modified_string) {}
function start(location) {}
function onHasParentDirectory() {}
</script></head><body>
<table id="tbody"></table>
<script>start("/tmp/ws/");</script>
<script>onHasParentDirectory();</script>
${rows}
</body></html>`;

describe('parseDirListing', () => {
  it('parses files and directories', () => {
    const html = page(
      `<script>addRow("README.md","README.md",0,1234,"1.2 kB",1758000000,"9/16/25, 5:20:00 AM");</script>
<script>addRow("guide","guide",1,0,"",1758000100,"9/16/25, 5:21:40 AM");</script>`,
    );
    expect(parseDirListing(html, 'file:///tmp/ws/')).toEqual([
      { name: 'README.md', url: 'file:///tmp/ws/README.md', isDir: false, size: 1234, mtime: 1758000000 },
      { name: 'guide', url: 'file:///tmp/ws/guide/', isDir: true, size: 0, mtime: 1758000100 },
    ]);
  });

  it('handles encoded names, escaped quotes and unicode escapes', () => {
    const html = page(
      `<script>addRow("my notes.md","my%20notes.md",0,1,"1 B",1,"x");</script>
<script>addRow("say \\"hi\\".md","say%20%22hi%22.md",0,1,"1 B",1,"x");</script>
<script>addRow("\\u00E9t\\u00E9.md","%C3%A9t%C3%A9.md",0,1,"1 B",1,"x");</script>
<script>addRow("a);b.md","a);b.md",0,1,"1 B",1,"x");</script>`,
    );
    const out = parseDirListing(html, 'file:///tmp/ws/');
    expect(out.map((e) => e.name)).toEqual(['my notes.md', 'say "hi".md', 'été.md', 'a);b.md']);
    expect(out[0].url).toBe('file:///tmp/ws/my%20notes.md');
    expect(out[2].url).toBe('file:///tmp/ws/%C3%A9t%C3%A9.md');
  });

  it('ignores the parent entry and tolerates multiple rows per script tag', () => {
    const html = page(`<script>addRow("..","..",1,0,"",0,"");addRow("a.md","a.md",0,1,"1 B",1,"x");</script>`);
    expect(parseDirListing(html, 'file:///tmp/ws/').map((e) => e.name)).toEqual(['a.md']);
  });

  it('adds a trailing slash to the base directory when missing', () => {
    const html = page(`<script>addRow("a.md","a.md",0,1,"1 B",1,"x");</script>`);
    expect(parseDirListing(html, 'file:///tmp/ws')[0].url).toBe('file:///tmp/ws/a.md');
  });

  it('returns an empty list for an empty directory', () => {
    expect(parseDirListing(page(''), 'file:///tmp/ws/')).toEqual([]);
  });

  it('throws when the page is not a directory listing', () => {
    expect(() => parseDirListing('<html><body>hello</body></html>', 'file:///tmp/ws/')).toThrow(
      'not a directory listing',
    );
  });
});
