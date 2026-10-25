# JSON2Table — working rules

A Chrome/Edge MV3 extension with no build step: the files listed in
`tests/e2e/support/prepare.mjs` → `SHIPPED` (manifest, icons, `src/`, popup
and viewer) are what ships. README.md describes the features.

## Test first, every change

Every change is test-driven, whatever its size:

1. **Write the test first and watch it fail** for the reason you expect.
2. Make it pass with the smallest change.
3. Run `npm test` (unit + browser) before calling anything done.

A test is never weakened, skipped or deleted to get to green. If a test is
wrong, say why and fix the test in its own step.

A bug fix starts with a test that reproduces the bug.

## The test layers

| Layer | Where | Command | What belongs there |
|---|---|---|---|
| Unit | `tests/unit/*.test.mjs` | `npm run test:unit` | Logic with no UI: parsing, number preservation, table-data extraction, flattening, CSV, value formatting. The classes in `src/` export themselves through `module.exports`; load them with `createRequire`. |
| Browser | `tests/e2e/*.spec.mjs` | `npm run test:e2e` | The real unpacked extension in Chromium. Pages are served by `page.route` on placeholder hosts — no network. Auto-convert, the table UI (expand, search, sort, export), the popup, the viewer page, settings and themes. |

Pick the lowest layer that can catch the bug. Logic goes to unit tests; a
flow that needs the page goes to the browser layer.

Every feature has tests; a new feature or setting gets them in the spec for
its area:

| Area | Spec |
|---|---|
| Detecting and converting JSON pages | `auto-convert.spec.mjs` |
| How values look: types, dates, images, long strings, value dialog | `values.spec.mjs` |
| Expanding: in-cell, tree rows, sub-tables, paging, expand all, keyboard | `expand.spec.mjs` |
| Sorting and column resize | `sort-resize.spec.mjs` |
| Search and match navigation | `search.spec.mjs` |
| Focus (magnifier), breadcrumb, back | `focus.spec.mjs` |
| JSON view: folding, shared search, copy | `json-view.spec.mjs` |
| Export menu: CSV, JSON, copy | `export.spec.mjs` |
| Theme and density | `theme.spec.mjs` |
| Popup: settings, paste box, convert current page | `popup.spec.mjs` |
| Viewer page for pasted JSON | `extension-pages.spec.mjs` |

The browser fixture fails a test on any error the extension logs or throws —
a test that expects one must say so by emptying `problems.consoleErrors`.

## Real behaviour, not assumptions

Chrome renders JSON documents its own way (a `body > pre`, plus a
pretty-print control in newer versions), and sites serve JSON with all kinds
of content types. Before writing code or a fixture page for a page shape:

- **Check it in a real browser** — the Playwright MCP, or `npm run test:e2e
  -- --headed` — and look at the actual DOM.
- **Copy fixture pages from that real DOM** rather than from what you expect
  it to be.

## Never commit identifying data

The repository is public. `scripts/sensitive-scan.mjs` runs before every
commit (`.githooks/pre-commit`) and in CI; never bypass it. Test data uses
placeholders only: `contoso` / `fabrikam` / `example` hosts, made-up names
and addresses.

## Code style

- Classic scripts, not ES modules: every file in `src/` is a content script
  listed in `manifest.json`, defines one class on `window`, and ends with the
  `module.exports` guard so unit tests can load it. A new file needs both.
- Tests, scripts and config are `.mjs`; `package.json` stays without
  `"type": "module"` so the `src/` files load as CommonJS in Node.

## Commands

```
npm test                 # unit + browser — run before every commit
npm run test:unit        # seconds
npm run test:e2e         # the extension in Chromium
npm run test:e2e -- --headed   # watch it
npm run test:report      # the last browser run's report
npm run check            # syntax + sensitive-data scan
npm run store-images     # Chrome Web Store screenshots and promo tiles → store-images/
```

Store images come from the real extension with placeholder data
(`scripts/store-images.mjs`); regenerate them after a visible UI change.

One-time setup after cloning: `npm install`, `npx playwright install
chromium`, `git config core.hooksPath .githooks`.
