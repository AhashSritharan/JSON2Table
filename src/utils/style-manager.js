/**
 * CSS styles for JSON2Table components
 *
 * Layout model: ONE flat table. Nested values are emitted as sibling <tr>s
 * carrying a --depth, not as tables inside cells. That keeps a single aligned
 * value column at every depth instead of pushing it right by a full column
 * width per level.
 */
class StyleManager {
  static injectTableStyles() {
    const existing = document.getElementById('json2tableStyles');
    if (existing) existing.remove();

    const style = document.createElement('style');
    style.id = 'json2tableStyles';
    style.textContent = this.getTableStyles()
      + this.getToolbarStyles()
      + this.getModalStyles()
      + (typeof ThemeManager !== 'undefined' ? ThemeManager.getJsonViewStyles() : '');
    document.head.appendChild(style);
  }

  static getTableStyles() {
    return `
      .json2table-table {
        /* width:auto + min-width:100% lets a many-column table size to its
           content and scroll horizontally. Forcing width:100% made the auto
           layout squeeze every column toward min-content. */
        width: auto;
        min-width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: var(--font-size);
        line-height: var(--line-height);
        background: var(--bg);
        color: var(--text);
      }

      .json2table-table.is-fixed {
        table-layout: fixed;
        width: 100%;
      }

      /* Tree mode has no header row; the first record still needs a boundary
         against the toolbar. */
      .json2table-table.is-headerless tbody tr:first-child > td {
        padding-top: calc(var(--row-py) + 4px);
      }

      .json2table-table th {
        background: var(--header-bg);
        color: var(--text-secondary);
        padding: 8px var(--row-px);
        text-align: left;
        border-bottom: 1px solid var(--border-strong);
        font-weight: 600;
        font-size: 12px;
        letter-spacing: 0.01em;
        position: sticky;
        top: 0;
        z-index: 30;
        white-space: nowrap;
        user-select: none;
      }

      .json2table-table th .j2t-th-inner {
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        border-radius: 4px;
        margin: -2px -4px;
        padding: 2px 4px;
      }

      .json2table-table th .j2t-th-inner:hover {
        background: var(--hover-bg);
        color: var(--text);
      }

      .j2t-sort-indicator {
        font-size: 9px;
        opacity: 0.35;
        transition: opacity 0.15s;
      }

      th[aria-sort="ascending"] .j2t-sort-indicator,
      th[aria-sort="descending"] .j2t-sort-indicator {
        opacity: 1;
        color: var(--primary);
      }

      /* Drag handle for column resize */
      .j2t-col-resizer {
        position: absolute;
        top: 0;
        right: -3px;
        width: 7px;
        height: 100%;
        cursor: col-resize;
        z-index: 2;
        background: transparent;
      }

      .j2t-col-resizer::after {
        content: '';
        position: absolute;
        left: 3px;
        top: 20%;
        height: 60%;
        border-left: 2px solid transparent;
        transition: border-color 0.15s;
      }

      .j2t-col-resizer:hover::after,
      .j2t-col-resizer.is-dragging::after {
        border-left-color: var(--primary);
      }

      .json2table-table td {
        padding: var(--row-py) var(--row-px);
        color: var(--text);
        vertical-align: top;
        overflow-wrap: break-word;
      }

      /* Caps stop a single column from eating the viewport in the auto layout.
         They must NOT apply once a column has an explicit width from a resize,
         or dragging wider would have no effect. */
      .json2table-table:not(.is-fixed) td {
        max-width: 340px;
      }

      /* Rules only between top-level records, not between every nested row.
         Lines at every depth read as noise. */
      .json2table-table tr.j2t-root-row:not(:first-child) > td {
        border-top: 1px solid var(--border);
      }

      .json2table-table tr.j2t-root-row > td {
        font-weight: 500;
      }

      .json2table-table tbody tr:hover > td {
        background: var(--hover-bg);
      }

      .json2table-table tbody tr.is-cursor > td {
        background: var(--selected-bg);
      }

      .json2table-table tbody tr:focus {
        outline: none;
      }

      .json2table-table tbody tr:focus-visible > td:first-child {
        box-shadow: inset 2px 0 0 0 var(--focus-ring);
      }

      .json2table-table tbody tr:focus-visible > td {
        background: var(--selected-bg);
      }

      /* Sticky key column keeps the property name visible on wide tables. */
      .json2table-table td.j2t-sticky-col,
      .json2table-table th.j2t-sticky-col {
        position: sticky;
        left: 0;
        z-index: 20;
        background: var(--bg);
      }

      .json2table-table th.j2t-sticky-col {
        z-index: 40;
        background: var(--header-bg);
      }

      .json2table-table tbody tr:hover > td.j2t-sticky-col {
        background: var(--hover-bg);
      }

      .json2table-table td.j2t-sticky-col::after {
        content: '';
        position: absolute;
        top: 0;
        right: 0;
        bottom: 0;
        border-right: 1px solid var(--border);
      }

      /* ---- Tree rows -------------------------------------------------- */

      .json2table-table td.tree-key {
        padding: 0;
        height: 1px; /* lets the flex child resolve height:100% */
        color: var(--text-secondary);
        font-weight: 400;
      }

      .j2t-keywrap {
        display: flex;
        align-items: stretch;
        height: 100%;
        min-height: 100%;
      }

      .j2t-guides {
        display: flex;
        flex: none;
      }

      .j2t-guides > i {
        display: block;
        width: var(--tree-indent);
        flex: none;
        border-left: 1px solid var(--guide);
      }

      .j2t-guides > i:first-child {
        margin-left: var(--row-px);
        border-left-color: transparent;
      }

      tr.is-cursor .j2t-guides > i:last-child,
      tr:focus-visible .j2t-guides > i:last-child {
        border-left-color: var(--guide-active);
      }

      .j2t-keylabel {
        display: flex;
        align-items: center;
        gap: 5px;
        min-width: 0;
        padding: var(--row-py) var(--row-px) var(--row-py) 4px;
      }

      .j2t-key {
        overflow-wrap: break-word;
      }

      /* Detail rows: used when the table has real data columns, so an expanded
         value cannot be spread across them without stranding it. */
      .j2t-detail-row > td {
        padding: 0;
        height: 1px;
        background: var(--surface-raised);
        box-shadow: inset 3px 0 0 -1px var(--guide-active);
      }

      .json2table-table tbody tr.j2t-detail-row:hover > td {
        background: var(--hover-bg);
      }

      /* ---- In-cell expansion (multi-column mode) ----------------------- */

      /* Expanded content stays inside its own cell so every record's value for
         a column lines up under that column as you scroll. Bounded width keeps
         one expanded column from swallowing the table. */
      .j2t-cell-children {
        margin: 5px 0 3px 7px;
        padding-left: 9px;
        border-left: 1px solid var(--guide);
        max-width: 560px;
        /* Floor the column width. Without it an expanded cell can be squeezed
           to min-content by the auto table layout and wrap one char per line. */
        min-width: 240px;
      }

      .j2t-cell-row {
        display: flex;
        align-items: baseline;
        gap: 10px;
        padding: 1px 0;
        min-width: 0;
      }

      .j2t-cell-key {
        flex: none;
        min-width: 84px;
        max-width: 170px;
        color: var(--text-secondary);
        font-weight: 400;
        overflow-wrap: break-word;
      }

      .j2t-cell-val {
        flex: 1;
        min-width: 0;
        overflow-wrap: break-word;
      }

      /* Cells holding a sub-table get a larger starting cap so the inline table
         can show its columns instead of scrolling internally. */
      .json2table-table:not(.is-fixed) td.j2t-cell-wide {
        max-width: 760px;
      }

      /* The whole chain below the cell is width:100% so the sub-table tracks
         the column: widen the column and the internal scrollbar goes away. */
      .j2t-cell-children-table {
        max-width: none;
        min-width: 0;
        width: 100%;
      }

      .json2table-cell .j2t-subtable-wrap {
        max-width: 100%;
        width: 100%;
      }

      .json2table-cell .j2t-subtable {
        width: 100%;
      }

      .json2table-cell .j2t-subtable td,
      .json2table-cell .j2t-subtable th {
        max-width: 260px;
        white-space: normal;
      }

      .j2t-cell-children .j2t-subtable-wrap {
        margin: 2px 0 4px;
      }

      /* ---- Inline sub-table (array of uniform objects) ----------------- */

      /* Scrolls inside its own box: a wide sub-table can never widen the outer
         table or shift the main value column. */
      /* flex: 0 1 auto so the box hugs the table's natural column widths
         instead of stretching them apart to fill the row. */
      .j2t-subtable-wrap {
        flex: 0 1 auto;
        min-width: 0;
        overflow-x: auto;
        margin: 6px var(--row-px) 8px 4px;
        border: 1px solid var(--border);
        border-radius: 7px;
        background: var(--bg);
      }

      .j2t-subtable {
        border-collapse: separate;
        border-spacing: 0;
        width: auto;
        font-size: calc(var(--font-size) - 1px);
      }

      .j2t-subtable th {
        position: static;
        background: var(--header-bg);
        color: var(--text-secondary);
        font-size: 11px;
        font-weight: 600;
        text-align: left;
        padding: 5px 10px;
        border-bottom: 1px solid var(--border);
        white-space: nowrap;
      }

      .j2t-subtable td {
        padding: 5px 10px;
        border-top: 1px solid var(--border);
        vertical-align: top;
        color: var(--text);
        min-width: 104px;
        max-width: 320px;
      }

      /* Dates and numbers are atomic: wrapping them makes rows four lines tall
         for no gain. Let the box scroll horizontally instead. */
      .j2t-subtable .date-value,
      .j2t-subtable .number-value,
      .j2t-subtable .boolean-value {
        white-space: nowrap;
      }

      .j2t-subtable tbody tr:first-child > td {
        border-top: none;
      }

      .j2t-subtable tbody tr:hover > td {
        background: var(--hover-bg);
      }

      .j2t-subtable .j2t-sub-index {
        color: var(--null-color);
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
        font-size: 10px;
        text-align: right;
        width: 1%;
        white-space: nowrap;
        padding-right: 12px;
      }

      .j2t-subtable td.j2t-numeric {
        text-align: right;
      }

      .j2t-subtable .j2t-sub-more {
        text-align: center;
        background: var(--surface-raised);
      }

      .j2t-subtable .j2t-preview {
        max-width: 24ch;
      }

      .j2t-subtable .inline-image {
        max-width: 48px;
        max-height: 36px;
      }

      /* Table / list switch for one array */
      .j2t-view-toggle {
        flex: none;
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        margin-left: 2px;
        border: none;
        border-radius: 4px;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 12px;
        line-height: 1;
        opacity: 0;
        transition: opacity 0.15s, background 0.15s;
      }

      tr:hover .j2t-view-toggle,
      tr:focus-within .j2t-view-toggle,
      .j2t-view-toggle:focus-visible {
        opacity: 1;
      }

      .j2t-view-toggle:hover {
        background: var(--hover-bg);
        color: var(--primary);
      }

      .j2t-view-toggle:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .j2t-key-index {
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        color: var(--null-color);
      }

      /* Disclosure triangle. A real <button> so it is tabbable and announced. */
      .j2t-twisty {
        flex: none;
        width: 16px;
        height: 16px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 0;
        border: none;
        border-radius: 3px;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        font-size: 9px;
        line-height: 1;
        transition: transform 0.12s ease, background 0.12s;
      }

      .j2t-twisty:hover {
        background: var(--hover-bg);
        color: var(--text);
      }

      .j2t-twisty:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .j2t-twisty[aria-expanded="true"] {
        transform: rotate(90deg);
      }

      .j2t-twisty-spacer {
        flex: none;
        width: 16px;
      }

      /* ---- Badges ----------------------------------------------------- */

      .expandable-array, .expandable-object {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: var(--badge-py) 7px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        cursor: pointer;
        transition: background 0.15s;
        user-select: none;
        vertical-align: baseline;
      }

      .expandable-array {
        background: var(--array-badge-bg);
        color: var(--array-badge);
        border: 1px solid var(--array-badge-border);
      }

      .expandable-object {
        background: var(--object-badge-bg);
        color: var(--object-badge);
        border: 1px solid var(--object-badge-border);
      }

      .expandable-array:hover, .expandable-object:hover {
        filter: brightness(0.97) saturate(1.2);
      }

      .expandable-array:focus-visible, .expandable-object:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .j2t-preview {
        color: var(--null-color);
        font-size: 0.92em;
        margin-left: 8px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 46ch;
        display: inline-block;
        vertical-align: bottom;
      }

      .j2t-valwrap {
        display: flex;
        align-items: baseline;
        gap: 2px;
        min-width: 0;
      }

      /* ---- Focus (zoom-in) button ------------------------------------- */

      .focus-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        flex: none;
        border-radius: 4px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        margin-left: 2px;
        opacity: 0;
        transition: opacity 0.15s, background 0.15s;
      }

      tr:hover .focus-btn,
      tr:focus-within .focus-btn,
      .focus-btn:focus-visible {
        opacity: 1;
      }

      .focus-btn:hover {
        background: var(--hover-bg);
        color: var(--primary);
      }

      .focus-btn:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .focus-btn svg {
        width: 13px;
        height: 13px;
        display: block;
      }

      /* ---- "Show more" row -------------------------------------------- */

      .j2t-more-btn {
        background: transparent;
        border: 1px dashed var(--border-strong);
        color: var(--text-secondary);
        border-radius: 6px;
        padding: 3px 10px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
      }

      .j2t-more-btn:hover {
        background: var(--hover-bg);
        color: var(--text);
      }

      .j2t-more-btn:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      /* ---- Value types ------------------------------------------------- */

      .null-value {
        color: var(--null-color);
        font-style: italic;
      }

      .empty-string {
        color: var(--null-color);
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
      }

      .boolean-value { font-weight: 600; }
      .boolean-value.true { color: var(--bool-true); }
      .boolean-value.false { color: var(--bool-false); }

      .number-value {
        color: var(--number-color);
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-variant-numeric: tabular-nums;
      }

      /* Strings inherit --text on purpose: the default case should not
         consume the color signal. */
      /* pre-wrap: show repeated spaces and line breaks as they are in the
         JSON instead of collapsing them. */
      .string-value { color: var(--string-color); white-space: pre-wrap; }

      .date-value {
        color: var(--date-color);
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace;
        font-variant-numeric: tabular-nums;
      }

      td.j2t-numeric {
        text-align: right;
        font-variant-numeric: tabular-nums;
      }

      .j2t-empty-container {
        color: var(--null-color);
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
        font-size: 11px;
      }

      /* ---- Search ------------------------------------------------------ */

      .search-highlight {
        background: var(--mark-bg);
        color: var(--mark-fg);
        padding: 0 2px;
        border-radius: 2px;
      }

      .search-highlight.is-current {
        background: var(--mark-current-bg);
        color: var(--mark-current-fg);
        box-shadow: 0 0 0 2px var(--mark-current-bg);
      }

      .j2t-empty-state {
        padding: 48px 24px;
        text-align: center;
        color: var(--text-secondary);
      }

      .j2t-empty-state strong {
        display: block;
        font-size: 15px;
        color: var(--text);
        margin-bottom: 6px;
      }

      /* ---- Images ------------------------------------------------------ */

      .image-value-container {
        position: relative;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        width: fit-content;
        min-width: 88px;
      }

      .inline-image {
        max-width: 80px;
        max-height: 60px;
        object-fit: cover;
        border-radius: 6px;
        border: 1px solid var(--border);
        cursor: pointer;
        flex-shrink: 0;
        transition: transform 0.15s, box-shadow 0.15s;
      }

      .inline-image:hover {
        transform: scale(1.04);
        box-shadow: var(--shadow-md);
      }

      .image-value-container:hover .image-preview {
        opacity: 1;
        visibility: visible;
      }

      .image-preview {
        position: fixed;
        z-index: 1000;
        background: var(--header-bg);
        padding: 8px;
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        border: 1px solid var(--border);
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.15s, visibility 0.15s;
        top: var(--mouse-y, 50%);
        left: var(--mouse-x, 50%);
        transform: var(--preview-transform, translate(15px, -50%));
      }

      .image-preview img {
        display: block;
        max-width: 300px;
        border-radius: 4px;
      }

      .preview-info {
        margin-top: 8px;
        font-size: 11px;
        color: var(--text-secondary);
        text-align: center;
      }

      @media (prefers-reduced-motion: reduce) {
        .json2table-table *,
        .json2table-table *::before,
        .json2table-table *::after {
          transition-duration: 0.01ms !important;
          animation-duration: 0.01ms !important;
        }
      }
    `;
  }

  static getToolbarStyles() {
    return `
      .json2table-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 10px 16px;
        background: var(--header-bg);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 1000;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        flex-wrap: wrap;
      }

      .json2table-titlebar {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 0;
      }

      .json2table-title {
        font-size: 15px;
        font-weight: 650;
        color: var(--text);
        white-space: nowrap;
      }

      .json2table-subtitle {
        font-size: 12px;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      .json2table-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        flex-wrap: wrap;
      }

      /* Buttons: exactly one filled action in the bar. */
      .j2t-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 11px;
        background: var(--button-bg);
        color: var(--text);
        border: 1px solid var(--button-border);
        border-radius: 6px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        line-height: 1.3;
        transition: background 0.15s, border-color 0.15s;
        white-space: nowrap;
      }

      .j2t-btn:hover:not(:disabled) {
        background: var(--hover-bg);
        border-color: var(--border-strong);
      }

      .j2t-btn:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .j2t-btn:disabled {
        opacity: 0.45;
        cursor: not-allowed;
      }

      .j2t-btn-primary {
        background: var(--button-active);
        border-color: var(--button-active);
        color: var(--primary-contrast);
      }

      .j2t-btn-primary:hover:not(:disabled) {
        background: var(--primary);
        border-color: var(--primary);
        filter: brightness(1.08);
      }

      .j2t-btn.is-success {
        background: var(--success);
        border-color: var(--success);
        color: var(--primary-contrast);
      }

      .j2t-btn-icon {
        padding: 6px 8px;
      }

      .j2t-btn.is-active {
        background: var(--selected-bg);
        border-color: var(--primary);
        color: var(--primary);
      }

      /* Segmented control: a mode switch, not an action. */
      .j2t-segmented {
        display: inline-flex;
        background: var(--bg);
        border: 1px solid var(--button-border);
        border-radius: 6px;
        padding: 2px;
        gap: 2px;
      }

      .j2t-segmented button {
        padding: 4px 12px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        border-radius: 4px;
        cursor: pointer;
        font-size: 13px;
        font-weight: 500;
        font-family: inherit;
        transition: background 0.15s, color 0.15s;
      }

      .j2t-segmented button[aria-pressed="true"] {
        background: var(--selected-bg);
        color: var(--primary);
        font-weight: 600;
      }

      .j2t-segmented button:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: -1px;
      }

      /* Search */
      .j2t-search-wrap {
        display: flex;
        align-items: center;
        gap: 4px;
        background: var(--bg);
        border: 1px solid var(--button-border);
        border-radius: 6px;
        padding: 0 4px 0 8px;
        transition: border-color 0.15s, box-shadow 0.15s;
      }

      .j2t-search-wrap:focus-within {
        border-color: var(--primary);
        box-shadow: 0 0 0 3px var(--primary-light);
      }

      .j2t-search-wrap svg {
        flex: none;
        color: var(--text-secondary);
      }

      #json2table-search {
        border: none;
        outline: none;
        background: transparent;
        color: var(--text);
        font-size: 13px;
        font-family: inherit;
        padding: 6px 2px;
        width: 190px;
      }

      #json2table-search::placeholder {
        color: var(--null-color);
      }

      .j2t-search-count {
        font-size: 11px;
        color: var(--text-secondary);
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
        min-width: 4ch;
        text-align: right;
      }

      .j2t-search-count.is-empty {
        color: var(--error);
      }

      .j2t-search-nav {
        display: flex;
        gap: 1px;
      }

      .j2t-search-nav button {
        width: 20px;
        height: 20px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        border-radius: 3px;
        cursor: pointer;
        font-size: 9px;
        padding: 0;
      }

      .j2t-search-nav button:hover:not(:disabled) {
        background: var(--hover-bg);
        color: var(--text);
      }

      .j2t-search-nav button:disabled {
        opacity: 0.3;
        cursor: default;
      }

      .j2t-search-nav button:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      /* Breadcrumbs */
      #json2table-breadcrumb {
        display: flex;
        align-items: center;
        font-size: 12px;
        color: var(--text-secondary);
        gap: 2px;
        flex-wrap: wrap;
      }

      .breadcrumb-link {
        color: var(--primary);
        cursor: pointer;
        background: none;
        border: none;
        font: inherit;
        font-weight: 500;
        padding: 3px 6px;
        border-radius: 4px;
      }

      .breadcrumb-link:hover {
        background: var(--primary-light);
      }

      .breadcrumb-link:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .breadcrumb-separator {
        color: var(--null-color);
      }

      .breadcrumb-current {
        font-weight: 600;
        color: var(--text);
        padding: 3px 6px;
      }

      /* Dropdown menu */
      .j2t-menu {
        position: fixed;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
        box-shadow: var(--shadow-lg);
        z-index: 1000002;
        display: none;
        min-width: 140px;
        padding: 4px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .j2t-menu button {
        display: block;
        width: 100%;
        padding: 7px 12px;
        background: none;
        border: none;
        border-radius: 5px;
        text-align: left;
        cursor: pointer;
        font-size: 13px;
        font-family: inherit;
        color: var(--text);
        white-space: nowrap;
      }

      .j2t-menu button:hover {
        background: var(--hover-bg);
      }

      .j2t-menu button:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: -2px;
      }

      /* Toast */
      .j2t-toast {
        position: fixed;
        top: 16px;
        left: 50%;
        transform: translateX(-50%);
        padding: 10px 18px;
        border-radius: 8px;
        color: #fff;
        font-weight: 500;
        font-size: 13px;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 1000001;
        box-shadow: var(--shadow-lg);
        transition: opacity 0.25s ease, transform 0.25s ease;
      }

      .j2t-toast.is-success { background: #047857; }
      .j2t-toast.is-info    { background: #1d4ed8; }
      .j2t-toast.is-warning { background: #b45309; }
      .j2t-toast.is-error   { background: #b91c1c; }

      /* JSON source view */
      .j2t-json-view {
        height: 100%;
        overflow: auto;
        background: var(--bg-color);
      }

      .j2t-json-toolbar {
        padding: 10px 16px;
        border-bottom: 1px solid var(--border);
        background: var(--header-bg);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
        position: sticky;
        top: 0;
        /* Same as the header: nothing above sets a font, and buttons inherit. */
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }

      .j2t-json-actions {
        display: flex;
        gap: 6px;
      }

      .j2t-json-toolbar h3 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
      }

      #json2table-json-content {
        margin: 0;
        padding: 16px 20px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        color: var(--text);
        background: var(--bg-color);
        font-family: 'JetBrains Mono', ui-monospace, 'SF Mono', Monaco, Menlo, monospace;
        font-size: 12.5px;
        line-height: 1.6;
        tab-size: 2;
      }
    `;
  }

  static getModalStyles() {
    return `
      .json2table-value-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(3px);
      }

      .modal-content {
        position: relative;
        background: var(--bg);
        width: 90%;
        max-width: 640px;
        max-height: 85vh;
        border-radius: 12px;
        box-shadow: var(--shadow-lg);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--border);
      }

      .modal-header {
        padding: 14px 20px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        background: var(--header-bg);
      }

      .modal-header h3 {
        margin: 0;
        font-size: 15px;
        font-weight: 600;
        color: var(--text);
      }

      .modal-close {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 18px;
        line-height: 1;
      }

      .modal-close:hover {
        background: var(--hover-bg);
        color: var(--error);
      }

      .modal-close:focus-visible {
        outline: 2px solid var(--focus-ring);
        outline-offset: 1px;
      }

      .modal-body {
        padding: 16px 20px;
        overflow-y: auto;
        font-size: 13px;
      }

      .content-header {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        margin-bottom: 10px;
      }

      .object-property, .array-item {
        display: flex;
        gap: 12px;
        padding: 6px 8px;
        border-radius: 5px;
      }

      .object-property:nth-child(odd), .array-item:nth-child(odd) {
        background: var(--hover-bg);
      }

      .property-key, .item-index {
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
        font-size: 12px;
        color: var(--text-secondary);
        min-width: 120px;
        flex: none;
      }

      .property-value, .item-value {
        font-family: 'JetBrains Mono', ui-monospace, Menlo, monospace;
        font-size: 12px;
        color: var(--text);
        overflow-wrap: anywhere;
      }

      .empty-state {
        color: var(--null-color);
        font-style: italic;
      }
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StyleManager;
} else {
  window.StyleManager = StyleManager;
}
