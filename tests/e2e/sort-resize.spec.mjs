// Sorting by column (record tables) or by key (property/value trees), and
// resizing columns.
import { test, expect, openTable } from './support/extension.mjs';

const ROWS = [
    { name: 'item10', price: 5, note: null },
    { name: 'item2', price: 30, note: 'b' },
    { name: 'Item1', price: 12, note: 'a' },
];

test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

test('clicking a header sorts ascending, descending, then back to the original order', async ({ page }) => {
    const container = await openTable(page, ROWS);
    const header = container.locator('th[data-col="price"]');
    const prices = container.locator('td[data-col="price"]');

    await header.locator('[data-sort-col]').click();
    await expect(prices).toHaveText(['5', '12', '30']);
    await expect(header).toHaveAttribute('aria-sort', 'ascending');

    await header.locator('[data-sort-col]').click();
    await expect(prices).toHaveText(['30', '12', '5']);
    await expect(header).toHaveAttribute('aria-sort', 'descending');

    await header.locator('[data-sort-col]').click();
    await expect(prices).toHaveText(['5', '30', '12']);
    await expect(header).toHaveAttribute('aria-sort', 'none');
});

test('text sorts naturally, and empty values go last', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await container.locator('[data-sort-col="name"]').click();
    await expect(container.locator('td[data-col="name"]')).toHaveText(['Item1', 'item2', 'item10']);
    await container.locator('[data-sort-col="note"]').click();
    await expect(container.locator('td[data-col="note"]')).toHaveText(['a', 'b', 'null']);
});

test('a header sorts from the keyboard', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await container.locator('[data-sort-col="price"]').focus();
    await page.keyboard.press('Enter');
    await expect(container.locator('td[data-col="price"]')).toHaveText(['5', '12', '30']);
});

test('sorting keeps expanded values expanded', async ({ page }) => {
    const container = await openTable(page, [{ n: 2, o: { k: 'two' }, x: 1 }, { n: 1, o: { k: 'one' }, x: 1 }]);
    await container.locator('td[data-col="o"]', { hasText: 'two' }).locator('.j2t-twisty').click();
    await container.locator('[data-sort-col="n"]').click();
    await expect(container.locator('td[data-col="o"]').last().locator('.j2t-cell-row')).toHaveText(/k\s*two/);
});

test('a property/value tree sorts by key from the toolbar', async ({ page }) => {
    const container = await openTable(page, { b: 1, c: 2, a: 3 });
    const sort = container.locator('#json2table-sort');
    const keys = container.locator('td[data-col="property"]');

    await expect(sort).toHaveAttribute('aria-label', 'Sort keys by name');
    await sort.click();
    await expect(keys).toHaveText(['a', 'b', 'c']);
    await expect(sort).toHaveAttribute('aria-label', 'Sorted A–Z');
    await sort.click();
    await expect(keys).toHaveText(['c', 'b', 'a']);
    await expect(sort).toHaveAttribute('aria-label', 'Sorted Z–A');
    await sort.click();
    await expect(keys).toHaveText(['b', 'c', 'a']);
});

test('a record table has no key-sort button', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await expect(container.locator('#json2table-sort')).toBeHidden();
});

test('dragging a column edge resizes it, down to a minimum', async ({ page }) => {
    const container = await openTable(page, ROWS);
    const header = container.locator('th[data-col="name"]');
    const handle = header.locator('.j2t-col-resizer');
    const before = (await header.boundingBox()).width;
    const box = await handle.boundingBox();
    const y = box.y + box.height / 2;

    await page.mouse.move(box.x + 1, y);
    await page.mouse.down();
    await page.mouse.move(box.x + 151, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => (await header.boundingBox()).width).toBeGreaterThan(before + 100);

    const box2 = await handle.boundingBox();
    await page.mouse.move(box2.x + 1, y);
    await page.mouse.down();
    await page.mouse.move(box2.x - 1000, y, { steps: 5 });
    await page.mouse.up();
    await expect.poll(async () => Math.round((await header.boundingBox()).width)).toBeGreaterThanOrEqual(60);
    expect((await header.boundingBox()).width).toBeLessThan(before);
});

test('the last column has no resize handle', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await expect(container.locator('th[data-col="note"] .j2t-col-resizer')).toHaveCount(0);
});
