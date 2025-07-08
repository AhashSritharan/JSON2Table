/**
 * Main content script - coordinates all components
 */

// Import all required modules
// Note: In a real Chrome extension, you'd need to include these in manifest.json
// This file serves as the main coordinator

// Main application initialization
(function() {
  'use strict';

  let detectedData = null;
  let autoConvertEnabled = false;

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
      ThemeManager.applyTheme();
    }

    // Clear existing content and create viewer
    container.innerHTML = '';
    
    // Use the same interface creation method
    UIUtils.createTableInterface(container, tableData);
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

  // Initialize message handler
  MessageHandler.init();

  // Export showTableViewer function for potential external use
  window.showTableViewer = showTableViewer;

})();
