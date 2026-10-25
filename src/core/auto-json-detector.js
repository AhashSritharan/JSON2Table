/**
 * Automatic JSON detection based on json-formatter approach
 */
class AutoJSONDetector {
  static async checkAndConvert(forceConvert = false) {
    // Only proceed if auto-convert is enabled (unless forced)
    if (!forceConvert) {
      const settings = await ThemeManager.getSettings();
      if (!settings.autoConvert) {
        return { converted: false, note: 'Auto-convert disabled' };
      }
      // Unasked, only take over pages that are JSON documents. The popup's
      // "Detect & Convert" is an explicit request and may convert JSON shown
      // inside an ordinary page.
      if (!JSONDetector.looksLikeJsonDocument(document)) {
        return { converted: false, note: 'Not a JSON document' };
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

    // Size limit removed - can handle any size JSON file

    if (!/^\s*[\{\[]/.test(rawPreContent)) {
      return { converted: false, note: 'Does not start with { or [' };
    }

    // Try to parse as JSON
    let parsedJsonValue;
    try {
      parsedJsonValue = JSONDetector.parse(rawPreContent);
    } catch (e) {
      return { converted: false, note: 'Does not parse as JSON' };
    }

    if (typeof parsedJsonValue !== 'object' && !Array.isArray(parsedJsonValue)) {
      return { converted: false, note: 'Not an object or array' };
    }

    // Check if it's suitable for table conversion
    const tableData = JSONDetector.extractTableData(parsedJsonValue);

    if (tableData.length === 0) {
      return { converted: false, note: 'No suitable table data found' };
    }

    originalPreElement.remove();

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

    // The table takes over the page: whatever else the body holds (the rest of
    // an HTML page, or the browser's own JSON viewer controls) is hidden, and
    // the body's default margin goes so the table starts at the very top.
    for (const child of document.body.children) {
      if (child !== tableContainer) child.style.setProperty('display', 'none', 'important');
    }
    document.body.style.margin = '0';

    // Apply theme first so the table never paints against undefined variables
    await ThemeManager.applyTheme();

    UIUtils.createTableInterface(tableContainer, tableData, parsedJsonValue);

    return { converted: true, note: 'Converted to table', rawLength };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoJSONDetector;
} else {
  window.AutoJSONDetector = AutoJSONDetector;
}
