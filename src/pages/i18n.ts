export const t = {
  theme: 'Theme',
  themeAuto: 'System',
  themeLight: 'Light',
  themeDark: 'Dark',
  ignore: 'Ignored folder / file names',
  ignoreHint: 'Comma separated. Entries starting with a dot are always ignored.',
  maxFiles: 'Maximum files in the search index',
  allowHtml: 'Render raw HTML inside Markdown',
  allowHtmlHint: 'Scripts and event handlers are still removed.',
  savedRoots: 'Saved workspace roots',
  noRoots: 'None yet. They appear after you use "move root up" in the right sidebar.',
  remove: 'Remove',
  fileAccessOk: 'File access is allowed. Open any local .md file to start reading.',
  fileAccessMissing: 'One more step: allow access to file URLs',
  step1: 'Open the extension details page',
  step2: 'Turn on "Allow access to file URLs"',
  step3: 'Reopen or reload your .md file',
  openDetails: 'Open extension details',
  shortcuts: 'Shortcuts',
  scOutline: 'Toggle outline',
  scFiles: 'Toggle workspace',
  scSearch: 'Search workspace',
  options: 'Options',
};


/** Fills every `[data-i18n]` element with its translation. */
export function localize(): void {
  for (const el of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    el.textContent = t[el.dataset.i18n as keyof typeof t] ?? '';
  }
}
