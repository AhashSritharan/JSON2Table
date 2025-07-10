/**
 * UI utilities for JSON2Table
 */
class UIUtils {
  static clearPageAndResetStyles() {
    // Remove all existing content and styles
    document.body.innerHTML = '';

    // Remove any remaining PRE elements that might still exist
    document.querySelectorAll('pre').forEach(pre => pre.remove());

    document.head.querySelectorAll('style').forEach(style => {
      // Only remove non-essential styles, keep basic browser styles
      if (!style.id || !style.id.includes('json2table')) {
        style.remove();
      }
    });

    // Reset body and html styles to eliminate any scrolling conflicts
    document.documentElement.style.cssText = `
      margin: 0;
      padding: 0;
      height: 100%;
      overflow: hidden;
    `;

    document.body.style.cssText = `
      margin: 0;
      padding: 0;
      height: 100vh;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color, #ffffff);
      color: var(--text-color, #333333);
    `;
  }

  static createToggleButtons(tableContainer, rawJsonContainer) {
    const optionBar = document.createElement('div');
    optionBar.id = 'json2tableOptionBar';
    optionBar.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 10000;
      display: flex;
      gap: 8px;
      background: var(--button-bg);
      border: 1px solid var(--button-border);
      border-radius: 8px;
      padding: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    const buttonTable = document.createElement('button');
    buttonTable.textContent = 'JSON Table View';
    buttonTable.style.cssText = `
      padding: 10px 18px;
      border: none;
      background: var(--button-active);
      color: white;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s ease;
    `;

    // Only add raw JSON toggle if rawJsonContainer is provided
    if (rawJsonContainer) {
      const buttonRaw = document.createElement('button');
      buttonRaw.textContent = 'Raw JSON';
      buttonRaw.style.cssText = `
        padding: 10px 18px;
        border: none;
        background: var(--button-bg);
        color: var(--text-color);
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        transition: all 0.2s ease;
      `;

      let tableMode = true;

      buttonRaw.addEventListener('click', () => {
        if (tableMode) {
          tableMode = false;
          tableContainer.hidden = true;
          rawJsonContainer.hidden = false;
          // Enable scrolling for raw view
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';

          buttonTable.style.background = 'var(--button-bg)';
          buttonTable.style.color = 'var(--text-color)';
          buttonRaw.style.background = 'var(--button-active)';
          buttonRaw.style.color = 'white';
        }
      });

      buttonTable.addEventListener('click', () => {
        if (!tableMode) {
          tableMode = true;
          tableContainer.hidden = false;
          rawJsonContainer.hidden = true;
          // Disable scrolling for table view (table handles its own scrolling)
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';

          buttonTable.style.background = 'var(--button-active)';
          buttonTable.style.color = 'white';
          buttonRaw.style.background = 'var(--button-bg)';
          buttonRaw.style.color = 'var(--text-color)';
        }
      });

      optionBar.appendChild(buttonTable);
      optionBar.appendChild(buttonRaw);
    } else {
      // Table-only mode - just show an indicator
      buttonTable.style.cursor = 'default';
      buttonTable.title = 'Currently viewing JSON as interactive table';
      optionBar.appendChild(buttonTable);
    }

    document.body.appendChild(optionBar);
  }

  static createTableInterface(container, tableData, originalJson = null) {
    // Create the table interface HTML
    container.innerHTML = `
      <div class="json2table-header" style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 15px 20px;
        background: var(--header-bg);
        border-bottom: 1px solid var(--border-color);
        position: sticky;
        top: 0;
        z-index: 1000;
      ">
        <div class="json2table-title" style="
          font-size: 18px;
          font-weight: 600;
          color: var(--text-color);
        ">JSON Table (${tableData.length} rows)</div>
        <div class="json2table-controls" style="display: flex; gap: 10px; align-items: center;">
          <input type="text" id="json2table-search" placeholder="Search..." style="
            padding: 6px 12px;
            border: 1px solid var(--border-color);
            border-radius: 4px;
            background: var(--button-bg);
            color: var(--text-color);
            font-size: 14px;
            width: 200px;
          "/>
          <button id="json2table-expand-all" style="
            padding: 6px 12px;
            background: var(--button-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Expand All</button>
          <button id="json2table-collapse-all" style="
            padding: 6px 12px;
            background: var(--button-bg);
            color: var(--text-color);
            border: 1px solid var(--border-color);
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Collapse All</button>          <button id="json2table-toggle-view" style="
            padding: 6px 12px;
            background: #8b5cf6;
            color: white;
            border: 1px solid #8b5cf6;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">JSON View</button>          <div id="json2table-export-dropdown" style="position: relative; display: inline-block;">
            <button id="json2table-export" style="
              padding: 6px 12px;
              background: var(--button-active);
              color: white;
              border: 1px solid var(--button-active);
              border-radius: 4px;
              cursor: pointer;
              font-size: 14px;
              display: flex;
              align-items: center;
              gap: 4px;
            ">Export <span style="font-size: 10px;">▼</span></button>
          </div>
        </div>
      </div>
      <div id="json2table-table-container" style="
        flex: 1;
        overflow: auto;
        background: var(--bg-color);
      "></div>
      <div id="json2table-json-container" style="
        flex: 1;
        overflow: auto;
        background: var(--bg-color);
        display: none;
      "></div>
    `;

    // Add table styles
    StyleManager.injectTableStyles();

    // Initialize table viewer
    const tableViewer = new TableViewer(tableData);
    // Store table viewer globally for access by message handler
    window.tableViewer = tableViewer;
    tableViewer.render();

    // Check if auto-expand is enabled and expand all automatically
    ThemeManager.getSettings().then(settings => {
      if (settings.autoExpand) {
        // Small delay to ensure table is fully rendered
        setTimeout(() => {
          tableViewer.expandAll();
        }, 100);
      }
    });    // Event listeners
    document.getElementById('json2table-search').oninput = (e) => tableViewer.search(e.target.value);
    document.getElementById('json2table-expand-all').onclick = () => tableViewer.expandAll();
    document.getElementById('json2table-collapse-all').onclick = () => tableViewer.collapseAll();
    // Use original JSON if available, otherwise fall back to table data
    const jsonForView = originalJson || tableData;
    document.getElementById('json2table-toggle-view').onclick = () => this.toggleView(jsonForView);      // Export dropdown functionality
    const exportButton = document.getElementById('json2table-export');

    // Create dropdown menu and append to body to escape stacking context
    const exportMenu = document.createElement('div');
    exportMenu.id = 'json2table-export-menu'; exportMenu.style.cssText = `
      position: fixed;
      background: var(--bg-color);
      border: 1px solid var(--border-color);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 1000002;
      display: none;
      width: auto;
      min-width: 80px;
      pointer-events: auto;
      overflow: hidden;
    `; exportMenu.innerHTML = `
      <button id="json2table-export-csv" style="
        padding: 8px 16px;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        color: var(--text-color);
        transition: background-color 0.2s;
        line-height: 1.2;
        margin: 0;
        white-space: nowrap;
        display: block;
        width: 100%;
      ">CSV</button>
      <button id="json2table-export-json" style="
        padding: 8px 16px;
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        font-size: 14px;
        color: var(--text-color);
        transition: background-color 0.2s;
        border-top: 1px solid var(--border-color);
        line-height: 1.2;
        margin: 0;
        white-space: nowrap;
        display: block;
        width: 100%;
      ">JSON</button>
    `;

    document.body.appendChild(exportMenu);

    const exportCsvBtn = document.getElementById('json2table-export-csv');
    const exportJsonBtn = document.getElementById('json2table-export-json');

    // Toggle dropdown
    exportButton.onclick = (e) => {
      e.stopPropagation();
      const isVisible = exportMenu.style.display === 'block';

      if (!isVisible) {
        // Show dropdown to measure its dimensions
        exportMenu.style.display = 'block';
        exportMenu.style.visibility = 'hidden';

        // Get button and dropdown dimensions
        const buttonRect = exportButton.getBoundingClientRect();
        const menuRect = exportMenu.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // Calculate initial position
        let top = buttonRect.bottom + 2;
        let left = buttonRect.left;

        // Check if dropdown extends beyond right edge of viewport
        if (left + menuRect.width > viewportWidth) {
          // Position to the left of the button instead
          left = buttonRect.right - menuRect.width;
        }

        // Check if dropdown extends beyond bottom edge of viewport
        if (top + menuRect.height > viewportHeight) {
          // Position above the button instead
          top = buttonRect.top - menuRect.height - 2;
        }

        // Ensure dropdown doesn't go beyond left edge
        if (left < 0) {
          left = 8; // Small margin from left edge
        }

        // Ensure dropdown doesn't go beyond top edge
        if (top < 0) {
          top = 8; // Small margin from top edge
        }

        // Apply final position and make visible
        exportMenu.style.top = top + 'px';
        exportMenu.style.left = left + 'px';
        exportMenu.style.visibility = 'visible';
      } else {
        exportMenu.style.display = 'none';
      }
    };

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
      if (!exportButton.contains(e.target) && !exportMenu.contains(e.target)) {
        exportMenu.style.display = 'none';
      }
    });

    // Export CSV option
    exportCsvBtn.onclick = () => {
      tableViewer.exportCSV();
      exportMenu.style.display = 'none';
    };

    // Export JSON option
    exportJsonBtn.onclick = () => {
      this.exportJSON(jsonForView);
      exportMenu.style.display = 'none';
    };

    // Add hover effects to menu items
    [exportCsvBtn, exportJsonBtn].forEach(btn => {
      btn.onmouseenter = () => btn.style.background = 'var(--button-bg)';
      btn.onmouseleave = () => btn.style.background = 'none';
    });
  }

  // Toggle view functionality for auto-converted interface
  static toggleView(jsonData) {
    const tableContainer = document.getElementById('json2table-table-container');
    const jsonContainer = document.getElementById('json2table-json-container');
    const toggleButton = document.getElementById('json2table-toggle-view');
    const searchInput = document.getElementById('json2table-search');
    const expandButton = document.getElementById('json2table-expand-all');
    const collapseButton = document.getElementById('json2table-collapse-all');

    if (!tableContainer || !jsonContainer) return;

    const isJsonView = jsonContainer.style.display !== 'none';

    if (!isJsonView) {
      // Switch to JSON view
      tableContainer.style.display = 'none';
      jsonContainer.style.display = 'block';
      toggleButton.textContent = 'Table View';

      // Disable table-specific controls
      if (searchInput) searchInput.disabled = true;
      if (expandButton) expandButton.disabled = true;
      if (collapseButton) collapseButton.disabled = true;

      // Handle both original JSON string and parsed JSON data
      let formattedJson;
      let dataLength = 0;

      if (typeof jsonData === 'string') {
        // Original JSON string - use as is but format it
        try {
          const parsed = JSON.parse(jsonData);
          formattedJson = JSON.stringify(parsed, null, 2);
          dataLength = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        } catch (e) {
          // If parsing fails, use the string as is
          formattedJson = jsonData;
          dataLength = 'N/A';
        }
      } else {
        // Parsed JSON data - stringify it
        formattedJson = JSON.stringify(jsonData, null, 2);
        dataLength = Array.isArray(jsonData) ? jsonData.length : Object.keys(jsonData).length;
      }

      // Render formatted JSON with syntax highlighting
      jsonContainer.innerHTML = `
        <div style="
          padding: 20px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          background: var(--bg-color);
          height: 100%;
          overflow: auto;
        ">          <div style="
            padding: 16px 20px;
            border-bottom: 1px solid var(--border-color);
            background: var(--header-bg);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-radius: 4px 4px 0 0;
            margin: -20px -20px 20px -20px;
          ">
            <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--text-color);">
              Original JSON Data (${dataLength} items)
            </h3>
          </div>
          <pre style="
            margin: 0;
            white-space: pre-wrap;
            color: var(--text-color);
            background: var(--bg-color);
          ">${ThemeManager.syntaxHighlightJson(formattedJson)}</pre>
        </div>
      `;

      // Store JSON data for copying
      window.currentJsonData = formattedJson;
    } else {
      // Switch to table view
      tableContainer.style.display = 'block';
      jsonContainer.style.display = 'none';
      toggleButton.textContent = 'JSON View';

      // Re-enable table-specific controls
      if (searchInput) searchInput.disabled = false;
      if (expandButton) expandButton.disabled = false;
      if (collapseButton) collapseButton.disabled = false;
    }
  }

  static formatColumnName(name) {
    return name.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  static showTemporaryMessage(message, type = 'info') {
    // Create temporary notification
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 6px;
      color: white;
      font-weight: 500;
      z-index: 1000001;
      transition: all 0.3s ease;
      background: ${type === 'success' ? '#10b981' : type === 'info' ? '#2563eb' : '#f59e0b'};
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Auto remove after 2 seconds
    setTimeout(() => {
      notification.style.opacity = '0';
      notification.style.transform = 'translateY(-20px)';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
  static exportJSON(jsonData) {
    try {
      // Handle both original JSON string and parsed JSON data
      let formattedJson;

      if (typeof jsonData === 'string') {
        // Original JSON string - use as is but format it
        try {
          const parsed = JSON.parse(jsonData);
          formattedJson = JSON.stringify(parsed, null, 2);
        } catch (e) {
          // If parsing fails, use the string as is
          formattedJson = jsonData;
        }
      } else {
        // Parsed JSON data - stringify it
        formattedJson = JSON.stringify(jsonData, null, 2);
      }

      // Create and download the JSON file
      const blob = new Blob([formattedJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = 'json-table-export.json';
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
