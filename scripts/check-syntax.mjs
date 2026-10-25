#!/usr/bin/env node
/**
 * `node --check` on every JavaScript file of the extension and the tests — the
 * extension has no build step, so a syntax error would otherwise first show up
 * in someone's browser.
 * Run: node scripts/check-syntax.mjs
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const isScript = (name) => /\.(m?js)$/.test(name);

function* files(dir) {
    if (!existsSync(dir)) return;
    for (const name of readdirSync(dir)) {
        if (name === 'node_modules') continue;
        const path = join(dir, name);
        if (statSync(path).isDirectory()) yield* files(path);
        else if (isScript(name)) yield path;
    }
}

// The extension lives in the repo root: its top-level scripts, then src/.
const targets = [
    ...readdirSync(ROOT).filter(isScript).map((name) => join(ROOT, name)),
    ...['src', 'tests', 'scripts'].flatMap((dir) => [...files(join(ROOT, dir))]),
];

let failed = 0;
for (const file of targets) {
    try {
        execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
    } catch (e) {
        failed++;
        process.stderr.write(e.stderr.toString());
    }
}
console.log(failed ? `check-syntax: ${failed} of ${targets.length} files failed.` : `check-syntax: ${targets.length} files OK.`);
process.exit(failed ? 1 : 0);
