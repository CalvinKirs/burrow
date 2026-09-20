# Burrow — Design Notes

## Goal

A Manifest V3 Chrome extension for reading local Markdown files that treats the folder a file
lives in as a workspace:

- The document is rendered in the centre (GFM, syntax highlighting, Mermaid, light and dark themes).
- **Left sidebar:** the heading outline of the current file. It highlights the section being read
  and jumps on click.
- **Right sidebar:** the workspace file tree plus full-text search across the folder. Clicking a
  file switches to it.
- Both sidebars can be hidden and resized, and that state persists.
- There is no setup step. Opening `file:///…/x.md` in Chrome makes the folder containing it the
  workspace.

## Out of scope for the first version

Remote or GitHub sources, an "open folder" picker based on the File System Access API, editing,
KaTeX, and live reload when files change. The `FileSource` interface is the extension point for
the first two.

## Architecture

Three runtime units communicate through `chrome.runtime` messages.

| Unit | Responsibility |
|---|---|
| Content script (injected into Markdown pages under `file://`) | UI only: rendering, outline, file tree and search, layout and theme |
| Background service worker | Data only: reading directories and files, resolving the workspace root, the search index, settings |
| Offscreen document | A fallback `FileSource`, used only if the service worker cannot `fetch('file://…')` |
| Options and popup pages | Settings, and a check that "Allow access to file URLs" is enabled, with instructions |

The source of the current file is taken from the `<pre>` that Chrome generates for plain-text
files, so it is never fetched a second time.

### Reading a folder

Chrome renders `file:///dir/` as a directory listing page containing a series of
`addRow("name","url",isDir,size,"sizeStr",mtime,"mtimeStr")` calls. The background fetches that
page and parses it, so no folder picker or native helper is needed.

Fetching is hidden behind `FileSource`, which has two transports:

1. The service worker calls `fetch(fileUrl)` directly.
2. The offscreen document reads the URL with `XMLHttpRequest` on the worker's behalf.

`AutoSource` probes at runtime: it tries (1) first, falls back to (2) on failure, and records the
working mode in `chrome.storage.session`.

**Validation result:** on Chromium 153 the service worker can fetch a `file://` directory listing
directly (the response has `status` 0). The end-to-end suite asserts that the probe selects `sw`.
The offscreen path is kept as a safety net but is not exercised on that version.

## Modules and interfaces

```ts
interface Entry { name: string; url: string; isDir: boolean; size: number; mtime: number }
interface FileSource {
  listDir(dirUrl: string): Promise<Entry[]>;
  readText(fileUrl: string): Promise<string>;
}
```

| Module | Location | Interface and notes |
|---|---|---|
| `dirListingParser` | `src/shared/` | Pure function `parseDirListing(html, dirUrl) → Entry[]`. Returned URLs are normalised with `canonicalUrl`. |
| `paths` | `src/shared/` | URL helpers: `dirOf`, `parentDir`, `isMarkdown`, `isUnder`, `relPath`, `baseName`, `canonicalUrl` |
| `settings` | `src/shared/` | Defaults plus load and save on `chrome.storage.local` |
| `messages` | `src/shared/` | Typed `send()` wrapper around `chrome.runtime.sendMessage` |
| `workspace` | `src/background/` | `resolveRoot`, `addRoot`, `removeRootsFor`, `filterAndSort` |
| `searchIndex` | `src/background/` | `build(root)` and `query(q) → Hit[]`, where `Hit = { url, rel, line, snippet }` |
| `fileSource` | `src/background/` | `FileSource`, the two transports and `AutoSource` |
| `renderer` | `src/content/` | `render(src) → { html, headings }` using markdown-it, highlight.js and DOMPurify |
| `outline` | `src/content/` | Left sidebar. A scroll listener throttled with `requestAnimationFrame` tracks the active heading; a clicked item stays active until the scroll it caused has finished. |
| `explorer` | `src/content/` | Right sidebar: lazy file tree, search box and result list |
| `highlightHit` | `src/content/` | Scrolls to the line named in a search-hit fragment and marks the query |
| `layout` | `src/content/` | Page skeleton, sidebar toggling and resizing, shortcuts, theme, raw view |

The UI is plain TypeScript and DOM with no framework. Vite builds each entry separately because
they need different output formats: the content script is a single IIFE, the service worker is an
ES module, and the pages are HTML entries. Mermaid is its own ES module (`mermaid.js` plus
chunks), loaded with `import(chrome.runtime.getURL('mermaid.js'))` only when a page contains a
Mermaid block.

### File tree rules

- Only Markdown files (`.md`, `.markdown`, `.mdown`, `.mkd`) and directories are shown.
  Directories come first; names are sorted naturally and case-insensitively.
- Entries starting with `.` are always ignored. `node_modules` is ignored by default and the list
  is editable in the options page.
- Loading is lazy: the root level is listed first and the path to the current file is expanded
  automatically. Other directories are read when they are expanded.
- The set of expanded directories is stored per workspace root in `chrome.storage.local`.

### Workspace root

- By default the root is the directory of the current file.
- The header of the right sidebar shows the root's name and a "move up" button. Moving up stores
  the new root in `savedRoots` and drops any saved roots inside it, so that the longest-prefix
  match below cannot be shadowed by a stale, deeper root.
- When a file is opened, the root is the **longest** entry of `savedRoots` that contains the
  file, or the file's own directory if there is none.
- "Reset" returns to the file's own directory and forgets every saved root that contains the file.

### Search

- The index is built on the first query by crawling the root breadth-first while honouring the
  ignore rules. Limits: 2000 Markdown files by default (configurable) and 1 MB per file.
- The index is an in-memory array of `{ url, rel, lines[] }`. A query is a case-insensitive
  substring match. File-name hits are listed before content hits, with at most 5 line hits per
  file and 200 hits in total.
- Snippets start shortly before the match so that it stays visible in a narrow sidebar.
- Indexes are cached per root in the service worker and rebuilt after the worker is recycled. The
  result list has a "Rebuild index" action.
- A hit links to `fileUrl#bw-line=N&bw-q=query`. On arrival the page scrolls to the block that
  contains source line `N` and marks the query; the renderer tags every block element with
  `data-line` (from markdown-it's `token.map`) for this purpose. The explorer restores the query
  and its results from the fragment and marks the hit that is open, so the next result is one
  click away.

### Switching files

Switching is an ordinary navigation to the target URL. Every `file://` document is its own
origin, so `pushState` cannot change the URL; a real navigation keeps back and forward, reload and
bookmarks working. Sidebar widths, visibility and expanded folders live in storage, so the
sidebars look unchanged after the navigation.

### Layout and interaction

```
┌──────────┬──────────────────────┬───────────┐
│ Outline  │ Document (max 860px) │ Workspace │
└──────────┴──────────────────────┴───────────┘
```

- Shortcuts: `Alt+[` toggles the outline, `Alt+]` toggles the workspace, `Alt+K` focuses search.
- Toggle buttons stay visible at the top corners of the document when a sidebar is hidden.
- Below 900px the sidebars start closed and open as overlays; that state is not persisted.
- The theme cycles between system, light and dark, and is implemented with CSS variables.
- The top-right toolbar also switches between the rendered and the raw view.
- All injected classes and CSS variables use the `bw-` prefix and are scoped under `.bw-root`,
  which is added only after the content script has taken over a page.

## Error handling

| Situation | Behaviour |
|---|---|
| "Allow access to file URLs" is off | The content script is not injected. The popup detects this with `isAllowedFileSchemeAccess()` and shows the steps to enable it. |
| A directory cannot be read or parsed | The right sidebar shows the error with a retry action. The document and the outline are unaffected. |
| The workspace exceeds the file limit | Crawling stops and the search status says only the first N files were indexed. |
| A Markdown file is larger than 2 MB | Syntax highlighting is skipped and a notice is shown. |
| Mermaid syntax error | The block keeps its source and shows the error message below it. |
| The page is not plain-text Markdown | The content script leaves the page alone. |

Security: markdown-it runs with `html: false` by default (it can be enabled in the options), and
the rendered output always passes through DOMPurify.

## Testing

- **Unit tests (Vitest):** `dirListingParser`, `paths`, `workspace`, `searchIndex` (with an
  in-memory `FileSource`), `renderer` (headings, `data-line`, sanitising) and `highlightHit`.
- **End-to-end tests (Playwright, Chromium with the unpacked extension):** rendering and outline,
  the file tree and its ignore rules, switching files, saved roots, search and jumping to a hit,
  file names that need URL encoding, sidebar state across navigation, themes and the raw view,
  Mermaid including a broken diagram, non-Markdown files, the options and popup pages, and the
  `FileSource` probe.
