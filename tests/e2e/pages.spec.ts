import { expect, fileUrl, test } from './fixtures';

test('options are saved and applied to the reader', async ({ context, worker }) => {
  const id = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await expect(options.locator('label[for=theme]')).toHaveText('Theme');
  await options.locator('#theme').selectOption('dark');
  await options.locator('#ignore').fill('node_modules, notes');
  await options.locator('#ignore').blur();
  // Wait on the stored value, not on the "saved" indicator, which is only visible for a moment.
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.local.get('settings')).settings))
    .toMatchObject({ theme: 'dark', ignore: ['node_modules', 'notes'] });

  const page = await context.newPage();
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(fileUrl('README.md'));
  await expect(page.locator('html')).toHaveAttribute('data-bw-theme', 'dark');
  await expect(page.locator('.bw-tree > * > .bw-row, .bw-tree > .bw-row')).toHaveText(['Café Notes', 'guide', 'README.md']);
});

test('popup reports that file access is available', async ({ context, worker }) => {
  const id = new URL(worker.url()).host;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  await expect(popup.locator('#ok')).toBeVisible();
  await expect(popup.locator('#missing')).toBeHidden();
  await expect(popup.locator('#history-status')).toContainText('No history yet');
  await expect(popup.locator('#clear-history')).toBeDisabled();
});

test('popup finds and reopens persisted reading history, and removes or clears entries', async ({ context, worker }) => {
  const id = new URL(worker.url()).host;
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${id}/popup.html`);
  const reader = await context.newPage();
  await reader.goto(fileUrl('README.md'));
  await expect(popup.locator('.history-open strong')).toHaveText(['README.md']);
  await reader.goto(fileUrl('Café Notes/résumé (1).md'));
  await expect(popup.locator('.history-open strong')).toHaveText(['résumé (1).md', 'README.md']);
  await reader.goto(`${fileUrl('README.md')}#getting-started`);
  await expect(popup.locator('.history-open strong')).toHaveText(['README.md', 'résumé (1).md']);
  await reader.goto(fileUrl('plain.txt'));
  await reader.close();

  await popup.reload();
  await expect(popup.locator('.history-open strong')).toHaveText(['README.md', 'résumé (1).md']);
  await expect(popup.locator('.history-open').first()).toContainText('Rabbit Workspace');
  await expect(popup.locator('.history-path').first()).toContainText('/workspace/README.md');
  await expect(popup.locator('time').first()).not.toBeEmpty();
  await popup.locator('#history-search').fill('missing document');
  await expect(popup.locator('#history-status')).toHaveText('No matching files.');
  await popup.locator('#history-search').fill('café notes');
  await expect(popup.locator('.history-open strong')).toHaveText(['résumé (1).md']);
  await popup.locator('#history-search').fill('RABBIT WORKSPACE');
  await expect(popup.locator('.history-open strong')).toHaveText(['README.md']);
  await popup.locator('#history-search').fill('résumé');

  const opened = context.waitForEvent('page');
  await popup.locator('.history-open').click();
  const reopened = await opened;
  await expect(reopened).toHaveURL(fileUrl('Café Notes/résumé (1).md'));
  await expect(reopened.locator('.bw-article h1')).toHaveText('Bonjour');
  await reopened.close();

  const history = await context.newPage();
  await history.goto(`chrome-extension://${id}/popup.html`);
  await expect(history.locator('.history-open strong')).toHaveText(['résumé (1).md', 'README.md']);
  await history.getByRole('button', { name: 'Remove: résumé (1).md', exact: true }).click();
  await expect(history.locator('.history-open strong')).toHaveText(['README.md']);
  await history.reload();
  await expect(history.locator('.history-open strong')).toHaveText(['README.md']);
  await history.locator('#clear-history').click();
  await expect(history.locator('#history-status')).toContainText('No history yet');
  await history.reload();
  await expect(history.locator('.history-open')).toHaveCount(0);
  await expect(history.locator('#clear-history')).toBeDisabled();
});
