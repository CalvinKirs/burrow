// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { findBlockForLine, parseHitHash, revealHit } from '../../src/content/highlightHit';

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

const article = (html: string) => {
  const el = document.createElement('article');
  el.innerHTML = html;
  return el;
};

describe('parseHitHash', () => {
  it('reads the line and query', () => {
    expect(parseHitHash('#bw-line=12&bw-q=hello%20world')).toEqual({ line: 12, query: 'hello world' });
  });

  it('rejects ordinary heading fragments', () => {
    expect(parseHitHash('#setup')).toBeNull();
    expect(parseHitHash('')).toBeNull();
  });
});

describe('findBlockForLine', () => {
  const el = article('<h1 data-line="1">T</h1><ul data-line="3"><li data-line="3">a</li><li data-line="4">b</li></ul><p data-line="9">p</p>');

  it('picks the closest block at or before the line, preferring the innermost', () => {
    expect(findBlockForLine(el, 4)!.textContent).toBe('b');
    expect(findBlockForLine(el, 3)!.tagName).toBe('LI');
    expect(findBlockForLine(el, 7)!.textContent).toBe('b');
    expect(findBlockForLine(el, 100)!.tagName).toBe('P');
  });
});

describe('revealHit', () => {
  it('wraps every case-insensitive match in the block and flashes it', () => {
    const el = article('<p data-line="1">Rabbit and <em>rabbit</em>s</p><p data-line="3">rabbit elsewhere</p>');
    expect(revealHit(el, '#bw-line=1&bw-q=rabbit')).toBe(true);
    const marks = el.querySelectorAll('mark.bw-hit');
    expect([...marks].map((m) => m.textContent)).toEqual(['Rabbit', 'rabbit']);
    expect(el.querySelector('p')!.classList.contains('bw-flash')).toBe(true);
  });

  it('clears previous marks before applying new ones', () => {
    const el = article('<p data-line="1">one rabbit</p><p data-line="3">two rabbit</p>');
    revealHit(el, '#bw-line=1&bw-q=rabbit');
    revealHit(el, '#bw-line=3&bw-q=two');
    expect([...el.querySelectorAll('mark.bw-hit')].map((m) => m.textContent)).toEqual(['two']);
    expect(el.querySelectorAll('.bw-flash').length).toBe(1);
    expect(el.textContent).toBe('one rabbittwo rabbit');
  });

  it('returns false for non-hit fragments', () => {
    expect(revealHit(article('<p data-line="1">x</p>'), '#intro')).toBe(false);
  });
});
