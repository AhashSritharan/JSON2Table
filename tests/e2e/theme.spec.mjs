// Theme (system / light / dark) and row density, in the table page.
import { test, expect, openTable } from './support/extension.mjs';

const LIGHT_BG = '#ffffff';
const DARK_BG = '#0f172a';
const bg = (page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim());

test('the system theme follows the OS colour scheme', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await openTable(page, { a: 1 });
    await expect.poll(() => bg(page)).toBe(DARK_BG);
    await page.emulateMedia({ colorScheme: 'light' });
    await expect.poll(() => bg(page)).toBe(LIGHT_BG);
});

test('a forced dark theme ignores a light OS', async ({ page, settings }) => {
    await settings({ themeOverride: 'force_dark' });
    await page.emulateMedia({ colorScheme: 'light' });
    await openTable(page, { a: 1 });
    await expect.poll(() => bg(page)).toBe(DARK_BG);
});

test('a forced light theme ignores a dark OS', async ({ page, settings }) => {
    await settings({ themeOverride: 'force_light' });
    await page.emulateMedia({ colorScheme: 'dark' });
    await openTable(page, { a: 1 });
    await expect.poll(() => bg(page)).toBe(LIGHT_BG);
});

test('rows start in the stored density', async ({ page, settings }) => {
    await settings({ density: 'compact' });
    await openTable(page, { a: 1 });
    await expect(page.locator('html')).toHaveClass(/j2t-compact/);
});

test('the density button flips rows between comfortable and compact, and remembers', async ({ page, serviceWorker }) => {
    const container = await openTable(page, { a: 1 });
    const html = page.locator('html');
    await expect(html).toHaveClass(/j2t-comfortable/);

    await container.getByRole('button', { name: 'Toggle row density' }).click();
    await expect(html).toHaveClass(/j2t-compact/);
    await expect(page.locator('.j2t-toast')).toHaveText('Compact rows');
    expect(await serviceWorker.evaluate(() => chrome.storage.local.get('density'))).toEqual({ density: 'compact' });

    await container.getByRole('button', { name: 'Toggle row density' }).click();
    await expect(html).toHaveClass(/j2t-comfortable/);
    await expect(page.locator('.j2t-toast')).toHaveText('Comfortable rows');
});
