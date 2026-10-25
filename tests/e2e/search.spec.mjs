// Search: filtering rows, highlighting, match navigation, nested matches.
import { test, expect, openTable } from './support/extension.mjs';

const ROWS = [
    { name: 'Avery', city: 'Zurich', orders: [{ sku: 'A-1', qty: 1 }, { sku: 'B-2', qty: 2 }] },
    { name: 'Blake', city: 'Bern', orders: [{ sku: 'C-3', qty: 1 }, { sku: 'D-4', qty: 9 }] },
    { name: 'Casey', city: 'Zug', orders: [] },
];

test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

async function search(container, text) {
    await container.locator('#json2table-search').fill(text);
}

test('typing filters rows, highlights matches and counts them', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await search(container, 'zu');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(2);
    await expect(container.locator('#json2table-rowcount')).toHaveText('2 of 3 rows');
    await expect(container.locator('mark.search-highlight')).toHaveText(['Zu', 'Zu']);
    await expect(container.locator('#json2table-search-count')).toHaveText('1 of 2');
});

test('next/previous move between matches and wrap around', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await search(container, 'e');
    const current = container.locator('mark.search-highlight.is-current');
    const count = container.locator('#json2table-search-count');
    await expect(count).toHaveText(/^1 of \d+$/);
    const total = Number((await count.textContent()).split(' of ')[1]);

    await container.getByRole('button', { name: 'Next match' }).click();
    await expect(count).toHaveText(`2 of ${total}`);
    await container.getByRole('button', { name: 'Previous match' }).click();
    await container.getByRole('button', { name: 'Previous match' }).click();
    await expect(count).toHaveText(`${total} of ${total}`);
    await expect(current).toHaveCount(1);

    await container.locator('#json2table-search').press('Enter');
    await expect(count).toHaveText(`1 of ${total}`);
    await container.locator('#json2table-search').press('Shift+Enter');
    await expect(count).toHaveText(`${total} of ${total}`);
});

test('no matches says so and disables navigation', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await search(container, 'nowhere');
    await expect(container.locator('.j2t-empty-state')).toContainText('No matches for “nowhere”');
    await expect(container.locator('.j2t-empty-state')).toContainText('see all 3 rows');
    await expect(container.locator('#json2table-search-count')).toHaveText('no matches');
    await expect(container.getByRole('button', { name: 'Next match' })).toBeDisabled();
});

test('Escape clears the search', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await search(container, 'zu');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(2);
    await container.locator('#json2table-search').press('Escape');
    await expect(container.locator('#json2table-search')).toHaveValue('');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(3);
    await expect(container.locator('#json2table-search-count')).toHaveText('');
});

test('matching a column name keeps every row', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await search(container, 'city');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(3);
});

test('a match inside a collapsed value expands to it, showing only matching items', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await search(container, 'D-4');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(1);
    const sub = container.locator('td[data-col="orders"] table.j2t-subtable');
    await expect(sub.locator('tbody tr')).toHaveCount(1);
    await expect(sub.locator('thead th')).toHaveText(['#', 'Sku']);
    await expect(sub.locator('mark.search-highlight')).toHaveText('D-4');
});

test('a match in a key counts', async ({ page }) => {
    const container = await openTable(page, { profile: { favouriteColour: 'green' }, other: 1 });
    await search(container, 'favourite');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(1);
    await expect(container.locator('tr.j2t-tree-row mark.search-highlight')).toHaveText('favourite');
});

test('Ctrl+F focuses the table search', async ({ page }) => {
    const container = await openTable(page, ROWS);
    await container.locator('td').first().click();
    await page.keyboard.press('Control+f');
    await expect(container.locator('#json2table-search')).toBeFocused();
});
