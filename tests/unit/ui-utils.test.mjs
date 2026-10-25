// UIUtils (src/utils/ui-utils.js): the pure helpers behind the toolbar —
// column names, JSON-view filtering and export serialization.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSONDetector, UIUtils } from './support/load.mjs';

test('column names are humanized', () => {
    assert.equal(UIUtils.formatColumnName('firstName'), 'First Name');
    assert.equal(UIUtils.formatColumnName('created_at'), 'Created At');
    assert.equal(UIUtils.formatColumnName('zip-code'), 'Zip Code');
    assert.equal(UIUtils.formatColumnName('id'), 'Id');
    assert.equal(UIUtils.formatColumnName('item2Name'), 'Item2 Name');
});

test('filterJson keeps only what matches, at every level', () => {
    const data = { a: { city: 'Zurich', zip: '8000' }, b: { city: 'Bern' }, list: ['zurich', 'geneva'] };
    assert.deepEqual(UIUtils.filterJson(data, 'zur'), { a: { city: 'Zurich' }, list: ['zurich'] });
    assert.equal(UIUtils.filterJson(data, 'nowhere'), undefined);
});

test('filterJson keeps a property whole when only its name matches', () => {
    assert.deepEqual(UIUtils.filterJson({ address: { city: 'Bern' }, x: 1 }, 'addr'), { address: { city: 'Bern' } });
});

test('filterJson matches raw numbers by their text and keeps a "__proto__" key as data', () => {
    const data = JSONDetector.parse('{"price": 10.50, "__proto__": "10.50 CHF"}');
    const kept = UIUtils.filterJson(data, '10.50');
    assert.equal(JSON.stringify(kept), '{"price":10.50,"__proto__":"10.50 CHF"}');
});

test('export serialization pretty-prints and keeps numbers as written', () => {
    assert.equal(UIUtils.serializeForExport('{"a":1.0,"b":[1]}'), '{\n  "a": 1.0,\n  "b": [\n    1\n  ]\n}');
    assert.equal(UIUtils.serializeForExport('not json'), 'not json');
    assert.equal(UIUtils.serializeForExport({ z: 1, a: 2 }), '{\n  "z": 1,\n  "a": 2\n}');
});

test('escapeHtml escapes all five special characters', () => {
    assert.equal(UIUtils.escapeHtml(`<a href="x" title='y'>&</a>`), '&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;');
});
