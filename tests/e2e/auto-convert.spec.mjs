// Auto-convert: a JSON document turns into the table viewer on load, and
// stays raw when the setting is off or the page is not suitable JSON.
import { test, expect, serveJson, openTable } from './support/extension.mjs';

const USERS = [
    { id: 1, name: 'Avery Contoso', email: 'avery@contoso.com', active: true },
    { id: 2, name: 'Blake Fabrikam', email: 'blake@fabrikam.com', active: false },
];

test('a JSON array of objects becomes a table with a column per key', async ({ page }) => {
    const container = await openTable(page, USERS, 'https://api.contoso.com/users');
    await expect(container.locator('.j2t-th-inner > span:first-child')).toHaveText(['Id', 'Name', 'Email', 'Active']);
    await expect(container.locator('tr.j2t-root-row')).toHaveCount(2);
    await expect(container).toContainText('Blake Fabrikam');
    await expect(container.locator('#json2table-rowcount')).toHaveText('2 rows');
    await expect(container.locator('.json2table-title')).toHaveText('JSON Table');
});

test('a single JSON object is shown as property/value rows without a header', async ({ page }) => {
    const container = await openTable(page, { name: 'Avery Contoso', role: 'admin' });
    await expect(container.locator('.json2table-table')).toHaveClass(/is-headerless/);
    await expect(container.locator('td[data-col="property"]')).toHaveText(['name', 'role']);
    await expect(container.locator('td[data-col="value"]')).toHaveText(['Avery Contoso', 'admin']);
    await expect(container.locator('#json2table-rowcount')).toHaveText('2 rows');
});

test('an array of primitives is shown as index/value rows', async ({ page }) => {
    const container = await openTable(page, ['alpha', 'beta', 'gamma']);
    await expect(container.locator('td[data-col="index"]')).toHaveText(['0', '1', '2']);
    await expect(container.locator('td[data-col="value"]')).toHaveText(['alpha', 'beta', 'gamma']);
});

test('JSON served as text/plain is converted too', async ({ page }) => {
    await serveJson(page, 'https://api.contoso.com/plain', USERS, 'text/plain');
    await expect(page.locator('#json2tableContainer')).toContainText('Blake Fabrikam');
});

test('numbers keep their original text', async ({ page }) => {
    const container = await openTable(page, '[{"price": 663400.0, "big": 12345678901234567890, "exp": 1e3}]');
    await expect(container.locator('td[data-col="price"]')).toHaveText('663400.0');
    await expect(container.locator('td[data-col="big"]')).toHaveText('12345678901234567890');
    await expect(container.locator('td[data-col="exp"]')).toHaveText('1e3');
});

test('markup in keys and values is shown as text, never run', async ({ page }) => {
    const evil = '<img src=x onerror="document.title=\'pwned\'">';
    const container = await openTable(page, [{ [evil]: evil, b: 1, c: 2 }]);
    await expect(container.locator('td').first()).toHaveText(evil);
    await expect(container.locator('.json2table-table img')).toHaveCount(0);
    expect(await page.title()).not.toBe('pwned');
});

test('nothing is converted when auto-convert is off', async ({ page, settings }) => {
    await settings({ autoConvert: false });
    await serveJson(page, 'https://api.contoso.com/users', USERS);
    await expect(page.locator('body > pre')).toContainText('Blake Fabrikam');
    await page.waitForTimeout(500);
    await expect(page.locator('#json2tableContainer')).toHaveCount(0);
});

for (const [what, body] of [['invalid JSON', '{"a": 1,'], ['an empty array', '[]'], ['text that is not JSON', 'hello world']]) {
    test(`${what} is left alone`, async ({ page }) => {
        await serveJson(page, 'https://api.contoso.com/x', body);
        await expect(page.locator('body > pre')).toHaveText(body);
        await page.waitForTimeout(500);
        await expect(page.locator('#json2tableContainer')).toHaveCount(0);
    });
}

async function serveHtml(page, body) {
    await page.route('https://www.contoso.com/', (route) => route.fulfill({ contentType: 'text/html', body }));
    await page.goto('https://www.contoso.com/');
}

test('an HTML page is left alone', async ({ page }) => {
    await serveHtml(page, '<!doctype html><html><body><h1>Hello</h1><p>[{"a":1}]</p></body></html>');
    await expect(page.locator('h1')).toHaveText('Hello');
    await page.waitForTimeout(500);
    await expect(page.locator('#json2tableContainer')).toHaveCount(0);
});

test('an HTML page that shows JSON in a <pre> among other content is left alone', async ({ page }) => {
    await serveHtml(page, '<!doctype html><html><body><h1>API docs</h1><pre>[{"id": 1, "name": "x"}]</pre><p>More text</p></body></html>');
    await expect(page.locator('h1')).toHaveText('API docs');
    await page.waitForTimeout(500);
    await expect(page.locator('#json2tableContainer')).toHaveCount(0);
    await expect(page.locator('body > pre')).toBeVisible();
});

test('JSON mislabelled as HTML is converted when the page is nothing but the JSON', async ({ page }) => {
    await serveHtml(page, '<html><body><pre>[{"id": 1, "name": "Avery"}]</pre></body></html>');
    await expect(page.locator('#json2tableContainer td[data-col="name"]')).toHaveText('Avery');
});

test('JSON with a vendor content type is converted', async ({ page }) => {
    await serveJson(page, 'https://api.contoso.com/v', USERS, 'application/vnd.api+json');
    await expect(page.locator('#json2tableContainer')).toContainText('Blake Fabrikam');
});

test('an array of two-field records keeps its column headers and sorts by them', async ({ page }) => {
    const container = await openTable(page, [{ id: 2, name: 'Blake' }, { id: 1, name: 'Avery' }]);
    await expect(container.locator('.j2t-th-inner > span:first-child')).toHaveText(['Id', 'Name']);
    await container.locator('[data-sort-col="id"]').click();
    await expect(container.locator('td[data-col="name"]')).toHaveText(['Avery', 'Blake']);
});

test('websites cannot load the extension\'s files', async ({ page, extensionId, problems }) => {
    await openTable(page, USERS);
    const loaded = await page.evaluate((id) => fetch(`chrome-extension://${id}/viewer.html`).then(() => true, () => false), extensionId);
    expect(loaded).toBe(false);
    // Chrome logs the refused load against the extension's URL — that is the point here.
    await expect.poll(() => problems.consoleErrors).toEqual(['Failed to load resource: net::ERR_FAILED']);
    problems.consoleErrors.length = 0;
});
