/**
 * UI utilities for JSON2Table
 */
class UIUtils {
  static icon(path, size = 14) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" stroke-width="2" stroke-linecap="round"
      stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
  }

  /**
   * @param tableData  rows from JSONDetector.extractTableData(jsonData)
   * @param jsonData   the parsed JSON they came from: decides table vs tree,
   *                   and is what the JSON view and exports show
   */
  static createTableInterface(container, tableData, jsonData) {
    // Styles must exist before the header renders so it is never unstyled.
    StyleManager.injectTableStyles();

    container.style.cssText = 'display: flex; flex-direction: column; height: 100vh; overflow: hidden;';

    container.innerHTML = `
      <header class="json2table-header">
        <div class="json2table-titlebar">
          <button id="json2table-focus-back" class="j2t-btn j2t-btn-icon" style="display: none;" aria-label="Back to previous level">
            ${this.icon('<path d="M19 12H5"/><path d="M12 19l-7-7 7-7"/>')}
          </button>
          <span class="json2table-title">JSON Table</span>
          <span class="json2table-subtitle" id="json2table-rowcount" aria-live="polite"></span>
          <nav id="json2table-breadcrumb" aria-label="Breadcrumb" style="display: none;"></nav>
        </div>

        <div class="json2table-controls">
          <div class="j2t-search-wrap">
            ${this.icon('<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>', 13)}
            <input type="search" id="json2table-search" placeholder="Search values&hellip;"
                   aria-label="Search JSON values" autocomplete="off" spellcheck="false" />
            <span class="j2t-search-count" id="json2table-search-count" aria-live="polite"></span>
            <span class="j2t-search-nav">
              <button type="button" id="json2table-search-prev" aria-label="Previous match" disabled>&#9650;</button>
              <button type="button" id="json2table-search-next" aria-label="Next match" disabled>&#9660;</button>
            </span>
          </div>

          <button id="json2table-expand-toggle" class="j2t-btn" aria-pressed="false">Expand all</button>

          <button id="json2table-sort" class="j2t-btn j2t-btn-icon" style="display: none;"
                  aria-label="Sort keys by name" title="Sort keys by name">
            ${this.icon('<path d="M7 4v16"/><path d="M4 8l3-4 3 4"/><path d="M13 6h7"/><path d="M13 12h5"/><path d="M13 18h3"/>')}
          </button>

          <div class="j2t-segmented" role="group" aria-label="View mode">
            <button type="button" id="json2table-view-table" aria-pressed="true">Table</button>
            <button type="button" id="json2table-view-json" aria-pressed="false">JSON</button>
          </div>

          <button id="json2table-density" class="j2t-btn j2t-btn-icon" aria-label="Toggle row density" title="Toggle row density">
            ${this.icon('<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>')}
          </button>

          <button id="json2table-export" class="j2t-btn j2t-btn-primary" aria-haspopup="menu" aria-expanded="false">
            ${this.icon('<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/>')}
            Export
          </button>
        </div>
      </header>

      <div id="json2table-table-container" style="flex: 1; overflow: auto; background: var(--bg-color);"></div>
      <div id="json2table-json-container" class="j2t-json-view" style="flex: 1; display: none;"></div>
    `;

    const tableViewer = new TableViewer(tableData, { treeMode: JSONDetector.isTreeShaped(jsonData) });
    window.tableViewer = tableViewer;
    tableViewer.render();

    ThemeManager.getSettings().then(settings => {
      if (settings.autoExpand) tableViewer.expandAll();
    });

    this.wireSearch(tableViewer);
    this.wireExpandToggle(tableViewer);
    document.getElementById('json2table-sort').onclick = () => tableViewer.cycleKeySort();
    this.wireViewSwitch(jsonData);
    this.wireDensity();
    this.wireExport(tableViewer, jsonData);

    document.getElementById('json2table-focus-back').onclick = () => tableViewer.focusBack();
  }

  /* ---------------------------------------------------------------- *
   * Toolbar wiring
   * ---------------------------------------------------------------- */

  static wireSearch(tableViewer) {
    const input = document.getElementById('json2table-search');
    const prev = document.getElementById('json2table-search-prev');
    const next = document.getElementById('json2table-search-next');

    let debounce;
    input.addEventListener('input', (e) => {
      clearTimeout(debounce);
      const value = e.target.value;
      debounce = setTimeout(() => {
        tableViewer.search(value);
        this.refreshJsonView();
      }, 140);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.gotoMatch(tableViewer, e.shiftKey ? -1 : 1);
      } else if (e.key === 'Escape') {
        input.value = '';
        tableViewer.search('');
        this.refreshJsonView();
      }
    });

    prev.onclick = () => this.gotoMatch(tableViewer, -1);
    next.onclick = () => this.gotoMatch(tableViewer, 1);

    // Ctrl/Cmd+F focuses the table's own search rather than the browser's.
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        input.focus();
        input.select();
      }
    });
  }

  static wireExpandToggle(tableViewer) {
    const btn = document.getElementById('json2table-expand-toggle');
    btn.onclick = () => {
      if (btn.getAttribute('aria-pressed') === 'true') {
        tableViewer.collapseAll();
      } else {
        tableViewer.expandAll();
      }
    };
  }

  /** Called by TableViewer so the single toggle always reflects real state. */
  static setExpandState(expanded) {
    const btn = document.getElementById('json2table-expand-toggle');
    if (!btn) return;
    btn.setAttribute('aria-pressed', String(expanded));
    btn.textContent = expanded ? 'Collapse all' : 'Expand all';
  }

  /**
   * Tree mode drops the "Property | Value" header row, so its sort affordance
   * lives here. Multi-column mode keeps clickable column headers and hides this.
   */
  static updateSortControl(isTreeMode, dir) {
    const btn = document.getElementById('json2table-sort');
    if (!btn) return;

    btn.style.display = isTreeMode ? 'inline-flex' : 'none';
    btn.setAttribute('aria-pressed', String(Boolean(dir)));

    const label = dir === 'asc' ? 'Sorted A–Z' : dir === 'desc' ? 'Sorted Z–A' : 'Sort keys by name';
    btn.title = label;
    btn.setAttribute('aria-label', label);
    btn.classList.toggle('is-active', Boolean(dir));
  }

  /** Called by TableViewer after every render. */
  static updateRowCount(shown, total) {
    const el = document.getElementById('json2table-rowcount');
    if (!el) return;
    el.textContent = shown === total
      ? `${total} ${total === 1 ? 'row' : 'rows'}`
      : `${shown} of ${total} rows`;
  }

  /** Prev/next match in whichever view is showing. */
  static gotoMatch(tableViewer, delta) {
    if (this.isJsonViewVisible()) {
      this.gotoJsonMatch(delta);
    } else {
      tableViewer.gotoMatch(delta);
    }
  }

  static isJsonViewVisible() {
    const jsonContainer = document.getElementById('json2table-json-container');
    return Boolean(jsonContainer && jsonContainer.style.display !== 'none');
  }

  static wireViewSwitch(jsonData) {
    this.jsonViewData = jsonData;
    const tableBtn = document.getElementById('json2table-view-table');
    const jsonBtn = document.getElementById('json2table-view-json');

    tableBtn.onclick = () => this.setView('table', jsonData);
    jsonBtn.onclick = () => this.setView('json', jsonData);
  }

  static setView(mode, jsonData) {
    const tableContainer = document.getElementById('json2table-table-container');
    const jsonContainer = document.getElementById('json2table-json-container');
    const tableBtn = document.getElementById('json2table-view-table');
    const jsonBtn = document.getElementById('json2table-view-json');
    if (!tableContainer || !jsonContainer) return;

    const isJson = mode === 'json';
    tableContainer.style.display = isJson ? 'none' : 'block';
    jsonContainer.style.display = isJson ? 'block' : 'none';
    tableBtn.setAttribute('aria-pressed', String(!isJson));
    jsonBtn.setAttribute('aria-pressed', String(isJson));

    // Table-only controls are meaningless in JSON view.
    ['json2table-expand-toggle', 'json2table-density'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.disabled = isJson;
    });

    if (isJson) {
      this.renderJsonView(jsonData, jsonContainer);
    } else if (window.tableViewer) {
      // Restore the table's own match count / nav state.
      window.tableViewer.updateSearchStatus();
    }
  }

  static wireDensity() {
    const btn = document.getElementById('json2table-density');
    btn.onclick = () => {
      const isCompact = document.documentElement.classList.contains('j2t-compact');
      const next = isCompact ? 'comfortable' : 'compact';
      ThemeManager.applyDensity(next);
      chrome.storage.local.set({ density: next });
      this.showTemporaryMessage(`${next === 'compact' ? 'Compact' : 'Comfortable'} rows`, 'info');
    };
  }

  static wireExport(tableViewer, jsonData) {
    const exportButton = document.getElementById('json2table-export');

    const menu = document.createElement('div');
    menu.id = 'json2table-export-menu';
    menu.className = 'j2t-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <button type="button" role="menuitem" id="json2table-export-csv">Download CSV</button>
      <button type="button" role="menuitem" id="json2table-export-json">Download JSON</button>
      <button type="button" role="menuitem" id="json2table-copy-json">Copy JSON</button>
    `;
    document.body.appendChild(menu);

    const closeMenu = () => {
      menu.style.display = 'none';
      exportButton.setAttribute('aria-expanded', 'false');
    };

    exportButton.onclick = (e) => {
      e.stopPropagation();
      if (menu.style.display === 'block') {
        closeMenu();
        return;
      }

      menu.style.display = 'block';
      menu.style.visibility = 'hidden';
      exportButton.setAttribute('aria-expanded', 'true');

      const buttonRect = exportButton.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();

      let top = buttonRect.bottom + 4;
      let left = buttonRect.left;

      if (left + menuRect.width > window.innerWidth) left = buttonRect.right - menuRect.width;
      if (top + menuRect.height > window.innerHeight) top = buttonRect.top - menuRect.height - 4;
      left = Math.max(8, left);
      top = Math.max(8, top);

      menu.style.top = `${top}px`;
      menu.style.left = `${left}px`;
      menu.style.visibility = 'visible';
      menu.querySelector('button').focus();
    };

    document.addEventListener('click', (e) => {
      if (!exportButton.contains(e.target) && !menu.contains(e.target)) closeMenu();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.style.display === 'block') {
        closeMenu();
        exportButton.focus();
      }
    });

    document.getElementById('json2table-export-csv').onclick = () => {
      closeMenu();
      tableViewer.exportCSV();
      this.showTemporaryMessage('CSV downloaded', 'success');
    };

    document.getElementById('json2table-export-json').onclick = () => {
      closeMenu();
      this.exportJSON(jsonData);
      this.showTemporaryMessage('JSON downloaded', 'success');
    };

    document.getElementById('json2table-copy-json').onclick = async () => {
      closeMenu();
      try {
        await navigator.clipboard.writeText(this.serializeForExport(jsonData));
        this.showTemporaryMessage('JSON copied to clipboard', 'success');
      } catch (err) {
        this.showTemporaryMessage('Could not access the clipboard', 'error');
      }
    };
  }

  /* ---------------------------------------------------------------- *
   * JSON view
   * ---------------------------------------------------------------- */

  static refreshJsonView(jsonData = this.jsonViewData) {
    if (jsonData !== undefined) this.jsonViewData = jsonData;
    if (!this.isJsonViewVisible()) return;
    this.renderJsonView(this.jsonViewData, document.getElementById('json2table-json-container'));
  }

  /**
   * Prune JSON to what matches the search, at every level: a property stays if
   * its name or scalar value matches, or anything beneath it does -- and its
   * children are pruned the same way. A property whose name matches but whose
   * contents don't is kept whole, rather than shown as a misleading {} or [].
   * Returns undefined for no match.
   */
  static filterJson(value, needle) {
    if (value !== null && typeof value === 'object' && !JSONDetector.isRawNumber(value)) {
      if (Array.isArray(value)) {
        const items = value.map(item => this.filterJson(item, needle)).filter(item => item !== undefined);
        return items.length ? items : undefined;
      }

      const out = {};
      let matched = false;
      for (const [key, child] of Object.entries(value)) {
        let kept = this.filterJson(child, needle);
        if (kept === undefined && key.toLowerCase().includes(needle)) kept = child;
        if (kept === undefined) continue;
        // defineProperty so a "__proto__" key stays an ordinary property.
        Object.defineProperty(out, key, { value: kept, enumerable: true, writable: true, configurable: true });
        matched = true;
      }
      return matched ? out : undefined;
    }

    const text = JSONDetector.isRawNumber(value) ? value.rawJSON : String(value);
    return text.toLowerCase().includes(needle) ? value : undefined;
  }

  /** Wrap case-insensitive occurrences of the query in the rendered JSON with <mark>. */
  static highlightJsonMatches(pre, query) {
    const needle = query.toLowerCase();
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) {
      if (walker.currentNode.nodeValue.toLowerCase().includes(needle)) nodes.push(walker.currentNode);
    }

    nodes.forEach(node => {
      const text = node.nodeValue;
      const lower = text.toLowerCase();
      const fragment = document.createDocumentFragment();
      let pos = 0;
      let hit;
      while ((hit = lower.indexOf(needle, pos)) !== -1) {
        if (hit > pos) fragment.appendChild(document.createTextNode(text.slice(pos, hit)));
        const mark = document.createElement('mark');
        mark.className = 'search-highlight';
        mark.textContent = text.slice(hit, hit + needle.length);
        fragment.appendChild(mark);
        pos = hit + needle.length;
      }
      if (pos < text.length) fragment.appendChild(document.createTextNode(text.slice(pos)));
      node.parentNode.replaceChild(fragment, node);
    });
  }

  /** Match count and prev/next state for the JSON view. */
  static updateJsonSearchStatus(query) {
    const pre = document.getElementById('json2table-json-content');
    const marks = pre ? pre.querySelectorAll('mark.search-highlight') : [];
    const count = marks.length;
    this.jsonMatch = count ? Math.min(Math.max(this.jsonMatch || 1, 1), count) : 0;
    marks.forEach((mark, i) => mark.classList.toggle('is-current', i === this.jsonMatch - 1));

    const countEl = document.getElementById('json2table-search-count');
    if (countEl) {
      countEl.textContent = !query ? '' : count ? `${this.jsonMatch} of ${count}` : 'no matches';
      countEl.classList.toggle('is-empty', Boolean(query) && count === 0);
    }
    ['json2table-search-prev', 'json2table-search-next'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.disabled = count === 0;
    });
  }

  static gotoJsonMatch(delta) {
    const pre = document.getElementById('json2table-json-content');
    const marks = pre ? pre.querySelectorAll('mark.search-highlight') : [];
    if (!marks.length) return;
    this.jsonMatch = ((this.jsonMatch - 1 + delta + marks.length) % marks.length) + 1;
    const query = window.tableViewer ? window.tableViewer.searchQuery : null;
    this.updateJsonSearchStatus(query);
    marks[this.jsonMatch - 1].scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  static renderJsonView(jsonData, jsonContainer) {
    let dataToShow = jsonData;
    let contextInfo = 'Original JSON';

    const viewer = window.tableViewer;
    if (viewer && viewer.currentContext && viewer.currentContext.breadcrumbPath &&
        viewer.currentContext.breadcrumbPath.length > 0) {
      dataToShow = viewer.currentData;
      contextInfo = viewer.currentContext.breadcrumbPath.join(' / ');
    }

    // Share the table's search: prune to matching properties and highlight.
    const query = viewer && viewer.searchQuery ? viewer.searchQuery : null;
    let noMatches = false;
    if (query) {
      if (typeof dataToShow === 'string') {
        try { dataToShow = JSONDetector.parse(dataToShow); } catch (e) { /* leave as-is */ }
      }
      const filtered = this.filterJson(dataToShow, query.toLowerCase());
      noMatches = filtered === undefined;
      dataToShow = noMatches ? (Array.isArray(dataToShow) ? [] : {}) : filtered;
      contextInfo += ` \u00b7 filtered by \u201c${query}\u201d${noMatches ? ' \u2014 no matches' : ''}`;
    }

    const formattedJson = this.serializeForExport(dataToShow);

    jsonContainer.innerHTML = `
      <div class="j2t-json-toolbar">
        <h3>${this.escapeHtml(contextInfo)}</h3>
        <div class="j2t-json-actions">
          <button id="json2table-json-expand-all" class="j2t-btn" type="button">Expand all</button>
          <button id="json2table-json-collapse-all" class="j2t-btn" type="button">Collapse all</button>
          <button id="json2table-copy-source" class="j2t-btn" type="button">Copy</button>
        </div>
      </div>
      <pre id="json2table-json-content">${ThemeManager.foldableJsonHtml(formattedJson)}</pre>
    `;

    window.currentJsonData = formattedJson;

    const pre = document.getElementById('json2table-json-content');
    ThemeManager.wireJsonFolding(pre);
    document.getElementById('json2table-json-expand-all').onclick = () => ThemeManager.setAllFolds(pre, false);
    document.getElementById('json2table-json-collapse-all').onclick = () => ThemeManager.setAllFolds(pre, true);

    this.jsonMatch = 1;
    if (query) this.highlightJsonMatches(pre, query);
    this.updateJsonSearchStatus(query);

    const copyBtn = document.getElementById('json2table-copy-source');
    if (copyBtn) {
      copyBtn.onclick = () => ThemeManager.copyJsonToClipboard(copyBtn);
    }
  }

  static serializeForExport(data) {
    if (typeof data === 'string') {
      try {
        return JSON.stringify(JSONDetector.parse(data), null, 2);
      } catch (e) {
        return data;
      }
    }
    try {
      return JSON.stringify(data, null, 2);
    } catch (e) {
      return String(data);
    }
  }

  static escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  }

  static formatColumnName(name) {
    return String(name)
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  static showTemporaryMessage(message, type = 'info') {
    document.querySelectorAll('.j2t-toast').forEach(el => el.remove());

    const notification = document.createElement('div');
    notification.className = `j2t-toast is-${type}`;
    notification.setAttribute('role', 'status');
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateX(-50%) translateY(-16px)';
      setTimeout(() => notification.remove(), 300);
    }, 2200);
  }

  static exportJSON(jsonData) {
    try {
      let dataToExport = jsonData;
      const viewer = window.tableViewer;

      if (viewer && viewer.currentContext && viewer.currentContext.breadcrumbPath &&
          viewer.currentContext.breadcrumbPath.length > 0) {
        dataToExport = viewer.currentData;
      }

      const formattedJson = this.serializeForExport(dataToExport);
      const blob = new Blob([formattedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      let filename = 'json-table-export.json';
      if (viewer && viewer.currentContext && viewer.currentContext.breadcrumbPath &&
          viewer.currentContext.breadcrumbPath.length > 0) {
        const focusPath = viewer.currentContext.breadcrumbPath
          .join('-').toLowerCase().replace(/[^a-z0-9-]/g, '-');
        filename = `json-export-${focusPath}.json`;
      }

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting JSON:', error);
      this.showTemporaryMessage('Error downloading JSON', 'error');
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIUtils;
} else {
  window.UIUtils = UIUtils;
}
