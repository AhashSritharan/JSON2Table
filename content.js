// Content script for JSON2Table extension
(function() {
  'use strict';

  let detectedData = null;
  let autoConvertEnabled = false;

  // Automatic JSON detection based on json-formatter approach
  class AutoJSONDetector {
    static async checkAndConvert(forceConvert = false) {
      // Only proceed if auto-convert is enabled (unless forced)
      if (!forceConvert) {
        const settings = await this.getSettings();
        if (!settings.autoConvert) {
          return { converted: false, note: 'Auto-convert disabled' };
        }
      }

      // Look for body>pre element (json-formatter approach)
      const originalPreElement = (() => {
        const bodyChildren = document.body.children;
        const length = bodyChildren.length;
        for (let i = 0; i < length; i++) {
          const child = bodyChildren[i];
          if (child.tagName === 'PRE') return child;
        }
        return null;
      })();

      if (originalPreElement === null) {
        return { converted: false, note: 'No body>pre found' };
      }

      const rawPreContent = originalPreElement.textContent;

      if (!rawPreContent) {
        return { converted: false, note: 'No content in body>pre' };
      }

      const rawLength = rawPreContent.length;

      if (rawLength > 3000000) {
        return { converted: false, note: 'Too long (>3MB)' };
      }

      if (!/^\s*[\{\[]/.test(rawPreContent)) {
        return { converted: false, note: 'Does not start with { or [' };
      }

      // Try to parse as JSON
      let parsedJsonValue;
      try {
        parsedJsonValue = JSON.parse(rawPreContent);
      } catch (e) {
        return { converted: false, note: 'Does not parse as JSON' };
      }

      if (typeof parsedJsonValue !== 'object' && !Array.isArray(parsedJsonValue)) {
        return { converted: false, note: 'Not an object or array' };
      }      // Check if it's suitable for table conversion
      const tableData = JSONDetector.extractTableData(parsedJsonValue);
      
      if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
        return { converted: false, note: 'No suitable table data found' };
      }

      // Verify the table data contains objects
      if (!tableData.some(item => item && typeof item === 'object' && !Array.isArray(item))) {
        return { converted: false, note: 'Table data must contain objects' };
      }      // Store ONLY the text content before clearing everything
      const originalTextContent = originalPreElement.textContent;

      originalPreElement.remove(); // Remove the original PRE element

      // Create containers with clean structure
      const tableContainer = document.createElement('div');
      tableContainer.id = 'json2tableContainer';
      tableContainer.style.cssText = `
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: var(--bg-color, #ffffff);
        color: var(--text-color, #333333);
        margin: 0;
        padding: 0;
        height: 100vh;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
      `;
      document.body.appendChild(tableContainer);      // Apply theme
      this.applyTheme();

      // Create table viewer
      this.createTableInterface(tableContainer, tableData);return { converted: true, note: 'Converted to table', rawLength };
    }    static clearPageAndResetStyles() {
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
      `;

      // Add table styles
      const style = document.createElement('style');
      style.textContent = `        .json2table-table {
          width: 100%;
          border-collapse: collapse;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          table-layout: auto;
        }        .json2table-table th {
          background: var(--header-bg);
          color: var(--text-color);
          padding: 16px 16px;
          text-align: left;
          border-bottom: 2px solid var(--border-color);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 100;
        }        .json2table-table td {
          padding: 16px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-color);
          vertical-align: top;
          word-wrap: break-word;
          white-space: normal;
        }
        
        /* Apply minimum width only to cells with substantial content */
        .json2table-table td.wide-content {
          min-width: 200px;
        }
        .json2table-table tr:hover {
          background: var(--hover-bg);
        }
        .expandable-array, .expandable-object {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          cursor: pointer;
          margin: 1px;
          font-weight: 500;
        }
        .expandable-array {
          background: var(--array-badge);
          color: white;
        }
        .expandable-object {
          background: var(--object-badge);
          color: white;
        }
        .expandable-array:hover, .expandable-object:hover {
          opacity: 0.8;
        }
        .json2table-expanded-row {
          background: var(--expand-bg) !important;
        }        .json2table-expanded-content {
          padding: 10px 15px;
          border-left: 3px solid var(--button-active);
          margin: 5px 0;
        }
          /* Inline expansion styles */
        .inline-array-expansion, .inline-object-expansion {
          margin-top: 8px;
          padding: 8px;
          background: var(--expand-bg);
          border-radius: 4px;
          border-left: 3px solid var(--array-badge);
          font-size: 12px;
          position: relative;
          z-index: 1;
        }
        .inline-object-expansion {
          border-left-color: var(--object-badge);
        }
        .inline-expansion-header {
          font-weight: 600;
          color: var(--text-color);
          margin-bottom: 6px;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }        .inline-array-table, .inline-object-properties {
          max-height: 200px;
          overflow-y: auto;
        }
          /* Inline table styles */
        .inline-array-table-wrapper {
          margin-top: 6px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }
        
        .inline-object-table-wrapper {
          margin-top: 6px;
          border-radius: 4px;
          overflow: hidden;
          border: 1px solid var(--border-color);
        }.inline-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 11px;
          background: var(--bg-color);
        }
        .inline-table th {
          background: var(--header-bg);
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-color);
          border-right: 1px solid var(--border-color);
          font-weight: 600;
          color: var(--text-color);
          text-align: left;
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .inline-table th:last-child {
          border-right: none;
        }
        .inline-table-row {
          border-bottom: 1px solid var(--border-color);
          background: var(--bg-color);
        }
        .inline-table-row:hover {
          background: var(--hover-bg);
        }
        .inline-table-row:nth-child(even) {
          background: var(--header-bg);
        }
        .inline-table-row:nth-child(even):hover {
          background: var(--hover-bg);
        }        .inline-table-cell {
          padding: 6px 8px;
          border-right: 1px solid var(--border-color);
          color: var(--text-color);
          vertical-align: top;
          white-space: nowrap;
        }
        .inline-table-cell:last-child {
          border-right: none;
        }
        
        .inline-array-row, .inline-property-row {
          margin-bottom: 4px;
          padding: 4px 6px;
          background: var(--button-bg);
          border-radius: 3px;
          border: 1px solid var(--border-color);
          font-size: 11px;
          line-height: 1.3;
        }
        .inline-item-index {
          color: var(--array-badge);
          font-weight: 600;
          margin-right: 6px;
          font-family: monospace;
        }        .inline-property-name {
          color: var(--object-badge);
          font-weight: 600;
          margin-right: 6px;
        }
        .inline-property-value, .inline-value {
          color: var(--text-color);
        }
          /* Style for table-based object property names */
        .inline-table-cell.inline-property-name {
          background: var(--header-bg);
          font-weight: 600;
          color: var(--object-badge);
          /* Remove fixed width - let content determine size naturally */
        }
        
        /* Apply smart width logic to object property value cells */
        .inline-table-cell.inline-property-value.wide-content {
          min-width: 200px;
        }
        .inline-property {
          margin-right: 8px;
        }
        .inline-property strong {
          color: var(--object-badge);
        }
          /* Inline value formatting */
        .null-value {
          color: var(--muted-text);
          font-style: italic;
        }
        .boolean-value {
          font-weight: 600;
        }
        .boolean-value.true {
          color: #059669;
        }
        .boolean-value.false {
          color: #dc2626;
        }
        .date-value {
          color: #7c3aed;
          font-weight: 500;
        }        .nested-array, .nested-object {
          color: #64748b;
          background: var(--button-bg);
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 10px;
          border: 1px solid var(--border-color);
        }
        .nested-object-detailed {
          color: #374151;
          background: var(--expand-bg);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 11px;
          border: 1px solid var(--border-color);
          line-height: 1.4;
        }        .nested-object-detailed strong {
          color: var(--object-badge);
          font-weight: 600;
        }
        
        /* Search highlighting */
        .search-highlight {
          background: #ffeb3b;
          color: #333;
          padding: 1px 2px;
          border-radius: 2px;
          font-weight: 600;
        }
        
        /* Dark mode search highlighting */
        @media (prefers-color-scheme: dark) {
          .search-highlight {
            background: #ffc107;
            color: #000;
          }
        }
      `;
      document.head.appendChild(style);

      // Initialize table viewer
      const tableViewer = new TableViewer(tableData);
      tableViewer.render();

      // Event listeners
      document.getElementById('json2table-search').oninput = (e) => tableViewer.search(e.target.value);
      document.getElementById('json2table-expand-all').onclick = () => tableViewer.expandAll();
      document.getElementById('json2table-collapse-all').onclick = () => tableViewer.collapseAll();
      document.getElementById('json2table-export').onclick = () => tableViewer.exportCSV();
    }

    static async getSettings() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['autoConvert', 'themeOverride'], (result) => {
          resolve({
            autoConvert: result.autoConvert !== false, // Default to true
            themeOverride: result.themeOverride || 'system'
          });
        });
      });
    }

    static applyTheme() {
      // Add CSS variables for theming
      const style = document.createElement('style');
      style.id = 'json2tableTheme';
      
      // Get theme preference
      this.getSettings().then(settings => {
        let themeCSS = '';
        
        switch (settings.themeOverride) {          case 'force_light':
            themeCSS = `
              :root {
                --bg-color: #ffffff;
                --text-color: #333333;
                --border-color: #e1e5e9;
                --header-bg: #f8f9fa;
                --hover-bg: #f5f5f5;
                --button-bg: #ffffff;
                --button-border: #dee2e6;
                --button-active: #007bff;
                --expand-bg: #e3f2fd;
                --array-badge: #9c27b0;
                --object-badge: #2196f3;
                --muted-text: #9ca3af;
              }
            `;
            break;          case 'force_dark':
            themeCSS = `
              :root {
                --bg-color: #1a1a1a;
                --text-color: #eeeeeee;
                --border-color: #404040;
                --header-bg: #2a2a2a;
                --hover-bg: #333333;
                --button-bg: #2a2a2a;
                --button-border: #404040;
                --button-active: #4dabf7;
                --expand-bg: #1e3a5f;
                --array-badge: #ba68c8;
                --object-badge: #64b5f6;
                --muted-text: #71717a;
              }
            `;
            break;          case 'system':
          default:
            themeCSS = `
              :root {
                --bg-color: #ffffff;
                --text-color: #333333;
                --border-color: #e1e5e9;
                --header-bg: #f8f9fa;
                --hover-bg: #f5f5f5;
                --button-bg: #ffffff;
                --button-border: #dee2e6;
                --button-active: #007bff;
                --expand-bg: #e3f2fd;
                --array-badge: #9c27b0;
                --object-badge: #2196f3;
                --muted-text: #9ca3af;
              }
              
              @media (prefers-color-scheme: dark) {
                :root {
                  --bg-color: #1a1a1a;
                  --text-color: #eeeeee;
                  --border-color: #404040;
                  --header-bg: #2a2a2a;
                  --hover-bg: #333333;
                  --button-bg: #2a2a2a;
                  --button-border: #404040;
                  --button-active: #4dabf7;
                  --expand-bg: #1e3a5f;
                  --array-badge: #ba68c8;
                  --object-badge: #64b5f6;
                  --muted-text: #71717a;
                }
              }
            `;
        }
        
        style.textContent = themeCSS;
      });
      
      document.head.appendChild(style);
    }  static createToggleButtons(tableContainer, rawJsonContainer) {
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
  }

  // JSON detection and parsing utilities
  class JSONDetector {
    static detectJSONInPage() {
      const jsonSources = [
        // Check for JSON in script tags
        ...Array.from(document.querySelectorAll('script[type="application/json"]'))
          .map(script => script.textContent),
        
        // Check for JSON in pre tags (common for API responses)
        ...Array.from(document.querySelectorAll('pre'))
          .map(pre => pre.textContent)
          .filter(text => text.trim().startsWith('{') || text.trim().startsWith('[')),
        
        // Check for JSON in the page body if it looks like raw JSON
        document.body.textContent.trim().startsWith('{') || document.body.textContent.trim().startsWith('[') 
          ? document.body.textContent : null
      ].filter(Boolean);

      for (const source of jsonSources) {
        try {
          const parsed = JSON.parse(source.trim());
          if (this.isValidDataStructure(parsed)) {
            return parsed;
          }
        } catch (e) {
          // Continue to next source
        }
      }

      return null;
    }    static isValidDataStructure(data) {
      // Check if it's an array of objects (like the products example)
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return true;
      }
      
      // Check if it's a single object (like a user profile) - NEW: Support single objects
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        // Accept any non-empty object as valid for single-row table
        const keys = Object.keys(data);
        if (keys.length > 0) {
          return true;
        }
      }
      
      // Check if it's an object with an array property
      if (typeof data === 'object' && data !== null) {
        for (const key in data) {
          if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
            return true;
          }
        }
      }
      
      return false;
    }    static extractTableData(jsonData) {
      // If it's directly an array, use it
      if (Array.isArray(jsonData)) {
        return jsonData;
      }
      
      // NEW: If it's a single object, convert it to property-value format
      if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
        // Check if this object has array properties first
        let hasArrayProperty = false;
        let largestArray = [];
        
        for (const key in jsonData) {
          if (Array.isArray(jsonData[key]) && 
              jsonData[key].length > largestArray.length &&
              jsonData[key].length > 0 && 
              typeof jsonData[key][0] === 'object') {
            largestArray = jsonData[key];
            hasArrayProperty = true;
          }
        }
        
        // If we found array properties, use the largest one
        if (hasArrayProperty && largestArray.length > 0) {
          return largestArray;
        }
        
        // Otherwise, convert single object to property-value rows
        return Object.entries(jsonData).map(([key, value]) => ({
          property: key,
          value: value
        }));
      }
      
      return [];
    }
  }
  // Data preparation utility - keeps objects intact for expansion
  class DataFlattener {
    static prepareTableData(data) {
      // Don't flatten objects - keep them intact for expandable display
      return data.map(item => this.prepareItem(item));
    }

    static prepareItem(obj) {
      const prepared = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          
          // Keep objects and arrays as-is for expandable display
          if (Array.isArray(value)) {
            prepared[key] = value;
          } else if (value !== null && typeof value === 'object') {
            // Keep object intact but limit size for performance
            const keys = Object.keys(value);
            if (keys.length <= 20) { // Limit to prevent performance issues
              prepared[key] = value;
            } else {
              prepared[key] = `{${keys.length} properties - too large to expand}`;
            }
          } else {
            prepared[key] = value;
          }
        }      }
      return prepared;
    }
  }

  // Message listener for communication with popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detectJson') {
      // Use forced conversion for manual detection (bypass auto-convert setting)
      AutoJSONDetector.checkAndConvert(true).then(result => {
        if (result.converted) {
          sendResponse({
            success: true,
            recordCount: result.rawLength ? Math.round(result.rawLength/1024) + 'KB' : 'Unknown size',
            converted: true
          });
        } else {
          sendResponse({ success: false, note: result.note || 'No suitable JSON found' });
        }
      }).catch(error => {
        console.error('JSON detection error:', error);
        sendResponse({ success: false, error: error.message });
      });      return true; // Will respond asynchronously
    }
  });

  // Create and open table viewer
  function openTableViewer(data) {
    // Remove existing viewer if present
    const existingViewer = document.getElementById('json2table-viewer');
    if (existingViewer) {
      existingViewer.remove();
    }

    // Create viewer container
    const viewer = document.createElement('div');
    viewer.id = 'json2table-viewer';
    viewer.innerHTML = `
      <div class="json2table-overlay">
        <div class="json2table-modal">
          <div class="json2table-header">
            <h2>JSON Table Viewer</h2>            <div class="json2table-controls">
              <input type="text" id="json2table-search" placeholder="Search..." />
              <button id="json2table-expand-all">Expand All</button>
              <button id="json2table-collapse-all">Collapse All</button>
              <button id="json2table-export">Export CSV</button>
              <button id="json2table-close">✕</button>
            </div>
          </div>
          <div class="json2table-content">
            <div id="json2table-table-container"></div>
          </div>
        </div>
      </div>
    `;

    // Add styles
    const style = document.createElement('style');
    style.textContent = `
      .json2table-overlay {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .json2table-modal {
        width: 95%;
        height: 90%;
        background: white;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
      }
      .json2table-header {
        padding: 20px;
        border-bottom: 1px solid #e5e7eb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #f9fafb;
        border-radius: 8px 8px 0 0;
      }
      .json2table-header h2 {
        margin: 0;
        color: #1f2937;
        font-size: 20px;
      }
      .json2table-controls {
        display: flex;
        gap: 10px;
        align-items: center;
      }
      .json2table-controls input {
        padding: 8px 12px;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        font-size: 14px;
        width: 200px;
      }      .json2table-controls button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 500;
        margin-left: 8px;
      }
      #json2table-expand-all {
        background: #10b981;
        color: white;
      }
      #json2table-expand-all:hover {
        background: #059669;
      }
      #json2table-collapse-all {
        background: #f59e0b;
        color: white;
      }
      #json2table-collapse-all:hover {
        background: #d97706;
      }
      #json2table-export {
        background: #2563eb;
        color: white;
      }
      #json2table-export:hover {
        background: #1d4ed8;
      }
      #json2table-close {
        background: #ef4444;
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }      .json2table-content {
        flex: 1;
        overflow: hidden;
        padding: 20px;
        display: flex;
        flex-direction: column;
      }
      #json2table-table-container {
        flex: 1;
        overflow: auto;
        border: 1px solid #e5e7eb;
        border-radius: 4px;
        min-height: 0; /* Critical for flex scrolling */
      }
      .json2table-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 13px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .json2table-table th {
        background: #f9fafb;
        padding: 12px 8px;
        text-align: left;
        border-bottom: 2px solid #e5e7eb;
        font-weight: 600;
        color: #374151;
        position: sticky;
        top: 0;
        z-index: 10;
      }      .json2table-table td {
        padding: 8px;
        border-bottom: 1px solid #f3f4f6;
        white-space: nowrap;
        vertical-align: top;
      }
      .json2table-table tr:hover {
        background: #f9fafb;
      }
      .json2table-table tr:nth-child(even) {
        background: #f8fafc;
      }      .json2table-table tr:nth-child(even):hover {
        background: #f1f5f9;
      }
      .clickable {
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .clickable:hover {
        transform: scale(1.02);
      }
      .expandable-array {
        cursor: pointer;
        transition: all 0.15s ease;
      }      .expandable-array:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .expandable-object {
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .expandable-object:hover {
        transform: scale(1.05);
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      }
      .array-badge {
        background: #ddd6fe;
        color: #7c3aed;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        display: inline-block;
        min-width: 70px;
        text-align: center;
        border: 1px solid #c4b5fd;
      }
      .object-badge {
        background: #dbeafe;
        color: #2563eb;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 11px;
        font-weight: 600;
        display: inline-block;
        min-width: 80px;
        text-align: center;
      }
      .empty-object {
        color: #9ca3af;
        font-style: italic;
      }
      
      /* Array expansion styles */
      .array-expansion-container {
        background: #f8fafc !important;
      }
      .array-expansion-cell {
        padding: 0 !important;
        border: none !important;
      }
      .array-table-wrapper {
        margin: 8px 12px;
        background: white;
        border: 1px solid #e2e8f0;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .array-table-header {
        background: #f1f5f9;
        padding: 8px 12px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .array-table-title {
        font-weight: 600;
        color: #475569;
        font-size: 12px;
      }
      .collapse-array-btn {
        background: #ef4444;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .collapse-array-btn:hover {
        background: #dc2626;
        transform: scale(1.05);
      }
      .array-sub-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .array-sub-header {
        background: #f8fafc;
      }
      .array-sub-header th {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
        color: #64748b;
        font-size: 10px;
        text-transform: uppercase;
      }
      .array-index-col {
        width: 40px;
        text-align: center;
      }
      .array-column-header {
        min-width: 80px;
      }
      .array-sub-row:nth-child(even) {
        background: #f8fafc;
      }
      .array-sub-row:hover {
        background: #e2e8f0;
      }
      .array-index-cell {
        text-align: center;
        color: #64748b;
        font-weight: 500;
        font-size: 10px;
        width: 40px;
        padding: 4px;
      }      .array-sub-cell {
        padding: 4px 8px;
        border-bottom: 1px solid #f1f5f9;
        white-space: nowrap;
        font-size: 11px;
      }
      
      /* Enhanced value formatting */      .null-value {
        color: var(--muted-text);
        font-style: italic;
      }
      .boolean-value {
        font-weight: 600;
      }
      .boolean-value.true {
        color: #059669;
      }      .boolean-value.false {
        color: #dc2626;
      }
      
      /* Object expansion styles */
      .object-expansion-container {
        background: #f0f9ff !important;
      }
      .object-expansion-cell {
        padding: 0 !important;
        border: none !important;
      }
      .object-table-wrapper {
        margin: 8px 12px;
        background: white;
        border: 1px solid #bfdbfe;
        border-radius: 6px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .object-table-header {
        background: #eff6ff;
        padding: 8px 12px;
        border-bottom: 1px solid #bfdbfe;
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .object-table-title {
        font-weight: 600;
        color: #1e40af;
        font-size: 12px;
      }
      .collapse-object-btn {
        background: #ef4444;
        color: white;
        border: none;
        padding: 4px 8px;
        border-radius: 3px;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .collapse-object-btn:hover {
        background: #dc2626;
        transform: scale(1.05);
      }
      .object-sub-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .object-sub-header {
        background: #f8fafc;
      }
      .object-sub-header th {
        padding: 6px 8px;
        text-align: left;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
        color: #475569;
        font-size: 10px;
        text-transform: uppercase;
      }
      .object-property-col {
        width: 30%;
        font-weight: 600;
      }
      .object-value-col {
        width: 55%;
      }
      .object-type-col {
        width: 15%;
        text-align: center;
      }
      .object-sub-row:nth-child(even) {
        background: #f8fafc;
      }
      .object-sub-row:hover {
        background: #e0f2fe;
      }
      .object-property-cell {
        padding: 6px 8px;
        font-weight: 600;
        color: #1e40af;
        font-size: 11px;
        border-bottom: 1px solid #f1f5f9;
      }      .object-value-cell {
        padding: 6px 8px;
        border-bottom: 1px solid #f1f5f9;
        white-space: nowrap;
        font-size: 11px;
      }
      .object-type-cell {
        padding: 6px 8px;
        text-align: center;
        font-size: 10px;
        color: #64748b;
        font-style: italic;
        border-bottom: 1px solid #f1f5f9;
      }
      .array-header-row {
        background: #f8fafc !important;
        border-left: 3px solid #7c3aed;
      }
      .array-header-cell {
        padding: 8px 12px !important;
        background: #f1f5f9;
        border-bottom: 2px solid #e5e7eb;
        font-weight: 600;
        color: #4c1d95;
      }
      .array-column-header {
        display: inline-block;
        background: white;
        padding: 4px 8px;
        margin: 0 4px 4px 0;
        border-radius: 4px;
        font-size: 10px;
        color: #6b46c1;
        border: 1px solid #ddd6fe;
        font-weight: 600;
      }
      .array-item-row {
        background: #fefbff !important;
        border-left: 3px solid #c4b5fd;
      }
      .array-item-row:hover {
        background: #f5f3ff !important;
      }
      .array-item-cell {
        padding: 6px 12px !important;
        font-size: 12px;
      }
      .array-cell-value {
        display: inline-block;
        background: #f8fafc;
        padding: 2px 6px;
        margin: 0 4px 2px 0;        border-radius: 3px;
        font-size: 11px;        color: #1e293b;
        border: 1px solid #e2e8f0;
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        white-space: nowrap;
      }
      .array-spacer {
        background: #fafafa;
        border-left: 1px solid #f0f0f0;
      }
      .main-row {
        border-bottom: 1px solid #e5e7eb;
      }
      
      /* Optimized Modal Styles */
      .json2table-value-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1000000;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .modal-backdrop {
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.75);
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
      }
      .modal-content {
        background: white;
        border-radius: 12px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        max-width: 800px;
        max-height: 80vh;
        width: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .modal-header {
        padding: 20px 24px;
        border-bottom: 1px solid #e5e7eb;
        background: #f9fafb;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-radius: 12px 12px 0 0;
      }
      .modal-header h3 {
        margin: 0;
        font-size: 18px;
        font-weight: 600;
        color: #1f2937;
      }
      .modal-close {
        background: #ef4444;
        color: white;
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s ease;
      }
      .modal-close:hover {
        background: #dc2626;
      }
      .modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 24px;
      }
      .content-header {
        font-size: 14px;
        font-weight: 600;
        color: #374151;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid #f3f4f6;
      }
      .array-items, .object-properties {
        max-height: 400px;
        overflow-y: auto;
      }
      .array-item, .object-property {
        padding: 8px 12px;
        border-radius: 6px;
        margin-bottom: 4px;
        background: #f8fafc;
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }
      .item-index, .property-key {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        font-weight: 600;
        color: #6b7280;
        flex-shrink: 0;
      }      .item-value, .property-value {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        flex: 1;
      }
      .string-value { color: #059669; }
      .number-value { color: #dc2626; }
      .boolean-value { color: #7c3aed; }
      .null-value, .undefined-value { color: var(--muted-text); font-style: italic; }
      .nested-array, .nested-object { color: #2563eb; }      .empty-state {
        text-align: center;
        color: var(--muted-text);
        font-style: italic;
        padding: 40px;
      }
      .pagination-info {
        margin-top: 16px;
        padding: 12px;
        background: #eff6ff;
        border-radius: 6px;
        font-size: 13px;
        color: #1d4ed8;
        text-align: center;
      }
    `;
    
    document.head.appendChild(style);
    document.body.appendChild(viewer);

    // Initialize table
    const tableViewer = new TableViewer(data);
    tableViewer.render();    // Event listeners
    document.getElementById('json2table-close').onclick = () => viewer.remove();
    document.getElementById('json2table-search').oninput = (e) => tableViewer.search(e.target.value);
    document.getElementById('json2table-expand-all').onclick = () => tableViewer.expandAll();
    document.getElementById('json2table-collapse-all').onclick = () => tableViewer.collapseAll();
    document.getElementById('json2table-export').onclick = () => tableViewer.exportCSV();
  }

  // Ultra-high-performance table viewer with expandable arrays
  class TableViewer {
    constructor(data) {
      this.originalData = data;
      this.filteredData = data;
      this.container = document.getElementById('json2table-table-container');
      this.rowHeight = 45; // Base row height
      this.visibleRows = Math.ceil(window.innerHeight / this.rowHeight) + 5;
      this.scrollTop = 0;
      this.columns = this.extractColumns(data);
      
      // Add stable row IDs that don't change when filtering
      this.originalData = data.map((row, index) => ({
        ...row,
        __rowId: index // Stable identifier for expansions
      }));
      this.filteredData = this.originalData;
      
      // Array expansion tracking
      this.expandedArrays = new Set(); // Track which arrays are expanded
      this.arrayRowHeights = new Map(); // Track additional height per expanded array
      this.renderCache = new Map();
      this.modalOverlay = null;
      this.lastRenderTime = 0;
      this.renderThrottle = 16;
      this.rafId = null; // For requestAnimationFrame scroll handling
      this.boundScrollHandler = null; // Bound scroll handler reference
    }

    extractColumns(data) {
      // Ensure data is an array
      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }
      
      const columnSet = new Set();
      data.slice(0, 100).forEach(row => { // Sample first 100 rows for columns
        if (row && typeof row === 'object') {
          Object.keys(row).forEach(key => columnSet.add(key));
        }
      });
      return Array.from(columnSet);
    }

    render() {
      // Simple render - no virtual scrolling, just render all rows
      const html = `
        <table class="json2table-table">
          <thead style="position: sticky; top: 0; z-index: 1000; background: var(--header-bg); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <tr>
              ${this.columns.map(col => `<th title="${col}">${this.formatColumnName(col)}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${this.renderAllRows()}
          </tbody>
        </table>
      `;

      this.container.innerHTML = html;
      this.attachOptimizedEventListeners();
    }

    renderAllRows() {
      // Simply render all rows without any virtual scrolling complexity
      let html = '';
      for (let i = 0; i < this.filteredData.length; i++) {
        const row = this.filteredData[i];
        html += this.renderMainRow(row, i);
      }
      return html;
    }

    calculateDynamicHeight() {
      // Simplified: Use base row height for all rows, add expansion estimates
      const baseHeight = this.filteredData.length * this.rowHeight;
      const expansionHeight = this.expandedArrays.size * 100; // Estimate 100px per expansion
      return baseHeight + expansionHeight;
    }

    calculateVisibleRange() {
      // Simplified virtual scrolling calculation
      const rowHeight = this.rowHeight;
      const startIndex = Math.max(0, Math.floor(this.scrollTop / rowHeight) - 5);
      const endIndex = Math.min(
        this.filteredData.length,
        startIndex + Math.ceil(window.innerHeight / rowHeight) + 10
      );
      
      return { startIndex, endIndex };
    }

    calculateOffsetTop(startIndex) {
      // Always use consistent calculation for smooth scrolling
      return startIndex * this.rowHeight;
    }

    renderRowsWithExpansions(startIndex, endIndex) {
      let html = '';
      for (let i = startIndex; i < endIndex; i++) {
        const row = this.filteredData[i];
        // Only render main row since expansions are now inline
        html += this.renderMainRow(row, i);
      }
      return html;
    }

    renderMainRow(row, rowIndex) {
      const stableRowId = row.__rowId; // Use stable ID instead of changing row index
      return `
        <tr data-row-index="${rowIndex}" class="main-row">
          ${this.columns.map(col => {
            const value = row[col];
            const cellContent = this.formatCellValueWithExpansion(value, stableRowId, col);
            // Determine if this cell needs wide content class
            const isWideContent = this.shouldUseWideContent(value, cellContent);
            const widthClass = isWideContent ? ' wide-content' : '';
            return `<td class="json2table-cell${widthClass}" data-col="${col}" data-row="${rowIndex}">
              ${cellContent}
            </td>`;
          }).join('')}
        </tr>
      `;
    }

    shouldUseWideContent(value, cellContent) {
      // Single digits, booleans, short numbers don't need wide columns
      if (typeof value === 'number' && Math.abs(value) < 1000) return false;
      if (typeof value === 'boolean') return false;
      if (value === null || value === undefined) return false;
      
      // Arrays and objects always need wide content for expansion
      if (Array.isArray(value) || (typeof value === 'object' && value !== null)) return true;
      
      // String content - check length
      if (typeof value === 'string') {
        // Short strings (like IDs, status, single words) don't need wide columns
        if (value.length <= 10) return false;
        // Medium strings might need some width
        if (value.length <= 30) return false;
        // Long strings definitely need wide columns
        return true;
      }
      
      // For rendered HTML content, check if it contains expansion elements
      if (typeof cellContent === 'string') {
        if (cellContent.includes('expandable-array') || cellContent.includes('expandable-object')) return true;
        // Long rendered content
        if (cellContent.length > 50) return true;
      }
      
      return false;
    }

    getArrayColumns(arrayItems) {
      const columnSet = new Set();
      const columnPriority = new Map();
      
      // Sample more items for better column detection
      const sampleSize = Math.min(50, arrayItems.length);
      const sampleItems = arrayItems.slice(0, sampleSize);
      
      sampleItems.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          Object.keys(item).forEach(key => {
            columnSet.add(key);
            // Count frequency for prioritization
            columnPriority.set(key, (columnPriority.get(key) || 0) + 1);
          });
        } else {
          columnSet.add('value'); // For primitive arrays
        }
      });
      
      // Convert to array and sort by priority (frequency) and common field names
      const columns = Array.from(columnSet).sort((a, b) => {
        // Prioritize common important fields first
        const priorityFields = ['id', 'name', 'title', 'rating', 'comment', 'date', 'price', 'description'];
        const aPriority = priorityFields.indexOf(a.toLowerCase());
        const bPriority = priorityFields.indexOf(b.toLowerCase());
        
        if (aPriority !== -1 && bPriority !== -1) {
          return aPriority - bPriority;
        }
        if (aPriority !== -1) return -1;
        if (bPriority !== -1) return 1;
        
        // Then sort by frequency
        const aFreq = columnPriority.get(a) || 0;
        const bFreq = columnPriority.get(b) || 0;
        
        return bFreq - aFreq;
      });
      
      // Limit to 10 columns for better display
      return columns.slice(0, 10);
    }

    formatArrayCellValue(value) {
      if (value === null || value === undefined) return '<span class="null-value">-</span>';
      
      const stringValue = String(value);
      
      // Format dates
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        try {
          const date = new Date(value);
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
          // Fall through to regular formatting
        }
      }
      
      // Format booleans
      if (typeof value === 'boolean') {
        return `<span class="boolean-value ${value ? 'true' : 'false'}">${value ? '✓' : '✗'}</span>`;
      }
      
      // Format numbers
      if (typeof value === 'number') {
        return value % 1 === 0 ? value.toString() : value.toFixed(2);
      }
        // Return full string for complete text selection
      return stringValue;
    }

    escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    formatObjectPropertyValue(value) {
      if (value === null || value === undefined) return '<span class="null-value">-</span>';
      
      const stringValue = String(value);
      
      // Format dates
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        try {
          const date = new Date(value);
          return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
          // Fall through to regular formatting
        }
      }
      
      // Format booleans
      if (typeof value === 'boolean') {
        return `<span class="boolean-value ${value ? 'true' : 'false'}">${value ? '✓' : '✗'}</span>`;
      }
      
      // Format numbers
      if (typeof value === 'number') {
        return value % 1 === 0 ? value.toString() : value.toFixed(2);
      }
      
      // Handle arrays and objects
      if (Array.isArray(value)) {
        return `<span class="nested-array">[${value.length} items]</span>`;
      }
      
      if (typeof value === 'object' && value !== null) {
        return `<span class="nested-object">{${Object.keys(value).length} props}</span>`;
      }
        // Return full string for complete text selection
      return stringValue;
    }

    getValueType(value) {
      if (value === null) return 'null';
      if (value === undefined) return 'undefined';
      if (Array.isArray(value)) return 'array';
      return typeof value;
    }    formatCellValueWithExpansion(value, rowIndex, col) {
      if (value === null || value === undefined) return '';
      
      if (Array.isArray(value)) {
        const count = value.length;
        const arrayKey = `${rowIndex}-${col}`;
        const isExpanded = this.expandedArrays.has(arrayKey);
        const expandIcon = isExpanded ? '[-]' : '[+]';
        
        let html = `<span class="array-badge expandable-array" data-array-key="${arrayKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} array">
          ${expandIcon} [${count}] ${count === 1 ? 'item' : 'items'}
        </span>`;
          // Add inline expansion content
        if (isExpanded && value.length > 0) {
          const arrayColumns = this.getArrayColumns(value);
          html += `
            <div class="inline-array-expansion" data-array-key="${arrayKey}">
              <div class="inline-expansion-header">Array Items (${count}):</div>
              <div class="inline-array-table-wrapper">
                <table class="inline-table">
                  <thead>
                    <tr>
                      ${arrayColumns.map(col => `<th>${this.formatColumnName(col)}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${value.map((item, itemIndex) => {
                      if (typeof item === 'object' && item !== null) {
                        return `<tr class="inline-table-row">
                          ${arrayColumns.map(acol => {
                            const cellValue = item[acol];
                            return `<td class="inline-table-cell">${cellValue !== undefined ? this.highlightSearchTerm(this.formatArrayCellValue(cellValue)) : '<span class="null-value">-</span>'}</td>`;
                          }).join('')}
                        </tr>`;
                      } else {
                        return `<tr class="inline-table-row">
                          <td class="inline-table-cell" colspan="${arrayColumns.length}">
                            <span class="inline-item-index">${itemIndex + 1}.</span>
                            <span class="inline-value">${this.highlightSearchTerm(this.formatInlineValue(item))}</span>
                          </td>
                        </tr>`;
                      }
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }
        
        return html;
      }
      
      if (typeof value === 'object') {
        const propCount = Object.keys(value).length;
        if (propCount === 0) return '<span class="empty-object">{}</span>';
        
        const objectKey = `${rowIndex}-${col}-object`;
        const isExpanded = this.expandedArrays.has(objectKey); // Reuse same tracking set
        const expandIcon = isExpanded ? '[-]' : '[+]';
        
        let html = `<span class="object-badge expandable-object" data-object-key="${objectKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} object properties">
          ${expandIcon} {${propCount}} ${propCount === 1 ? 'property' : 'properties'}
        </span>`;
          // Add inline expansion content in table format
        if (isExpanded) {
          html += `
            <div class="inline-object-expansion" data-object-key="${objectKey}">
              <div class="inline-expansion-header">Properties (${propCount}):</div>
              <div class="inline-object-table-wrapper">
                <table class="inline-table">
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Value</th>
                    </tr>
                  </thead>                  <tbody>                    ${Object.entries(value).map(([key, val]) => {
                      // Determine if this property value needs wide content class
                      const isWideContent = this.shouldUseWideContent(val, null);
                      const widthClass = isWideContent ? ' wide-content' : '';
                      
                      return `<tr class="inline-table-row">
                        <td class="inline-table-cell inline-property-name">${this.highlightSearchTerm(key)}</td>
                        <td class="inline-table-cell inline-property-value${widthClass}">${this.highlightSearchTerm(this.formatInlineValue(val, rowIndex, col, key))}</td>
                      </tr>`;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }
        
        return html;
      }
        const stringValue = String(value);
      // Apply search highlighting to the value
      return this.highlightSearchTerm(stringValue);
    }

    formatInlineValue(value, parentRowIndex = null, parentCol = null, nestedKey = null) {
      if (value === null || value === undefined) return '<span class="null-value">null</span>';
      
      if (Array.isArray(value)) {
        // For nested arrays, make them expandable too
        if (parentRowIndex !== null && parentCol !== null && nestedKey !== null) {
          const nestedArrayKey = `${parentRowIndex}-${parentCol}-${nestedKey}-array`;
          const isExpanded = this.expandedArrays.has(nestedArrayKey);
          const expandIcon = isExpanded ? '[-]' : '[+]';
          
          let html = `<span class="array-badge expandable-array" data-array-key="${nestedArrayKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} nested array">
            ${expandIcon} [${value.length} items]
          </span>`;
          
          if (isExpanded && value.length > 0) {
            const arrayColumns = this.getArrayColumns(value);
            html += `
              <div class="inline-array-expansion" data-array-key="${nestedArrayKey}" style="margin-top: 4px;">
                <div class="inline-expansion-header" style="font-size: 10px;">Nested Array (${value.length}):</div>
                <div class="inline-array-table-wrapper">
                  <table class="inline-table" style="font-size: 10px;">
                    <thead>
                      <tr>
                        ${arrayColumns.map(col => `<th style="font-size: 9px;">${this.formatColumnName(col)}</th>`).join('')}
                      </tr>
                    </thead>
                    <tbody>
                      ${value.map((item, itemIndex) => {
                        if (typeof item === 'object' && item !== null) {
                          return `<tr class="inline-table-row">
                            ${arrayColumns.map(acol => {
                              const cellValue = item[acol];
                              return `<td class="inline-table-cell">${cellValue !== undefined ? this.formatArrayCellValue(cellValue) : '<span class="null-value">-</span>'}</td>`;
                            }).join('')}
                          </tr>`;
                        } else {
                          return `<tr class="inline-table-row">
                            <td class="inline-table-cell" colspan="${arrayColumns.length}">
                              <span class="inline-item-index">${itemIndex + 1}.</span>
                              <span class="inline-value">${this.formatInlineValue(item)}</span>
                            </td>
                          </tr>`;
                        }
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`;
          }
          
          return html;
        }
        
        return `<span class="nested-array">[${value.length} items]</span>`;
      }
      
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        
        // For nested objects, make them expandable
        if (parentRowIndex !== null && parentCol !== null && nestedKey !== null) {
          const nestedObjectKey = `${parentRowIndex}-${parentCol}-${nestedKey}-object`;
          const isExpanded = this.expandedArrays.has(nestedObjectKey);
          const expandIcon = isExpanded ? '[-]' : '[+]';
          
          let html = `<span class="object-badge expandable-object" data-object-key="${nestedObjectKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} nested object">
            ${expandIcon} {${keys.length} props}
          </span>`;
          
          if (isExpanded) {
            html += `
              <div class="inline-object-expansion" data-object-key="${nestedObjectKey}" style="margin-top: 4px;">
                <div class="inline-expansion-header" style="font-size: 10px;">Nested Object (${keys.length}):</div>
                <div class="inline-object-table-wrapper">
                  <table class="inline-table" style="font-size: 10px;">
                    <thead>
                      <tr>
                        <th style="font-size: 9px;">Property</th>
                        <th style="font-size: 9px;">Value</th>
                      </tr>
                    </thead>                    <tbody>
                      ${Object.entries(value).map(([key, val]) => {
                        // Apply smart width logic to nested object property values
                        const isWideContent = this.shouldUseWideContent(val, null);
                        const widthClass = isWideContent ? ' wide-content' : '';
                        
                        return `<tr class="inline-table-row">
                          <td class="inline-table-cell inline-property-name" style="font-size: 10px;">${key}</td>
                          <td class="inline-table-cell inline-property-value${widthClass}" style="font-size: 10px;">${this.formatInlineValue(val, parentRowIndex, parentCol, `${nestedKey}-${key}`)}</td>
                        </tr>`;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              </div>`;
          }
          
          return html;
        }
        
        // For simple objects with few properties, show them inline
        if (keys.length <= 4) {
          const props = keys.map(key => {
            const propValue = value[key];
            let displayValue;
            
            // Handle nested values more gracefully
            if (typeof propValue === 'object' && propValue !== null) {
              if (Array.isArray(propValue)) {
                displayValue = `[${propValue.length} items]`;
              } else {
                displayValue = `{${Object.keys(propValue).length} props}`;
              }
            } else if (typeof propValue === 'string' && propValue.length > 30) {
              displayValue = propValue.substring(0, 30) + '...';
            } else {
              displayValue = String(propValue);
            }
            
            return `<strong>${key}:</strong> ${displayValue}`;
          }).join(', ');
          
          return `<span class="nested-object-detailed">{${props}}</span>`;
        } else {
          // For complex objects, show summary
          return `<span class="nested-object">{${keys.length} props}</span>`;
        }
      }
      
      if (typeof value === 'boolean') {
        return `<span class="boolean-value ${value}">${value ? '✓' : '✗'}</span>`;
      }
      
      // Format dates
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
        try {
          const date = new Date(value);
          return `<span class="date-value">${date.toLocaleDateString()}</span>`;
        } catch (e) {
          // Fall through to regular formatting
        }
      }
      
      // Truncate very long strings
      if (typeof value === 'string' && value.length > 50) {
        return value.substring(0, 50) + '...';
      }
        const stringValue = String(value);
      // Return full string for complete text selection
      return stringValue;
    }

    highlightSearchTerm(text) {
      // If no search query or text is not a string, return as is
      if (!this.searchQuery || typeof text !== 'string') {
        return text;
      }
      
      // Create a case-insensitive regex to find all matches
      const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');
      
      // Replace matches with highlighted spans
      return text.replace(regex, '<mark class="search-highlight">$1</mark>');
    }

    escapeRegex(string) {
      // Escape special regex characters
      return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    attachOptimizedEventListeners() {
      // Single delegated event listener for maximum performance
      this.container.removeEventListener('click', this.handleTableClick);
      this.handleTableClick = this.handleTableClick.bind(this);
      this.container.addEventListener('click', this.handleTableClick);
      
      // No scroll handler needed since we're not using virtual scrolling
    }

    handleTableClick(e) {
      // Handle array expansion/collapse badges
      const arrayBadge = e.target.closest('.expandable-array');
      if (arrayBadge) {
        const arrayKey = arrayBadge.dataset.arrayKey;
        this.toggleArrayExpansion(arrayKey);
        return;
      }

      // Handle object expansion/collapse badges
      const objectBadge = e.target.closest('.expandable-object');
      if (objectBadge) {
        const objectKey = objectBadge.dataset.objectKey;
        this.toggleObjectExpansion(objectKey);
        return;
      }
      
      // Handle object modal for non-arrays
      const clickable = e.target.closest('.clickable');
      if (clickable) {
        const cell = clickable.closest('.json2table-cell');
        const rowIndex = parseInt(cell.dataset.row);
        const col = cell.dataset.col;
        const value = this.filteredData[rowIndex][col];
        
        if (typeof value === 'object' && !Array.isArray(value)) {
          this.showValueModal(value, `${col} (Row ${rowIndex + 1})`);
        }
      }
    }

    toggleArrayExpansion(arrayKey) {      
      if (this.expandedArrays.has(arrayKey)) {
        this.expandedArrays.delete(arrayKey);
      } else {
        this.expandedArrays.add(arrayKey);
      }
      
      // Simple re-render without complex scroll handling
      this.render();
    }

    toggleObjectExpansion(objectKey) {
      if (this.expandedArrays.has(objectKey)) {
        this.expandedArrays.delete(objectKey);
      } else {
        this.expandedArrays.add(objectKey);
      }
      
      // Simple re-render without complex scroll handling
      this.render();
    }

    throttledScrollHandler(e) {
      // Use requestAnimationFrame for smoother scrolling
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
      }
      
      this.rafId = requestAnimationFrame(() => {
        // Make sure we're getting the scroll position from the right element
        this.scrollTop = e.target.scrollTop;
        this.render();
        this.rafId = null;
      });
    }

    formatColumnName(name) {
      return name.split('.').pop().replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    showValueModal(value, title) {
      // Remove existing modal
      if (this.modalOverlay) {
        this.modalOverlay.remove();
      }

      // Create optimized modal
      this.modalOverlay = document.createElement('div');
      this.modalOverlay.className = 'json2table-value-modal';
      this.modalOverlay.innerHTML = `
        <div class="modal-backdrop" onclick="this.parentElement.remove()">
          <div class="modal-content" onclick="event.stopPropagation()">
            <div class="modal-header">
              <h3>${title}</h3>
              <button class="modal-close" onclick="this.closest('.json2table-value-modal').remove()">×</button>
            </div>
            <div class="modal-body">
              ${this.renderValueContent(value)}
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(this.modalOverlay);
    }

    renderValueContent(value) {
      if (Array.isArray(value)) {
        if (value.length === 0) return '<div class="empty-state">Empty array</div>';
        
        // For large arrays, show pagination
        if (value.length > 100) {
          return this.renderPaginatedArray(value);
        }
        
        return `
          <div class="array-content">
            <div class="content-header">Array (${value.length} items)</div>
            <div class="array-items">
              ${value.map((item, idx) => `
                <div class="array-item">
                  <span class="item-index">[${idx}]</span>
                  <span class="item-value">${this.formatModalValue(item)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      if (typeof value === 'object' && value !== null) {
        const entries = Object.entries(value);
        if (entries.length === 0) return '<div class="empty-state">Empty object</div>';
        
        return `
          <div class="object-content">
            <div class="content-header">Object (${entries.length} properties)</div>
            <div class="object-properties">
              ${entries.map(([key, val]) => `
                <div class="object-property">
                  <span class="property-key">${key}:</span>
                  <span class="property-value">${this.formatModalValue(val)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      return `<div class="simple-value">${String(value)}</div>`;
    }

    renderPaginatedArray(array) {
      const pageSize = 50;
      const totalPages = Math.ceil(array.length / pageSize);
      
      return `
        <div class="paginated-array">
          <div class="content-header">Large Array (${array.length} items) - Showing first ${Math.min(pageSize, array.length)}</div>
          <div class="array-items">
            ${array.slice(0, pageSize).map((item, idx) => `
              <div class="array-item">
                <span class="item-index">[${idx}]</span>
                <span class="item-value">${this.formatModalValue(item)}</span>
              </div>
            `).join('')}
          </div>
          ${totalPages > 1 ? `<div class="pagination-info">Showing 1-${pageSize} of ${array.length} items</div>` : ''}
        </div>
      `;
    }

    formatModalValue(value) {
      if (value === null) return '<span class="null-value">null</span>';
      if (value === undefined) return '<span class="undefined-value">undefined</span>';
      if (typeof value === 'string') return `<span class="string-value">"${value}"</span>`;
      if (typeof value === 'number') return `<span class="number-value">${value}</span>`;
      if (typeof value === 'boolean') return `<span class="boolean-value">${value}</span>`;
      if (Array.isArray(value)) return `<span class="nested-array">[Array: ${value.length} items]</span>`;
      if (typeof value === 'object') return `<span class="nested-object">{Object: ${Object.keys(value).length} props}</span>`;
      return String(value);
    }    search(query) {
      if (!query.trim()) {
        this.filteredData = this.originalData;
        this.searchQuery = null; // Clear search highlighting
      } else {
        this.performSearch(query);
        this.searchQuery = query.toLowerCase(); // Store for highlighting
      }
      
      // Keep expansions when searching - don't clear them
      this.render();
    }

    performSearch(query) {
      const lowerQuery = query.toLowerCase();
      const startTime = performance.now();
      
      this.filteredData = this.originalData.filter(row => {
        // Quick string search first (fastest)
        const rowString = JSON.stringify(row).toLowerCase();
        if (rowString.includes(lowerQuery)) return true;
        
        // If not found in JSON string, skip expensive deep search
        return false;
      });

      console.log(`Search completed in ${performance.now() - startTime}ms`);
    }

    searchWithWorker(query) {
      // Fallback to synchronous search if worker setup fails
      this.performSearch(query);
    }

    expandAll() {
      // Find all arrays and objects in the current filtered data and expand them recursively
      this.filteredData.forEach((row, rowIndex) => {
        const stableRowId = row.__rowId; // Use stable ID instead of changing index
        this.columns.forEach(col => {
          const value = row[col];
          this.expandAllNested(value, stableRowId, col, '');
        });
      });
      
      // Simple re-render
      this.render();
      
      // Show feedback
      this.showTemporaryMessage(`✅ Expanded ${this.expandedArrays.size} arrays and objects`, 'success');
    }

    expandAllNested(value, rowIndex, col, nestedPath) {
      if (Array.isArray(value) && value.length > 0) {
        // Expand this array
        const arrayKey = nestedPath ? `${rowIndex}-${col}-${nestedPath}-array` : `${rowIndex}-${col}`;
        this.expandedArrays.add(arrayKey);
        
        // Recursively expand nested objects/arrays within array items
        value.forEach((item, itemIndex) => {
          if (typeof item === 'object' && item !== null) {
            Object.keys(item).forEach(itemKey => {
              const nestedValue = item[itemKey];
              const newPath = nestedPath ? `${nestedPath}-${itemIndex}-${itemKey}` : `${itemIndex}-${itemKey}`;
              this.expandAllNested(nestedValue, rowIndex, col, newPath);
            });
          }
        });
      } else if (typeof value === 'object' && value !== null && Object.keys(value).length > 0) {
        // Expand this object
        const objectKey = nestedPath ? `${rowIndex}-${col}-${nestedPath}-object` : `${rowIndex}-${col}-object`;
        this.expandedArrays.add(objectKey);
        
        // Recursively expand nested objects/arrays within this object
        Object.keys(value).forEach(key => {
          const nestedValue = value[key];
          const newPath = nestedPath ? `${nestedPath}-${key}` : key;
          this.expandAllNested(nestedValue, rowIndex, col, newPath);
        });
      }
    }

    collapseAll() {
      const expandedCount = this.expandedArrays.size;
      this.expandedArrays.clear();
      
      // Simple re-render
      this.render();
      
      // Show feedback
      this.showTemporaryMessage(`Collapsed ${expandedCount} arrays and objects`, 'info');
    }

    showTemporaryMessage(message, type = 'info') {
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
        setTimeout(() => notification.remove(), 300);      }, 2000);
    }

    exportCSV() {
      const headers = this.columns.join(',');
      const rows = this.filteredData.map(row =>
        this.columns.map(col => {
          const value = row[col] || '';
          let csvValue = '';
          
          if (Array.isArray(value)) {
            csvValue = `"[${value.length} items]"`;
          } else if (typeof value === 'object' && value !== null) {
            csvValue = `"{${Object.keys(value).length} properties}"`;
          } else {
            csvValue = `"${String(value).replace(/"/g, '""')}"`;
          }
          
          return csvValue;
        }).join(',')
      );

      const csv = [headers, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = 'json-table-export.csv';
      a.click();
      
      URL.revokeObjectURL(url);
    }

    getRowHeight(rowIndex) {
      // Simple consistent height for all rows
      return this.rowHeight;
    }

    preserveScrollPosition() {
      // Store current scroll position before render
      if (this.container) {
        this.scrollTop = this.container.scrollTop;
      }
    }

    restoreScrollPosition() {
      // Restore scroll position after render
      if (this.container && this.scrollTop !== undefined) {
        this.container.scrollTop = this.scrollTop;
      }
    }

  }

  // Function to show table viewer in existing container or create new one
  function showTableViewer(tableData) {
    // Check if auto-converted container already exists
    let container = document.getElementById('json2tableContainer');
    
    if (!container) {
      // Create new container for manual conversion
      container = document.createElement('div');
      container.id = 'json2tableContainer';
      container.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: var(--bg-color, #ffffff);
        color: var(--text-color, #333333);
        z-index: 10000;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      `;
      document.body.appendChild(container);
      
      // Apply theme for manual conversions
      AutoJSONDetector.applyTheme();
    }
      // Clear existing content and create viewer
    container.innerHTML = '';
    
    // Use the same interface creation method
    AutoJSONDetector.createTableInterface(container, tableData);
  }

  // Auto-conversion initialization
  // Run automatic detection when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => AutoJSONDetector.checkAndConvert(), 100);
    });
  } else {
    // Document already loaded
    setTimeout(() => AutoJSONDetector.checkAndConvert(), 100);
  }
  // Message listener for manual trigger and settings
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detectJSON') {
      // Use the same successful auto-convert logic
      AutoJSONDetector.checkAndConvert().then(result => {
        sendResponse({ hasData: result.converted, result: result });
      }).catch(error => {
        sendResponse({ hasData: false, error: error.message });
      });
      return true;
    } else if (request.action === 'showTable') {
      // Use the same successful auto-convert logic
      AutoJSONDetector.checkAndConvert().then(result => {
        if (result.converted) {
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, message: result.note || 'No suitable table data found' });
        }
      }).catch(error => {
        sendResponse({ success: false, message: error.message });
      });
      return true;
    } else if (request.action === 'autoConvert') {
      AutoJSONDetector.checkAndConvert().then(result => {
        sendResponse(result);
      });
      return true; // Will respond asynchronously
    }
  });

})();
