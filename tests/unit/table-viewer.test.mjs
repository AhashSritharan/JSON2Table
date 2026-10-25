// TableViewer (src/components/table-viewer.js): the logic behind the table —
// columns, layout choice, value rendering, sorting, search matching and the
// row model. Rendering into the page is covered by the browser tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSONDetector, TableViewer, viewerFor } from './support/load.mjs';

const SEP = TableViewer.SEP;

test('columns are the union of keys in order of first appearance', () => {
    const viewer = viewerFor([{ b: 1, a: 2 }, { c: 3, a: 4 }]);
    assert.deepEqual(viewer.columns, ['b', 'a', 'c']);
});

test('a single object reads as a property/value tree', () => {
    assert.equal(viewerFor({ x: 1, y: 2 }).isTreeMode, true);
    assert.equal(viewerFor([{ a: 1, b: 2, c: 3 }]).isTreeMode, false);
});

test('records with exactly two fields are still a table', () => {
    assert.equal(viewerFor([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]).isTreeMode, false);
});

test('a uniform array of objects qualifies for an inline sub-table', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    assert.equal(viewer.qualifiesForSubTable([{ id: 1, n: 'a' }, { id: 2, n: 'b' }]), true);
});

test('arrays that would make a poor table stay trees', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    assert.equal(viewer.qualifiesForSubTable([{ id: 1 }]), false, 'fewer than two items');
    assert.equal(viewer.qualifiesForSubTable([1, 2, 3]), false, 'primitives');
    assert.equal(viewer.qualifiesForSubTable([{ a: 1 }, { b: 1 }, { c: 1 }, { d: 1 }]), false, 'ragged keys');
    assert.equal(viewer.qualifiesForSubTable([{ a: 1 }, 2, 3, 4, 5]), false, 'mostly non-objects');
    const wide = Object.fromEntries(Array.from({ length: 13 }, (_, i) => [`k${i}`, i]));
    assert.equal(viewer.qualifiesForSubTable([wide, wide]), false, 'more than 12 columns');
});

test('sorting compares numbers, raw numbers, booleans and strings naturally; empties last', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    const raw = JSONDetector.parse('[10.0]')[0];
    const sorted = (values) => [...values].sort((x, y) => viewer.compareValues(x, y));
    assert.deepEqual(sorted([10, 2, 33]), [2, 10, 33]);
    assert.deepEqual(sorted([raw, 5]), [5, raw]);
    assert.deepEqual(sorted([raw, 50]), [raw, 50]);
    assert.deepEqual(sorted([true, false]), [false, true]);
    assert.deepEqual(sorted(['item10', 'item2', 'Item1']), ['Item1', 'item2', 'item10']);
    assert.deepEqual(sorted([null, '', { o: 1 }, 'a']), ['a', { o: 1 }, null, '']);
});

test('only real image URLs are shown as images', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    assert.equal(viewer.isImageUrl('https://cdn.contoso.com/p/a.png'), true);
    assert.equal(viewer.isImageUrl('https://cdn.contoso.com/a.JPG?w=200'), true);
    assert.equal(viewer.isImageUrl('data:image/png;base64,iVBORw0KGgo='), true);
    assert.equal(viewer.isImageUrl('iVBORw0KGgoAAAANSUhEUg'), true, 'bare base64 PNG');
    assert.equal(viewer.isImageUrl('https://contoso.com/photos/123'), false, 'no image extension');
    assert.equal(viewer.isImageUrl('javascript:alert(1).png'), false);
    assert.equal(viewer.isImageUrl('ftp://contoso.com/a.png'), false);
});

test('scalars render escaped and typed', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    assert.equal(viewer.renderScalar('<img src=x onerror=alert(1)>'),
        '<span class="string-value">&lt;img src=x onerror=alert(1)&gt;</span>');
    assert.equal(viewer.renderScalar(true), '<span class="boolean-value true">true</span>');
    assert.equal(viewer.renderScalar(1.5), '<span class="number-value">1.5</span>');
    assert.equal(viewer.renderScalar(JSONDetector.parse('[663400.0]')[0]), '<span class="number-value">663400.0</span>');
    assert.equal(viewer.renderScalar(''), '<span class="empty-string">""</span>');
});

test('an ISO date is shown as written, with local time as a hint', () => {
    const html = viewerFor([{ a: 1, b: 2, c: 3 }]).renderScalar('2024-05-01T10:20:30.123Z');
    assert.match(html, /^<span class="date-value" title="Local time: [^"]+">2024-05-01T10:20:30\.123Z<\/span>$/);
});

test('long strings are cut at 240 characters with a "Show all" button', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    const html = viewer.renderScalar('x'.repeat(300));
    assert.ok(html.includes(`${'x'.repeat(240)}&hellip;`));
    assert.ok(!html.includes('x'.repeat(241)));
    assert.match(html, /data-show-value="[^"]+">Show all 300</);
});

test('search highlighting escapes before marking, so the query cannot inject markup', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    viewer.searchQuery = '<b>';
    assert.equal(viewer.text('a <b> c'), 'a <mark class="search-highlight">&lt;b&gt;</mark> c');
    viewer.searchQuery = 'A.C';
    assert.equal(viewer.text('abc a.c'), 'abc <mark class="search-highlight">a.c</mark>', 'regex characters are literal');
});

test('collapsed containers get a short preview', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    assert.equal(viewer.previewOf({ id: 7, tags: ['a', 'b'], owner: null }), '{id: 7, tags: [2], owner: null}');
    assert.equal(viewer.previewOf(['a'.repeat(30)]), `[&quot;${'a'.repeat(22)}…&quot;]`);
    assert.match(viewer.previewOf(Array.from({ length: 40 }, (_, i) => i)), /, …\]$/);
});

test('search matches values and keys at any depth, case-insensitively', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    viewer.searchQuery = 'ZUR';
    assert.equal(viewer.containsMatch({ address: { city: 'Zurich' } }), true);
    assert.equal(viewer.containsMatch({ zurichOffice: 1 }), true, 'a key counts');
    assert.equal(viewer.containsMatch(['zurich']), true);
    assert.equal(viewer.containsMatch({ city: 'Bern' }), false);
    viewer.searchQuery = '1.50';
    assert.equal(viewer.containsMatch(JSONDetector.parse('[1.50]')[0]), true, 'raw numbers match their text');
});

test('while searching, a container shows only its matching children — or all if none match', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    viewer.searchQuery = 'bern';
    assert.deepEqual(viewer.visibleEntries({ x: 'Zurich', y: 'Bern' }), [['y', 'Bern']]);
    assert.deepEqual(viewer.visibleEntries({ x: 'Zurich' }), [['x', 'Zurich']]);
});

test('tree mode: an expanded value becomes child rows, paged 100 at a time', () => {
    const viewer = viewerFor({ list: Array.from({ length: 250 }, (_, i) => i) });
    assert.deepEqual(viewer.buildRowModel().map((r) => r.kind), ['root']);

    viewer.expanded.add(viewer.cellPath(0, 'value'));
    let rows = viewer.buildRowModel();
    assert.equal(rows.filter((r) => r.kind === 'child').length, 100);
    assert.deepEqual(rows.at(-1), { kind: 'more', depth: 1, path: `r0${SEP}value`, shown: 100, total: 250, sourceCol: 'value' });

    viewer.shownCounts.set(`r0${SEP}value`, 300);
    rows = viewer.buildRowModel();
    assert.equal(rows.filter((r) => r.kind === 'child').length, 250);
    assert.equal(rows.some((r) => r.kind === 'more'), false);
});

test('tree mode: a uniform array expands to a sub-table unless switched to a list', () => {
    const viewer = viewerFor({ people: [{ id: 1, n: 'a' }, { id: 2, n: 'b' }] });
    const path = viewer.cellPath(0, 'value');
    viewer.expanded.add(path);
    assert.deepEqual(viewer.buildRowModel().map((r) => r.kind), ['root', 'subtable']);
    viewer.arrayViewMode.set(path, 'list');
    assert.deepEqual(viewer.buildRowModel().map((r) => r.kind), ['root', 'child', 'child']);
});

test('the CSV delimiter defaults to ";" in locales that use a decimal comma', () => {
    const viewer = viewerFor([{ a: 1, b: 2, c: 3 }]);
    const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    try {
        for (const [language, expected] of [['de-CH', ';'], ['fr-FR', ';'], ['pt-PT', ';'], ['en-US', ','], ['pt-BR', ',']]) {
            Object.defineProperty(globalThis, 'navigator', { value: { language }, configurable: true });
            assert.equal(viewer.getLikelyCsvDelimiter(), expected, language);
        }
    } finally {
        Object.defineProperty(globalThis, 'navigator', original);
    }
});
