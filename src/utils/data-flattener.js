/**
 * Data preparation utility - keeps objects intact for expansion
 */
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
      }
    }
    return prepared;
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = DataFlattener;
} else {
  window.DataFlattener = DataFlattener;
}
