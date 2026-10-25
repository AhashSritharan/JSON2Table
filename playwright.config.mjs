// Browser tests: the unpacked extension in Playwright's Chromium, against
// pages served by page.route on placeholder hosts — no network, no secrets.
// See CLAUDE.md → "The test layers".
import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    // Each worker is one browser with the extension loaded once, shared by its
    // tests; every test gets its own tab and empty extension storage.
    fullyParallel: true,
    workers: process.env.CI ? 2 : 4,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'on-failure' }]],
    use: { trace: 'retain-on-failure' },
});
