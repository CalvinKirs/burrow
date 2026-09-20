import { parseDirListing } from '../shared/dirListingParser';
import type { Entry } from '../shared/types';

export interface FileSource {
  listDir(dirUrl: string): Promise<Entry[]>;
  readText(fileUrl: string): Promise<string>;
}

export type Fetcher = (url: string) => Promise<string>;

/** Fetches file:// urls directly from the service worker. */
export const swFetch: Fetcher = async (url) => {
  const res = await fetch(url);
  if (!res.ok && res.status !== 0) throw new Error(`HTTP ${res.status}`);
  return res.text();
};

const OFFSCREEN_URL = 'offscreen.html';
let creatingOffscreen: Promise<void> | null = null;

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  creatingOffscreen ??= chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: [chrome.offscreen.Reason.DOM_PARSER],
      justification: 'Read local Markdown files and directory listings for the workspace sidebar.',
    })
    .finally(() => (creatingOffscreen = null));
  await creatingOffscreen;
}

/** Fetches file:// urls through the offscreen document, where XMLHttpRequest is available. */
export const offscreenFetch: Fetcher = async (url) => {
  await ensureOffscreen();
  const res = await chrome.runtime.sendMessage({ target: 'offscreen', url });
  if (!res?.ok) throw new Error(res?.error ?? 'offscreen fetch failed');
  return res.text as string;
};

const MODE_KEY = 'fileSourceMode';
type Mode = 'sw' | 'offscreen';

/**
 * Tries the service worker fetch first and falls back to the offscreen document. The working
 * mode is remembered for the browser session so the probe only costs one failed request.
 */
export class AutoSource implements FileSource {
  private mode: Mode | null = null;

  private async fetchText(url: string): Promise<string> {
    if (this.mode === null) {
      const stored = await chrome.storage.session.get(MODE_KEY);
      this.mode = (stored[MODE_KEY] as Mode | undefined) ?? null;
    }
    if (this.mode === 'offscreen') return offscreenFetch(url);
    try {
      const text = await swFetch(url);
      if (this.mode === null) this.setMode('sw');
      return text;
    } catch (err) {
      if (this.mode === 'sw') throw err;
      const text = await offscreenFetch(url);
      this.setMode('offscreen');
      return text;
    }
  }

  private setMode(mode: Mode): void {
    this.mode = mode;
    void chrome.storage.session.set({ [MODE_KEY]: mode });
  }

  async listDir(dirUrl: string): Promise<Entry[]> {
    return parseDirListing(await this.fetchText(dirUrl), dirUrl);
  }

  readText(fileUrl: string): Promise<string> {
    return this.fetchText(fileUrl);
  }
}
