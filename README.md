# JSON2Table

A Chrome/Edge extension that turns JSON into an interactive table you can
search, sort, expand and export.

## Features

**Opening JSON**
- **Automatic:** JSON documents (API responses, `.json` files) open as a table.
  This covers JSON and text content types, and HTML pages whose body is nothing
  but the JSON. Ordinary web pages are never taken over.
- **Detect & Convert** in the popup converts the current page on request, even
  with auto-convert off or when the JSON sits in a `<pre>` inside a normal page.
- **Paste JSON** in the popup to open it in a viewer tab.

**The table**
- An array of records gets a column per field. Anything else (one object, a
  list of values) is shown as property/value rows that read as a tree.
- **Expand nested values:** in record tables, objects and arrays expand inside
  their own cell. Uniform arrays become a small sub-table, which you can switch
  to a list. Long lists show 100 items at a time. **Expand all / Collapse all**
  does everything at once; *Auto-expand* in the settings does it on load.
- **Focus** (magnifier): open any nested value as its own table. A breadcrumb
  and Back take you up again.
- **Search** filters rows and nested items, highlights matches, and steps
  through them (Enter / Shift+Enter, ▲▼). Ctrl+F jumps to the search box.
- **Sort** by clicking a column header (ascending, descending, off), or sort
  keys A–Z from the toolbar in property/value views. **Resize** columns by
  dragging their edge.
- **Values are shown faithfully:** numbers keep their exact text (`1.0`, `1e3`,
  big integers), dates as written with local time on hover, image URLs as
  thumbnails, and long strings cut short with a *Show all* button.
- **Keyboard:** arrow keys move between rows and open/close them; Home and End
  work too.

**JSON view and export**
- **JSON view:** the original JSON, syntax-highlighted and foldable (Alt+click
  folds everything inside). It shares the table's search.
- **Export:** download as CSV (comma or semicolon) or JSON, or copy the JSON.
  CSV contains the rows you see, in the order you see them.

**Settings** (popup): auto-convert, auto-expand, row density, CSV delimiter,
and a theme (system, light, dark). Changes apply to open tables immediately.

All values are escaped before display, and the extension makes no network
requests of its own (image thumbnails are loaded from the URLs in your JSON).

## Install

### [➜ Get it from the Chrome Web Store](https://chromewebstore.google.com/detail/json2table/ipfeofhefkpebgnpnckolmmhnmkpeacf)

- **Chrome:** open the store page and click **Add to Chrome**.
- **Microsoft Edge:** open the same page, click **Allow extensions from other
  stores** in the banner at the top, then **Get** (labelled **Add to Chrome**
  on some versions).

Updates install automatically.

<details>
<summary>Install from source instead</summary>

1. Clone this repository.
2. Open `chrome://extensions` (or `edge://extensions`) and turn on
   **Developer mode**.
3. Click **Load unpacked** and select the repository folder.

</details>

## How it works

No build step and no dependencies: the files listed in `manifest.json` are
what runs.

| File | Role |
|---|---|
| `src/content-main.js` | Content script entry: converts the page, listens to the popup |
| `src/core/auto-json-detector.js` | Decides whether a page is JSON and swaps in the table |
| `src/core/message-handler.js` | The popup's *Detect & Convert* and live settings |
| `src/utils/json-detector.js` | Parsing (numbers kept exact) and turning JSON into rows |
| `src/components/table-viewer.js` | The table: rendering, expanding, search, sort, focus, CSV |
| `src/utils/ui-utils.js` | Toolbar, JSON view, export menu |
| `src/utils/theme-manager.js`, `style-manager.js` | Theme tokens, density, styles |
| `popup.html`, `popup.js` | Toolbar popup: paste box and settings |
| `viewer.html`, `viewer.js` | The tab that shows pasted JSON |

## Tests

Every change is test-driven — see [CLAUDE.md](CLAUDE.md) for the rules. Two
layers:

| Layer | Where | What it covers |
|---|---|---|
| Unit | [`tests/unit/`](tests/unit/) | Logic with no UI — parsing, table vs tree, rendering and search rules, JSON-view filtering, themes — on Node's built-in test runner |
| Browser | [`tests/e2e/`](tests/e2e/) | Every feature, in the unpacked extension in Playwright's Chromium against pages the tests serve themselves (no network). CLAUDE.md maps each feature to its spec |

```
npm install
npx playwright install chromium
git config core.hooksPath .githooks   # pre-commit: sensitive scan, syntax, unit tests
npm test                              # unit + browser
npm run test:e2e -- --headed          # watch the browser
npm run check                         # syntax of every script + the sensitive-data scan
```

CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) runs all of it on
every push and pull request. Publishing a GitHub release runs it again and
attaches the extension zip.

