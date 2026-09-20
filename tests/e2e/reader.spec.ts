import { expect, fileUrl, test } from './fixtures';

test('renders markdown with an outline that tracks headings', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('README.md'));

  await expect(page).toHaveTitle('Rabbit Workspace');
  await expect(page.locator('.bw-article h1')).toHaveText('Rabbit Workspace');
  await expect(page.locator('.bw-article .hljs-keyword').first()).toHaveText('const');
  await expect(page.locator('.bw-article li.bw-task input')).toHaveCount(2);
  await expect(page.locator('.bw-article td')).toHaveCount(2);

  const items = page.locator('.bw-outline-item');
  await expect(items).toHaveText(['Rabbit Workspace', 'Getting Started', 'Requirements', 'Code', 'Getting Started']);

  await items.nth(3).click();
  await expect(page.locator('#code')).toBeInViewport();
  await expect(items.nth(3)).toHaveClass(/bw-active/);
  expect(page.url()).toContain('#code');
});

test('lists the workspace, hides ignored entries and switches files', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('README.md'));

  const rows = page.locator('.bw-tree > * > .bw-row, .bw-tree > .bw-row');
  await expect(rows).toHaveText(['Café Notes', 'guide', 'notes', 'README.md']);
  await expect(page.locator('.bw-current')).toHaveText('README.md');
  await expect(page.locator('.bw-root-name')).toHaveText('workspace');

  await page.locator('.bw-dir', { hasText: 'guide' }).click();
  await page.locator('.bw-file', { hasText: 'install.md' }).click();
  await expect(page).toHaveURL(fileUrl('guide/install.md'));
  await expect(page.locator('.bw-article h1')).toHaveText('Install');
});

test('keeps a moved-up root and the expanded folders across navigation', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('guide/install.md'));
  await expect(page.locator('.bw-root-name')).toHaveText('guide');
  await expect(page.locator('.bw-btn[title^="Reset"]')).toBeHidden();

  await page.locator('.bw-btn[title^="Move workspace root"]').click();
  await expect(page.locator('.bw-root-name')).toHaveText('workspace');
  await expect(page.locator('.bw-current')).toHaveText('install.md');

  // Deep file: the saved root still applies and the path to the file is expanded.
  await page.locator('.bw-dir', { hasText: 'advanced' }).click();
  await page.locator('.bw-file', { hasText: 'tuning.md' }).click();
  await expect(page).toHaveURL(fileUrl('guide/advanced/tuning.md'));
  await expect(page.locator('.bw-root-name')).toHaveText('workspace');
  await expect(page.locator('.bw-current')).toHaveText('tuning.md');

  await page.locator('.bw-btn[title^="Reset"]').click();
  await expect(page.locator('.bw-root-name')).toHaveText('advanced');
});

test('searches the workspace and jumps to the matching line', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('README.md'));

  await expect(page.locator('.bw-current')).toBeVisible();
  await page.keyboard.press('Alt+KeyK');
  await expect(page.locator('.bw-search-input')).toBeFocused();
  await page.keyboard.type('xylophone');

  const files = page.locator('.bw-hit-file');
  // Breadth-first: shallower files come before deeper ones.
  await expect(files).toHaveText(['Café Notes/résumé (1).md', 'guide/install.md', 'guide/advanced/tuning.md']);
  await expect(page.locator('.bw-status')).toContainText('3 results');
  await expect(page.locator('.bw-status')).toContainText('6 files indexed');

  await page.locator('.bw-hit-line', { hasText: 'secret word' }).click();
  await expect(page.locator('.bw-article h1')).toHaveText('Install');
  await expect(page.locator('mark.bw-hit')).toHaveText('xylophone');
  await expect(page.locator('mark.bw-hit')).toBeInViewport();

  // The query and results survive the jump, with the opened hit marked.
  await expect(page.locator('.bw-search-input')).toHaveValue('xylophone');
  await expect(page.locator('.bw-hit-current')).toContainText('xylophone');

  // File name search; the workspace is now guide/, so paths are relative to it.
  await page.locator('.bw-search-input').fill('tuning');
  await expect(page.locator('.bw-hit-file')).toHaveText(['advanced/tuning.md']);
});

test('opens files whose names need url encoding', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('README.md'));
  await page.locator('.bw-dir', { hasText: 'Café Notes' }).click();
  await page.locator('.bw-file', { hasText: 'résumé (1).md' }).click();
  await expect(page.locator('.bw-article h1')).toHaveText('Bonjour');
  await expect(page.locator('.bw-current')).toHaveText('résumé (1).md');
  await expect(page.locator('.bw-root-name')).toHaveText('Café Notes');
});

test('hides sidebars with buttons and shortcuts and remembers the choice', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('README.md'));
  const right = page.locator('.bw-right');
  const left = page.locator('.bw-left');
  await expect(right).toBeVisible();

  await page.locator('.bw-toggle-right').click();
  await expect(right).toBeHidden();
  await page.keyboard.press('Alt+BracketLeft');
  await expect(left).toBeHidden();

  await page.goto(fileUrl('notes/todo.md'));
  await expect(page.locator('.bw-article h1')).toHaveText('Todo');
  await expect(page.locator('.bw-right')).toBeHidden();
  await expect(page.locator('.bw-left')).toBeHidden();

  await page.keyboard.press('Alt+BracketRight');
  await expect(page.locator('.bw-right')).toBeVisible();
});

test('cycles themes and toggles the raw view', async ({ context }) => {
  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(fileUrl('README.md'));
  const html = page.locator('html');
  await expect(html).toHaveAttribute('data-bw-theme', 'light');
  await page.locator('.bw-theme-btn').click(); // auto → light
  await page.locator('.bw-theme-btn').click(); // light → dark
  await expect(html).toHaveAttribute('data-bw-theme', 'dark');

  await page.locator('.bw-raw-btn').click();
  await expect(page.locator('.bw-raw')).toContainText('# Rabbit Workspace');
  await expect(page.locator('.bw-article')).toBeHidden();
});

test('renders mermaid diagrams and reports broken ones in place', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('notes/diagram.md'));
  await expect(page.locator('.bw-mermaid-done svg')).toHaveCount(1);
  await expect(page.locator('.bw-mermaid-done svg')).toContainText('Carrot');
  await expect(page.locator('.bw-mermaid-failed pre')).toContainText('this is not valid mermaid');
  await expect(page.locator('.bw-mermaid-failed .bw-error')).toBeVisible();
});

test('leaves non-markdown files alone', async ({ context }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('plain.txt'));
  await expect(page.locator('body > pre')).toContainText('not markdown');
  await expect(page.locator('html')).not.toHaveClass(/bw-root/);
});

test('reads directories straight from the service worker', async ({ context, worker }) => {
  const page = await context.newPage();
  await page.goto(fileUrl('README.md'));
  await expect(page.locator('.bw-current')).toBeVisible();
  const mode = await worker.evaluate(async () => (await chrome.storage.session.get('fileSourceMode')).fileSourceMode);
  expect(mode).toBe('sw');
});
