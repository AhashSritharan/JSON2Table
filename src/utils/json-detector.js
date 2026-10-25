/**
 * JSON detection and parsing utilities
 */
class JSONDetector {
  /**
   * JSON.parse that keeps numbers exactly as written. Plain JSON.parse turns
   * 663400.0 into 663400, 1e3 into 1000 and rounds integers beyond 2^53, so
   * any number whose text would change is kept as JSON.rawJSON(sourceText).
   * JSON.stringify emits those verbatim, so copy/export stay faithful too.
   */
  static parse(text) {
    if (typeof JSON.rawJSON !== 'function') return JSON.parse(text);
    return JSON.parse(text, (key, value, context) => {
      if (typeof value === 'number' && context && context.source !== String(value)) {
        return JSON.rawJSON(context.source);
      }
      return value;
    });
  }

  /** True for a number preserved by parse() as its original source text. */
  static isRawNumber(value) {
    return typeof JSON.isRawJSON === 'function' && JSON.isRawJSON(value);
  }

  /** A real JSON object (not an array, null or a preserved raw number). */
  static isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value) && !this.isRawNumber(value);
  }

  /**
   * Is this page a JSON document rather than an HTML page that happens to show
   * some JSON? Browsers render a JSON (or text) response as a lone body > pre,
   * sometimes with their own viewer controls beside it, so a JSON or text
   * content type is enough. An HTML page qualifies only if its body is nothing
   * but that one <pre> -- a server sending JSON with the wrong type.
   */
  static looksLikeJsonDocument(doc = document) {
    const type = (doc.contentType || '').toLowerCase();
    if (type === 'application/json' || type.endsWith('+json') || type === 'text/json' || type === 'text/plain') {
      return true;
    }
    const children = Array.from(doc.body ? doc.body.children : []);
    return children.length === 1 && children[0].tagName === 'PRE';
  }

  /**
   * Records -- an array whose first item is an object -- are a table with a
   * column per field. Everything else (one object, a list of primitives or of
   * arrays) becomes property/value rows and reads as a tree.
   */
  static isTreeShaped(jsonData) {
    return !(Array.isArray(jsonData) && jsonData.length > 0 && this.isPlainObject(jsonData[0]));
  }

  static extractTableData(jsonData) {
    // If it's directly an array of objects, use it
    if (Array.isArray(jsonData)) {
      // Check if it's an array of objects
      if (jsonData.length > 0 && this.isPlainObject(jsonData[0])) {
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
      // Always convert single object to property-value rows to preserve all data,
      // keeping the property order of the original JSON
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
