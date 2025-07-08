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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = JSONDetector;
} else {
  window.JSONDetector = JSONDetector;
}
