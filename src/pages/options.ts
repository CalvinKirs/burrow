import { loadSettings, saveSettings } from '../shared/settings';
import type { Settings, Theme } from '../shared/types';
import { localize, t } from './i18n';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const theme = $<HTMLSelectElement>('theme');
const ignore = $<HTMLInputElement>('ignore');
const maxFiles = $<HTMLInputElement>('maxFiles');
const allowHtml = $<HTMLInputElement>('allowHtml');
const roots = $<HTMLUListElement>('roots');
const saved = $<HTMLSpanElement>('saved');

let savedTimer = 0;

async function save(patch: Partial<Settings>) {
  await saveSettings(patch);
  saved.classList.add('show');
  // Restart the countdown so an earlier save cannot hide the indicator of a later one.
  clearTimeout(savedTimer);
  savedTimer = window.setTimeout(() => saved.classList.remove('show'), 900);
}

function renderRoots(list: string[]) {
  roots.replaceChildren();
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'hint';
    li.textContent = t.noRoots;
    roots.append(li);
    return;
  }
  for (const root of list) {
    const li = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = t.remove;
    button.addEventListener('click', async () => {
      const next = (await loadSettings()).savedRoots.filter((r) => r !== root);
      await save({ savedRoots: next });
      renderRoots(next);
    });
    li.append(button, decodeURI(root.replace(/^file:\/\//, '')));
    roots.append(li);
  }
}

async function init() {
  localize();
  const settings = await loadSettings();
  theme.value = settings.theme;
  ignore.value = settings.ignore.join(', ');
  maxFiles.value = String(settings.maxFiles);
  allowHtml.checked = settings.allowHtml;
  renderRoots(settings.savedRoots);

  theme.addEventListener('change', () => void save({ theme: theme.value as Theme }));
  ignore.addEventListener('change', () => {
    const names = ignore.value.split(',').map((s) => s.trim()).filter(Boolean);
    void save({ ignore: names });
  });
  maxFiles.addEventListener('change', () => {
    const n = Math.min(20000, Math.max(1, Math.round(Number(maxFiles.value)) || 2000));
    maxFiles.value = String(n);
    void save({ maxFiles: n });
  });
  allowHtml.addEventListener('change', () => void save({ allowHtml: allowHtml.checked }));
}

void init();
