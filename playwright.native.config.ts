import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.native.ts',
  workers: 1,
  timeout: 90_000,
  use: { viewport: { width: 1600, height: 1000 }, trace: 'retain-on-failure' },
});
