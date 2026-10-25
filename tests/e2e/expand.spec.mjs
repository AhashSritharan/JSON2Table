// Expanding nested values: in-cell for record tables, as child rows for
// property/value trees; sub-tables, paging, expand/collapse all, auto-expand
// and keyboard navigation.
import { test, expect, openTable } from './support/extension.mjs';

const PRODUCTS = [
    {
        id: 1, name: 'Chair', specs: { weight: 7, color: 'oak' },
        reviews: [{ user: 'Avery', stars: 5 }, { user: 'Blake', stars: 3 }],
        tags: ['wood', 'seat'],
    },
    { id: 2, name: 'Desk', specs: { weight: 30, color: 'white' }, reviews: [], tags: ['office'] },
];

const PROFILE = { name: 'Avery', address: { city: 'Zurich', zip: '8000' }, tags: ['a', 'b'] };

test.describe('with auto-expand off', () => {
    test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

    test('a record table expands an object inside its own cell', async ({ page }) => {
        const container = await openTable(page, PRODUCTS);
        const specs = container.locator('td[data-col="specs"][data-row="0"]');
        await specs.locator('.j2t-twisty').click();
        await expect(specs.locator('.j2t-cell-row')).toHaveText([/weight\s*7/, /color\s*oak/]);
        await expect(specs.locator('.j2t-twisty')).toHaveAttribute('aria-expanded', 'true');

        await specs.locator('.j2t-twisty').click();
        await expect(specs.locator('.j2t-cell-row')).toHaveCount(0);
    });

    test('clicking the size badge expands too', async ({ page }) => {
        const container = await openTable(page, PRODUCTS);
        const tags = container.locator('td[data-col="tags"][data-row="0"]');
        await tags.locator('.expandable-array').click();
        await expect(tags.locator('.j2t-cell-row')).toHaveText([/\[0\]\s*wood/, /\[1\]\s*seat/]);
    });

    test('a uniform array expands to a sub-table, and can switch to a list and back', async ({ page }) => {
        const container = await openTable(page, PRODUCTS);
        const reviews = container.locator('td[data-col="reviews"][data-row="0"]');
        await reviews.locator('.j2t-twisty').click();
        const sub = reviews.locator('table.j2t-subtable');
        await expect(sub.locator('thead th')).toHaveText(['#', 'User', 'Stars']);
        await expect(sub.locator('tbody tr')).toHaveText([/0\s*Avery\s*5/, /1\s*Blake\s*3/]);

        await reviews.getByRole('button', { name: 'Show this array as a list' }).click();
        await expect(reviews.locator('table.j2t-subtable')).toHaveCount(0);
        await expect(reviews.locator('.j2t-cell-row').first()).toContainText('[0]');

        await reviews.getByRole('button', { name: 'Show this array as a table' }).click();
        await expect(reviews.locator('table.j2t-subtable')).toBeVisible();
    });

    test('a property/value tree expands into child rows, level by level', async ({ page }) => {
        const container = await openTable(page, { ...PROFILE, address: { ...PROFILE.address, geo: { lat: 47.3 } } });
        await container.locator('tr', { hasText: 'address' }).locator('.j2t-twisty').click();
        const children = container.locator('tr.j2t-tree-row');
        await expect(children.locator('.j2t-key')).toHaveText(['city', 'zip', 'geo']);
        await expect(children.first()).toHaveAttribute('aria-level', '2');

        await children.filter({ hasText: 'geo' }).locator('.j2t-twisty').click();
        await expect(children.filter({ hasText: 'lat' })).toHaveAttribute('aria-level', '3');

        await container.locator('tr.j2t-root-row', { hasText: 'tags' }).locator('.j2t-twisty').click();
        await expect(children.locator('.j2t-key-index')).toHaveText(['[0]', '[1]']);

        await container.locator('tr.j2t-root-row', { hasText: 'address' }).locator('.j2t-twisty').click();
        await expect(children.locator('.j2t-key')).toHaveText(['[0]', '[1]']);
    });

    test('long lists show 100 children at a time', async ({ page }) => {
        const container = await openTable(page, { name: 'x', list: Array.from({ length: 250 }, (_, i) => `item-${i}`) });
        await container.locator('tr', { hasText: 'list' }).locator('.j2t-twisty').click();
        const children = container.locator('tr.j2t-tree-row');
        await expect(children).toHaveCount(100);
        await container.getByRole('button', { name: 'Show 100 more of 250' }).click();
        await expect(children).toHaveCount(200);
        await container.getByRole('button', { name: 'Show 50 more of 250' }).click();
        await expect(children).toHaveCount(250);
        await expect(container.locator('.j2t-more-btn')).toHaveCount(0);
    });

    test('Expand all / Collapse all toggles everything and says which it will do', async ({ page }) => {
        const container = await openTable(page, PRODUCTS);
        const toggle = container.locator('#json2table-expand-toggle');
        await expect(toggle).toHaveText('Expand all');
        await toggle.click();
        await expect(toggle).toHaveText('Collapse all');
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await expect(container.locator('.j2t-twisty[aria-expanded="false"]')).toHaveCount(0);

        await toggle.click();
        await expect(toggle).toHaveText('Expand all');
        await expect(container.locator('.j2t-twisty[aria-expanded="true"]')).toHaveCount(0);
    });

    test('the keyboard moves through rows and opens and closes them', async ({ page }) => {
        const container = await openTable(page, PROFILE);
        const cursor = container.locator('tr.is-cursor');
        await container.locator('tr', { hasText: 'address' }).locator('td').first().click();
        await expect(cursor).toContainText('address');

        await page.keyboard.press('ArrowRight');
        await expect(container.locator('tr.j2t-tree-row')).toHaveCount(2);
        await page.keyboard.press('ArrowDown');
        await expect(cursor).toContainText('city');
        await page.keyboard.press('ArrowLeft');
        await expect(cursor).toContainText('address');
        await page.keyboard.press('ArrowLeft');
        await expect(container.locator('tr.j2t-tree-row')).toHaveCount(0);

        await page.keyboard.press('Enter');
        await expect(container.locator('tr.j2t-tree-row')).toHaveCount(2);
        await page.keyboard.press('End');
        await expect(cursor).toContainText('tags');
        await page.keyboard.press('Home');
        await expect(cursor).toContainText('name');
        await page.keyboard.press('ArrowUp');
        await expect(cursor).toContainText('name');
    });
});

test('auto-expand (the default) opens everything on load', async ({ page }) => {
    const container = await openTable(page, PRODUCTS);
    await expect(container.locator('#json2table-expand-toggle')).toHaveText('Collapse all');
    await expect(container.locator('table.j2t-subtable')).toBeVisible();
    await expect(container.locator('.j2t-twisty[aria-expanded="false"]')).toHaveCount(0);
});

test('nesting deeper than a cell can hold opens in a dialog', async ({ page }) => {
    const deep = { l1: { l2: { l3: { l4: { l5: { l6: 'bottom' } } } } } };
    const container = await openTable(page, [{ id: 1, deep, x: 1 }]);
    await container.getByRole('button', { name: 'Open remaining levels' }).click();
    await expect(page.getByRole('dialog')).toContainText('l6');
});

test('expanding a huge document stops at a limit and says so', async ({ page }) => {
    const rows = Array.from({ length: 2100 }, (_, i) => ({ id: i, a: { x: i }, b: { y: i } }));
    const container = await openTable(page, rows);
    await expect(page.locator('.j2t-toast.is-warning')).toHaveText(/^Expanded 4000 nodes \(stopped at the limit/);
    await expect(container.locator('#json2table-expand-toggle')).toHaveText('Collapse all');
});
