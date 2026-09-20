import { test as base, chromium, type BrowserContext, type Worker } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const dist = resolve(import.meta.dirname, '../../dist');
export const workspace = resolve(import.meta.dirname, '../fixtures/workspace');
export const fileUrl = (rel: string) => pathToFileURL(join(workspace, rel)).href;

export const test = base.extend<{ context: BrowserContext; worker: Worker }>({
  context: async ({}, use) => {
    const profile = mkdtempSync(join(tmpdir(), 'burrow-'));
    const context = await chromium.launchPersistentContext(profile, {
      channel: 'chromium',
      headless: true,
      locale: 'en-US',
      args: [`--disable-extensions-except=${dist}`, `--load-extension=${dist}`],
    });
    await use(context);
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  },
  worker: async ({ context }, use) => {
    const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
    await use(worker);
  },
});

export const expect = test.expect;
