#!/usr/bin/env node
/**
 * Keeps identifying data out of the repository: credentials, personal email
 * addresses, anything on the local denylist. The repository is public, and
 * anything committed stays in history even after it is deleted.
 *
 *   node scripts/sensitive-scan.mjs            every tracked file
 *   node scripts/sensitive-scan.mjs --staged   what is about to be committed (pre-commit hook)
 *
 * Two layers:
 *   • generic patterns — anything that looks like a credential or an email;
 *   • a denylist of literal strings, one per line, from `.sensitive-denylist`
 *     in the repo root or the SENSITIVE_DENYLIST environment variable
 *     (newline-separated, e.g. a CI secret). The denylist is itself sensitive,
 *     so it is gitignored — never commit it.
 *
 * A line containing `sensitive-scan: allow` is skipped, for the rare genuine
 * example value. Exits 1 on any finding.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

// Paths that must never be tracked at all.
const FORBIDDEN_PATHS = [
    /^\.playwright-mcp\//, /^\.sensitive-denylist$/, /\.pem$/, /^test-results\//, /^playwright-report\//,
];

const BINARY = /\.(png|jpe?g|gif|ico|webp|zip|crx|woff2?)$/i;

const PATTERNS = [
    { name: 'private key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
    { name: 'JWT / bearer token', re: /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/ },
    { name: 'hard-coded secret', re: /\b(api[_-]?key|secret|password|client[_-]?secret|token)\b\s*[:=]\s*['"`][A-Za-z0-9_\-+/=]{16,}['"`]/i },
    {
        name: 'email address',
        re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g,
        ignore: (m) => /@(example|contoso|fabrikam|anthropic)\./i.test(m) || /^noreply@/i.test(m),
    },
];

function loadDenylist() {
    const file = join(ROOT, '.sensitive-denylist');
    const text = [existsSync(file) ? readFileSync(file, 'utf8') : '', process.env.SENSITIVE_DENYLIST ?? ''].join('\n');
    return text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
}

/** [path, content] for every file in scope. */
function filesInScope(staged) {
    const paths = staged
        ? git('diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z').split('\0').filter(Boolean)
        : git('ls-files', '-z').split('\0').filter(Boolean);
    return paths.map((path) => {
        if (BINARY.test(path)) return [path, null];
        // Staged mode reads the index, not the working tree: that is what gets committed.
        if (staged) return [path, git('show', `:${path}`)];
        // A tracked file moved or deleted without staging it yet has nothing left to read.
        const file = join(ROOT, path);
        return [path, existsSync(file) ? readFileSync(file, 'utf8') : null];
    });
}

export function scan(files, denylist) {
    const findings = [];
    const lowerDeny = denylist.map((d) => d.toLowerCase());
    for (const [path, content] of files) {
        if (FORBIDDEN_PATHS.some((re) => re.test(path))) {
            findings.push({ path, line: 0, rule: 'path must not be tracked', match: path });
            continue;
        }
        if (content == null) continue;
        // This file's own patterns would otherwise flag themselves.
        if (path === 'scripts/sensitive-scan.mjs') continue;
        content.split(/\r?\n/).forEach((text, i) => {
            if (text.includes('sensitive-scan: allow')) return;
            for (const { name, re, ignore } of PATTERNS) {
                const matches = re.global ? [...text.matchAll(re)].map((m) => m[0]) : (text.match(re) ? [text.match(re)[0]] : []);
                for (const match of matches) {
                    if (ignore?.(match)) continue;
                    findings.push({ path, line: i + 1, rule: name, match });
                }
            }
            const lower = text.toLowerCase();
            lowerDeny.forEach((needle, k) => {
                if (lower.includes(needle)) findings.push({ path, line: i + 1, rule: 'denylist', match: denylist[k] });
            });
        });
    }
    return findings;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === join(process.argv[1]);
if (isMain) {
    const staged = process.argv.includes('--staged');
    const denylist = loadDenylist();
    const findings = scan(filesInScope(staged), denylist);
    const scope = staged ? 'staged changes' : 'tracked files';
    if (!denylist.length) console.warn('sensitive-scan: no denylist found — only generic patterns were checked.');
    if (!findings.length) {
        console.log(`sensitive-scan: ${scope} clean.`);
        process.exit(0);
    }
    console.error(`sensitive-scan: ${findings.length} finding(s) in ${scope}:`);
    for (const f of findings) {
        // Denylist hits are not echoed in full — CI logs of a public repo are public too.
        const shown = f.rule === 'denylist' ? `${f.match.slice(0, 3)}…` : f.match.slice(0, 80);
        console.error(`  ${f.path}${f.line ? `:${f.line}` : ''}  [${f.rule}]  ${shown}`);
    }
    console.error('Fix these, or mark a genuine example line with "sensitive-scan: allow".');
    process.exit(1);
}
