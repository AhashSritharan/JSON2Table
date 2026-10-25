// Focus: opening a nested value as its own table, with breadcrumb and back.
import { test, expect, openTable } from './support/extension.mjs';

const DATA = [
    { id: 1, name: 'Chair', vendor: { name: 'Contoso', address: { city: 'Zurich', zip: '8000' } }, x: 1 },
    { id: 2, name: 'Desk', vendor: { name: 'Fabrikam', address: { city: 'Bern', zip: '3000' } }, x: 1 },
];

test.beforeEach(async ({ settings }) => settings({ autoExpand: false }));

test('the magnifier opens a value as its own table, and Back returns', async ({ page }) => {
    const container = await openTable(page, DATA);
    const back = container.getByRole('button', { name: 'Back to previous level' });
    const breadcrumb = container.locator('#json2table-breadcrumb');
    await expect(back).toBeHidden();
    await expect(breadcrumb).toBeHidden();

    await container.locator('td[data-col="vendor"][data-row="1"]').getByRole('button', { name: 'Open vendor as its own table' }).click();
    await expect(container.locator('.json2table-title')).toHaveText('vendor');
    await expect(breadcrumb).toHaveText(/Root\s*\/\s*vendor/);
    await expect(container.locator('td[data-col="property"]')).toHaveText(['name', 'address']);
    await expect(container.locator('td[data-col="value"]').first()).toHaveText('Fabrikam');
    await expect(back).toBeVisible();

    await back.click();
    await expect(container.locator('.json2table-title')).toHaveText('JSON Table');
    await expect(container.locator('.j2t-th')).toHaveCount(4);
    await expect(back).toBeHidden();
});

test('focusing twice builds a breadcrumb that jumps back to any level', async ({ page }) => {
    const container = await openTable(page, DATA);
    await container.locator('td[data-col="vendor"][data-row="0"] .focus-btn').click();
    await container.locator('tr', { hasText: 'address' }).getByRole('button', { name: 'Open address as its own table' }).click();
    const breadcrumb = container.locator('#json2table-breadcrumb');
    await expect(breadcrumb).toHaveText(/Root\s*\/\s*vendor\s*\/\s*address/);
    await expect(container.locator('td[data-col="value"]')).toHaveText(['Zurich', '8000']);

    await breadcrumb.getByRole('button', { name: 'vendor' }).click();
    await expect(container.locator('.json2table-title')).toHaveText('vendor');
    await expect(container.locator('td[data-col="value"]').first()).toHaveText('Contoso');

    await container.locator('tr', { hasText: 'address' }).locator('.focus-btn').click();
    await breadcrumb.getByRole('button', { name: 'Root' }).click();
    await expect(container.locator('.json2table-title')).toHaveText('JSON Table');
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(2);
});

test('a focused list of two-field records is a table with headers', async ({ page }) => {
    const container = await openTable(page, { name: 'Shop', staff: [{ id: 1, name: 'Avery' }, { id: 2, name: 'Blake' }] });
    await container.locator('tr', { hasText: 'staff' }).locator('.focus-btn').first().click();
    await expect(container.locator('.j2t-th-inner > span:first-child')).toHaveText(['Id', 'Name']);
    await container.getByRole('button', { name: 'Back to previous level' }).click();
    await expect(container.locator('.json2table-table')).toHaveClass(/is-headerless/);
});

test('the Expand all button stays truthful across focus changes', async ({ page }) => {
    const container = await openTable(page, DATA);
    const toggle = container.locator('#json2table-expand-toggle');
    await toggle.click();
    await expect(toggle).toHaveText('Collapse all');

    await container.locator('td[data-col="vendor"][data-row="0"] .focus-btn').first().click();
    await expect(toggle).toHaveText('Expand all');
    await expect(container.locator('.j2t-twisty[aria-expanded="true"]')).toHaveCount(0);

    await container.getByRole('button', { name: 'Back to previous level' }).click();
    await expect(toggle).toHaveText('Collapse all');
});

test('going back restores what was expanded and sorted', async ({ page }) => {
    const container = await openTable(page, DATA);
    await container.locator('[data-sort-col="name"]').click();
    await container.locator('td[data-col="vendor"][data-row="0"] .j2t-twisty').click();
    await container.locator('td[data-col="vendor"][data-row="1"] .focus-btn').click();
    await container.getByRole('button', { name: 'Back to previous level' }).click();
    await expect(container.locator('td[data-col="name"]')).toHaveText(['Chair', 'Desk']);
    await expect(container.locator('th[data-col="name"]')).toHaveAttribute('aria-sort', 'ascending');
    await expect(container.locator('td[data-col="vendor"][data-row="0"] .j2t-twisty').first()).toHaveAttribute('aria-expanded', 'true');
});
