/**
 * Table viewer with a flat, indented tree row model.
 *
 * Nested values are emitted as sibling <tr>s carrying a depth, NOT as tables
 * nested inside cells. One aligned value column at every depth; indentation
 * costs one --tree-indent per level instead of a full column width.
 *
 * All text is HTML-escaped before interpolation -- the JSON comes from
 * arbitrary pages and is not trusted.
 */

class TableViewer {
  // Printable unit separator; effectively never appears in JSON keys. A static
  // field rather than a top-level const, so re-injecting this script cannot
  // throw "already declared".
  static SEP = '␟';

  // Beyond this an inline sub-table stops being readable; those arrays stay trees.
  static MAX_SUBTABLE_COLS = 12;

  // How deep in-cell nesting may go before deferring to the modal.
  static MAX_CELL_DEPTH = 5;
  /**
   * @param data      table rows (JSONDetector.extractTableData)
   * @param treeMode  the rows are property/value pairs, not records
   *                  (JSONDetector.isTreeShaped of the JSON they came from)
   */
  constructor(data, { treeMode = false } = {}) {
    this.container = document.getElementById('json2table-table-container');

    this.treeMode = treeMode;
    this.rootTreeMode = treeMode;
    this.allExpanded = false; // what the Expand all / Collapse all toggle offers

    this.rootData = data;
    this.currentData = data;
    this.currentContext = {
      data: data,
      displayName: 'Root',
      breadcrumbPath: []
    };

    // Stable row IDs so expansion state survives filtering and sorting.
    this.sourceRows = (Array.isArray(data) ? data : []).map((row, index) => ({
      ...row,
      __rowId: index
    }));
    this.filteredData = this.sourceRows;
    this.columns = this.extractColumns(this.sourceRows);

    // Expansion is keyed by data path, not by render order.
    this.expanded = new Set();
    this.shownCounts = new Map(); // path -> how many children are revealed
    this.arrayViewMode = new Map(); // path -> 'table' | 'list' user override
    this.childPageSize = 100;

    this.searchQuery = null;
    this.matchCount = 0;
    this.currentMatch = 0;

    this.sort = { col: null, dir: null };
    this.colWidths = new Map();

    this.cursorIndex = 0;
    this.pendingFocus = false;
    this.rowModel = [];

    this.focusStack = [];
    this.focusObjectRegistry = new Map();

    this.modalOverlay = null;
    this.csvDelimiter = ',';

    chrome.storage.local.get(['csvDelimiter'], (result) => {
      this.csvDelimiter = result.csvDelimiter || this.getLikelyCsvDelimiter();
    });

    // Bind once. The previous implementation re-bound and re-added a listener
    // on every render without ever removing the old one.
    this.handleTableClick = this.handleTableClick.bind(this);
    this.handleTableKeydown = this.handleTableKeydown.bind(this);
    this.handleBreadcrumbClick = this.handleBreadcrumbClick.bind(this);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.listenersAttached = false;
  }

  /* ------------------------------------------------------------------ *
   * Escaping
   * ------------------------------------------------------------------ */

  esc(value) {
    return String(value).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  escapeRegex(string) {
    return String(string).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Wrap search matches in <mark>. Input MUST already be escaped -- this
   * inserts markup, so running it on raw text would let JSON content break out.
   */
  highlightSearchTerm(escapedText) {
    if (!this.searchQuery || typeof escapedText !== 'string') return escapedText;
    const needle = this.esc(this.searchQuery);
    if (!needle) return escapedText;
    const regex = new RegExp(`(${this.escapeRegex(needle)})`, 'gi');
    return escapedText.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  /** Escape then highlight, in that order. */
  text(value) {
    return this.highlightSearchTerm(this.esc(value));
  }

  /* ------------------------------------------------------------------ *
   * Data shape helpers
   * ------------------------------------------------------------------ */

  isContainer(value) {
    return value !== null && typeof value === 'object' && !JSONDetector.isRawNumber(value);
  }

  isEmptyContainer(value) {
    if (!this.isContainer(value)) return false;
    return (Array.isArray(value) ? value.length : Object.keys(value).length) === 0;
  }

  entriesOf(container) {
    return Array.isArray(container)
      ? container.map((v, i) => [String(i), v])
      : Object.entries(container);
  }

  childCount(value) {
    return Array.isArray(value) ? value.length : Object.keys(value).length;
  }

  cellPath(rowId, col) {
    return `r${rowId}${TableViewer.SEP}${col}`;
  }

  /** Property/value shape: the whole table reads as a tree. */
  get isTreeMode() {
    return this.treeMode;
  }

  /**
   * Right-aligning numbers only pays off in a real numeric column. In tree mode
   * the value column is the full remaining width, so right-alignment would
   * strand each number a screen away from its key.
   */
  numericClass(value) {
    return ((typeof value === 'number' || JSONDetector.isRawNumber(value)) && !this.isTreeMode) ? ' j2t-numeric' : '';
  }

  extractColumns(data) {
    if (!Array.isArray(data) || data.length === 0) return [];

    // Columns in order of first appearance, matching the original JSON.
    const columns = new Set();

    data.forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(key => {
          if (key !== '__rowId') columns.add(key);
        });
      }
    });

    return Array.from(columns);
  }

  /* ------------------------------------------------------------------ *
   * Row model -- the flat list of visible rows
   * ------------------------------------------------------------------ */

  /**
   * An array of reasonably uniform objects is genuinely tabular -- one row per
   * item, one column per key beats a tree of N expandable nodes. Anything else
   * (ragged shapes, arrays of primitives, arrays of arrays) reads better as a
   * tree, so it falls through to pushChildren.
   */
  qualifiesForSubTable(value) {
    if (!Array.isArray(value) || value.length < 2) return false;

    const objects = value.filter(v => this.isContainer(v) && !Array.isArray(v));
    if (objects.length < value.length * 0.8) return false;

    const columns = this.getArrayColumns(objects);
    if (columns.length === 0 || columns.length > TableViewer.MAX_SUBTABLE_COLS) return false;

    // Uniformity: the most common key must appear in most items, otherwise the
    // table would be mostly empty cells.
    const topKeyCount = Math.max(...columns.map(col =>
      objects.filter(o => Object.prototype.hasOwnProperty.call(o, col)).length));
    return topKeyCount >= objects.length * 0.6;
  }

  /** Union of keys across the items, in order of first appearance. */
  getArrayColumns(items) {
    const columns = new Set();

    items.forEach(item => {
      if (!this.isContainer(item) || Array.isArray(item)) return;
      Object.keys(item).forEach(key => columns.add(key));
    });

    return Array.from(columns);
  }

  /** 'table' or 'list' for an expanded array, honouring any per-array override. */
  arrayView(path, value) {
    return this.arrayViewMode.get(path)
      || (this.qualifiesForSubTable(value) ? 'table' : 'list');
  }

  /** Expand an already-expanded container into either a sub-table or tree rows. */
  pushExpansion(rows, value, path, depth, sourceCol) {
    if (Array.isArray(value) && this.arrayView(path, value) === 'table') {
      rows.push({ kind: 'subtable', depth, path, value, sourceCol });
    } else {
      this.pushChildren(rows, value, path, depth, sourceCol);
    }
  }

  /**
   * Two shapes, two layouts:
   *
   * - Tree mode (property / value): expansions become sibling rows. Nesting
   *   inside the cell would push the value column right one column-width per
   *   level, which is the layout this rewrite exists to remove.
   *
   * - Multi-column (array of records): expansions stay INSIDE their cell. Here
   *   the column is the comparison axis -- every record's `reviews` belongs
   *   under the Reviews header so they stack and align as you scroll down.
   *   Pulling them into full-width rows destroys exactly that.
   */
  buildRowModel() {
    const rows = [];

    this.filteredData.forEach((row, rowIndex) => {
      rows.push({ kind: 'root', rowIndex, row });

      if (!this.isTreeMode) return; // multi-column expands in-cell

      this.columns.forEach(col => {
        const value = row[col];
        if (!this.isContainer(value) || this.isEmptyContainer(value)) return;
        const path = this.cellPath(row.__rowId, col);
        if (!this.expanded.has(path)) return;
        this.pushExpansion(rows, value, path, 1, col);
      });
    });

    return rows;
  }

  pushChildren(rows, container, parentPath, depth, sourceCol) {
    if (depth > 40) return; // guard against pathological nesting

    const entries = this.visibleEntries(container);
    const shown = Math.min(
      entries.length,
      this.shownCounts.get(parentPath) || this.childPageSize
    );
    const isArrayParent = Array.isArray(container);

    for (let i = 0; i < shown; i++) {
      const [key, value] = entries[i];
      const path = `${parentPath}${TableViewer.SEP}${key}`;
      const container_ = this.isContainer(value) && !this.isEmptyContainer(value);
      const isExpanded = container_ && this.expanded.has(path);

      rows.push({
        kind: 'child',
        depth,
        key,
        value,
        path,
        sourceCol,
        isArrayParent,
        hasChildren: container_,
        isExpanded
      });

      if (isExpanded) {
        this.pushExpansion(rows, value, path, depth + 1, sourceCol);
      }
    }

    if (entries.length > shown) {
      rows.push({
        kind: 'more',
        depth,
        path: parentPath,
        shown,
        total: entries.length,
        sourceCol
      });
    }
  }

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  render() {
    // Rebuild the registry each render so it cannot grow without bound.
    this.focusObjectRegistry.clear();

    this.rowModel = this.buildRowModel();

    if (this.cursorIndex >= this.rowModel.length) {
      this.cursorIndex = Math.max(0, this.rowModel.length - 1);
    }

    if (this.filteredData.length === 0) {
      this.container.innerHTML = this.renderEmptyState();
      this.attachListeners();
      this.updateSearchStatus();
      this.updateFocusUI();
      return;
    }

    // In tree mode (property / value) pin the key column so deep keys have room
    // and long values wrap instead of stretching the table past the viewport.
    let useFixed = false;
    let colgroup = '';

    if (this.colWidths.size > 0) {
      useFixed = true;
      colgroup = `<colgroup>${this.columns.map(col => {
        const w = this.colWidths.get(col);
        return `<col${w ? ` style="width:${w}px"` : ''}>`;
      }).join('')}</colgroup>`;
    } else if (this.isTreeMode) {
      useFixed = true;
      colgroup = '<colgroup><col style="width:340px"><col></colgroup>';
    }

    // Multi-column headers name real fields (Id, Title, Price) and earn their
    // row. In tree mode they would read "Property | Value" -- two words that
    // label nothing the reader cannot already see. Sorting moves to the toolbar.
    const thead = this.isTreeMode ? '' : `
        <thead>
          <tr>${this.columns.map((col, i) => this.renderHeaderCell(col, i)).join('')}</tr>
        </thead>`;

    const html = `
      <table class="json2table-table${useFixed ? ' is-fixed' : ''}${this.isTreeMode ? ' is-headerless' : ''}"
             role="treegrid"
             aria-label="JSON data"
             aria-rowcount="${this.rowModel.length}">
        ${colgroup}${thead}
        <tbody>
          ${this.rowModel.map((r, i) => this.renderRow(r, i)).join('')}
        </tbody>
      </table>
    `;

    this.container.innerHTML = html;
    this.attachListeners();
    this.applyCursor();
    this.updateSearchStatus();
    this.updateFocusUI();
  }

  renderEmptyState() {
    if (this.searchQuery) {
      return `
        <div class="j2t-empty-state">
          <strong>No matches for &ldquo;${this.esc(this.searchQuery)}&rdquo;</strong>
          <span>Try a shorter term, or clear the search to see all ${this.sourceRows.length} rows.</span>
        </div>`;
    }
    return `
      <div class="j2t-empty-state">
        <strong>Nothing to show</strong>
        <span>This JSON produced no table rows.</span>
      </div>`;
  }

  renderHeaderCell(col, index) {
    const sorted = this.sort.col === col ? this.sort.dir : null;
    const ariaSort = sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none';
    const arrow = sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '▲';
    const sticky = index === 0 ? ' j2t-sticky-col' : '';
    // No handle on the last column: it has nothing to resize against, and the
    // handle's 3px overhang would push the table past the viewport.
    const isLast = index === this.columns.length - 1;

    return `
      <th class="j2t-th${sticky}" aria-sort="${ariaSort}" data-col="${this.esc(col)}" title="${this.esc(col)}">
        <div class="j2t-th-inner" role="button" tabindex="0" data-sort-col="${this.esc(col)}">
          <span>${this.esc(UIUtils.formatColumnName(col))}</span>
          <span class="j2t-sort-indicator" aria-hidden="true">${arrow}</span>
        </div>
        ${isLast ? '' : `<div class="j2t-col-resizer" data-resize-col="${this.esc(col)}" role="separator" aria-hidden="true"></div>`}
      </th>`;
  }

  renderRow(model, index) {
    switch (model.kind) {
      case 'root': return this.renderRootRow(model, index);
      case 'child': return this.renderChildRow(model, index);
      case 'subtable': return this.renderSubTableRow(model, index);
      case 'more': return this.renderMoreRow(model, index);
      default: return '';
    }
  }

  renderRootRow(model, index) {
    const { row, rowIndex } = model;

    // In tree mode the row's own key column is the meaningful name for this
    // value; the column name ("value") is not.
    const rowLabel = this.isTreeMode && typeof row[this.columns[0]] === 'string'
      ? row[this.columns[0]]
      : null;

    const cells = this.columns.map((col, i) => {
      const value = row[col];
      const path = this.cellPath(row.__rowId, col);
      const sticky = i === 0 ? ' j2t-sticky-col' : '';
      const numeric = this.numericClass(value);

      // A cell about to hold a sub-table needs more than the default column
      // cap, or the table it contains scrolls internally and hides columns.
      const holdsSubTable = !this.isTreeMode
        && Array.isArray(value)
        && this.expanded.has(path)
        && this.arrayView(path, value) === 'table';

      return `<td class="json2table-cell${sticky}${numeric}${holdsSubTable ? ' j2t-cell-wide' : ''}" data-col="${this.esc(col)}" data-row="${rowIndex}">${
        this.renderValue(value, path, rowLabel || col, this.isTreeMode ? null : 0)
      }</td>`;
    }).join('');

    return `<tr class="j2t-root-row" role="row" aria-level="1" data-index="${index}" tabindex="-1">${cells}</tr>`;
  }

  guides(depth) {
    return `<span class="j2t-guides" aria-hidden="true">${'<i></i>'.repeat(depth)}</span>`;
  }

  renderChildRow(model, index) {
    const { depth, key, value, path } = model;
    const keyLabel = model.isArrayParent
      ? `<span class="j2t-key j2t-key-index">[${this.esc(key)}]</span>`
      : `<span class="j2t-key">${this.text(key)}</span>`;

    const attrs = `role="row" aria-level="${depth + 1}"${
      model.hasChildren ? ` aria-expanded="${model.isExpanded}"` : ''
    } data-index="${index}" data-path="${this.esc(path)}" tabindex="-1"`;

    return `<tr class="j2t-tree-row" ${attrs}>
      <td class="tree-key j2t-sticky-col">
        <div class="j2t-keywrap">
          ${this.guides(depth)}
          <span class="j2t-keylabel">${keyLabel}</span>
        </div>
      </td>
      <td class="tree-val">${this.renderValue(value, path, key)}</td>
    </tr>`;
  }

  renderSubTableRow(model, index) {
    return `<tr class="j2t-subtable-row j2t-detail-row" role="row" data-index="${index}" tabindex="-1">
      <td colspan="${Math.max(1, this.columns.length)}">
        <div class="j2t-keywrap">
          ${this.guides(model.depth)}
          ${this.renderSubTableBlock(model.value, model.path, 0)}
        </div>
      </td>
    </tr>`;
  }

  /**
   * The inline table itself, independent of where it is mounted: a tree row in
   * tree mode, or directly inside a data cell in multi-column mode. It scrolls
   * inside its own box so it can never widen whatever contains it.
   */
  renderSubTableBlock(value, path, depth) {
    // While searching, keep only matching items (with their real indices) and
    // only the columns that hold a match.
    const items = this.visibleEntries(value);
    const columns = this.visibleSubTableColumns(
      this.getArrayColumns(value).slice(0, TableViewer.MAX_SUBTABLE_COLS),
      items
    );
    const shown = Math.min(items.length, this.shownCounts.get(path) || this.childPageSize);

    const head = `<tr>
      <th class="j2t-sub-index" scope="col">#</th>
      ${columns.map(col => `<th scope="col" title="${this.esc(col)}">${this.esc(UIUtils.formatColumnName(col))}</th>`).join('')}
    </tr>`;

    const body = items.slice(0, shown).map(([i, item]) => {
      const itemPath = `${path}${TableViewer.SEP}${i}`;

      if (!this.isContainer(item) || Array.isArray(item)) {
        // Ragged item inside an otherwise-uniform array.
        return `<tr>
          <td class="j2t-sub-index">${i}</td>
          <td colspan="${columns.length}">${this.renderValue(item, itemPath, String(i), depth + 1)}</td>
        </tr>`;
      }

      return `<tr>
        <td class="j2t-sub-index">${i}</td>
        ${columns.map(col => {
          const cellValue = item[col];
          const numeric = typeof cellValue === 'number' ? ' j2t-numeric' : '';
          return `<td class="${numeric.trim()}">${
            Object.prototype.hasOwnProperty.call(item, col)
              ? this.renderValue(cellValue, `${itemPath}${TableViewer.SEP}${col}`, col, depth + 1)
              : '<span class="null-value">&ndash;</span>'
          }</td>`;
        }).join('')}
      </tr>`;
    }).join('');

    const moreRow = items.length > shown
      ? `<tr><td class="j2t-sub-more" colspan="${columns.length + 1}">
          <button type="button" class="j2t-more-btn" data-more-path="${this.esc(path)}">
            Show ${Math.min(items.length - shown, this.childPageSize)} more of ${items.length}
          </button>
        </td></tr>`
      : '';

    return `<div class="j2t-subtable-wrap">
      <table class="j2t-subtable">
        <thead>${head}</thead>
        <tbody>${body}${moreRow}</tbody>
      </table>
    </div>`;
  }

  /**
   * Expanded content rendered inside its own cell (multi-column mode). A
   * uniform array becomes a sub-table; anything else becomes an indented
   * key/value list. Indentation is a few px per level rather than a column
   * width, so nesting inside a cell stays bounded.
   */
  renderInCellExpansion(value, path, depth) {
    if (depth >= TableViewer.MAX_CELL_DEPTH) {
      const focusId = this.registerFocusObject(value, 'Value', `deep-${path}`);
      return `<div class="j2t-cell-children">
        <button type="button" class="j2t-more-btn" data-show-value="${focusId}">Open remaining levels</button>
      </div>`;
    }

    // Only the outermost levels get a real table; deeper arrays fall back to a
    // list so tables never nest inside tables.
    if (Array.isArray(value) && depth <= 1 && this.arrayView(path, value) === 'table') {
      // Own modifier: a sub-table must be free to grow with the column, so it
      // opts out of the width cap that keeps key/value lists readable.
      return `<div class="j2t-cell-children j2t-cell-children-table">${
        this.renderSubTableBlock(value, path, depth)
      }</div>`;
    }

    const entries = this.visibleEntries(value);
    const shown = Math.min(entries.length, this.shownCounts.get(path) || this.childPageSize);
    const isArray = Array.isArray(value);

    const lines = entries.slice(0, shown).map(([key, val]) => {
      const childPath = `${path}${TableViewer.SEP}${key}`;
      const keyHtml = isArray
        ? `<span class="j2t-cell-key j2t-key-index">[${this.esc(key)}]</span>`
        : `<span class="j2t-cell-key">${this.text(key)}</span>`;
      return `<div class="j2t-cell-row">
        ${keyHtml}
        <span class="j2t-cell-val">${this.renderValue(val, childPath, key, depth + 1)}</span>
      </div>`;
    }).join('');

    const more = entries.length > shown
      ? `<div class="j2t-cell-row">
          <button type="button" class="j2t-more-btn" data-more-path="${this.esc(path)}">
            Show ${Math.min(entries.length - shown, this.childPageSize)} more of ${entries.length}
          </button>
        </div>`
      : '';

    return `<div class="j2t-cell-children">${lines}${more}</div>`;
  }

  renderMoreRow(model, index) {
    const remaining = model.total - model.shown;
    return `<tr class="j2t-more-row" role="row" data-index="${index}" tabindex="-1">
      <td class="tree-key j2t-sticky-col">
        <div class="j2t-keywrap">${this.guides(model.depth)}<span class="j2t-keylabel"></span></div>
      </td>
      <td>
        <button type="button" class="j2t-more-btn" data-more-path="${this.esc(model.path)}">
          Show ${Math.min(remaining, this.childPageSize)} more of ${model.total}
        </button>
      </td>
    </tr>`;
  }

  /* ------------------------------------------------------------------ *
   * Value rendering
   * ------------------------------------------------------------------ */

  /**
   * Render one value. Containers get a twisty + count badge + preview + focus
   * button; scalars get a typed span.
   */
  /**
   * @param {number|null} cellDepth  null = the expansion is rendered as sibling
   *   rows (tree mode). A number = render it inline inside this cell at that
   *   nesting depth (multi-column mode).
   */
  renderValue(value, path, label, cellDepth = null) {
    if (value === undefined) return '<span class="null-value">&ndash;</span>';
    if (value === null) return '<span class="null-value">null</span>';

    if (this.isContainer(value)) {
      if (this.isEmptyContainer(value)) {
        return `<span class="j2t-empty-container">${Array.isArray(value) ? '[]' : '{}'}</span>`;
      }

      const isArray = Array.isArray(value);
      const count = this.childCount(value);
      const isExpanded = this.expanded.has(path);
      const badgeClass = isArray ? 'expandable-array' : 'expandable-object';
      // Visible text is the shape and the count only. The words "items" /
      // "properties" repeat what the brackets already say on every single row,
      // so they live in the accessible name instead of on screen.
      const noun = isArray
        ? (count === 1 ? 'item' : 'items')
        : (count === 1 ? 'property' : 'properties');
      const countText = isArray ? `[${count}]` : `{${count}}`;

      const focusId = this.registerFocusObject(value, label, path);

      const header = `<span class="j2t-valwrap">
        <button type="button"
                class="j2t-twisty"
                data-toggle-path="${this.esc(path)}"
                aria-expanded="${isExpanded}"
                aria-label="${isExpanded ? 'Collapse' : 'Expand'} ${this.esc(label)}, ${count} ${noun}">▶</button>
        <span class="${badgeClass}" data-toggle-path="${this.esc(path)}" aria-hidden="true">${countText}</span>
        ${isExpanded ? '' : `<span class="j2t-preview">${this.previewOf(value)}</span>`}
        ${isExpanded && isArray && this.qualifiesForSubTable(value) ? this.renderViewToggle(path, value) : ''}
        <button type="button" class="focus-btn" data-focus-id="${focusId}" aria-label="Open ${this.esc(label)} as its own table">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
            <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5" stroke-linecap="round"/>
          </svg>
        </button>
      </span>`;

      const expansion = (isExpanded && cellDepth !== null)
        ? this.renderInCellExpansion(value, path, cellDepth)
        : '';

      return header + expansion;
    }

    return this.renderScalar(value);
  }

  /**
   * Per-array switch between the inline table and the tree. The table is the
   * default for uniform arrays, but a tree is better when you want to drill
   * into one item's nested content inline.
   */
  renderViewToggle(path, value) {
    const asTable = this.arrayView(path, value) === 'table';
    return `<button type="button" class="j2t-view-toggle" data-view-path="${this.esc(path)}"
      aria-pressed="${asTable}"
      title="${asTable ? 'Show as list' : 'Show as table'}"
      aria-label="${asTable ? 'Show this array as a list' : 'Show this array as a table'}">${
      asTable ? '&#9776;' : '&#9638;'
    }</button>`;
  }

  renderScalar(value) {
    // A number whose text JSON.parse would have changed (663400.0, 1e3, big
    // integers) -- show the original text.
    if (JSONDetector.isRawNumber(value)) {
      return `<span class="number-value">${this.text(value.rawJSON)}</span>`;
    }

    if (typeof value === 'boolean') {
      return `<span class="boolean-value ${value}">${value}</span>`;
    }

    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        return `<span class="null-value">${this.esc(String(value))}</span>`;
      }
      // Show the number as written. The old code ran toFixed(2) on non-integers,
      // silently truncating precision in a tool whose job is faithful display.
      return `<span class="number-value">${this.text(String(value))}</span>`;
    }

    if (typeof value === 'string') {
      if (value === '') return '<span class="empty-string">""</span>';

      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        // Show the value exactly as written so copying it is faithful; the
        // local-time rendering is only a hover hint.
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          const local = date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {
            hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
          });
          return `<span class="date-value" title="Local time: ${this.esc(local)}">${this.text(value)}</span>`;
        }
      }

      if (this.isImageUrl(value)) {
        return this.renderImageValue(value);
      }

      // Long strings get truncated with an affordance to see the whole thing,
      // rather than blowing out the row height.
      if (value.length > 240) {
        const id = this.registerFocusObject(value, 'Value', `str${this.focusObjectRegistry.size}`);
        return `<span class="string-value">${this.text(value.slice(0, 240))}&hellip;</span>
          <button type="button" class="j2t-more-btn" data-show-value="${id}">Show all ${value.length}</button>`;
      }

      return `<span class="string-value">${this.text(value)}</span>`;
    }

    return `<span class="string-value">${this.text(String(value))}</span>`;
  }

  /** Compact summary of a collapsed container, like DevTools' object preview. */
  previewOf(value, maxLen = 58) {
    const entries = this.entriesOf(value);
    const isArray = Array.isArray(value);
    const parts = [];
    let len = 0;

    for (const [key, val] of entries) {
      const piece = isArray ? this.plainValue(val) : `${key}: ${this.plainValue(val)}`;
      if (len + piece.length > maxLen) {
        parts.push('…');
        break;
      }
      parts.push(piece);
      len += piece.length + 2;
    }

    return this.esc((isArray ? '[' : '{') + parts.join(', ') + (isArray ? ']' : '}'));
  }

  plainValue(value) {
    if (value === null) return 'null';
    if (JSONDetector.isRawNumber(value)) return value.rawJSON;
    if (value === undefined) return '–';
    if (Array.isArray(value)) return `[${value.length}]`;
    if (typeof value === 'object') return `{${Object.keys(value).length}}`;
    if (typeof value === 'string') {
      return value.length > 22 ? `"${value.slice(0, 22)}…"` : `"${value}"`;
    }
    return String(value);
  }

  /* ------------------------------------------------------------------ *
   * Images
   * ------------------------------------------------------------------ */

  /**
   * Deliberately conservative. The previous heuristic matched any URL merely
   * containing "photo", "img", "images." etc., which meant the viewer issued
   * network requests to arbitrary URLs found in the JSON. Require a real image
   * extension or a data/base64 signature.
   */
  isImageUrl(url) {
    if (typeof url !== 'string' || url.length > 5_000_000) return false;

    if (/^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml|bmp);base64,/i.test(url)) return true;
    if (/^\/9j\//.test(url) || /^iVBORw0KGgo/.test(url) || /^R0lGOD/.test(url)) return true;

    if (!/^https?:\/\/.+/i.test(url)) return false;
    return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|avif)(\?[^\s]*)?$/i.test(url);
  }

  renderImageValue(imageUrl) {
    let imageSrc = imageUrl;
    let displayUrl = imageUrl;

    if (/^\/9j\//.test(imageUrl) || /^iVBORw0KGgo/.test(imageUrl) || /^R0lGOD/.test(imageUrl)) {
      let mimeType = 'jpeg';
      if (/^iVBORw0KGgo/.test(imageUrl)) mimeType = 'png';
      if (/^R0lGOD/.test(imageUrl)) mimeType = 'gif';
      imageSrc = `data:image/${mimeType};base64,${imageUrl}`;
      displayUrl = `Base64 ${mimeType.toUpperCase()} (${Math.round(imageUrl.length * 0.75 / 1024)}KB)`;
    } else if (/^data:image/.test(imageUrl)) {
      const match = imageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (match) {
        displayUrl = `Base64 ${match[1].toUpperCase()} (${Math.round(match[2].length * 0.75 / 1024)}KB)`;
      }
    }

    const isData = displayUrl !== imageUrl; // base64 got a human-readable label

    // Short caption. Printing the whole URL beside the thumbnail said nothing
    // the image doesn't, and as one long unbreakable token it wrapped a
    // character per line and blew the row height out to ~1000px.
    let caption = displayUrl;
    if (!isData) {
      const withoutQuery = imageUrl.split(/[?#]/)[0];
      caption = withoutQuery.slice(withoutQuery.lastIndexOf('/') + 1) || 'image';
    }

    const safeSrc = this.esc(imageSrc);
    const safeCaption = this.esc(caption);
    const safeFull = this.esc(isData ? displayUrl : imageUrl);

    return `
      <span class="image-value-container">
        <img src="${safeSrc}"
             alt="${safeCaption}"
             title="${safeFull}"
             class="inline-image hover-expandable"
             loading="lazy"
             referrerpolicy="no-referrer" />
        <span class="image-preview">
          <img src="${safeSrc}" alt="" />
          <span class="preview-info">${safeFull}</span>
        </span>
      </span>`;
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  attachListeners() {
    if (!this.listenersAttached) {
      this.container.addEventListener('click', this.handleTableClick);
      this.container.addEventListener('keydown', this.handleTableKeydown);
      this.container.addEventListener('mousemove', this.handleMouseMove);
      this.container.addEventListener('mousedown', (e) => this.handleResizeStart(e));
      this.listenersAttached = true;
    }

    const breadcrumbContainer = document.getElementById('json2table-breadcrumb');
    if (breadcrumbContainer && !breadcrumbContainer.dataset.j2tBound) {
      breadcrumbContainer.addEventListener('click', this.handleBreadcrumbClick);
      breadcrumbContainer.dataset.j2tBound = '1';
    }
  }

  handleTableClick(e) {
    const sortHeader = e.target.closest('[data-sort-col]');
    if (sortHeader) {
      this.toggleSort(sortHeader.dataset.sortCol);
      return;
    }

    const viewToggle = e.target.closest('[data-view-path]');
    if (viewToggle) {
      e.stopPropagation();
      const path = viewToggle.dataset.viewPath;
      const current = viewToggle.getAttribute('aria-pressed') === 'true' ? 'table' : 'list';
      this.arrayViewMode.set(path, current === 'table' ? 'list' : 'table');
      this.render();
      return;
    }

    const focusBtn = e.target.closest('.focus-btn');
    if (focusBtn) {
      e.stopPropagation();
      const focusObject = this.getFocusObject(focusBtn.dataset.focusId);
      if (focusObject) {
        this.focusOn(focusObject.data, focusObject.displayName, focusObject.breadcrumbPath);
      }
      return;
    }

    const showValue = e.target.closest('[data-show-value]');
    if (showValue) {
      const entry = this.getFocusObject(showValue.dataset.showValue);
      if (entry) this.showValueModal(entry.data, 'Full value');
      return;
    }

    const moreBtn = e.target.closest('[data-more-path]');
    if (moreBtn) {
      const path = moreBtn.dataset.morePath;
      this.shownCounts.set(path, (this.shownCounts.get(path) || this.childPageSize) + this.childPageSize);
      this.render();
      return;
    }

    const toggle = e.target.closest('[data-toggle-path]');
    if (toggle) {
      const row = toggle.closest('tr');
      if (row) this.cursorIndex = Number(row.dataset.index);
      this.toggleExpansion(toggle.dataset.togglePath);
      return;
    }

    const row = e.target.closest('tr[data-index]');
    if (row) {
      this.cursorIndex = Number(row.dataset.index);
      this.applyCursor();
    }
  }

  handleTableKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      const sortHeader = e.target.closest('[data-sort-col]');
      if (sortHeader) {
        e.preventDefault();
        this.toggleSort(sortHeader.dataset.sortCol);
        return;
      }
    }

    const row = e.target.closest('tr[data-index]');
    if (!row) return;

    const index = Number(row.dataset.index);
    const model = this.rowModel[index];
    if (!model) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.moveCursor(index + 1);
        break;

      case 'ArrowUp':
        e.preventDefault();
        this.moveCursor(index - 1);
        break;

      case 'ArrowRight': {
        e.preventDefault();
        const path = this.expandablePathFor(model);
        if (path && !this.expanded.has(path)) {
          this.cursorIndex = index;
          this.toggleExpansion(path);
        } else {
          this.moveCursor(index + 1);
        }
        break;
      }

      case 'ArrowLeft': {
        e.preventDefault();
        const path = this.expandablePathFor(model);
        if (path && this.expanded.has(path)) {
          this.cursorIndex = index;
          this.toggleExpansion(path);
        } else {
          this.moveCursor(this.parentIndexOf(index));
        }
        break;
      }

      case 'Enter':
      case ' ': {
        e.preventDefault();
        const path = this.expandablePathFor(model);
        if (path) {
          this.cursorIndex = index;
          this.toggleExpansion(path);
        }
        break;
      }

      case 'Home':
        e.preventDefault();
        this.moveCursor(0);
        break;

      case 'End':
        e.preventDefault();
        this.moveCursor(this.rowModel.length - 1);
        break;
    }
  }

  /** The expandable path for a row, whether it is a root cell or a tree row. */
  expandablePathFor(model) {
    if (model.kind === 'child') return model.hasChildren ? model.path : null;

    if (model.kind === 'root') {
      for (const col of this.columns) {
        const value = model.row[col];
        if (this.isContainer(value) && !this.isEmptyContainer(value)) {
          return this.cellPath(model.row.__rowId, col);
        }
      }
    }
    return null;
  }

  parentIndexOf(index) {
    const model = this.rowModel[index];
    if (!model || model.kind !== 'child') return index;
    for (let i = index - 1; i >= 0; i--) {
      const candidate = this.rowModel[i];
      if (candidate.kind === 'root') return i;
      if (candidate.kind === 'child' && candidate.depth < model.depth) return i;
    }
    return index;
  }

  moveCursor(index) {
    if (index < 0 || index >= this.rowModel.length) return;
    this.cursorIndex = index;
    this.applyCursor(true);
  }

  applyCursor(focus = false) {
    const rows = this.container.querySelectorAll('tbody tr[data-index]');
    rows.forEach(row => {
      const isCursor = Number(row.dataset.index) === this.cursorIndex;
      row.classList.toggle('is-cursor', isCursor);
      row.tabIndex = isCursor ? 0 : -1;
      if (isCursor && (focus || this.pendingFocus)) {
        row.focus({ preventScroll: false });
      }
    });
    this.pendingFocus = false;
  }

  handleBreadcrumbClick(e) {
    const breadcrumbLink = e.target.closest('.breadcrumb-link');
    if (breadcrumbLink) {
      e.stopPropagation();
      this.focusToLevel(parseInt(breadcrumbLink.dataset.focusLevel, 10));
    }
  }

  toggleExpansion(path) {
    if (this.expanded.has(path)) {
      this.expanded.delete(path);
    } else {
      this.expanded.add(path);
    }
    this.pendingFocus = true;
    this.render();
  }

  handleMouseMove(e) {
    if (!e.target.classList || !e.target.classList.contains('hover-expandable')) return;

    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    let adjustedY = e.clientY;

    document.documentElement.style.setProperty(
      '--preview-transform',
      e.clientX > windowWidth - 420 ? 'translate(-100%, -50%)' : 'translate(15px, -50%)'
    );

    if (adjustedY < 50) adjustedY = 50;
    if (adjustedY > windowHeight - 50) adjustedY = windowHeight - 50;

    document.documentElement.style.setProperty('--mouse-x', e.clientX + 'px');
    document.documentElement.style.setProperty('--mouse-y', adjustedY + 'px');
  }

  /* ------------------------------------------------------------------ *
   * Sorting and column resize
   * ------------------------------------------------------------------ */

  /**
   * Tree mode has no column headers to click, so sorting by key name is driven
   * from the toolbar instead.
   */
  cycleKeySort() {
    if (!this.columns.length) return;
    this.toggleSort(this.columns[0]);
  }

  toggleSort(col) {
    if (this.sort.col !== col) {
      this.sort = { col, dir: 'asc' };
    } else if (this.sort.dir === 'asc') {
      this.sort = { col, dir: 'desc' };
    } else {
      this.sort = { col: null, dir: null };
    }
    this.applyFilters();
  }

  compareValues(a, b) {
    if (JSONDetector.isRawNumber(a)) a = Number(a.rawJSON);
    if (JSONDetector.isRawNumber(b)) b = Number(b.rawJSON);
    const rank = (v) => {
      if (v === null || v === undefined || v === '') return 3;
      if (this.isContainer(v)) return 2;
      return 0;
    };
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    if (ra !== 0) return 0;

    if (typeof a === 'number' && typeof b === 'number') return a - b;
    if (typeof a === 'boolean' && typeof b === 'boolean') return (a ? 1 : 0) - (b ? 1 : 0);
    return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
  }

  handleResizeStart(e) {
    const handle = e.target.closest('[data-resize-col]');
    if (!handle) return;

    e.preventDefault();
    const col = handle.dataset.resizeCol;
    const th = handle.closest('th');
    const startX = e.clientX;
    const startWidth = th.getBoundingClientRect().width;

    // Freeze every column's current width so resizing one does not reflow the rest.
    if (this.colWidths.size === 0) {
      this.container.querySelectorAll('thead th').forEach(header => {
        this.colWidths.set(header.dataset.col, header.getBoundingClientRect().width);
      });
    }

    handle.classList.add('is-dragging');
    document.body.style.userSelect = 'none';

    const onMove = (moveEvent) => {
      const width = Math.max(60, startWidth + (moveEvent.clientX - startX));
      this.colWidths.set(col, width);
      const table = this.container.querySelector('.json2table-table');
      const colEl = table && table.querySelectorAll('colgroup col')[this.columns.indexOf(col)];
      if (colEl) {
        colEl.style.width = `${width}px`;
      } else {
        this.render();
      }
      if (table) table.classList.add('is-fixed');
    };

    const onUp = () => {
      handle.classList.remove('is-dragging');
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      this.render();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* ------------------------------------------------------------------ *
   * Search
   * ------------------------------------------------------------------ */

  search(query) {
    const trimmed = (query || '').trim();
    this.searchQuery = trimmed || null;
    this.currentMatch = 0;
    this.matchCache = new WeakMap();

    if (this.searchQuery) {
      this.expandToMatches(this.searchQuery);
    }

    this.applyFilters();
  }

  applyFilters() {
    let rows = this.sourceRows;

    if (this.searchQuery) {
      // Multi-column mode: a matching column name keeps every row. Otherwise a
      // row stays only if one of its cells contains the term somewhere.
      const needle = this.searchQuery.toLowerCase();
      const headerHit = !this.isTreeMode && this.columns.some(col => col.toLowerCase().includes(needle));
      if (!headerHit) {
        rows = rows.filter(row => this.columns.some(col => this.containsMatch(row[col])));
      }
    }

    if (this.sort.col) {
      const { col, dir } = this.sort;
      rows = [...rows].sort((a, b) => {
        const result = this.compareValues(a[col], b[col]);
        return dir === 'desc' ? -result : result;
      });
    }

    this.filteredData = rows;
    this.render();
  }

  /**
   * Expand every container whose subtree contains the query, so matches that
   * live inside collapsed nodes are actually reachable.
   */
  expandToMatches(query) {
    const MAX_DEPTH = 12;

    const walk = (container, path, depth) => {
      if (depth > MAX_DEPTH) return;
      for (const [key, value] of this.entriesOf(container)) {
        if (!this.isContainer(value) || this.isEmptyContainer(value)) continue;
        const childPath = `${path}${TableViewer.SEP}${key}`;
        if (this.containsMatch(value)) {
          this.expanded.add(childPath);
          walk(value, childPath, depth + 1);
        }
      }
    };

    this.sourceRows.forEach(row => {
      this.columns.forEach(col => {
        const value = row[col];
        if (!this.isContainer(value) || this.isEmptyContainer(value)) return;
        if (!this.containsMatch(value)) return;
        const path = this.cellPath(row.__rowId, col);
        this.expanded.add(path);
        walk(value, path, 1);
      });
    });
  }

  /**
   * Does the value, or anything beneath it, contain the search term? Object
   * keys count as part of their object. Memoised per search.
   */
  containsMatch(value) {
    if (!this.searchQuery) return true;
    if (value === undefined) return false;
    const needle = this.searchQuery.toLowerCase();

    if (!this.isContainer(value)) {
      const text = JSONDetector.isRawNumber(value) ? value.rawJSON : String(value);
      return text.toLowerCase().includes(needle);
    }

    if (!this.matchCache) this.matchCache = new WeakMap();
    if (this.matchCache.has(value)) return this.matchCache.get(value);
    this.matchCache.set(value, false); // guards against cycles

    const isArray = Array.isArray(value);
    const result = this.entriesOf(value).some(([key, child]) =>
      (!isArray && key.toLowerCase().includes(needle)) || this.containsMatch(child));
    this.matchCache.set(value, result);
    return result;
  }

  /**
   * The children of a container to show. While searching that is only the
   * ones whose name, value or descendants match. A container that is visible
   * only because its own name matched has no matching children, so it shows
   * everything rather than looking empty.
   */
  visibleEntries(container) {
    const entries = this.entriesOf(container);
    if (!this.searchQuery) return entries;

    const needle = this.searchQuery.toLowerCase();
    const isArray = Array.isArray(container);
    const hits = entries.filter(([key, value]) =>
      (!isArray && key.toLowerCase().includes(needle)) || this.containsMatch(value));
    return hits.length ? hits : entries;
  }

  /** Sub-table columns that hold a match among the shown items (all when not searching). */
  visibleSubTableColumns(columns, items) {
    if (!this.searchQuery) return columns;
    const needle = this.searchQuery.toLowerCase();
    const hits = columns.filter(col =>
      col.toLowerCase().includes(needle) ||
      items.some(([, item]) => this.isContainer(item) && !Array.isArray(item) &&
        Object.prototype.hasOwnProperty.call(item, col) && this.containsMatch(item[col])));
    return hits.length ? hits : columns;
  }

  updateSearchStatus() {
    const marks = this.container.querySelectorAll('mark.search-highlight');
    this.matchCount = marks.length;

    if (this.matchCount > 0) {
      this.currentMatch = Math.min(Math.max(this.currentMatch, 1), this.matchCount);
      marks.forEach((mark, i) => mark.classList.toggle('is-current', i === this.currentMatch - 1));
    } else {
      this.currentMatch = 0;
    }

    const countEl = document.getElementById('json2table-search-count');
    const prevBtn = document.getElementById('json2table-search-prev');
    const nextBtn = document.getElementById('json2table-search-next');

    if (countEl) {
      if (!this.searchQuery) {
        countEl.textContent = '';
        countEl.classList.remove('is-empty');
      } else if (this.matchCount === 0) {
        countEl.textContent = 'no matches';
        countEl.classList.add('is-empty');
      } else {
        countEl.textContent = `${this.currentMatch} of ${this.matchCount}`;
        countEl.classList.remove('is-empty');
      }
    }

    const disabled = this.matchCount === 0;
    if (prevBtn) prevBtn.disabled = disabled;
    if (nextBtn) nextBtn.disabled = disabled;

    if (typeof UIUtils !== 'undefined' && UIUtils.updateRowCount) {
      UIUtils.updateRowCount(this.filteredData.length, this.sourceRows.length);
    }
    if (typeof UIUtils !== 'undefined' && UIUtils.updateSortControl) {
      UIUtils.updateSortControl(this.isTreeMode, this.sort.dir);
    }
    if (typeof UIUtils !== 'undefined' && UIUtils.setExpandState) {
      UIUtils.setExpandState(this.allExpanded);
    }
  }

  gotoMatch(delta) {
    if (this.matchCount === 0) return;
    this.currentMatch += delta;
    if (this.currentMatch > this.matchCount) this.currentMatch = 1;
    if (this.currentMatch < 1) this.currentMatch = this.matchCount;

    const marks = this.container.querySelectorAll('mark.search-highlight');
    marks.forEach((mark, i) => mark.classList.toggle('is-current', i === this.currentMatch - 1));

    const target = marks[this.currentMatch - 1];
    if (target) target.scrollIntoView({ block: 'center', behavior: 'smooth' });

    this.updateSearchStatus();
  }

  /* ------------------------------------------------------------------ *
   * Expand / collapse all
   * ------------------------------------------------------------------ */

  collapseAll() {
    this.expanded.clear();
    this.shownCounts.clear();
    this.arrayViewMode.clear();
    this.allExpanded = false;
    this.render();
  }

  /**
   * Expands from the data model rather than by scraping the DOM for "[+]".
   * Bounded so a deep or wide document cannot lock the tab up.
   */
  expandAll() {
    const MAX_NODES = 4000;
    const MAX_DEPTH = 8;
    let count = 0;
    let truncated = false;

    const walk = (container, path, depth) => {
      if (depth > MAX_DEPTH) { truncated = true; return; }
      for (const [key, value] of this.entriesOf(container)) {
        if (count >= MAX_NODES) { truncated = true; return; }
        if (!this.isContainer(value) || this.isEmptyContainer(value)) continue;
        const childPath = `${path}${TableViewer.SEP}${key}`;
        this.expanded.add(childPath);
        count++;
        walk(value, childPath, depth + 1);
      }
    };

    this.filteredData.forEach(row => {
      this.columns.forEach(col => {
        const value = row[col];
        if (count >= MAX_NODES) { truncated = true; return; }
        if (!this.isContainer(value) || this.isEmptyContainer(value)) return;
        const path = this.cellPath(row.__rowId, col);
        this.expanded.add(path);
        count++;
        walk(value, path, 1);
      });
    });

    this.allExpanded = true;
    this.render();

    if (truncated && typeof UIUtils !== 'undefined') {
      UIUtils.showTemporaryMessage(
        `Expanded ${count} nodes (stopped at the limit to keep the page responsive)`,
        'warning'
      );
    }
  }

  /* ------------------------------------------------------------------ *
   * Modal
   * ------------------------------------------------------------------ */

  showValueModal(value, title) {
    if (this.modalOverlay) this.modalOverlay.remove();

    this.lastFocusedElement = document.activeElement;

    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'json2table-value-modal';
    this.modalOverlay.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-content" role="dialog" aria-modal="true" aria-label="${this.esc(title)}">
        <div class="modal-header">
          <h3>${this.esc(title)}</h3>
          <button class="modal-close" type="button" aria-label="Close">&times;</button>
        </div>
        <div class="modal-body">${this.renderValueContent(value)}</div>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);

    const close = () => {
      if (!this.modalOverlay) return;
      this.modalOverlay.remove();
      this.modalOverlay = null;
      document.removeEventListener('keydown', onKey);
      if (this.lastFocusedElement && this.lastFocusedElement.focus) {
        this.lastFocusedElement.focus();
      }
    };

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    this.modalOverlay.querySelector('.modal-backdrop').addEventListener('click', close);
    const closeBtn = this.modalOverlay.querySelector('.modal-close');
    closeBtn.addEventListener('click', close);
    closeBtn.focus();
  }

  renderValueContent(value) {
    if (JSONDetector.isRawNumber(value)) {
      return `<div class="property-value">${this.esc(value.rawJSON)}</div>`;
    }

    if (typeof value === 'string') {
      return `<div class="property-value">${this.esc(value)}</div>`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return '<div class="empty-state">Empty array</div>';
      return `
        <div class="array-content">
          ${value.slice(0, 500).map((item, idx) => `
            <div class="array-item">
              <span class="item-index">[${idx}]</span>
              <span class="item-value">${this.formatModalValue(item)}</span>
            </div>`).join('')}
          ${value.length > 500 ? `<div class="content-header">…and ${value.length - 500} more</div>` : ''}
        </div>`;
    }

    if (this.isContainer(value)) {
      const entries = Object.entries(value);
      if (entries.length === 0) return '<div class="empty-state">Empty object</div>';
      return `
        <div class="object-content">
          ${entries.map(([key, val]) => `
            <div class="object-property">
              <span class="property-key">${this.esc(key)}</span>
              <span class="property-value">${this.formatModalValue(val)}</span>
            </div>`).join('')}
        </div>`;
    }

    return `<div class="property-value">${this.esc(String(value))}</div>`;
  }

  formatModalValue(value) {
    if (value === null) return '<span class="null-value">null</span>';
    if (value === undefined) return '<span class="null-value">undefined</span>';
    if (JSONDetector.isRawNumber(value)) return `<span class="number-value">${this.esc(value.rawJSON)}</span>`;
    if (typeof value === 'string') return `<span class="string-value">"${this.esc(value)}"</span>`;
    if (typeof value === 'number') return `<span class="number-value">${this.esc(value)}</span>`;
    if (typeof value === 'boolean') return `<span class="boolean-value ${value}">${value}</span>`;
    if (Array.isArray(value)) return `<span class="j2t-empty-container">[${value.length}]</span>`;
    if (typeof value === 'object') return `<span class="j2t-empty-container">{${Object.keys(value).length}}</span>`;
    return this.esc(String(value));
  }

  /* ------------------------------------------------------------------ *
   * Export
   * ------------------------------------------------------------------ */

  getLikelyCsvDelimiter() {
    const locale = navigator.language || navigator.userLanguage || 'en';
    const semicolonLocales = [
      'de', 'fr', 'it', 'es', 'ru', 'pl', 'nl', 'da', 'fi', 'sv', 'cs',
      'hu', 'tr', 'pt-PT', 'sl', 'sk', 'hr', 'lt', 'lv', 'et'
    ];
    return semicolonLocales.some(code => locale.startsWith(code)) ? ';' : ',';
  }

  exportCSV() {
    const delimiter = this.csvDelimiter;
    const quote = (raw) => `"${String(raw).replace(/"/g, '""')}"`;

    const headers = this.columns.map(quote).join(delimiter);
    const rows = this.filteredData.map(row =>
      this.columns.map(col => {
        const value = row[col];
        if (value === null || value === undefined) return '""';
        if (JSONDetector.isRawNumber(value)) return quote(value.rawJSON);
        if (this.isContainer(value)) return quote(JSON.stringify(value));
        return quote(value);
      }).join(delimiter)
    );

    // BOM so Excel reads UTF-8 correctly.
    const csv = '﻿' + [headers, ...rows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'json-table-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ------------------------------------------------------------------ *
   * Focus navigation
   * ------------------------------------------------------------------ */

  focusOn(targetData, displayName, breadcrumbPath) {
    this.focusStack.push({
      context: { ...this.currentContext },
      expanded: new Set(this.expanded),
      shownCounts: new Map(this.shownCounts),
      arrayViewMode: new Map(this.arrayViewMode),
      columns: [...this.columns],
      sourceRows: this.sourceRows,
      filteredData: this.filteredData,
      sort: { ...this.sort },
      colWidths: new Map(this.colWidths),
      treeMode: this.treeMode,
      allExpanded: this.allExpanded
    });

    this.treeMode = JSONDetector.isTreeShaped(targetData);
    this.allExpanded = false;
    this.currentData = targetData;
    this.currentContext = { data: targetData, displayName, breadcrumbPath };
    this.expanded.clear();
    this.shownCounts.clear();
    this.arrayViewMode.clear();
    this.colWidths.clear();
    this.sort = { col: null, dir: null };
    this.cursorIndex = 0;

    const processedData = JSONDetector.extractTableData(targetData);
    this.sourceRows = processedData.map((row, index) => ({ ...row, __rowId: index }));
    this.filteredData = this.sourceRows;
    this.columns = this.extractColumns(this.sourceRows);

    this.applyFilters();

    ThemeManager.getSettings().then(settings => {
      if (settings.autoExpand) this.expandAll();
    });
  }

  focusBack() {
    if (this.focusStack.length === 0) return;

    const previous = this.focusStack.pop();
    this.currentData = previous.context.data;
    this.currentContext = previous.context;
    this.expanded = previous.expanded;
    this.shownCounts = previous.shownCounts;
    this.arrayViewMode = previous.arrayViewMode;
    this.columns = previous.columns;
    this.sourceRows = previous.sourceRows;
    this.filteredData = previous.filteredData;
    this.sort = previous.sort;
    this.colWidths = previous.colWidths;
    this.treeMode = previous.treeMode;
    this.allExpanded = previous.allExpanded;
    this.cursorIndex = 0;

    this.render();
  }

  focusToRoot() {
    this.focusStack = [];
    this.treeMode = this.rootTreeMode;
    this.allExpanded = false;
    this.currentData = this.rootData;
    this.currentContext = { data: this.rootData, displayName: 'Root', breadcrumbPath: [] };
    this.expanded.clear();
    this.shownCounts.clear();
    this.arrayViewMode.clear();
    this.colWidths.clear();
    this.sort = { col: null, dir: null };
    this.cursorIndex = 0;

    const processedData = JSONDetector.extractTableData(this.rootData);
    this.sourceRows = processedData.map((row, index) => ({ ...row, __rowId: index }));
    this.filteredData = this.sourceRows;
    this.columns = this.extractColumns(this.sourceRows);

    this.applyFilters();

    ThemeManager.getSettings().then(settings => {
      if (settings.autoExpand) this.expandAll();
    });
  }

  focusToLevel(level) {
    if (level === 0) {
      this.focusToRoot();
      return;
    }
    while (this.focusStack.length > level) {
      this.focusBack();
    }
  }

  registerFocusObject(targetData, displayName, pathKey) {
    // Deterministic id -- the registry is cleared and rebuilt each render, so
    // random ids would churn and the map would never be reused.
    const focusId = `focus_${pathKey}`;
    this.focusObjectRegistry.set(focusId, {
      data: targetData,
      displayName,
      breadcrumbPath: [...this.currentContext.breadcrumbPath, displayName]
    });
    return this.esc(focusId);
  }

  getFocusObject(focusId) {
    return this.focusObjectRegistry.get(focusId) || null;
  }

  updateFocusUI() {
    const backButton = document.getElementById('json2table-focus-back');
    const breadcrumbContainer = document.getElementById('json2table-breadcrumb');
    const isInFocusedView = this.focusStack.length > 0;

    if (backButton) backButton.style.display = isInFocusedView ? 'inline-flex' : 'none';
    if (breadcrumbContainer) breadcrumbContainer.style.display = isInFocusedView ? 'flex' : 'none';

    this.updateBreadcrumb();
    this.updateFocusedTitle();

    if (typeof UIUtils !== 'undefined' && UIUtils.refreshJsonView) {
      // No argument: keep showing the original JSON, not the table rows.
      UIUtils.refreshJsonView();
    }
  }

  updateBreadcrumb() {
    const breadcrumbContainer = document.getElementById('json2table-breadcrumb');
    if (!breadcrumbContainer) return;

    const breadcrumbPath = this.currentContext.breadcrumbPath || [];
    if (breadcrumbPath.length === 0) {
      breadcrumbContainer.innerHTML = '<span class="breadcrumb-current">Root</span>';
      return;
    }

    const segments = ['Root', ...breadcrumbPath];
    breadcrumbContainer.innerHTML = segments.map((segment, index) => {
      if (index === segments.length - 1) {
        return `<span class="breadcrumb-current" aria-current="page">${this.esc(segment)}</span>`;
      }
      return `<button type="button" class="breadcrumb-link" data-focus-level="${index}">${this.esc(segment)}</button>`;
    }).join('<span class="breadcrumb-separator" aria-hidden="true">/</span>');
  }

  updateFocusedTitle() {
    const titleElement = document.querySelector('.json2table-title');
    if (!titleElement) return;

    const isInFocusedView = this.focusStack.length > 0;
    titleElement.textContent = isInFocusedView
      ? this.currentContext.displayName
      : 'JSON Table';
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableViewer;
} else {
  window.TableViewer = TableViewer;
}
