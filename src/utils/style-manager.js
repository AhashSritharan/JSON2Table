/**
 * CSS styles for JSON2Table components
 */
class StyleManager {
  static injectTableStyles() {
    const style = document.createElement('style');
    style.textContent = this.getTableStyles();
    document.head.appendChild(style);
  }

  static getTableStyles() {
    return `
      .json2table-table {
        width: 100%;
        border-collapse: collapse;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        table-layout: auto;
      }

      .json2table-table th {
        background: var(--header-bg);
        color: var(--text-color);
        padding: 16px 16px;
        text-align: left;
        border-bottom: 2px solid var(--border-color);
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 100;
      }

      .json2table-table td {
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
      
      /* Button and input disabled states */
      button:disabled {
        background: #d1d5db !important;
        color: #9ca3af !important;
        cursor: not-allowed;
      }
      input:disabled {
        background: #f3f4f6 !important;
        color: #9ca3af !important;
        cursor: not-allowed;
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
      
      /* Focus navigation styles */
      .focus-btn {
        display: inline-block;
        background: var(--button-bg);
        border: 1px solid var(--border-color);
        border-radius: 3px;
        padding: 2px 4px;
        margin-left: 4px;
        cursor: pointer;
        font-size: 10px;
        vertical-align: middle;
        transition: all 0.2s ease;
      }
      .focus-btn:hover {
        background: var(--button-hover);
        transform: scale(1.1);
      }
      
      /* Breadcrumb styles */
      .breadcrumb-root, .breadcrumb-current {
        font-weight: 500;
        color: var(--text-color);
      }
      .breadcrumb-link {
        color: var(--button-active);
        cursor: pointer;
        text-decoration: underline;
      }
      .breadcrumb-link:hover {
        color: var(--button-hover);
      }
      .breadcrumb-separator {
        margin: 0 8px;
        color: var(--text-muted);
      }
      
      .json2table-expanded-row {
        background: var(--expand-bg) !important;
      }

      .json2table-expanded-content {
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
      }

      .inline-object-expansion {
        border-left-color: var(--object-badge);
      }
      
      /* Ensure inline table containers don't interfere with image previews */
      .inline-array-table-wrapper, .inline-object-table-wrapper, .inline-table {
        position: static;
        z-index: auto;
      }
      .inline-expansion-header {
        font-weight: 600;
        color: var(--text-color);
        margin-bottom: 6px;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .inline-array-table, .inline-object-properties {
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
      }

      .inline-table {
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
      .inline-table-cell {
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
      }

      .inline-property-name {
        color: var(--object-badge);
        font-weight: 600;
        margin-right: 6px;
      }
      .inline-property-value, .inline-value {
        color: var(--text-color);
      }

      /* Style for table-based object property names */
      .inline-table-cell.inline-property-name {
        background: var(--bg-color);
        font-weight: 600;
        color: var(--object-badge);
      }
      
      /* Ensure hover effect applies to entire row including property column */
      .inline-table-row:hover .inline-table-cell.inline-property-name {
        background: var(--hover-bg);
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
        color: #4caf50;
      }
      .boolean-value.false {
        color: #ff5252;
      }

      .date-value {
        color: #9c27b0;
        font-weight: 500;
      }

      .nested-array, .nested-object {
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
      }

      .nested-object-detailed strong {
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

      /* Image hover effects */
      .hover-expandable {
        position: relative;
        transition: all 0.2s ease;
      }
      
      .hover-expandable:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        border-color: #3b82f6 !important;
      }

      /* Image hover preview container */
      .image-value-container {
        display: inline-block;
      }

      .image-value-container .image-preview {
        position: fixed;
        background: rgba(0, 0, 0, 0.9);
        border-radius: 8px;
        padding: 10px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
        z-index: 1000002;
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s ease, visibility 0.2s ease;
        top: var(--mouse-y, 50%);
        left: var(--mouse-x, 50%);
        transform: var(--preview-transform, translate(15px, -50%));
        max-width: 400px;
        max-height: 400px;
      }
      
      .image-value-container .image-preview img {
        max-width: 400px;
        max-height: 400px;
        border-radius: 4px;
        display: block;
      }
      
      .image-value-container .image-preview .preview-info {
        color: white;
        font-size: 12px;
        margin-top: 8px;
        text-align: center;
        opacity: 0.8;
      }
      
      .hover-expandable:hover + .image-preview,
      .image-value-container:hover .image-preview {
        opacity: 1;
        visibility: visible;
      }
      
      .image-hover-info {
        color: white;
        font-size: 12px;
        text-align: center;
        margin-top: 5px;
        opacity: 0.8;
      }
    `;
  }

  static getModalStyles() {
    return `
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
      }
      .item-value, .property-value {
        font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
        font-size: 12px;
        flex: 1;
      }
      .string-value { color: #059669; }
      .number-value { color: #dc2626; }
      .boolean-value { color: #7c3aed; }
      .null-value, .undefined-value { color: var(--muted-text); font-style: italic; }
      .nested-array, .nested-object { color: #2563eb; }
      .empty-state {
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
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StyleManager;
} else {
  window.StyleManager = StyleManager;
}
