export interface Entry {
  name: string;
  url: string;
  isDir: boolean;
  size: number;
  mtime: number;
}

/** A search hit. `line` is 1-based; 0 means the file name matched. */
export interface Hit {
  url: string;
  rel: string;
  line: number;
  snippet: string;
}

export interface Heading {
  level: number;
  text: string;
  id: string;
}

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  leftOpen: boolean;
  rightOpen: boolean;
  leftWidth: number;
  rightWidth: number;
  ignore: string[];
  maxFiles: number;
  allowHtml: boolean;
  savedRoots: string[];
  /** workspace root url → expanded directory urls */
  expanded: Record<string, string[]>;
}

export interface SearchResult {
  hits: Hit[];
  indexed: number;
  truncated: boolean;
}

export type Request =
  | { type: 'resolveRoot'; fileUrl: string }
  | { type: 'listChildren'; dirUrl: string }
  | { type: 'setRoot'; root: string }
  | { type: 'resetRoot'; fileUrl: string }
  | { type: 'search'; root: string; q: string; rebuild?: boolean };

export interface ResponseMap {
  resolveRoot: { root: string };
  listChildren: { entries: Entry[] };
  setRoot: { ok: true };
  resetRoot: { ok: true };
  search: SearchResult;
}

export type Response<T> = { ok: true; data: T } | { ok: false; error: string };
