/**
 * Playwright end-to-end tests: a real browser against the running dev stack.
 *
 * Start the stack first (docs/DEMO.md), then `yarn e2e`. See docs/DEMO.md
 * "End-to-end tests" for the env flags.
 *
 * Why these choices:
 * - Test files end in `.e2e.ts`, not `.spec.ts`/`.test.ts`, so Vitest (which
 *   picks up *.test.* and *.spec.* everywhere) never tries to run them.
 * - One worker, in file order: the tests share one backend, and some of them
 *   flip global switches (open enrollment) that would confuse a parallel test.
 * - No `webServer` block: the Docker stack is started by hand and may already
 *   be running for the demo; Playwright should never start or stop it.
 */
import { defineConfig, devices } from '@playwright/test';
import { BASE_URL } from './e2e/support/env';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // Argon2 password hashing makes each sign-in ~0.5 s on purpose; give each
  // test room for a few of them plus page loads.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
