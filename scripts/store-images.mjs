#!/usr/bin/env node
/**
 * Chrome Web Store images, made from the real extension with placeholder data:
 *
 *   store-images/screenshot-1..5.jpg   1280×800
 *   store-images/promo-small.jpg       440×280
 *   store-images/promo-large.jpg       1400×560
 *
 * JPEG throughout: the store rejects PNGs with an alpha channel.
 * Run: npm run store-images   (needs `npx playwright install chromium` once)
 */
import { chromium } from '@playwright/test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ROOT, prepareExtension } from '../tests/e2e/support/prepare.mjs';

const OUT = join(ROOT, 'store-images');
const BRAND = '#4a90d9';
const BRAND_DARK = '#1f5fa8';
const JPEG = { type: 'jpeg', quality: 92 };

// ── Placeholder data ──────────────────────────────────────────────────────
// "__n:249.00" marks a number to keep exactly as written (the extension shows
// numbers as their source text).
const raw = (text) => `__n:${text}`;
const jsonText = (value) => JSON.stringify(value, null, 2).replace(/"__n:([^"]+)"/g, '$1');

const PRODUCTS = [
    ['Oak Lounge Chair', 'oak-chair', '249.00', 'Seating', true, { material: 'Oak', weight_kg: 7.2, color: 'Natural' },
        [['Avery', 5, 'Sturdy and beautiful'], ['Blake', 4, 'Comfortable, easy to assemble'], ['Casey', 5, 'Looks great by the window']]],
    ['Walnut Desk', 'walnut-desk', '589.00', 'Office', true, { material: 'Walnut', weight_kg: 31.5, color: 'Dark brown' },
        [['Devon', 5, 'Solid build'], ['Emery', 4, 'Pairs well with my oak shelf']]],
    ['Oak Dining Table', 'oak-dining', '899.00', 'Tables', true, { material: 'Oak', weight_kg: 46, color: 'Natural' },
        [['Ira', 5, 'Seats eight easily'], ['Jules', 5, 'Gorgeous grain']]],
    ['Linen Sofa', 'linen-sofa', '1299.00', 'Seating', false, { material: 'Linen', weight_kg: 54, color: 'Sand' },
        [['Finley', 5, 'So soft'], ['Harper', 3, 'Delivery took a while']]],
    ['Oak Side Table', 'oak-table', '119.50', 'Tables', true, { material: 'Oak', weight_kg: 5.1, color: 'Natural' },
        [['Jordan', 4, 'Perfect size']]],
    ['Steel Floor Lamp', 'floor-lamp', '89.90', 'Lighting', true, { material: 'Steel', weight_kg: 3.4, color: 'Black' },
        [['Kai', 5, 'Warm, even light'], ['Logan', 4, 'Tall and slim']]],
    ['Wool Rug', 'wool-rug', '349.00', 'Textiles', true, { material: 'Wool', weight_kg: 9.8, color: 'Grey' },
        [['Morgan', 5, 'Thick and cosy on oak floors']]],
    ['Oak Bench', 'oak-bench', '279.00', 'Seating', true, { material: 'Oak', weight_kg: 12.4, color: 'Natural' },
        [['Mika', 4, 'Great in the hallway']]],
    ['Rattan Basket', 'rattan-basket', '39.00', 'Storage', true, { material: 'Rattan', weight_kg: 0.9, color: 'Honey' },
        [['Noah', 4, 'Handy for blankets'], ['Parker', 5, 'Lovely weave']]],
    ['Glass Vase', 'glass-vase', '24.90', 'Decor', false, { material: 'Glass', weight_kg: 1.2, color: 'Clear' },
        [['Quinn', 5, 'Elegant']]],
    ['Oak Bookshelf', 'oak-shelf', '429.00', 'Storage', true, { material: 'Oak', weight_kg: 38, color: 'Natural' },
        [['Riley', 5, 'Holds a lot'], ['Sage', 4, 'Easy to put together']]],
    ['Ceramic Pendant', 'pendant', '159.00', 'Lighting', true, { material: 'Ceramic', weight_kg: 1.6, color: 'White' },
        [['Taylor', 5, 'Beautiful glaze']]],
].map(([name, slug, price, category, inStock, specs, reviews], i) => ({
    id: 1001 + i,
    image: `https://cdn.contoso.com/img/${slug}.svg`,
    name,
    price: raw(price),
    inStock,
    specs,
    reviews: reviews.map(([user, stars, comment]) => ({ user, stars, comment })),
}));

const ORDER = {
    orderId: 'SO-2026-10482',
    status: 'shipped',
    placedAt: '2026-10-18T14:22:05.000Z',
    total: raw('987.40'),
    currency: 'CHF',
    customer: {
        name: 'Avery Contoso',
        email: 'avery@contoso.com',
        address: { street: 'Bahnhofstrasse 1', city: 'Zurich', zip: '8001', country: 'CH' },
    },
    items: [
        { sku: 'OAK-CH-01', name: 'Oak Lounge Chair', qty: 2, price: raw('249.00') },
        { sku: 'WAL-DK-02', name: 'Walnut Desk', qty: 1, price: raw('589.00') },
        { sku: 'LMP-FL-05', name: 'Steel Floor Lamp', qty: 1, price: raw('89.90') },
    ],
    shipping: { carrier: 'Fabrikam Post', tracking: 'FP 3388 1029 CH', eta: '2026-10-22' },
    payment: { method: 'card', last4: '4242', captured: true },
    giftWrap: false,
    notes: null,
};

const HUES = [28, 200, 34, 38, 120, 260, 10, 22, 45, 180, 90, 330];
const productSvg = (slug) => {
    const hue = HUES[PRODUCTS.findIndex((p) => p.image.endsWith(`/${slug}.svg`))] ?? 210;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
        <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="hsl(${hue},55%,82%)"/><stop offset="1" stop-color="hsl(${hue},45%,62%)"/>
        </linearGradient></defs>
        <rect width="96" height="96" rx="18" fill="url(#g)"/>
        <rect x="26" y="34" width="44" height="30" rx="6" fill="hsl(${hue},40%,38%)" opacity=".55"/>
        <rect x="30" y="64" width="6" height="14" rx="2" fill="hsl(${hue},40%,32%)" opacity=".6"/>
        <rect x="60" y="64" width="6" height="14" rx="2" fill="hsl(${hue},40%,32%)" opacity=".6"/>
    </svg>`;
};

// ── Browser ───────────────────────────────────────────────────────────────
const extensionDir = prepareExtension();
const profileDir = mkdtempSync(join(tmpdir(), 'j2t-store-profile-'));
const context = await chromium.launchPersistentContext(profileDir, {
    channel: 'chromium',
    headless: true,
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    args: [`--disable-extensions-except=${extensionDir}`, `--load-extension=${extensionDir}`],
});
const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
const extensionId = new URL(worker.url()).host;

await context.route('https://api.contoso.com/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.startsWith('/orders') ? jsonText(ORDER) : jsonText(PRODUCTS);
    return route.fulfill({ contentType: 'application/json', body });
});
await context.route('https://cdn.contoso.com/img/*.svg', (route) => route.fulfill({
    contentType: 'image/svg+xml',
    body: productSvg(new URL(route.request().url()).pathname.split('/').pop().replace('.svg', '')),
}));

const setSettings = (values) => worker.evaluate(async (v) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(v);
}, values);

async function openTable(url, settings, colorScheme = 'light') {
    await setSettings({ autoExpand: false, csvDelimiter: ',', ...settings });
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme });
    await page.goto(url);
    await page.locator('#json2table-table-container table').waitFor();
    return page;
}

const settle = (page) => page.evaluate(() => document.fonts.ready.then(() => new Promise((r) => setTimeout(r, 300))));

async function shoot(page, name) {
    await page.mouse.move(1279, 799);
    await settle(page);
    await page.screenshot({ path: join(OUT, name), ...JPEG });
    console.log(`  ${name}`);
}

mkdirSync(OUT, { recursive: true });
console.log(`Writing to ${OUT}`);

// 1. A record table with nested values open in their cells.
const table = await openTable('https://api.contoso.com/products', { themeOverride: 'force_light' });
await table.locator('td[data-col="reviews"][data-row="0"] .j2t-twisty').first().click();
await table.locator('td[data-col="specs"][data-row="1"] .j2t-twisty').first().click();
await table.locator('td[data-col="reviews"][data-row="2"] .j2t-twisty').first().click();
await table.locator('td[data-col="name"][data-row="0"]').click();
await shoot(table, 'screenshot-1.jpg');

// 2. Search: rows filtered, matches highlighted, nested matches opened.
await table.locator('#json2table-search').fill('oak');
await table.locator('#json2table-search-count').filter({ hasText: /of/ }).waitFor();
await table.locator('#json2table-search').press('Enter');
await shoot(table, 'screenshot-2.jpg');
await table.close();

// 3. One object as a property/value tree, dark theme, compact rows.
const order = await openTable('https://api.contoso.com/orders/SO-2026-10482', { themeOverride: 'force_dark', density: 'compact' }, 'dark');
for (const key of ['customer', 'items', 'shipping']) {
    await order.locator('tr.j2t-root-row', { hasText: key }).locator('.j2t-twisty').first().click();
}
await order.locator('tr.j2t-tree-row', { hasText: 'address' }).locator('.j2t-twisty').first().click();
await order.locator('tr.j2t-root-row', { hasText: 'orderId' }).locator('td').first().click();
await shoot(order, 'screenshot-3.jpg');

// 4. The JSON view: highlighted, foldable, sharing the search.
await order.getByRole('button', { name: 'JSON', exact: true }).click();
await order.locator('#json2table-json-content').waitFor();
await order.locator('#json2table-search').fill('zurich');
await order.locator('#json2table-json-content mark').first().waitFor();
await order.locator('#json2table-search').fill('');
await order.locator('#json2table-json-content mark').first().waitFor({ state: 'detached' });
const folds = order.locator('#json2table-json-content .j2t-fold');
await folds.nth(3).locator(':scope > .j2t-fold-toggle').click(); // items
await shoot(order, 'screenshot-4.jpg');
await order.close();

// 5. The popup, shown on a backdrop with what it does.
await setSettings({ csvDelimiter: ',' });
const popupShot = await (async () => {
    const popup = await context.newPage();
    await popup.setViewportSize({ width: 380, height: 900 });
    await popup.goto(`chrome-extension://${extensionId}/popup.html`);
    await popup.locator('#jsonInput').fill(jsonText([{ id: 1, city: 'Zurich', zip: '8001' }, { id: 2, city: 'Bern', zip: '3011' }]));
    await popup.locator('#jsonInput').evaluate((el) => { el.scrollTop = 0; el.setSelectionRange(0, 0); });
    await popup.getByText('Settings', { exact: true }).click();
    await popup.locator('#themeSelect').waitFor();
    await popup.mouse.move(0, 0);
    await settle(popup);
    const buffer = await popup.locator('body').screenshot({ type: 'png' });
    await popup.close();
    return buffer.toString('base64');
})();

const icon = readFileSync(join(ROOT, 'icons', 'icon-128.png')).toString('base64');
const FONT = "'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif";

async function render(html, width, height, name) {
    const page = await context.newPage();
    await page.setViewportSize({ width, height });
    await page.setContent(`<!doctype html><html><head><style>
        * { box-sizing: border-box; margin: 0; }
        body { width: ${width}px; height: ${height}px; overflow: hidden; font-family: ${FONT};
               background: linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%); color: #fff; }
    </style></head><body>${html}</body></html>`);
    await settle(page);
    await page.screenshot({ path: join(OUT, name), ...JPEG });
    await page.close();
    console.log(`  ${name}`);
}

const bullets = (items, size) => items.map((t) => `
    <li style="display:flex;gap:12px;align-items:center;font-size:${size}px;margin:10px 0;opacity:.95">
        <span style="width:${size * 0.5}px;height:${size * 0.5}px;border-radius:50%;background:#fff;opacity:.85;flex:none"></span>${t}
    </li>`).join('');

await render(`
    <div style="display:flex;height:100%;align-items:center;gap:72px;padding:0 90px">
        <div style="flex:1">
            <div style="display:flex;align-items:center;gap:16px;margin-bottom:28px">
                <img src="data:image/png;base64,${icon}" width="56" height="56" style="border-radius:12px">
                <span style="font-size:30px;font-weight:700">JSON2Table</span>
            </div>
            <h1 style="font-size:46px;line-height:1.15;font-weight:700;margin-bottom:26px">Paste any JSON.<br>Get a table.</h1>
            <ul style="list-style:none;padding:0">${bullets([
                'Converts JSON pages automatically',
                'Or paste JSON into the popup',
                'Light, dark or system theme',
                'CSV with comma or semicolon',
            ], 21)}</ul>
        </div>
        <img src="data:image/png;base64,${popupShot}" style="height:700px;border-radius:14px;box-shadow:0 24px 60px rgba(0,0,0,.35)">
    </div>`, 1280, 800, 'screenshot-5.jpg');

// ── Promo tiles ───────────────────────────────────────────────────────────
const tableShot = readFileSync(join(OUT, 'screenshot-1.jpg')).toString('base64');

await render(`
    <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center">
        <img src="data:image/png;base64,${icon}" width="88" height="88" style="border-radius:18px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
        <div style="font-size:40px;font-weight:700;letter-spacing:-.5px">JSON2Table</div>
        <div style="font-size:19px;opacity:.92">JSON into searchable tables</div>
    </div>`, 440, 280, 'promo-small.jpg');

await render(`
    <div style="display:flex;height:100%;align-items:center;padding-left:90px">
        <div style="width:520px;flex:none">
            <div style="display:flex;align-items:center;gap:18px;margin-bottom:26px">
                <img src="data:image/png;base64,${icon}" width="72" height="72" style="border-radius:16px;box-shadow:0 10px 30px rgba(0,0,0,.25)">
                <span style="font-size:44px;font-weight:700;letter-spacing:-.5px">JSON2Table</span>
            </div>
            <div style="font-size:30px;line-height:1.3;font-weight:600;margin-bottom:22px">Turn JSON into tables you can<br>search, sort, expand and export.</div>
            <ul style="list-style:none;padding:0">${bullets(['Automatic on JSON pages', 'Numbers shown exactly as written', 'Nothing leaves your browser'], 20)}</ul>
        </div>
        <div style="flex:1;align-self:stretch;position:relative">
            <img src="data:image/jpeg;base64,${tableShot}"
                 style="position:absolute;left:30px;top:70px;width:1000px;border-radius:14px;box-shadow:0 30px 80px rgba(0,0,0,.4)">
        </div>
    </div>`, 1400, 560, 'promo-large.jpg');

await context.close();
rmSync(extensionDir, { recursive: true, force: true });
rmSync(profileDir, { recursive: true, force: true });
console.log('Done.');
