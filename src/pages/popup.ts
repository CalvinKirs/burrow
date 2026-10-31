import { send } from '../shared/messages';
import { baseName, relPath } from '../shared/paths';
import type { HistoryEntry } from '../shared/types';
import { localize, t } from './i18n';

localize();

// Content scripts cannot run on file:// pages until the user flips this switch by hand.
void chrome.extension.isAllowedFileSchemeAccess().then((allowed) => {
  document.getElementById('ok')!.hidden = !allowed;
  document.getElementById('missing')!.hidden = allowed;
});

document.getElementById('details')!.addEventListener('click', () => {
  void chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` });
});

document.getElementById('options')!.addEventListener('click', () => void chrome.runtime.openOptionsPage());

const history = document.getElementById('history')!;
const search = document.getElementById('history-search') as HTMLInputElement;
const status = document.getElementById('history-status')!;
const clear = document.getElementById('clear-history') as HTMLButtonElement;
let entries: HistoryEntry[] = [];

function renderHistory() {
  const query = search.value.trim().toLocaleLowerCase();
  const matches = entries.filter((entry) =>
    `${entry.title} ${relPath(entry.url, 'file://')}`.toLocaleLowerCase().includes(query),
  );
  clear.disabled = entries.length === 0;
  status.textContent = entries.length === 0 ? t.noHistory : '';
  if (entries.length > 0 && matches.length === 0) status.textContent = t.noHistoryMatches;
  history.replaceChildren();

  for (const entry of matches) {
    const li = document.createElement('li');
    const open = document.createElement('button');
    open.className = 'history-open';
    const name = document.createElement('strong');
    name.textContent = baseName(entry.url);
    const title = document.createElement('span');
    title.className = 'history-title';
    title.textContent = entry.title;
    const path = document.createElement('span');
    path.className = 'history-path';
    path.textContent = relPath(entry.url, 'file://');
    const time = document.createElement('time');
    time.dateTime = new Date(entry.visitedAt).toISOString();
    time.textContent = new Date(entry.visitedAt).toLocaleString();
    open.title = `${entry.title}\n${path.textContent}`;
    open.append(name, title, path, time);
    open.addEventListener('click', async () => {
      try {
        await chrome.tabs.create({ url: entry.url });
        window.close();
      } catch {
        status.textContent = t.openHistoryError;
      }
    });

    const remove = document.createElement('button');
    remove.className = 'history-remove';
    remove.textContent = '×';
    remove.title = `${t.remove}: ${baseName(entry.url)}`;
    remove.setAttribute('aria-label', remove.title);
    remove.addEventListener('click', () => void updateHistory({ type: 'removeVisit', fileUrl: entry.url }));
    li.append(open, remove);
    history.append(li);
  }
}

async function refreshHistory() {
  entries = (await send({ type: 'getHistory' })).entries;
  renderHistory();
}

async function updateHistory(request: { type: 'removeVisit'; fileUrl: string } | { type: 'clearHistory' }) {
  try {
    await send(request);
    await refreshHistory();
  } catch {
    status.textContent = t.historyActionError;
  }
}

search.addEventListener('input', renderHistory);
clear.addEventListener('click', () => void updateHistory({ type: 'clearHistory' }));
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.readingHistory) return;
  void refreshHistory().catch(() => { status.textContent = t.historyError; });
});
void refreshHistory().catch(() => { status.textContent = t.historyError; });
