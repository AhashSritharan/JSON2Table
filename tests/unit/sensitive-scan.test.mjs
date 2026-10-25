// The sensitive-data scan itself: what it flags, and what it lets through.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan } from '../../scripts/sensitive-scan.mjs';

const rules = (content, denylist = []) => scan([['file.js', content]], denylist).map((f) => f.rule);

test('flags personal email addresses, not placeholder ones', () => {
    assert.deepEqual(rules('contact: jane.doe@gmail.com'), ['email address']); // sensitive-scan: allow
    assert.deepEqual(rules('contact: someone@example.com'), []);
    assert.deepEqual(rules('contact: someone@contoso.com'), []);
});

test('flags hard-coded secrets and private keys', () => {
    assert.deepEqual(rules('const apiKey = "abcdefghijklmnop1234";'), ['hard-coded secret']); // sensitive-scan: allow
    assert.deepEqual(rules('-----BEGIN RSA PRIVATE KEY-----'), ['private key']); // sensitive-scan: allow
});

test('flags denylisted strings case-insensitively', () => {
    assert.deepEqual(rules('a SecretCustomer row', ['secretcustomer']), ['denylist']);
});

test('flags paths that must never be tracked', () => {
    assert.deepEqual(scan([['.sensitive-denylist', 'x']], []).map((f) => f.rule), ['path must not be tracked']);
    assert.deepEqual(scan([['playwright-report/index.html', 'x']], []).map((f) => f.rule), ['path must not be tracked']);
});

test('a line marked allow is skipped', () => {
    assert.deepEqual(rules('jane.doe@gmail.com // sensitive-scan: allow'), []);
});
