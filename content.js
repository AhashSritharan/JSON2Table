// Content script for JSON2Table extension - Optimized Version
(function() {
  'use strict';

  let detectedData = null;
  let autoConvertEnabled = false;

  // Performance utilities for debouncing and throttling
  class PerformanceUtils {
    static debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }

    static throttle(func, limit) {
      let inThrottle;
      return function(...args) {
        if (!inThrottle) {
          func.apply(this, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }

    static requestIdleCallback(callback, options = {}) {
      if (window.requestIdleCallback) {
        return window.requestIdleCallback(callback, options);
      }
      // Fallback for browsers without requestIdleCallback
      return setTimeout(callback, 1);
    }
  }

  // Memory management utilities
  class MemoryManager {
    constructor() {
      this.caches = new WeakMap();
      this.eventListeners = new Set();
      this.timers = new Set();
    }

    addCache(key, value) {
      this.caches.set(key, value);
    }

    getCache(key) {
      return this.caches.get(key);
    }

    addEventListener(element, event, handler) {
      element.addEventListener(event, handler);
      this.eventListeners.add({ element, event, handler });
    }

    addTimer(timerId) {
      this.timers.add(timerId);
    }

    cleanup() {
      // Clean up event listeners
      this.eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventListeners.clear();

      // Clear timers
      this.timers.forEach(timerId => clearTimeout(timerId));
      this.timers.clear();

      // Clear caches (WeakMap will handle garbage collection)
      this.caches = new WeakMap();
    }
  }

  // Global memory manager instance
  const memoryManager = new MemoryManager();

  // Error handling and logging
  class ErrorHandler {
    static globalHandler(error) {
      console.error('JSON2Table Error:', error);
      // Send to background script for debugging
      chrome.runtime.sendMessage({
        action: 'error',
        error: {
          message: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      }).catch(() => {}); // Ignore errors in error reporting
    }

    static sanitizeInput(input) {
      if (typeof input === 'string') {
        // Basic XSS prevention
        return input.replace(/[<>&"']/g, (char) => {
          const entities = {
            '<': '&lt;',
            '>': '&gt;',
            '&': '&amp;',
            '"': '&quot;',
            "'": '&#x27;'
          };
          return entities[char];
        });
      }
      return input;
    }
  }

  // Set up global error handler
  window.addEventListener('error', ErrorHandler.globalHandler);
  window.addEventListener('unhandledrejection', (event) => {
    ErrorHandler.globalHandler(event.reason);
  });

  // Automatic JSON detection with optimized parsing
  class AutoJSONDetector {
    static async checkAndConvert(forceConvert = false) {
      try {
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

        // Increased limit with streaming support
        if (rawLength > 10000000) { // 10MB limit instead of 3MB
          return { converted: false, note: 'Too long (>10MB)' };
        }

        if (!/^\s*[\{\[]/.test(rawPreContent)) {
          return { converted: false, note: 'Does not start with { or [' };
        }

        // Use optimized parsing for large files
        let parsedJsonValue;
        try {
          if (rawLength > 1000000) { // 1MB+ files use Web Worker
            parsedJsonValue = await this.parseJsonInWorker(rawPreContent);
          } else {
            parsedJsonValue = JSON.parse(rawPreContent);
          }
        } catch (e) {
          return { converted: false, note: 'Does not parse as JSON' };
        }

        if (typeof parsedJsonValue !== 'object' && !Array.isArray(parsedJsonValue)) {
          return { converted: false, note: 'Not an object or array' };
        }

        // Check if it's suitable for table conversion
        const tableData = JSONDetector.extractTableData(parsedJsonValue);
        
        if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
          return { converted: false, note: 'No suitable table data found' };
        }

        // Verify the table data contains objects
        if (!tableData.some(item => item && typeof item === 'object' && !Array.isArray(item))) {
          return { converted: false, note: 'Table data must contain objects' };
        }

        // Store ONLY the text content before clearing everything
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
        document.body.appendChild(tableContainer);

        // Apply theme
        this.applyTheme();

        // Create table viewer
        this.createTableInterface(tableContainer, tableData);

        return { converted: true, note: 'Converted to table', rawLength };
      } catch (error) {
        ErrorHandler.globalHandler(error);
        return { converted: false, note: `Error: ${error.message}` };
      }
    }

    // Web Worker-based JSON parsing for large files
    static async parseJsonInWorker(jsonString) {
      return new Promise((resolve, reject) => {
        // Create inline worker for JSON parsing
        const workerCode = `
          self.onmessage = function(e) {
            try {
              const parsed = JSON.parse(e.data);
              self.postMessage({ success: true, data: parsed });
            } catch (error) {
              self.postMessage({ success: false, error: error.message });
            }
          };
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = function(e) {
          const { success, data, error } = e.data;
          if (success) {
            resolve(data);
          } else {
            reject(new Error(error));
          }
          worker.terminate();
          URL.revokeObjectURL(blob);
        };
        
        worker.onerror = function(error) {
          reject(error);
          worker.terminate();
          URL.revokeObjectURL(blob);
        };
        
        worker.postMessage(jsonString);
        
        // Timeout after 10 seconds
        const timeoutId = setTimeout(() => {
          worker.terminate();
          URL.revokeObjectURL(blob);
          reject(new Error('JSON parsing timeout'));
        }, 10000);
        
        memoryManager.addTimer(timeoutId);
      });
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

      // Add optimized styles
      this.addOptimizedStyles();

      // Initialize optimized table viewer
      const tableViewer = new OptimizedTableViewer(tableData);
      tableViewer.render();

      // Check if auto-expand is enabled and expand all automatically
      this.getSettings().then(settings => {
        if (settings.autoExpand) {
          // Small delay to ensure table is fully rendered
          setTimeout(() => {
            tableViewer.expandAll();
          }, 100);
        }
      });

      // Event listeners with optimization
      const searchInput = document.getElementById('json2table-search');
      const debouncedSearch = PerformanceUtils.debounce((value) => tableViewer.search(value), 300);
      searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));

      document.getElementById('json2table-expand-all').addEventListener('click', () => tableViewer.expandAll());
      document.getElementById('json2table-collapse-all').addEventListener('click', () => tableViewer.collapseAll());
      document.getElementById('json2table-toggle-view').addEventListener('click', () => this.toggleView(tableData));
      document.getElementById('json2table-export').addEventListener('click', () => tableViewer.exportCSV());
    }

    static addOptimizedStyles() {
      const style = document.createElement('style');
      style.id = 'json2table-optimized-styles';
      style.textContent = `
        /* Optimized table styles for better performance */
        .json2table-table {
          width: 100%;
          border-collapse: collapse;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 14px;
          table-layout: auto; /* Auto layout to allow dynamic column sizing */
        }

        .json2table-table th {
          background: var(--header-bg);
          color: var(--text-color);
          padding: 12px 16px;
          text-align: left;
          border-bottom: 2px solid var(--border-color);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 100;
          white-space: nowrap;
        }

        .json2table-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color);
          color: var(--text-color);
          vertical-align: top;
          white-space: nowrap;
        }

        /* Only apply max-width to cells with long text content */
        .json2table-table td.long-text-content {
          max-width: 400px;
          white-space: normal;
          word-wrap: break-word;
          overflow-wrap: break-word;
        }

        .json2table-table tr:hover {
          background: var(--hover-bg);
        }

        /* Virtual scrolling container */
        .virtual-scroll-container {
          height: 100%;
          overflow-y: auto;
          overflow-x: auto;
          scroll-behavior: smooth;
        }

        .virtual-scroll-spacer {
          pointer-events: none;
        }

        /* Performance optimized expansion styles */
        .expandable-array, .expandable-object {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 12px;
          cursor: pointer;
          margin: 1px;
          font-weight: 500;
          transition: transform 0.1s ease;
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
          transform: scale(1.05);
        }

        /* Expanded content styles */
        .expanded-row {
          background: var(--hover-bg);
        }

        .expanded-cell {
          padding: 0 !important;
          border: none !important;
        }

        .expanded-content {
          background: var(--bg-color);
          border: 2px solid var(--border-color);
          border-radius: 6px;
          margin: 8px;
          overflow: hidden;
        }

        .expanded-header {
          background: var(--header-bg);
          padding: 8px 12px;
          border-bottom: 1px solid var(--border-color);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
        }

        .collapse-btn {
          background: #ff4444;
          color: white;
          border: none;
          padding: 4px 8px;
          border-radius: 3px;
          cursor: pointer;
          font-size: 11px;
          font-weight: 500;
        }

        .collapse-btn:hover {
          background: #cc0000;
        }

        .expanded-data {
          padding: 12px;
          max-height: 400px;
          overflow: auto;
          font-size: 13px;
        }

        /* Inline expansion styles */
        .cell-expanded {
          white-space: normal !important;
          vertical-align: top !important;
          max-width: none !important;
        }

        .expanded-content-inline {
          margin-top: 8px;
          border: 1px solid var(--border-color);
          border-radius: 4px;
          background: var(--bg-color);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .expanded-content-wrapper {
          overflow: hidden;
        }

        .expanded-header-inline {
          background: var(--header-bg);
          padding: 6px 8px;
          border-bottom: 1px solid var(--border-color);
          font-size: 12px;
          font-weight: 600;
          color: var(--text-color);
        }

        .expanded-data-inline {
          padding: 8px;
          max-height: 300px;
          overflow: auto;
          font-size: 12px;
        }

        .expanded-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }

        .expanded-table th,
        .expanded-table td {
          padding: 6px 8px;
          border: 1px solid var(--border-color);
          text-align: left;
          vertical-align: top;
        }

        .expanded-table th {
          background: var(--header-bg);
          font-weight: 600;
          white-space: nowrap;
        }

        .expanded-table td {
          max-width: 200px;
          word-wrap: break-word;
        }

        .expanded-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .expanded-list li {
          padding: 4px 0;
          border-bottom: 1px solid var(--border-color);
        }

        .expanded-list li:last-child {
          border-bottom: none;
        }

        .expanded-properties {
          width: 100%;
          border-collapse: collapse;
        }

        .expanded-properties td {
          padding: 6px;
          border-bottom: 1px solid var(--border-color);
          vertical-align: top;
        }

        .property-key {
          width: 30%;
          font-weight: 500;
          color: var(--muted-text);
        }

        .property-value {
          width: 70%;
        }

        .truncated-notice {
          text-align: center;
          padding: 8px;
          font-style: italic;
          color: var(--muted-text);
          background: var(--hover-bg);
          border-top: 1px solid var(--border-color);
        }

        .nested-array, .nested-object {
          font-size: 11px;
          padding: 1px 4px;
          border-radius: 2px;
          font-weight: 500;
        }

        .nested-array {
          background: #e1bee7;
          color: #4a148c;
        }

        .nested-object {
          background: #bbdefb;
          color: #0d47a1;
        }

        .long-string {
          font-family: monospace;
          font-size: 11px;
          color: var(--muted-text);
        }

        .null-value {
          font-style: italic;
          color: var(--muted-text);
          opacity: 0.7;
        }

        .boolean-value {
          font-weight: 500;
        }

        .number-value {
          color: #1976d2;
          font-weight: 500;
        }

        .string-value {
          color: var(--text-color);
        }

        /* Search highlighting */
        .search-highlight {
          background: #ffeb3b;
          color: #333;
          padding: 1px 2px;
          border-radius: 2px;
          font-weight: 600;
        }

        /* Loading states */
        .loading-placeholder {
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: loading 1.5s infinite;
        }

        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `;
      document.head.appendChild(style);
    }

    static async getSettings() {
      return new Promise((resolve) => {
        chrome.storage.local.get(['autoConvert', 'autoExpand', 'themeOverride'], (result) => {
          resolve({
            autoConvert: result.autoConvert !== false,
            autoExpand: result.autoExpand !== false,
            themeOverride: result.themeOverride || 'system'
          });
        });
      });
    }

    static applyTheme() {
      const style = document.createElement('style');
      style.id = 'json2tableTheme';
      
      // Get theme preference
      this.getSettings().then(settings => {
        let themeCSS = '';
        
        switch (settings.themeOverride) {
          case 'force_light':
            themeCSS = `
              :root {
                --bg-color: #ffffff;
                --text-color: #212121;
                --border-color: #e0e0e0;
                --header-bg: #f5f5f5;
                --hover-bg: #f5f5f5;
                --button-bg: #ffffff;
                --button-active: #2196f3;
                --array-badge: #9c27b0;
                --object-badge: #2196f3;
                --muted-text: #757575;
              }
            `;
            break;

          case 'force_dark':
            themeCSS = `
              :root {
                --bg-color: #121212;
                --text-color: #e0e0e0;
                --border-color: #444444;
                --header-bg: #1e1e1e;
                --hover-bg: #2c2c2c;
                --button-bg: #1e1e1e;
                --button-active: #2196f3;
                --array-badge: #9c27b0;
                --object-badge: #2196f3;
                --muted-text: #b0b0b0;
              }
            `;
            break;

          case 'system':
          default:
            themeCSS = `
              :root {
                --bg-color: #ffffff;
                --text-color: #212121;
                --border-color: #e0e0e0;
                --header-bg: #f5f5f5;
                --hover-bg: #f5f5f5;
                --button-bg: #ffffff;
                --button-active: #2196f3;
                --array-badge: #9c27b0;
                --object-badge: #2196f3;
                --muted-text: #757575;
              }
              
              @media (prefers-color-scheme: dark) {
                :root {
                  --bg-color: #121212;
                  --text-color: #e0e0e0;
                  --border-color: #444444;
                  --header-bg: #1e1e1e;
                  --hover-bg: #2c2c2c;
                  --button-bg: #1e1e1e;
                  --button-active: #2196f3;
                  --array-badge: #9c27b0;
                  --object-badge: #2196f3;
                  --muted-text: #b0b0b0;
                }
              }
            `;
        }
        
        style.textContent = themeCSS;
      });
      
      document.head.appendChild(style);
    }

    static toggleView(jsonData) {
      const tableContainer = document.getElementById('json2table-table-container');
      const jsonContainer = document.getElementById('json2table-json-container');
      const toggleButton = document.getElementById('json2table-toggle-view');

      const isJsonView = jsonContainer.style.display !== 'none';

      if (!isJsonView) {
        tableContainer.style.display = 'none';
        jsonContainer.style.display = 'block';
        toggleButton.textContent = 'Table View';
        
        const formattedJson = JSON.stringify(jsonData, null, 2);
        jsonContainer.innerHTML = `
          <div style="padding: 20px; font-family: monospace; font-size: 14px;">
            <pre style="white-space: pre-wrap; color: var(--text-color);">${ErrorHandler.sanitizeInput(formattedJson)}</pre>
          </div>
        `;
      } else {
        tableContainer.style.display = 'block';
        jsonContainer.style.display = 'none';
        toggleButton.textContent = 'JSON View';
      }
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
    }

    static isValidDataStructure(data) {
      // Check if it's an array of objects
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'object') {
        return true;
      }
      
      // Check if it's a single object
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
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
    }

    static extractTableData(jsonData) {
      // If it's directly an array, use it
      if (Array.isArray(jsonData)) {
        return jsonData;
      }
      
      // If it's a single object, convert it to property-value format
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

  // Data preparation utility - improved with iterative approach and memoization
  class DataFlattener {
    constructor() {
      this.memoCache = new Map();
      this.maxCacheSize = 1000;
    }

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
            if (keys.length <= 50) { // Increased from 20 to 50 for better data display
              prepared[key] = value;
            } else {
              prepared[key] = `{${keys.length} properties - too large to expand}`;
            }
          } else {
            prepared[key] = value;
          }
        }
      }
      return prepared;
    }

    // Iterative flattening function (replaces recursive approach)
    static flattenJsonIterative(obj, prefix = '', maxDepth = 10) {
      const result = {};
      const stack = [{ obj, prefix, depth: 0 }];
      
      while (stack.length > 0) {
        const { obj: current, prefix: currentPrefix, depth } = stack.pop();
        
        if (depth > maxDepth) {
          result[currentPrefix || 'deep_object'] = '[Max depth reached]';
          continue;
        }
        
        if (current === null || current === undefined) {
          result[currentPrefix] = current;
          continue;
        }
        
        if (typeof current !== 'object') {
          result[currentPrefix] = current;
          continue;
        }
        
        if (Array.isArray(current)) {
          if (current.length === 0) {
            result[currentPrefix] = '[]';
          } else if (current.length <= 100) { // Limit array processing
            current.forEach((item, index) => {
              const newKey = currentPrefix ? `${currentPrefix}[${index}]` : `[${index}]`;
              stack.push({ obj: item, prefix: newKey, depth: depth + 1 });
            });
          } else {
            result[currentPrefix] = `[${current.length} items - too large to flatten]`;
          }
        } else {
          const keys = Object.keys(current);
          if (keys.length === 0) {
            result[currentPrefix] = '{}';
          } else if (keys.length <= 50) { // Limit object processing
            keys.forEach(key => {
              const newKey = currentPrefix ? `${currentPrefix}.${key}` : key;
              stack.push({ obj: current[key], prefix: newKey, depth: depth + 1 });
            });
          } else {
            result[currentPrefix] = `{${keys.length} properties - too large to flatten}`;
          }
        }
      }
      
      return result;
    }
  }

  // Optimized Table Viewer with virtual scrolling and enhanced performance
  class OptimizedTableViewer {
    constructor(data) {
      this.originalData = data;
      this.filteredData = data;
      this.container = document.getElementById('json2table-table-container');
      this.rowHeight = 45;
      this.columns = this.extractColumns(data);
      
      // Virtual scrolling configuration
      this.virtualScrolling = data.length > 1000; // Enable for large datasets
      this.visibleRows = Math.ceil(window.innerHeight / this.rowHeight) + 10;
      this.bufferSize = 5; // Extra rows to render above/below viewport
      
      // Add stable row IDs
      this.originalData = data.map((row, index) => ({
        ...row,
        __rowId: index
      }));
      this.filteredData = this.originalData;

      // Performance optimizations
      this.expandedArrays = new Set();
      this.renderCache = new Map();
      this.maxCacheSize = 500;
      
      // Throttling and debouncing
      this.lastRenderTime = 0;
      this.renderThrottle = 16;
      this.rafId = null;
      
      // Event delegation
      this.boundScrollHandler = PerformanceUtils.throttle(this.handleScroll.bind(this), 16);
      this.boundClickHandler = this.handleDelegatedClick.bind(this);
      
      // Cleanup tracking
      this.eventListeners = [];
    }

    extractColumns(data) {
      if (!Array.isArray(data) || data.length === 0) {
        return [];
      }
      
      const columnSet = new Set();
      const sampleSize = Math.min(data.length, 200);
      data.slice(0, sampleSize).forEach(row => {
        if (row && typeof row === 'object') {
          Object.keys(row).forEach(key => {
            if (key !== '__rowId') {
              columnSet.add(key);
            }
          });
        }
      });
      return Array.from(columnSet);
    }

    render() {
      if (this.virtualScrolling) {
        this.renderVirtualized();
      } else {
        this.renderStandard();
      }
      
      this.attachOptimizedEventListeners();
    }

    renderVirtualized() {
      const containerHeight = this.calculateTotalHeight();
      
      const html = `
        <div class="virtual-scroll-container" style="height: 100%; overflow-y: auto;">
          <table class="json2table-table">
            <thead>
              <tr>
                ${this.columns.map(col => `<th title="${col}">${this.formatColumnName(col)}</th>`).join('')}
              </tr>
            </thead>
            <tbody id="virtual-tbody">
              ${this.renderAllRows()}
            </tbody>
          </table>
        </div>
      `;

      this.container.innerHTML = html;
    }

    renderStandard() {
      const html = `
        <table class="json2table-table">
          <thead>
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
    }

    calculateTotalHeight() {
      return this.filteredData.length * this.rowHeight;
    }

    renderAllRows() {
      let html = '';
      for (let i = 0; i < this.filteredData.length; i++) {
        const row = this.filteredData[i];
        html += this.renderMainRow(row, i);
      }
      return html;
    }

    renderMainRow(row, rowIndex) {
      const stableRowId = row.__rowId;
      
      return `
        <tr data-row-index="${rowIndex}" data-row-id="${stableRowId}" class="main-row">
          ${this.columns.map(col => {
            const value = row[col];
            const cellContent = this.formatCellValue(value);
            const isLongText = this.isLongTextContent(value);
            const cellClass = isLongText ? 'json2table-cell long-text-content' : 'json2table-cell';
            return `<td class="${cellClass}" data-col="${col}">
              ${cellContent}
            </td>`;
          }).join('')}
        </tr>
      `;
    }

    formatCellValue(value) {
      if (value === null || value === undefined) {
        return '<span class="null-value">null</span>';
      }
      
      if (typeof value === 'boolean') {
        return `<span class="boolean-value ${value}">${value}</span>`;
      }
      
      if (typeof value === 'number') {
        return `<span class="number-value">${value}</span>`;
      }
      
      if (Array.isArray(value)) {
        return `<span class="expandable-array" data-type="array" data-length="${value.length}">
          Array[${value.length}]
        </span>`;
      }
      
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        return `<span class="expandable-object" data-type="object" data-keys="${keys.length}">
          Object{${keys.length}}
        </span>`;
      }
      
      // String values - sanitize for security
      const sanitized = ErrorHandler.sanitizeInput(String(value));
      return `<span class="string-value">${sanitized}</span>`;
    }

    isLongTextContent(value) {
      // Only apply max-width to string values that are longer than 100 characters
      if (typeof value === 'string') {
        return value.length > 100;
      }
      return false;
    }

    formatColumnName(col) {
      return ErrorHandler.sanitizeInput(col);
    }

    handleDelegatedClick(event) {
      const target = event.target;
      
      if (target.classList.contains('expandable-array') || target.classList.contains('expandable-object')) {
        event.preventDefault();
        this.handleExpansionClick(target);
      }
    }

    handleExpansionClick(target) {
      const cell = target.closest('td');
      const rowElement = target.closest('tr');
      const rowIndex = parseInt(rowElement.dataset.rowIndex);
      const colName = cell.dataset.col;
      const row = this.filteredData[rowIndex];
      const value = row[colName];
      
      const expandedContainerId = `expanded-content-${rowElement.dataset.rowId}-${colName}`;
      
      // Check if already expanded
      const existingExpanded = cell.querySelector('.expanded-content-inline');
      if (existingExpanded) {
        // Collapse - remove the expanded content and restore original
        existingExpanded.remove();
        target.textContent = target.dataset.type === 'array' 
          ? `Array[${target.dataset.length}]`
          : `Object{${target.dataset.keys}}`;
        
        // Remove expanded styling from cell
        cell.classList.remove('cell-expanded');
        return;
      }
      
      // Expand - create inline expanded content
      const expandedContent = this.formatExpandedContent(value, colName);
      const expandedDiv = document.createElement('div');
      expandedDiv.className = 'expanded-content-inline';
      expandedDiv.id = expandedContainerId;
      expandedDiv.innerHTML = `
        <div class="expanded-content-wrapper">
          <div class="expanded-header-inline">
            <strong>${colName}</strong>
          </div>
          <div class="expanded-data-inline">
            ${expandedContent}
          </div>
        </div>
      `;
      
      // Add expanded content after the trigger element
      target.parentNode.insertBefore(expandedDiv, target.nextSibling);
      
      // Update the trigger text and add expanded styling to cell
      target.textContent = target.dataset.type === 'array' 
        ? `Array[${target.dataset.length}] ▼`
        : `Object{${target.dataset.keys}} ▼`;
      
      cell.classList.add('cell-expanded');
    }

    formatExpandedContent(value, colName) {
      if (Array.isArray(value)) {
        if (value.length === 0) {
          return '<em>Empty array</em>';
        }
        
        // For arrays of objects, show as mini-table
        if (value.length > 0 && typeof value[0] === 'object' && !Array.isArray(value[0])) {
          return this.formatArrayAsTable(value);
        }
        
        // For simple arrays, show as list
        return this.formatArrayAsList(value);
      }
      
      if (typeof value === 'object' && value !== null) {
        return this.formatObjectAsProperties(value);
      }
      
      return ErrorHandler.sanitizeInput(String(value));
    }

    formatArrayAsTable(array) {
      const maxItems = 100; // Limit for performance
      const displayArray = array.slice(0, maxItems);
      
      // Get all unique keys from all objects
      const allKeys = new Set();
      displayArray.forEach(item => {
        if (item && typeof item === 'object') {
          Object.keys(item).forEach(key => allKeys.add(key));
        }
      });
      
      const keys = Array.from(allKeys).slice(0, 10); // Limit columns
      
      let html = `
        <table class="expanded-table">
          <thead>
            <tr>${keys.map(key => `<th>${ErrorHandler.sanitizeInput(key)}</th>`).join('')}</tr>
          </thead>
          <tbody>
      `;
      
      displayArray.forEach((item, index) => {
        html += '<tr>';
        keys.forEach(key => {
          const cellValue = item && typeof item === 'object' ? item[key] : '';
          html += `<td>${this.formatSimpleValue(cellValue)}</td>`;
        });
        html += '</tr>';
      });
      
      html += '</tbody></table>';
      
      if (array.length > maxItems) {
        html += `<div class="truncated-notice">... and ${array.length - maxItems} more items</div>`;
      }
      
      return html;
    }

    formatArrayAsList(array) {
      const maxItems = 50;
      const displayArray = array.slice(0, maxItems);
      
      let html = '<ul class="expanded-list">';
      displayArray.forEach((item, index) => {
        html += `<li><strong>[${index}]:</strong> ${this.formatSimpleValue(item)}</li>`;
      });
      html += '</ul>';
      
      if (array.length > maxItems) {
        html += `<div class="truncated-notice">... and ${array.length - maxItems} more items</div>`;
      }
      
      return html;
    }

    formatObjectAsProperties(obj) {
      const keys = Object.keys(obj);
      const maxKeys = 50;
      const displayKeys = keys.slice(0, maxKeys);
      
      let html = '<table class="expanded-properties">';
      displayKeys.forEach(key => {
        const value = obj[key];
        html += `
          <tr>
            <td class="property-key"><strong>${ErrorHandler.sanitizeInput(key)}:</strong></td>
            <td class="property-value">${this.formatSimpleValue(value)}</td>
          </tr>
        `;
      });
      html += '</table>';
      
      if (keys.length > maxKeys) {
        html += `<div class="truncated-notice">... and ${keys.length - maxKeys} more properties</div>`;
      }
      
      return html;
    }

    formatSimpleValue(value) {
      if (value === null || value === undefined) {
        return '<span class="null-value">null</span>';
      }
      
      if (typeof value === 'boolean') {
        return `<span class="boolean-value">${value}</span>`;
      }
      
      if (typeof value === 'number') {
        return `<span class="number-value">${value}</span>`;
      }
      
      if (Array.isArray(value)) {
        return `<span class="nested-array">Array[${value.length}]</span>`;
      }
      
      if (typeof value === 'object') {
        const keys = Object.keys(value);
        return `<span class="nested-object">Object{${keys.length}}</span>`;
      }
      
      // String - truncate if too long
      const str = String(value);
      const sanitized = ErrorHandler.sanitizeInput(str);
      if (str.length > 200) {
        return `<span class="long-string">${sanitized.substring(0, 200)}...</span>`;
      }
      
      return `<span class="string-value">${sanitized}</span>`;
    }

    handleScroll() {
      if (!this.virtualScrolling) return;
      
      const now = performance.now();
      if (now - this.lastRenderTime < this.renderThrottle) {
        if (this.rafId) cancelAnimationFrame(this.rafId);
        this.rafId = requestAnimationFrame(() => this.handleScroll());
        return;
      }
      
      this.lastRenderTime = now;
      // Virtual scrolling logic would go here
    }

    search(query) {
      if (!query.trim()) {
        this.filteredData = this.originalData;
      } else {
        const searchTerm = query.toLowerCase();
        this.filteredData = this.originalData.filter(row => {
          return Object.values(row).some(value => {
            if (value === null || value === undefined) return false;
            return String(value).toLowerCase().includes(searchTerm);
          });
        });
      }
      
      this.renderCache.clear();
      this.render();
    }

    expandAll() {
      // Find all expandable elements and trigger their expansion
      const expandableElements = this.container.querySelectorAll('.expandable-array, .expandable-object');
      expandableElements.forEach(element => {
        // Only expand if not already expanded (check for inline expanded content)
        const cell = element.closest('td');
        const hasExpandedContent = cell.querySelector('.expanded-content-inline');
        
        if (!hasExpandedContent) {
          this.handleExpansionClick(element);
        }
      });
    }

    collapseAll() {
      // Find and remove all inline expanded content
      const expandedContent = this.container.querySelectorAll('.expanded-content-inline');
      expandedContent.forEach(content => {
        const cell = content.closest('td');
        const triggerElement = cell.querySelector('.expandable-array, .expandable-object');
        
        // Remove expanded content
        content.remove();
        
        // Reset trigger element text and cell styling
        if (triggerElement) {
          triggerElement.textContent = triggerElement.dataset.type === 'array' 
            ? `Array[${triggerElement.dataset.length}]`
            : `Object{${triggerElement.dataset.keys}}`;
        }
        
        cell.classList.remove('cell-expanded');
      });
    }

    exportCSV() {
      try {
        const headers = this.columns;
        const csvContent = [
          headers.join(','),
          ...this.filteredData.map(row => 
            headers.map(header => {
              const value = row[header];
              if (value === null || value === undefined) return '';
              if (typeof value === 'object') return JSON.stringify(value);
              return `"${String(value).replace(/"/g, '""')}"`;
            }).join(',')
          )
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'json-table-export.csv';
        link.click();
        URL.revokeObjectURL(link.href);
      } catch (error) {
        ErrorHandler.globalHandler(error);
      }
    }

    attachOptimizedEventListeners() {
      const tableContainer = this.container;
      
      tableContainer.addEventListener('click', this.boundClickHandler);
      this.eventListeners.push({ element: tableContainer, event: 'click', handler: this.boundClickHandler });
      
      if (this.virtualScrolling) {
        const scrollContainer = tableContainer.querySelector('.virtual-scroll-container');
        if (scrollContainer) {
          scrollContainer.addEventListener('scroll', this.boundScrollHandler);
          this.eventListeners.push({ element: scrollContainer, event: 'scroll', handler: this.boundScrollHandler });
        }
      }
    }

    cleanup() {
      this.eventListeners.forEach(({ element, event, handler }) => {
        element.removeEventListener(event, handler);
      });
      this.eventListeners = [];
      
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      
      this.renderCache.clear();
    }
  }

  // Message listener for communication with popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'detectJson') {
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
        ErrorHandler.globalHandler(error);
        sendResponse({ success: false, error: error.message });
      });

      return true; // Will respond asynchronously
    }
    
    if (request.action === 'settingsChanged') {
      // Handle settings changes from popup
      return false;
    }
  });

  // Auto-detection on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      PerformanceUtils.requestIdleCallback(() => {
        AutoJSONDetector.checkAndConvert(false);
      });
    });
  } else {
    PerformanceUtils.requestIdleCallback(() => {
      AutoJSONDetector.checkAndConvert(false);
    });
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    memoryManager.cleanup();
  });

})();
