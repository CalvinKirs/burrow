import { loadSettings, saveSettings } from '../shared/settings';
import type { Request, ResponseMap } from '../shared/types';
import { AutoSource } from './fileSource';
import { SearchIndex } from './searchIndex';
import { addRoot, filterAndSort, removeRootsFor, resolveRoot } from './workspace';

const source = new AutoSource();

// One index per workspace root; lost when the worker is recycled and rebuilt on demand.
const indexes = new Map<string, Promise<SearchIndex>>();

function getIndex(root: string, rebuild: boolean): Promise<SearchIndex> {
  let pending = rebuild ? undefined : indexes.get(root);
  if (!pending) {
    pending = (async () => {
      const { ignore, maxFiles } = await loadSettings();
      const index = new SearchIndex(source, { ignore, maxFiles });
      await index.build(root);
      return index;
    })();
    indexes.set(root, pending);
    pending.catch(() => indexes.delete(root));
  }
  return pending;
}

async function handle(req: Request): Promise<ResponseMap[Request['type']]> {
  switch (req.type) {
    case 'resolveRoot': {
      const { savedRoots } = await loadSettings();
      return { root: resolveRoot(req.fileUrl, savedRoots) };
    }
    case 'listChildren': {
      const { ignore } = await loadSettings();
      return { entries: filterAndSort(await source.listDir(req.dirUrl), ignore) };
    }
    case 'setRoot': {
      const { savedRoots } = await loadSettings();
      await saveSettings({ savedRoots: addRoot(savedRoots, req.root) });
      return { ok: true };
    }
    case 'resetRoot': {
      const { savedRoots } = await loadSettings();
      await saveSettings({ savedRoots: removeRootsFor(savedRoots, req.fileUrl) });
      return { ok: true };
    }
    case 'search': {
      const index = await getIndex(req.root, req.rebuild === true);
      return { hits: index.query(req.q), indexed: index.indexed, truncated: index.truncated };
    }
  }
}

chrome.runtime.onMessage.addListener((msg: Request & { target?: string }, _sender, sendResponse) => {
  if (msg.target === 'offscreen') return false;
  handle(msg).then(
    (data) => sendResponse({ ok: true, data }),
    (err: unknown) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
  );
  return true;
});
