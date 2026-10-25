// The viewer page the popup opens for pasted JSON.
import { test, expect } from './support/extension.mjs';

async function openViewer(page, extensionId, settings, json) {
    const key = `json2table_data_${Date.now()}`;
    await settings({ [key]: json, autoExpand: false });
    await page.goto(`chrome-extension://${extensionId}/viewer.html#data=${key}`);
    return key;
}

test('shows the stored JSON as a table, in its original key order', async ({ page, extensionId, settings }) => {
    await openViewer(page, extensionId, settings, '{"zeta": 1.0, "alpha": 2}');
    await expect(page.locator('td[data-col="property"]')).toHaveText(['zeta', 'alpha']);
    await expect(page.locator('td[data-col="value"]').first()).toHaveText('1.0');
});

test('removes the stored JSON once loaded', async ({ page, extensionId, settings, serviceWorker }) => {
    const key = await openViewer(page, extensionId, settings, '[{"a": 1, "b": 2, "c": 3}]');
    await expect(page.locator('tr.j2t-root-row')).toHaveCount(1);
    await expect.poll(() => serviceWorker.evaluate((k) => chrome.storage.local.get(k), key)).toEqual({});
});

test('has the full toolbar: search, JSON view and export work there too', async ({ page, extensionId, settings }) => {
    await openViewer(page, extensionId, settings, '[{"city": "Zurich", "n": 1, "x": 0}, {"city": "Bern", "n": 2, "x": 0}]');
    await page.locator('#json2table-search').fill('bern');
    await expect(page.locator('tr.j2t-root-row')).toHaveCount(1);
    await page.getByRole('button', { name: 'JSON', exact: true }).click();
    expect(JSON.parse(await page.locator('#json2table-json-content').textContent())).toEqual([{ city: 'Bern' }]);
});

test('applies the theme setting', async ({ page, extensionId, settings }) => {
    await settings({ themeOverride: 'force_dark' });
    await openViewer(page, extensionId, settings, '{"a": 1}');
    await expect(page.locator('td[data-col="property"]')).toHaveText('a');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim())).toBe('#0f172a');
});

test('explains when the data is gone (e.g. after a reload)', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/viewer.html#data=json2table_data_1`);
    await expect(page.locator('.error-title')).toHaveText('Failed to Load Data');
    await expect(page.locator('.error-message')).toContainText('Data not found');
});

test('explains when opened without data', async ({ page, extensionId }) => {
    await page.goto(`chrome-extension://${extensionId}/viewer.html`);
    await expect(page.locator('.error-message')).toContainText('No data provided');
});

test('shows an error message as text, never as markup', async ({ page, extensionId, settings, problems }) => {
    await openViewer(page, extensionId, settings, '<b id="injected">not json</b>');
    await expect(page.locator('.error-message')).toContainText('<b id="inj');
    await expect(page.locator('#injected')).toHaveCount(0);
    // Unparseable data is unexpected, so the viewer logs it.
    await expect.poll(() => problems.consoleErrors.length).toBe(1);
    problems.consoleErrors.length = 0;
});

test('the Close Tab button closes the viewer', async ({ extensionContext, extensionId }) => {
    const viewer = await extensionContext.newPage();
    await viewer.goto(`chrome-extension://${extensionId}/viewer.html`);
    const closed = viewer.waitForEvent('close');
    await viewer.getByRole('button', { name: 'Close Tab' }).click();
    await closed;
});
