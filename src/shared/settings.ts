import type { Settings } from './types';

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  leftOpen: true,
  rightOpen: true,
  leftWidth: 260,
  rightWidth: 280,
  ignore: ['node_modules'],
  maxFiles: 2000,
  allowHtml: false,
  savedRoots: [],
  expanded: {},
};

const KEY = 'settings';

export async function loadSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get(KEY);
  return { ...DEFAULT_SETTINGS, ...(stored[KEY] as Partial<Settings> | undefined) };
}

/** Merges `patch` into the stored settings and returns the result. */
export async function saveSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await loadSettings()), ...patch };
  await chrome.storage.local.set({ [KEY]: next });
  return next;
}
