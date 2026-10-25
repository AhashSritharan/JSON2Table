// The JSON view: the original text, folding, the shared search, copy.
import { test, expect, openTable } from './support/extension.mjs';

const SOURCE = '{"zeta": 1.0, "alpha": {"list": [1, 2], "deep": {"k": "v"}}, "name": "Zurich"}';
const PRETTY = JSON.stringify(JSON.parse(SOURCE), null, 2).replace('"zeta": 1', '"zeta": 1.0');

test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

async function openJsonView(page, data = SOURCE) {
    const container = await openTable(page, data);
    await container.getByRole('button', { name: 'JSON', exact: true }).click();
    return container;
}

test('the JSON view shows the original JSON, key order and numbers as written', async ({ page }) => {
    const container = await openJsonView(page);
    const pre = container.locator('#json2table-json-content');
    await expect(pre).toBeVisible();
    expect(await pre.textContent()).toBe(PRETTY);
    await expect(container.locator('.j2t-json-toolbar h3')).toHaveText('Original JSON');
    await expect(container.locator('#json2table-table-container')).toBeHidden();
});

test('table-only controls are disabled in the JSON view and come back in the table', async ({ page }) => {
    const container = await openJsonView(page);
    await expect(container.locator('#json2table-expand-toggle')).toBeDisabled();
    await expect(container.locator('#json2table-density')).toBeDisabled();
    await expect(container.getByRole('button', { name: 'JSON', exact: true })).toHaveAttribute('aria-pressed', 'true');

    await container.getByRole('button', { name: 'Table', exact: true }).click();
    await expect(container.locator('#json2table-table-container')).toBeVisible();
    await expect(container.locator('#json2table-json-container')).toBeHidden();
    await expect(container.locator('#json2table-expand-toggle')).toBeEnabled();
});

test('the JSON view toolbar uses the same font as the main toolbar', async ({ page }) => {
    const container = await openJsonView(page);
    const font = (selector) => container.locator(selector).evaluate((el) => getComputedStyle(el).fontFamily);
    const expected = await font('#json2table-export');
    for (const selector of ['#json2table-copy-source', '#json2table-json-expand-all', '.j2t-json-toolbar h3']) {
        expect(await font(selector), selector).toBe(expected);
    }
});

test('objects and arrays fold and unfold', async ({ page }) => {
    const container = await openJsonView(page);
    const folds = container.locator('#json2table-json-content .j2t-fold');
    const alpha = folds.nth(1);

    await alpha.locator(':scope > .j2t-fold-toggle').click();
    await expect(alpha).toHaveClass(/is-collapsed/);
    await expect(alpha.locator(':scope > .j2t-fold-summary')).toHaveAttribute('data-summary', '2 properties');
    await expect(alpha.locator(':scope > .j2t-fold-body')).toBeHidden();

    await alpha.locator(':scope > .j2t-fold-summary').click();
    await expect(alpha).not.toHaveClass(/is-collapsed/);
});

test('Alt+click folds a block and everything inside it', async ({ page }) => {
    const container = await openJsonView(page);
    const folds = container.locator('#json2table-json-content .j2t-fold');
    await folds.nth(1).locator(':scope > .j2t-fold-toggle').click({ modifiers: ['Alt'] });
    for (const i of [1, 2, 3]) await expect(folds.nth(i)).toHaveClass(/is-collapsed/);
});

test('Collapse all keeps the top level open; Expand all opens everything', async ({ page }) => {
    const container = await openJsonView(page);
    const folds = container.locator('#json2table-json-content .j2t-fold');
    await container.getByRole('button', { name: 'Collapse all' }).click();
    await expect(folds.first()).not.toHaveClass(/is-collapsed/);
    await expect(container.locator('.j2t-fold.is-collapsed')).toHaveCount(3);
    await container.getByRole('button', { name: 'Expand all' }).last().click();
    await expect(container.locator('.j2t-fold.is-collapsed')).toHaveCount(0);
});

test('the search filters and highlights the JSON view too', async ({ page }) => {
    const container = await openJsonView(page);
    await container.locator('#json2table-search').fill('zur');
    const pre = container.locator('#json2table-json-content');
    await expect(pre.locator('mark.search-highlight')).toHaveText(['Zur']);
    expect(JSON.parse(await pre.textContent())).toEqual({ name: 'Zurich' });
    await expect(container.locator('.j2t-json-toolbar h3')).toHaveText('Original JSON · filtered by “zur”');
    await expect(container.locator('#json2table-search-count')).toHaveText('1 of 1');

    await container.locator('#json2table-search').fill('nothing-here');
    await expect(container.locator('.j2t-json-toolbar h3')).toContainText('no matches');
    await expect(container.locator('#json2table-search-count')).toHaveText('no matches');
});

test('next/previous step through matches in the JSON view', async ({ page }) => {
    const container = await openJsonView(page, '{"a": "ab", "b": "abc", "c": "x"}');
    await container.locator('#json2table-search').fill('ab');
    const count = container.locator('#json2table-search-count');
    await expect(count).toHaveText('1 of 2');
    await container.getByRole('button', { name: 'Next match' }).click();
    await expect(count).toHaveText('2 of 2');
    await expect(container.locator('#json2table-json-content mark.is-current')).toHaveText('ab');
    await container.getByRole('button', { name: 'Next match' }).click();
    await expect(count).toHaveText('1 of 2');
});

test('Copy puts the shown JSON on the clipboard', async ({ page, extensionContext }) => {
    await extensionContext.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://api.contoso.com' });
    const container = await openJsonView(page);
    const copy = container.locator('#json2table-copy-source');
    await copy.click();
    await expect(copy).toHaveText('Copied!');
    // The Windows clipboard hands text back with CRLF line endings.
    expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(PRETTY);
});

test('in a focused view the JSON view shows the focused value', async ({ page }) => {
    const container = await openTable(page, SOURCE);
    await container.locator('tr', { hasText: 'alpha' }).locator('.focus-btn').first().click();
    await container.getByRole('button', { name: 'JSON', exact: true }).click();
    await expect(container.locator('.j2t-json-toolbar h3')).toHaveText('alpha');
    expect(JSON.parse(await container.locator('#json2table-json-content').textContent())).toEqual({ list: [1, 2], deep: { k: 'v' } });
});
