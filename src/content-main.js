/**
 * Main content script - coordinates all components
 */

// Import all required modules
// Note: In a real Chrome extension, you'd need to include these in manifest.json
// This file serves as the main coordinator

// Main application initialization
(function () {
  'use strict';

  let detectedData = null;
  let autoConvertEnabled = false;

  // Function to show table viewer - completely replaces page content
  function showTableViewer(tableData, originalJson = null) {
    // Check if we're already displaying a table (avoid clearing if just updating)
    const existingContainer = document.getElementById('json2tableContainer');

    if (!existingContainer) {
      // Completely clear the document and replace with our table viewer
      // This eliminates all CSS conflicts and styling issues

      // Store the original title
      const originalTitle = document.title;

      // Clear everything
      document.documentElement.innerHTML = `
        <head>
          <meta charset="utf-8">
          <title>${originalTitle} - JSON2Table</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body style="margin: 0; padding: 0;">
          <div id="json2tableContainer" style="
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100vh;
            display: flex;
            flex-direction: column;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: var(--bg-color, #ffffff);
            color: var(--text-color, #333333);
          "></div>
        </body>
      `;

      // Apply theme
      ThemeManager.applyTheme();
    }

    // Get the container (now guaranteed to exist)
    const container = document.getElementById('json2tableContainer');

    // Clear existing content and create viewer
    container.innerHTML = '';

    // Use the same interface creation method, passing original JSON if available
    UIUtils.createTableInterface(container, tableData, originalJson);
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
