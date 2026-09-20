// Renders static/logo.svg into the PNG sizes Chrome needs. Run after changing the logo.
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const svg = readFileSync(resolve(root, 'static/logo.svg'), 'utf8');

const browser = await chromium.launch();
try {
  for (const size of [16, 32, 48, 128]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
    await page.screenshot({ path: resolve(root, `static/icons/${size}.png`), omitBackground: true });
    await page.close();
  }
} finally {
  await browser.close();
}
console.log('Wrote static/icons/');
