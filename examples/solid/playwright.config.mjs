import { defineConfig } from '@playwright/test';
import { randomUUID } from 'node:crypto';

// Disposable CSS credentials inherited by the test server and workers.
process.env.RS_SOLID_TEST_PASSWORD ||= randomUUID();
export default defineConfig({
  testDir: './tests',
  timeout: 180000,
  expect: { timeout: 15000 },
  workers: 1,
  use: { browserName: 'chromium', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node tests/server.cjs',
    url: 'http://localhost:8787',
    timeout: 60000,
    reuseExistingServer: false
  }
});
