// The browser the tests run in: a fresh profile with the extension loaded
// unpacked, shared by every test of a worker. Each test gets its own tab and
// empty extension storage, and fails if the extension logged or threw an error
// while it ran. The extension is loaded from a copy (see prepare.mjs).
import { test as base, expect, chromium } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { prepareExtension } from './prepare.mjs';

export { ROOT, SHIPPED, manifest } from './prepare.mjs';

export const test = base.extend({
    extensionContext: [async ({ headless }, use) => {
        const extensionDir = prepareExtension();
        const profileDir = mkdtempSync(join(tmpdir(), 'j2t-e2e-profile-'));
        const context = await chromium.launchPersistentContext(profileDir, {
            channel: 'chromium',
            // Headless unless run with --headed. Extensions need the new
            // headless mode, which only Playwright's own Chromium has.
            headless,
            viewport: { width: 1400, height: 900 },
            // CI's container runs as root, where Chromium cannot sandbox.
            chromiumSandbox: !process.env.CI,
            args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
        });
        await use(context);
        await context.close();
        rmSync(extensionDir, { recursive: true, force: true });
        rmSync(profileDir, { recursive: true, force: true });
    }, { scope: 'worker' }],

    serviceWorker: [async ({ extensionContext }, use) => {
        const worker = extensionContext.serviceWorkers()[0]
            ?? await extensionContext.waitForEvent('serviceworker', { timeout: 15_000 });
        await use(worker);
    }, { scope: 'worker' }],

    extensionId: [async ({ serviceWorker }, use) => {
        await use(new URL(serviceWorker.url()).host);
    }, { scope: 'worker' }],

    // Settings from the previous test must not leak in. Both `page` and
    // `settings` depend on this, so the reset always comes first.
    freshStorage: async ({ serviceWorker }, use) => {
        await serviceWorker.evaluate(() => chrome.storage.local.clear());
        await use();
    },

    /** Sets extension settings (chrome.storage.local) before the page under test loads. */
    settings: async ({ serviceWorker, freshStorage }, use) => {
        await use((values) => serviceWorker.evaluate((v) => chrome.storage.local.set(v), values));
    },

    // Errors the extension caused in the current tab, and requests nothing in
    // the test answered. Tests that expect an error can empty the array before
    // the fixture checks it.
    problems: async ({}, use) => {
        await use({ consoleErrors: [], strays: [] });
    },

    page: async ({ extensionContext, freshStorage, problems }, use, testInfo) => {
        const page = await extensionContext.newPage();
        // Nothing reaches the network: a request no test route answers is
        // aborted and fails the test. Routes added later take precedence.
        await page.route(/^https?:/, (route) => {
            problems.strays.push(`${route.request().method()} ${route.request().url()}`);
            return route.abort();
        });
        page.on('console', (msg) => {
            if (msg.type() === 'error' && msg.location().url.startsWith('chrome-extension://')) problems.consoleErrors.push(msg.text());
        });
        page.on('pageerror', (error) => {
            if (/chrome-extension:\/\//.test(error.stack ?? '')) problems.consoleErrors.push(error.message);
        });

        await use(page);

        if (testInfo.status !== testInfo.expectedStatus) {
            await testInfo.attach('screenshot', { body: await page.screenshot().catch(() => Buffer.alloc(0)), contentType: 'image/png' });
        }
        await page.close();
        expect(problems.consoleErrors, 'errors the extension logged').toEqual([]);
        expect(problems.strays, 'requests no route answered').toEqual([]);
    },
});

/**
 * Serves `data` as a JSON document and waits for the extension to turn it
 * into the table viewer. Returns the viewer's container.
 */
export async function openTable(page, data, url = 'https://api.contoso.com/data') {
    await serveJson(page, url, data);
    const container = page.locator('#json2tableContainer');
    await expect(container.locator('#json2table-table-container')).toBeVisible();
    return container;
}

/** The text a download saved, and its suggested file name. */
export async function downloaded(page, trigger) {
    const [download] = await Promise.all([page.waitForEvent('download'), trigger()]);
    const stream = await download.createReadStream();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return { name: download.suggestedFilename(), text: Buffer.concat(chunks).toString('utf8') };
}

/** The extension tab id of `page`, which must be in front. */
export async function tabIdOf(page, serviceWorker) {
    await page.bringToFront();
    return serviceWorker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0].id);
}

/**
 * Serves `body` at `url` in this tab — the way an API or a .json file would
 * reach the browser. Chrome renders an application/json document itself;
 * that rendering is what the content script sees.
 */
export async function serveJson(page, url, body, contentType = 'application/json') {
    await page.route(url, (route) => route.fulfill({ status: 200, contentType, body: typeof body === 'string' ? body : JSON.stringify(body) }));
    await page.goto(url);
}

export { expect };
