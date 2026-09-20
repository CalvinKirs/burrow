import type { Heading } from '../shared/types';
import { h } from './dom';
import { t } from './i18n';

/** Offset from the viewport top at which a heading counts as the current section. */
const ACTIVE_OFFSET = 96;
/** Fallback for clicks that cause no scrolling, where `scrollend` never fires. */
const PIN_TIMEOUT_MS = 1000;

export function mountOutline(container: HTMLElement, article: HTMLElement, headings: Heading[]): void {
  const list = h('nav.bw-outline');
  container.replaceChildren(h('div.bw-side-title', {}, t.outline), list);
  if (headings.length === 0) {
    list.append(h('div.bw-muted', {}, t.noHeadings));
    return;
  }

  const minLevel = Math.min(...headings.map((x) => x.level));
  const links = headings.map((heading) => {
    const link = h('a.bw-outline-item', { href: `#${encodeURIComponent(heading.id)}`, title: heading.text }, heading.text);
    link.style.paddingLeft = `${12 + (heading.level - minLevel) * 14}px`;
    list.append(link);
    return link;
  });

  const targets = headings.map((x) => article.querySelector<HTMLElement>(`[id="${CSS.escape(x.id)}"]`));
  let active = -1;
  let scheduled = false;

  const setActive = (index: number) => {
    if (index === active) return;
    links[active]?.classList.remove('bw-active');
    links[index].classList.add('bw-active');
    links[index].scrollIntoView({ block: 'nearest' });
    active = index;
  };

  const update = () => {
    scheduled = false;
    if (pinned) return;
    let current = 0;
    targets.forEach((el, i) => {
      if (el && el.getBoundingClientRect().top <= ACTIVE_OFFSET) current = i;
    });
    setActive(current);
  };

  // A heading near the end of the document may never reach the top of the viewport, so a clicked
  // item stays active until the scroll it caused has finished.
  let pinned = false;
  let unpinTimer = 0;
  const unpin = () => {
    clearTimeout(unpinTimer);
    pinned = false;
  };
  // Deferred so the last scroll frame, which may still be queued, cannot override the pin.
  window.addEventListener('scrollend', () => window.setTimeout(unpin, 100));

  links.forEach((link, i) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      pinned = true;
      clearTimeout(unpinTimer);
      unpinTimer = window.setTimeout(unpin, PIN_TIMEOUT_MS);
      setActive(i);
      targets[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.replaceState(null, '', `#${encodeURIComponent(headings[i].id)}`);
    });
  });

  window.addEventListener(
    'scroll',
    () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    },
    { passive: true },
  );
  update();
}
