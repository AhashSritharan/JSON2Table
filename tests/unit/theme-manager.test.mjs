// ThemeManager (src/utils/theme-manager.js): settings defaults, the colour
// tokens, and the highlighted, foldable JSON view markup.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ThemeManager, storage } from './support/load.mjs';

const textOf = (html) => html.replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');

test('settings default to auto-convert, auto-expand, system theme, comfortable rows', async () => {
    storage.clear();
    assert.deepEqual(await ThemeManager.getSettings(), {
        autoConvert: true, autoExpand: true, themeOverride: 'system', density: 'comfortable',
    });
});

test('stored settings override the defaults', async () => {
    storage.clear();
    storage.set('autoConvert', false).set('autoExpand', false).set('themeOverride', 'force_dark').set('density', 'compact');
    assert.deepEqual(await ThemeManager.getSettings(), {
        autoConvert: false, autoExpand: false, themeOverride: 'force_dark', density: 'compact',
    });
    storage.clear();
});

test('light and dark themes define the same tokens', () => {
    const names = (mode) => [...ThemeManager.buildTokens(mode).matchAll(/--([\w-]+):/g)].map((m) => m[1]).sort();
    assert.ok(names('light').length > 10);
    assert.deepEqual(names('dark'), names('light'));
});

test('each theme mode emits its color-scheme', () => {
    assert.match(ThemeManager.getLightThemeCSS(), /color-scheme: light;/);
    assert.match(ThemeManager.getDarkThemeCSS(), /color-scheme: dark;/);
    assert.match(ThemeManager.getSystemThemeCSS(), /@media \(prefers-color-scheme: dark\)/);
});

test('JSON syntax highlighting classifies tokens and escapes markup', () => {
    const html = ThemeManager.syntaxHighlightJson('{"k": "<b>", "n": -1.5e3, "t": true, "z": null}');
    assert.ok(html.includes('<span class="j2t-json-key">"k":</span>'));
    assert.ok(html.includes('<span class="j2t-json-string">"&lt;b&gt;"</span>'));
    assert.ok(html.includes('<span class="j2t-json-number">-1.5e3</span>'));
    assert.ok(html.includes('<span class="j2t-json-boolean">true</span>'));
    assert.ok(html.includes('<span class="j2t-json-null">null</span>'));
});

test('the foldable JSON view copies back as exactly the original JSON', () => {
    const json = JSON.stringify({ a: [1, { b: '}' }], c: {}, d: '[x' }, null, 2);
    assert.equal(textOf(ThemeManager.foldableJsonHtml(json)), json);
});

test('every non-empty object and array gets a fold with a count summary', () => {
    const html = ThemeManager.foldableJsonHtml(JSON.stringify({ a: [1, 2], b: { c: 1 }, e: [] }, null, 2));
    assert.equal(html.match(/class="j2t-fold"/g).length, 3);
    assert.ok(html.includes('data-summary="3 properties"'));
    assert.ok(html.includes('data-summary="2 items"'));
    assert.ok(html.includes('data-summary="1 property"'));
});
