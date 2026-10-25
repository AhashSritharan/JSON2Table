// The toolbar popup: settings, the paste box, and converting the current page.
//
// The popup runs here as a tab, so "the active tab" would be the popup itself.
// Tests that need it to act on another tab point chrome.tabs.query at that
// tab; everything else — messaging, storage, the content script — is real.
import { test, expect, serveJson, openTable, tabIdOf, downloaded } from './support/extension.mjs';

async function openPopup(page, extensionId) {
    await page.goto(`chrome-extension://${extensionId}/popup.html`);
    await expect(page.locator('#jsonInput')).toBeVisible();
    return page;
}

/** Settings are a collapsed <details>; open them as a user would. */
async function openSettings(popup) {
    await popup.getByText('Settings', { exact: true }).click();
    await expect(popup.locator('#themeSelect')).toBeVisible();
}

/**
 * Opens the popup in a new tab that acts on `target`'s tab. The tab carries
 * its URL, as the activeTab grant from a real toolbar click provides.
 */
async function popupFor(target, { extensionContext, extensionId, serviceWorker }) {
    const tabId = await tabIdOf(target, serviceWorker);
    const popup = await openPopup(await extensionContext.newPage(), extensionId);
    await popup.evaluate(({ id, url }) => {
        chrome.tabs.query = (query, callback) => {
            const tabs = chrome.tabs.get(id).then((tab) => [{ ...tab, url }]);
            if (callback) tabs.then(callback);
            return tabs;
        };
    }, { id: tabId, url: target.url() });
    return popup;
}

const stored = (serviceWorker, keys) => serviceWorker.evaluate((k) => chrome.storage.local.get(k), keys);

test.describe('settings', () => {
    test('show the defaults, and save the locale CSV delimiter', async ({ page, extensionId, serviceWorker }) => {
        await openPopup(page, extensionId);
        await expect(page.locator('#autoConvertToggle')).toHaveClass(/active/);
        await expect(page.locator('#autoExpandToggle')).toHaveClass(/active/);
        await expect(page.locator('#themeSelect')).toHaveValue('system');
        await expect(page.locator('#densitySelect')).toHaveValue('comfortable');
        await expect(page.locator('#csvDelimiterSelect')).toHaveValue(',');
        await expect.poll(() => stored(serviceWorker, ['csvDelimiter'])).toEqual({ csvDelimiter: ',' });
    });

    test('show what is stored', async ({ page, extensionId, settings }) => {
        await settings({ autoConvert: false, autoExpand: false, themeOverride: 'force_dark', density: 'compact', csvDelimiter: ';' });
        await openPopup(page, extensionId);
        await expect(page.locator('#autoConvertToggle')).not.toHaveClass(/active/);
        await expect(page.locator('#autoExpandToggle')).not.toHaveClass(/active/);
        await expect(page.locator('#themeSelect')).toHaveValue('force_dark');
        await expect(page.locator('#densitySelect')).toHaveValue('compact');
        await expect(page.locator('#csvDelimiterSelect')).toHaveValue(';');
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    });

    test('every change is saved', async ({ page, extensionId, serviceWorker }) => {
        await openPopup(page, extensionId);
        await openSettings(page);
        await page.locator('#autoConvertToggle').click();
        await expect(page.locator('#status')).toHaveText('Settings saved');
        await page.locator('#autoExpandToggle').click();
        await page.locator('#themeSelect').selectOption('force_light');
        await page.locator('#densitySelect').selectOption('compact');
        await page.locator('#csvDelimiterSelect').selectOption(';');
        await expect.poll(() => stored(serviceWorker, ['autoConvert', 'autoExpand', 'themeOverride', 'density', 'csvDelimiter'])).toEqual({
            autoConvert: false, autoExpand: false, themeOverride: 'force_light', density: 'compact', csvDelimiter: ';',
        });
    });

    test('the theme applies to the popup itself', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        await openSettings(page);
        const html = page.locator('html');
        await page.locator('#themeSelect').selectOption('force_dark');
        await expect(html).toHaveAttribute('data-theme', 'dark');
        await page.locator('#themeSelect').selectOption('force_light');
        await expect(html).toHaveAttribute('data-theme', 'light');
        await page.locator('#themeSelect').selectOption('system');
        await expect(html).not.toHaveAttribute('data-theme');
    });

    test('theme, density and delimiter apply live to an open table', async ({ page, settings, extensionContext, extensionId, serviceWorker }) => {
        await settings({ autoExpand: false });
        await page.emulateMedia({ colorScheme: 'light' });
        const container = await openTable(page, [{ a: 1, b: 2, c: 3 }]);
        const popup = await popupFor(page, { extensionContext, extensionId, serviceWorker });
        await openSettings(popup);

        await popup.locator('#themeSelect').selectOption('force_dark');
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim())).toBe('#0f172a');
        await popup.locator('#densitySelect').selectOption('compact');
        await expect(page.locator('html')).toHaveClass(/j2t-compact/);
        await popup.locator('#csvDelimiterSelect').selectOption(';');
        await expect(popup.locator('#status')).toHaveText('Settings saved');

        await container.getByRole('button', { name: 'Export' }).click();
        const { text } = await downloaded(page, () => page.getByRole('menuitem', { name: 'Download CSV' }).click());
        expect(text).toBe('﻿"a";"b";"c"\r\n"1";"2";"3"');
    });
});

test.describe('paste box', () => {
    test('Convert is enabled only with input', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        const convert = page.locator('#convertJson');
        await expect(convert).toBeDisabled();
        await page.locator('#jsonInput').fill('   ');
        await expect(convert).toBeDisabled();
        await page.locator('#jsonInput').fill('{"a":1}');
        await expect(convert).toBeEnabled();
    });

    test('Format pretty-prints valid JSON, keeping numbers as written', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        await page.locator('#jsonInput').fill('{"b":1.0,"a":[1,2]}');
        await page.locator('#formatBtn').click();
        await expect(page.locator('#jsonInput')).toHaveValue('{\n  "b": 1.0,\n  "a": [\n    1,\n    2\n  ]\n}');
        await expect(page.locator('#status')).toHaveText('JSON formatted successfully');
    });

    test('Format explains invalid or missing JSON', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        await page.locator('#formatBtn').click();
        await expect(page.locator('#status')).toHaveText('Please enter JSON data to format');
        await page.locator('#jsonInput').fill('{"a":');
        await page.locator('#formatBtn').click();
        await expect(page.locator('#status')).toHaveText(/^Cannot format - Invalid JSON: /);
        await expect(page.locator('#status')).toHaveClass(/error/);
    });

    test('Clear empties the box', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        await page.locator('#jsonInput').fill('{"a":1}');
        await page.locator('#clearBtn').click();
        await expect(page.locator('#jsonInput')).toHaveValue('');
        await expect(page.locator('#convertJson')).toBeDisabled();
        await expect(page.locator('#jsonInput')).toBeFocused();
    });

    test('Paste fills the box from the clipboard', async ({ page, extensionId, extensionContext }) => {
        // Extension origins are opaque to grantPermissions; grant everywhere.
        await extensionContext.grantPermissions(['clipboard-read', 'clipboard-write']);
        await openPopup(page, extensionId);
        await page.evaluate(() => navigator.clipboard.writeText('[{"x": 1}]'));
        await page.locator('#pasteBtn').click();
        await expect(page.locator('#jsonInput')).toHaveValue('[{"x": 1}]');
        await expect(page.locator('#convertJson')).toBeEnabled();
    });

    test('Convert refuses invalid JSON', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        await page.locator('#jsonInput').fill('[1, 2');
        await page.locator('#convertJson').click();
        await expect(page.locator('#status')).toHaveText(/^Invalid JSON: /);
    });

    test('Convert opens the viewer with the JSON', async ({ page, extensionId, extensionContext }) => {
        await openPopup(page, extensionId);
        await page.locator('#jsonInput').fill('[{"city":"Zurich","zip":"8000","canton":"ZH"},{"city":"Bern","zip":"3000","canton":"BE"}]');
        const [viewer] = await Promise.all([extensionContext.waitForEvent('page'), page.locator('#convertJson').click()]);
        await expect(viewer).toHaveURL(new RegExp(`^chrome-extension://${extensionId}/viewer\\.html#data=json2table_data_\\d+$`));
        await expect(viewer.locator('td[data-col="city"]')).toHaveText(['Zurich', 'Bern']);
        await viewer.close();
    });

    test('opening the popup removes viewer data older than five minutes', async ({ page, extensionId, settings, serviceWorker }) => {
        const old = `json2table_data_${Date.now() - 10 * 60_000}`;
        const fresh = `json2table_data_${Date.now()}`;
        await settings({ [old]: '[]', [fresh]: '[]', unrelated: 1 });
        await openPopup(page, extensionId);
        await expect.poll(async () => Object.keys(await stored(serviceWorker, null)).sort())
            .toEqual(['csvDelimiter', fresh, 'unrelated'].sort());
    });
});

test.describe('Convert current page', () => {
    test('converts JSON the auto-convert setting left alone', async ({ page, settings, extensionContext, extensionId, serviceWorker }) => {
        await settings({ autoConvert: false, autoExpand: false });
        await serveJson(page, 'https://api.contoso.com/users', [{ id: 1, name: 'Avery', x: 1 }]);
        await expect(page.locator('body > pre')).toBeVisible();
        const popup = await popupFor(page, { extensionContext, extensionId, serviceWorker });
        await popup.locator('#detectJson').click();
        await expect(page.locator('#json2tableContainer td[data-col="name"]')).toHaveText('Avery');
    });

    test('converts JSON shown in a <pre> on an HTML page, when asked to', async ({ page, extensionContext, extensionId, serviceWorker }) => {
        await page.route('https://www.contoso.com/', (route) => route.fulfill({
            contentType: 'text/html', body: '<h1>API docs</h1><pre>[{"id": 1, "name": "Avery", "x": 0}]</pre>',
        }));
        await page.goto('https://www.contoso.com/');
        await expect(page.locator('h1')).toBeVisible();
        const popup = await popupFor(page, { extensionContext, extensionId, serviceWorker });
        await popup.locator('#detectJson').click();
        await expect(page.locator('#json2tableContainer td[data-col="name"]')).toHaveText('Avery');
        // The table takes over the page rather than landing below its content.
        await expect(page.locator('h1')).toBeHidden();
        const top = await page.locator('#json2tableContainer').boundingBox();
        expect(top.y).toBe(0);
    });

    test('says why when the page has no JSON', async ({ page, extensionContext, extensionId, serviceWorker }) => {
        await page.route('https://www.contoso.com/', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Hi</h1>' }));
        await page.goto('https://www.contoso.com/');
        const popup = await popupFor(page, { extensionContext, extensionId, serviceWorker });
        await popup.locator('#detectJson').click();
        await expect(popup.locator('#status')).toHaveText('No body>pre found');
    });

    test('refuses pages extensions cannot run on', async ({ page, extensionId }) => {
        await openPopup(page, extensionId);
        await page.locator('#detectJson').click();
        await expect(page.locator('#status')).toHaveText('Cannot run on extension pages. Please navigate to a regular website first.');
    });
});
