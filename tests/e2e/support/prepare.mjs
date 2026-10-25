// A loadable copy of the extension, for the browser tests and for
// scripts/store-images.mjs.
//
// The copy holds the shipped files with one addition: an empty service worker.
// The extension has none of its own, and without one Playwright has no way to
// learn the extension id (needed for the popup and viewer pages) or to reach
// chrome.storage. Nothing else differs from what ships.
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Everything that ships — the release workflow zips the same list.
export const SHIPPED = ['manifest.json', 'icons', 'src', 'popup.html', 'popup.js', 'viewer.html', 'viewer.js'];

export const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));

export function prepareExtension() {
    const dir = mkdtempSync(join(tmpdir(), 'j2t-e2e-extension-'));
    for (const entry of SHIPPED) cpSync(join(ROOT, entry), join(dir, entry), { recursive: true });
    if (manifest.background) throw new Error('manifest.json now has a background entry — use it in tests/e2e/support/prepare.mjs instead of the test worker');
    writeFileSync(join(dir, 'test-worker.js'), '// Test-only: lets Playwright find the extension id.\n');
    writeFileSync(join(dir, 'manifest.json'), JSON.stringify({ ...manifest, background: { service_worker: 'test-worker.js' } }, null, 2));
    return dir;
}
