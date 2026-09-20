import { relPath } from '../shared/paths';
import type { Hit } from '../shared/types';
import type { FileSource } from './fileSource';
import { filterAndSort } from './workspace';

const MAX_FILE_BYTES = 1_000_000;
const MAX_HITS_PER_FILE = 5;
const MAX_HITS = 200;
const SNIPPET_LEAD = 16;
const SNIPPET_LEAD_MAX = 24;
const SNIPPET_MAX = 160;
const READ_CONCURRENCY = 8;

interface Doc {
  url: string;
  rel: string;
  relLower: string;
  lines: string[];
  linesLower: string[];
}

export interface SearchIndexOptions {
  ignore: string[];
  maxFiles: number;
}

export class SearchIndex {
  private docs: Doc[] = [];
  truncated = false;

  constructor(
    private source: FileSource,
    private options: SearchIndexOptions,
  ) {}

  get indexed(): number {
    return this.docs.length;
  }

  /** Breadth-first crawl from `root`, reading every markdown file up to the configured limits. */
  async build(root: string): Promise<void> {
    this.docs = [];
    this.truncated = false;
    const files: string[] = [];
    const queue = [root];
    crawl: while (queue.length > 0) {
      const dir = queue.shift()!;
      let entries;
      try {
        entries = filterAndSort(await this.source.listDir(dir), this.options.ignore);
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isDir) {
          queue.push(entry.url);
        } else if (entry.size <= MAX_FILE_BYTES) {
          if (files.length >= this.options.maxFiles) {
            this.truncated = true;
            break crawl;
          }
          files.push(entry.url);
        }
      }
    }

    const docs: (Doc | null)[] = new Array(files.length).fill(null);
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        try {
          const text = await this.source.readText(files[i]);
          const lines = text.split(/\r?\n/);
          const rel = relPath(files[i], root);
          docs[i] = { url: files[i], rel, relLower: rel.toLowerCase(), lines, linesLower: lines.map((l) => l.toLowerCase()) };
        } catch {
          // unreadable file: leave it out of the index
        }
      }
    };
    await Promise.all(Array.from({ length: READ_CONCURRENCY }, worker));
    this.docs = docs.filter((d): d is Doc => d !== null);
  }

  query(q: string): Hit[] {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    const nameHits: Hit[] = [];
    const lineHits: Hit[] = [];
    for (const doc of this.docs) {
      if (doc.relLower.includes(needle)) nameHits.push({ url: doc.url, rel: doc.rel, line: 0, snippet: doc.rel });
      let perFile = 0;
      for (let i = 0; i < doc.lines.length && perFile < MAX_HITS_PER_FILE; i++) {
        const at = doc.linesLower[i].indexOf(needle);
        if (at === -1) continue;
        lineHits.push({ url: doc.url, rel: doc.rel, line: i + 1, snippet: snippet(doc.lines[i], at, needle.length) });
        perFile++;
      }
      if (nameHits.length + lineHits.length >= MAX_HITS + MAX_HITS_PER_FILE) break;
    }
    return [...nameHits, ...lineHits].slice(0, MAX_HITS);
  }
}

/** Keeps the match near the start of the snippet so it stays visible in a narrow sidebar. */
function snippet(line: string, at: number, len: number): string {
  const lead = line.length - line.trimStart().length;
  const start = at - lead > SNIPPET_LEAD_MAX ? at - SNIPPET_LEAD : lead;
  const end = Math.min(line.length, Math.max(at + len, start + SNIPPET_MAX));
  return (start > lead ? '…' : '') + line.slice(start, end).trim() + (end < line.trimEnd().length ? '…' : '');
}
