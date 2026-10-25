// How individual values look in the table: types, collapsed containers,
// dates, images and long strings with their full-value dialog.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, openTable, ROOT } from './support/extension.mjs';

test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

test('each value type has its own look', async ({ page }) => {
    const container = await openTable(page, [{ n: null, yes: true, no: false, empty: '', list: [], obj: {}, num: 42 }]);
    const cell = (col) => container.locator(`td[data-col="${col}"]`);
    await expect(cell('n').locator('.null-value')).toHaveText('null');
    await expect(cell('yes').locator('.boolean-value.true')).toHaveText('true');
    await expect(cell('no').locator('.boolean-value.false')).toHaveText('false');
    await expect(cell('empty').locator('.empty-string')).toHaveText('""');
    await expect(cell('list').locator('.j2t-empty-container')).toHaveText('[]');
    await expect(cell('obj').locator('.j2t-empty-container')).toHaveText('{}');
    await expect(cell('num')).toHaveClass(/j2t-numeric/);
});

test('a missing key shows a dash', async ({ page }) => {
    const container = await openTable(page, [{ a: 1, b: 2, c: 3 }, { a: 4, c: 6 }]);
    await expect(container.locator('td[data-col="b"][data-row="1"]')).toHaveText('–');
});

test('a collapsed container shows its size and a preview', async ({ page }) => {
    const container = await openTable(page, [{ id: 1, tags: ['red', 'blue'], owner: { name: 'Avery', age: 30 } }]);
    const tags = container.locator('td[data-col="tags"]');
    await expect(tags.locator('.expandable-array')).toHaveText('[2]');
    await expect(tags.locator('.j2t-preview')).toHaveText('["red", "blue"]');
    await expect(tags.locator('.j2t-twisty')).toHaveAttribute('aria-label', 'Expand tags, 2 items');
    const owner = container.locator('td[data-col="owner"]');
    await expect(owner.locator('.expandable-object')).toHaveText('{2}');
    await expect(owner.locator('.j2t-preview')).toHaveText('{name: "Avery", age: 30}');
});

test('an ISO date is shown as written with the local time on hover', async ({ page }) => {
    const container = await openTable(page, [{ id: 1, at: '2024-05-01T10:20:30.123Z', x: 1 }]);
    const date = container.locator('td[data-col="at"] .date-value');
    await expect(date).toHaveText('2024-05-01T10:20:30.123Z');
    await expect(date).toHaveAttribute('title', /^Local time: .+\d{2}:\d{2}:\d{2}/);
});

test('an image URL shows a thumbnail with a hover preview', async ({ page }) => {
    const png = readFileSync(join(ROOT, 'icons', 'icon-48.png'));
    await page.route('https://img.contoso.com/**', (route) => route.fulfill({ contentType: 'image/png', body: png }));
    const url = 'https://img.contoso.com/products/chair.png?w=200';
    const container = await openTable(page, [{ id: 1, photo: url, x: 1 }]);
    const img = container.locator('td[data-col="photo"] img.inline-image');
    await expect(img).toHaveAttribute('alt', 'chair.png');
    await expect(img).toHaveAttribute('title', url);
    await expect(img).toHaveAttribute('referrerpolicy', 'no-referrer');
    await expect.poll(() => img.evaluate((el) => el.naturalWidth)).toBe(48);

    await img.hover();
    await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue('--mouse-x'))).toMatch(/px$/);
});

test('a base64 image shows its type and size instead of the data', async ({ page }) => {
    const data = readFileSync(join(ROOT, 'icons', 'icon-16.png')).toString('base64');
    const container = await openTable(page, [{ id: 1, icon: data, x: 1 }]);
    await expect(container.locator('td[data-col="icon"] img.inline-image')).toHaveAttribute('alt', /^Base64 PNG \(\d+KB\)$/);
});

test('a long string is cut short, and "Show all" opens the full value', async ({ page }) => {
    const long = `${'word '.repeat(80)}END`;
    const container = await openTable(page, [{ id: 1, text: long, x: 1 }]);
    const cell = container.locator('td[data-col="text"]');
    await expect(cell).not.toContainText('END');
    await cell.getByRole('button', { name: `Show all ${long.length}` }).click();

    const dialog = page.getByRole('dialog', { name: 'Full value' });
    await expect(dialog).toContainText('END');
    await expect(dialog.locator('.modal-close')).toBeFocused();
});

test('the value dialog closes with Escape, the backdrop or the close button', async ({ page }) => {
    const container = await openTable(page, [{ id: 1, text: 'y'.repeat(300), x: 1 }]);
    const open = container.getByRole('button', { name: 'Show all 300' });
    const dialog = page.getByRole('dialog');

    await open.click();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(open).toBeFocused();

    await open.click();
    await page.locator('.modal-backdrop').click({ position: { x: 5, y: 5 } });
    await expect(dialog).toHaveCount(0);

    await open.click();
    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);
});
