import { saveSettings } from '../shared/settings';
import type { Settings, Theme } from '../shared/types';
import { h, icon, ICONS } from './dom';
import { t } from './i18n';

export interface Layout {
  article: HTMLElement;
  leftBody: HTMLElement;
  rightBody: HTMLElement;
  notice(text: string): void;
  focusRight(): void;
  onThemeChange(cb: (dark: boolean) => void): void;
  isDark(): boolean;
}

type Side = 'left' | 'right';

const MIN_WIDTH = 160;
const MAX_WIDTH = 600;
const NARROW = '(max-width: 900px)';
const THEMES: Theme[] = ['auto', 'light', 'dark'];

export function createLayout(source: string, settings: Settings): Layout {
  const root = document.documentElement;
  const narrow = matchMedia(NARROW);
  const prefersDark = matchMedia('(prefers-color-scheme: dark)');
  const themeListeners: ((dark: boolean) => void)[] = [];

  // On narrow screens the sidebars overlay the text, so they start closed and are not persisted.
  const open: Record<Side, boolean> = {
    left: settings.leftOpen && !narrow.matches,
    right: settings.rightOpen && !narrow.matches,
  };
  let theme = settings.theme;

  const leftBody = h('div.bw-side-body');
  const rightBody = h('div.bw-side-body');
  const article = h('article.bw-article');
  const raw = h('pre.bw-raw', { hidden: true }, source);
  const notices = h('div.bw-notices');

  const side = (which: Side, body: HTMLElement) => {
    const resizer = h('div.bw-resizer');
    const el = h(`aside.bw-side.bw-${which}`, {}, body, resizer);
    enableResize(resizer, which);
    return el;
  };

  const button = (cls: string, title: string, path: string, onClick: () => void) => {
    const b = h(`button.bw-btn.${cls}`, { type: 'button', title, 'aria-label': title }, icon(path));
    b.addEventListener('click', onClick);
    return b;
  };

  const themeBtn = button('bw-theme-btn', '', ICONS.theme, () => {
    theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
    applyTheme();
    void saveSettings({ theme });
  });

  const toolbarLeft = h('div.bw-toolbar.bw-toolbar-left', {}, button('bw-toggle-left', t.toggleOutline, ICONS.outline, () => toggle('left')));
  const toolbarRight = h(
    'div.bw-toolbar.bw-toolbar-right',
    {},
    button('bw-raw-btn', t.raw, ICONS.raw, toggleRaw),
    themeBtn,
    button('bw-toggle-right', t.toggleFiles, ICONS.files, () => toggle('right')),
  );

  const main = h('main.bw-main', {}, notices, article, raw);
  const app = h('div.bw-app', {}, side('left', leftBody), main, side('right', rightBody), toolbarLeft, toolbarRight);

  root.classList.add('bw-root');
  document.body.replaceChildren(app);
  root.style.setProperty('--bw-left-w', `${settings.leftWidth}px`);
  root.style.setProperty('--bw-right-w', `${settings.rightWidth}px`);
  applyOpen();
  applyTheme();

  prefersDark.addEventListener('change', applyTheme);
  main.addEventListener('click', () => {
    if (!narrow.matches || (!open.left && !open.right)) return;
    open.left = open.right = false;
    applyOpen();
  });

  document.addEventListener('keydown', (e) => {
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.code === 'BracketLeft') toggle('left');
    else if (e.code === 'BracketRight') toggle('right');
    else if (e.code === 'KeyK') focusRight();
    else return;
    e.preventDefault();
  });

  function isDark(): boolean {
    return theme === 'dark' || (theme === 'auto' && prefersDark.matches);
  }

  function applyTheme() {
    const dark = isDark();
    root.dataset.bwTheme = dark ? 'dark' : 'light';
    const label = { auto: t.themeAuto, light: t.themeLight, dark: t.themeDark }[theme];
    themeBtn.title = t.theme + label;
    themeBtn.dataset.mode = theme;
    themeListeners.forEach((cb) => cb(dark));
  }

  function applyOpen() {
    root.classList.toggle('bw-left-closed', !open.left);
    root.classList.toggle('bw-right-closed', !open.right);
  }

  function toggle(which: Side, force?: boolean) {
    open[which] = force ?? !open[which];
    if (narrow.matches && open[which]) open[which === 'left' ? 'right' : 'left'] = false;
    applyOpen();
    if (!narrow.matches) void saveSettings({ leftOpen: open.left, rightOpen: open.right });
  }

  function toggleRaw() {
    raw.hidden = !raw.hidden;
    article.hidden = !raw.hidden;
  }

  function focusRight() {
    if (!open.right) toggle('right', true);
    rightBody.querySelector<HTMLInputElement>('.bw-search-input')?.focus();
  }

  function enableResize(handle: HTMLElement, which: Side) {
    handle.addEventListener('pointerdown', (down) => {
      down.preventDefault();
      handle.setPointerCapture(down.pointerId);
      root.classList.add('bw-resizing');
      const prop = `--bw-${which}-w`;
      const start = parseInt(getComputedStyle(root).getPropertyValue(prop), 10);
      let width = start;
      const move = (e: PointerEvent) => {
        const delta = which === 'left' ? e.clientX - down.clientX : down.clientX - e.clientX;
        width = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, start + delta));
        root.style.setProperty(prop, `${width}px`);
      };
      const up = () => {
        handle.removeEventListener('pointermove', move);
        root.classList.remove('bw-resizing');
        void saveSettings(which === 'left' ? { leftWidth: width } : { rightWidth: width });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up, { once: true });
    });
  }

  return {
    article,
    leftBody,
    rightBody,
    notice: (text) => notices.append(h('div.bw-notice', {}, text)),
    focusRight,
    onThemeChange: (cb) => themeListeners.push(cb),
    isDark,
  };
}
