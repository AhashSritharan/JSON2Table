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

  static createTableInterface(container, tableData) {
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
          ">Collapse All</button>
          <button id="json2table-toggle-view" style="
            padding: 6px 12px;
            background: #8b5cf6;
            color: white;
            border: 1px solid #8b5cf6;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">JSON View</button>
          <button id="json2table-export" style="
            padding: 6px 12px;
            background: var(--button-active);
            color: white;
            border: 1px solid var(--button-active);
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          ">Export CSV</button>
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
    tableViewer.render();

    // Check if auto-expand is enabled and expand all automatically
    ThemeManager.getSettings().then(settings => {
      if (settings.autoExpand) {
        // Small delay to ensure table is fully rendered
        setTimeout(() => {
          tableViewer.expandAll();
        }, 100);
      }
    });

    // Event listeners
    document.getElementById('json2table-search').oninput = (e) => tableViewer.search(e.target.value);
    document.getElementById('json2table-expand-all').onclick = () => tableViewer.expandAll();
    document.getElementById('json2table-collapse-all').onclick = () => tableViewer.collapseAll();
    document.getElementById('json2table-toggle-view').onclick = () => this.toggleView(tableData);
    document.getElementById('json2table-export').onclick = () => tableViewer.exportCSV();
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
      
      // Render formatted JSON with syntax highlighting
      const formattedJson = JSON.stringify(jsonData, null, 2);
      jsonContainer.innerHTML = `
        <div style="
          padding: 20px;
          font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
          font-size: 14px;
          line-height: 1.6;
          background: var(--bg-color);
          height: 100%;
          overflow: auto;
        ">
          <div style="
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
              Formatted JSON Data (${jsonData.length} items)
            </h3>
            <button onclick="ThemeManager.copyJsonToClipboard()" style="
              padding: 6px 12px;
              background: var(--button-active);
              color: white;
              border: none;
              border-radius: 4px;
              cursor: pointer;
              font-size: 12px;
              font-weight: 500;
            ">Copy JSON</button>
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIUtils;
} else {
  window.UIUtils = UIUtils;
}
