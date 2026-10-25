// JSONDetector (src/utils/json-detector.js): parsing that keeps numbers as
// written, and turning any JSON shape into table rows.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const JSONDetector = require('../../src/utils/json-detector.js');

test('parse keeps numbers whose text would change', () => {
    const data = JSONDetector.parse('{"a": 663400.0, "b": 1e3, "c": 12345678901234567890}');
    for (const key of ['a', 'b', 'c']) assert.ok(JSONDetector.isRawNumber(data[key]), `${key} is kept raw`);
    assert.equal(JSON.stringify(data), '{"a":663400.0,"b":1e3,"c":12345678901234567890}');
});

test('parse leaves numbers that round-trip as plain numbers', () => {
    const data = JSONDetector.parse('{"n": 42, "f": 1.5, "neg": -7}');
    assert.deepEqual(data, { n: 42, f: 1.5, neg: -7 });
});

test('isPlainObject is false for arrays, null and raw numbers', () => {
    const raw = JSONDetector.parse('[1.0]')[0];
    assert.equal(JSONDetector.isPlainObject({}), true);
    assert.equal(JSONDetector.isPlainObject([]), false);
    assert.equal(JSONDetector.isPlainObject(null), false);
    assert.equal(JSONDetector.isPlainObject(raw), false);
});

test('extractTableData: an array of objects is the table', () => {
    const rows = [{ id: 1 }, { id: 2 }];
    assert.equal(JSONDetector.extractTableData(rows), rows);
});

test('extractTableData: an array of primitives becomes index/value rows', () => {
    assert.deepEqual(JSONDetector.extractTableData(['a', 'b']), [
        { index: 0, value: 'a' },
        { index: 1, value: 'b' },
    ]);
});

test('extractTableData: a single object becomes property/value rows in source order', () => {
    const rows = JSONDetector.extractTableData(JSONDetector.parse('{"z": 1, "a": {"x": true}}'));
    assert.deepEqual(rows, [
        { property: 'z', value: 1 },
        { property: 'a', value: { x: true } },
    ]);
});

test('isTreeShaped: records are a table, everything else a property/value tree', () => {
    assert.equal(JSONDetector.isTreeShaped([{ id: 1, name: 'a' }]), false, 'two-field records are still records');
    assert.equal(JSONDetector.isTreeShaped([{ a: 1, b: 2, c: 3 }]), false);
    assert.equal(JSONDetector.isTreeShaped({ id: 1, name: 'a' }), true);
    assert.equal(JSONDetector.isTreeShaped(['a', 'b']), true);
    assert.equal(JSONDetector.isTreeShaped([[1], [2]]), true);
});

test('looksLikeJsonDocument: JSON content types, or a body that is nothing but one <pre>', () => {
    const doc = (contentType, ...tags) => ({ contentType, body: { children: tags.map((tagName) => ({ tagName })) } });
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('application/json', 'PRE')), true);
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('application/vnd.api+json', 'PRE')), true);
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('text/plain', 'PRE')), true);
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('application/json', 'PRE', 'DIV')), true, "Chrome's own JSON viewer controls");
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('text/html', 'PRE')), true);
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('text/html', 'H1', 'PRE')), false);
    assert.equal(JSONDetector.looksLikeJsonDocument(doc('text/html', 'PRE', 'P')), false);
});

test('extractTableData: empty and primitive input give no rows', () => {
    assert.deepEqual(JSONDetector.extractTableData([]), []);
    assert.deepEqual(JSONDetector.extractTableData(5), []);
    assert.deepEqual(JSONDetector.extractTableData(null), []);
});
