import { expect, fileUrl, test } from './fixtures';

test('options are saved and applied to the reader', async ({ context, worker }) => {
  const id = new URL(worker.url()).host;
  const options = await context.newPage();
  await options.goto(`chrome-extension://${id}/options.html`);
  await expect(options.locator('label[for=theme]')).toHaveText('Theme');
  await options.locator('#theme').selectOption('dark');
  await options.locator('#ignore').fill('node_modules, notes');
  await options.locator('#ignore').blur();
  await expect(options.locator('#saved')).toHaveClass(/show/);

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
});
