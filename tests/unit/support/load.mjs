// Loads the extension's classes into Node the way the manifest loads them into
// a page: as globals that refer to each other by name. `chrome.storage.local`
// is an in-memory stand-in; `document` is a stub with no elements, enough for
// logic that never touches the DOM.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export const storage = new Map();

globalThis.chrome ??= {
    storage: {
        local: {
            get(keys, callback) {
                const list = keys == null ? [...storage.keys()] : [].concat(keys);
                const result = Object.fromEntries(list.filter((k) => storage.has(k)).map((k) => [k, storage.get(k)]));
                callback?.(result);
                return Promise.resolve(result);
            },
            set(values, callback) {
                for (const [k, v] of Object.entries(values)) storage.set(k, v);
                callback?.();
                return Promise.resolve();
            },
        },
    },
};
globalThis.document ??= { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [] };

export const JSONDetector = globalThis.JSONDetector = require('../../../src/utils/json-detector.js');
export const ThemeManager = globalThis.ThemeManager = require('../../../src/utils/theme-manager.js');
export const UIUtils = globalThis.UIUtils = require('../../../src/utils/ui-utils.js');
export const TableViewer = globalThis.TableViewer = require('../../../src/components/table-viewer.js');

/** A TableViewer over `json`, as UIUtils.createTableInterface builds it. */
export function viewerFor(json) {
    const data = typeof json === 'string' ? JSONDetector.parse(json) : json;
    return new TableViewer(JSONDetector.extractTableData(data), { treeMode: JSONDetector.isTreeShaped(data) });
}
