import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  // Every test launches its own persistent browser profile with the extension loaded.
  workers: 2,
  reporter: [['list']],
});
