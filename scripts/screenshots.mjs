// Regenerates the README screenshots from docs/demo/orchard-handbook. Run `npm run build` first.
import { chromium } from '@playwright/test';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const dist = join(root, 'dist');
const images = join(root, 'docs/images');
const demo = (rel) => pathToFileURL(join(root, 'docs/demo/orchard-handbook', rel)).href;
const VIEWPORT = { width: 1440, height: 900 };

/** Explanatory cards pinned to the bottom of each sidebar, for the annotated hero image. */
function addCallouts() {
  const style = document.createElement('style');
  style.textContent = `
    .shot-card { position: absolute; left: 12px; right: 12px; bottom: 14px; padding: 12px 14px 13px;
      border-radius: 10px; background: #0969da; color: #fff; font: 13px/1.5 -apple-system, 'Segoe UI', sans-serif;
      box-shadow: 0 6px 20px rgb(9 105 218 / 35%); }
    .shot-card b { display: block; margin-bottom: 3px; font-size: 14px; }
    .shot-card kbd { padding: 0 5px; border-radius: 4px; background: rgb(255 255 255 / 22%); font: 12px ui-monospace, monospace; }`;
  document.head.append(style);
  const card = (side, title, html) => {
    const el = document.createElement('div');
    el.className = 'shot-card';
    el.innerHTML = `<b>${title}</b>${html}`;
    document.querySelector(side).append(el);
  };
  card('.bw-left', 'Outline', 'Every heading of the file you are reading. It follows your scroll position; click to jump. Hide with <kbd>Alt</kbd> <kbd>[</kbd>');
  card('.bw-right', 'Workspace', 'The folder is detected from the file you opened. Click any file to switch, search them all, or press ↑ to widen the workspace to the parent folder. Hide with <kbd>Alt</kbd> <kbd>]</kbd>');
}

const profile = mkdtempSync(join(tmpdir(), 'burrow-shots-'));
const context = await chromium.launchPersistentContext(profile, {
  channel: 'chromium',
  headless: true,
  locale: 'en-US',
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
});
const plain = await chromium.launch();

try {
  const page = await context.newPage();
  const shot = (name) => page.screenshot({ path: join(images, name) });
  const settle = () => page.waitForTimeout(400);

  // Widen the workspace from architecture/ to the handbook root once; Burrow remembers it.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(demo('architecture/overview.md'));
  await page.locator('.bw-current').waitFor();
  await page.locator('.bw-btn[title^="Move workspace root"]').click();
  await page.locator('.bw-root-name', { hasText: 'orchard-handbook' }).waitFor();
  await page.locator('.bw-dir', { hasText: 'decisions' }).click();
  await page.locator('.bw-dir', { hasText: 'runbooks' }).click();
  await page.locator('.bw-mermaid-done svg').waitFor();

  // 1. "after" half of the comparison: top of the document, no annotations.
  await settle();
  const after = await page.screenshot();

  // 2. Annotated hero: mid-document, so the outline highlights a nested heading.
  await page.locator('.bw-outline-item', { hasText: 'Request flow' }).click();
  await page.waitForTimeout(900);
  await page.evaluate(addCallouts);
  await shot('overview.png');

  // 3. Search, then jump to a hit in another file (dark theme).
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.reload();
  await page.locator('.bw-current').waitFor();
  await page.locator('.bw-search-input').fill('failover');
  await page.locator('.bw-hit-line', { hasText: 'after a failover' }).click();
  await page.locator('mark.bw-hit').first().waitFor();
  await page.locator('.bw-hit-current').waitFor();
  await page.waitForTimeout(2600); // let the arrival flash fade
  await shot('search.png');

  // 4. Focus mode: both sidebars hidden.
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto(demo('architecture/overview.md'));
  await page.locator('.bw-mermaid-done svg').waitFor();
  await page.keyboard.press('Alt+BracketLeft');
  await page.keyboard.press('Alt+BracketRight');
  await page.locator('.bw-outline-item').first().waitFor({ state: 'hidden' });
  await page.evaluate(() => document.getElementById('components')?.scrollIntoView());
  await settle();
  await shot('focus.png');

  // 5. Before / after: the same file in Chrome without the extension.
  const raw = await plain.newPage({ viewport: { width: 760, height: VIEWPORT.height }, deviceScaleFactor: 2 });
  await raw.goto(demo('architecture/overview.md'));
  const before = await raw.screenshot();

  const data = (buf) => `data:image/png;base64,${buf.toString('base64')}`;
  const board = await plain.newPage({ viewport: { width: 1600, height: 100 }, deviceScaleFactor: 1.5 });
  await board.setContent(`
    <style>
      body { margin: 0; padding: 28px; background: #eef1f5; font: 600 17px -apple-system, 'Segoe UI', sans-serif; color: #1f2328; }
      .row { display: flex; gap: 28px; align-items: flex-start; }
      figure { margin: 0; }
      figcaption { height: 30px; margin-bottom: 12px; display: flex; align-items: center; gap: 10px; }
      figcaption span { font-weight: 400; color: #656d76; }
      figcaption img { width: 26px; height: 26px; }
      .shot { display: block; height: 600px; border-radius: 10px; border: 1px solid #d0d7de; box-shadow: 0 8px 28px rgb(31 35 40 / 12%); }
    </style>
    <div class="row">
      <figure><figcaption>Chrome on its own <span>— a wall of plain text</span></figcaption><img class="shot" src="${data(before)}"></figure>
      <figure><figcaption><img src="data:image/svg+xml;base64,${readFileSync(join(root, 'static/logo.svg')).toString('base64')}">With Burrow <span>— rendered, outlined, and the whole folder one click away</span></figcaption><img class="shot" src="${data(after)}"></figure>
    </div>`);
  await board.locator('.shot').last().evaluate((img) => img.decode());
  await board.locator('body').screenshot({ path: join(images, 'before-after.png') });
} finally {
  await context.close();
  await plain.close();
  rmSync(profile, { recursive: true, force: true });
}
console.log('Wrote docs/images/');
