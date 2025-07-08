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
    ThemeManager.applyTheme();

    // Create table viewer with original JSON text
    UIUtils.createTableInterface(tableContainer, tableData, originalTextContent);

    return { converted: true, note: 'Converted to table', rawLength };
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AutoJSONDetector;
} else {
  window.AutoJSONDetector = AutoJSONDetector;
}
