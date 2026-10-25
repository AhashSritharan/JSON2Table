// The Export menu: CSV and JSON downloads, and copying JSON.
import { test, expect, openTable, downloaded } from './support/extension.mjs';

const SOURCE = '[{"name": "Avery \\"AJ\\"", "price": 10.50, "tags": ["a", "b"], "note": null},'
    + ' {"name": "Blake", "price": 3, "tags": [], "note": "x, y"}]';

test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

async function exportVia(container, item) {
    await container.getByRole('button', { name: 'Export' }).click();
    await container.page().getByRole('menuitem', { name: item }).click();
}

test('the menu opens, and closes with Escape or a click elsewhere', async ({ page }) => {
    const container = await openTable(page, SOURCE);
    const button = container.getByRole('button', { name: 'Export' });
    const menu = page.getByRole('menu');

    await button.click();
    await expect(menu).toBeVisible();
    await expect(button).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('menuitem', { name: 'Download CSV' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(menu).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await container.locator('#json2table-table-container').click({ position: { x: 5, y: 5 } });
    await expect(menu).toBeHidden();

    await button.click();
    await button.click();
    await expect(menu).toBeHidden();
});

test('CSV: quoted values, nested values as JSON, numbers as written, a BOM for Excel', async ({ page }) => {
    const container = await openTable(page, SOURCE);
    const { name, text } = await downloaded(page, () => exportVia(container, 'Download CSV'));
    expect(name).toBe('json-table-export.csv');
    expect(text).toBe('﻿' + [
        '"name","price","tags","note"',
        '"Avery ""AJ""","10.50","[""a"",""b""]",""',
        '"Blake","3","[]","x, y"',
    ].join('\r\n'));
    await expect(page.locator('.j2t-toast')).toHaveText('CSV downloaded');
});

test('CSV uses the delimiter from the settings', async ({ page, settings }) => {
    await settings({ csvDelimiter: ';' });
    const container = await openTable(page, SOURCE);
    const { text } = await downloaded(page, () => exportVia(container, 'Download CSV'));
    expect(text.split('\r\n')[0]).toBe('﻿"name";"price";"tags";"note"');
});

test('CSV exports only the rows the search left, in the sorted order', async ({ page }) => {
    const container = await openTable(page, '[{"n": "b", "v": 1, "x": 0}, {"n": "a", "v": 2, "x": 0}, {"n": "c", "v": 3, "x": 0}]');
    await container.locator('[data-sort-col="n"]').click();
    await container.locator('#json2table-search').fill('2');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(1);
    await container.locator('#json2table-search').fill('');
    await container.locator('#json2table-search').fill('a');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(1);
    const { text } = await downloaded(page, () => exportVia(container, 'Download CSV'));
    expect(text).toBe('﻿"n","v","x"\r\n"a","2","0"');
});

test('JSON download is the original JSON, pretty-printed', async ({ page }) => {
    const container = await openTable(page, SOURCE);
    const { name, text } = await downloaded(page, () => exportVia(container, 'Download JSON'));
    expect(name).toBe('json-table-export.json');
    expect(text).toContain('"price": 10.50');
    expect(JSON.parse(text)).toEqual(JSON.parse(SOURCE));
    await expect(page.locator('.j2t-toast')).toHaveText('JSON downloaded');
});

test('JSON download in a focused view saves the focused value, named after it', async ({ page }) => {
    const container = await openTable(page, '[{"id": 1, "vendor": {"name": "Contoso"}, "x": 1}]');
    await container.locator('td[data-col="vendor"] .focus-btn').click();
    const { name, text } = await downloaded(page, () => exportVia(container, 'Download JSON'));
    expect(name).toBe('json-export-vendor.json');
    expect(JSON.parse(text)).toEqual({ name: 'Contoso' });
});

test('Copy JSON puts the original JSON on the clipboard', async ({ page, extensionContext }) => {
    await extensionContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://api.contoso.com' });
    const container = await openTable(page, SOURCE);
    await exportVia(container, 'Copy JSON');
    await expect(page.locator('.j2t-toast')).toHaveText('JSON copied to clipboard');
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('"price": 10.50');
    expect(JSON.parse(copied)).toEqual(JSON.parse(SOURCE));
});
