/**
 * JSON detection and parsing utilities
 */
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
  }

  static extractTableData(jsonData) {
    // If it's directly an array of objects, use it
    if (Array.isArray(jsonData)) {
      // Check if it's an array of objects
      if (jsonData.length > 0 && typeof jsonData[0] === 'object' && jsonData[0] !== null && !Array.isArray(jsonData[0])) {
        return jsonData;
      }

      // Handle array of primitive values (strings, numbers, booleans)
      // Convert to array of objects with an "index" and "value" property
      if (jsonData.length > 0) {
        return jsonData.map((item, index) => ({
          index: index,
          value: item
        }));
      }

      // Empty array
      return [];
    }

    // If it's a single object, convert it to property-value format
    if (typeof jsonData === 'object' && jsonData !== null && !Array.isArray(jsonData)) {
      // Always convert single object to property-value rows to preserve all data
      const entries = Object.entries(jsonData);

      // Sort entries: data quality first, then preserve original order
      const sortedEntries = entries.sort(([keyA, valueA], [keyB, valueB]) => {
        // 1. Sort by data quality (non-null values first)
        const aHasData = valueA !== null && valueA !== undefined && valueA !== '';
        const bHasData = valueB !== null && valueB !== undefined && valueB !== '';

        if (aHasData && !bHasData) return -1;
        if (!aHasData && bHasData) return 1;

        // 2. Preserve original order (use original entry index)
        const originalOrderA = entries.findIndex(([key]) => key === keyA);
        const originalOrderB = entries.findIndex(([key]) => key === keyB);
        return originalOrderA - originalOrderB;
      });

      return sortedEntries.map(([key, value]) => ({
        property: key,
        value: value
      }));
    }

    return [];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JSONDetector;
} else {
  window.JSONDetector = JSONDetector;
}
