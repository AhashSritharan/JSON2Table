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
      :root {
        --primary: #6366f1;
        --primary-light: #e0e7ff;
        --bg: #ffffff;
        --header-bg: #f8fafc;
        --border: #e2e8f0;
        --text: #1e293b;
        --text-secondary: #64748b;
        --hover-bg: #f1f5f9;
        --array-badge: #0ea5e9;
        --object-badge: #8b5cf6;
        --null-color: #94a3b8;
        --bool-true: #10b981;
        --bool-false: #ef4444;
        --string-color: #334155;
        --number-color: #f59e0b;
        --date-color: #ec4899;
      }

      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #0f172a;
          --header-bg: #1e293b;
          --border: #334155;
          --text: #f1f5f9;
          --text-secondary: #94a3b8;
          --hover-bg: #1e293b;
          --primary-light: #312e81;
        }
      }

      .json2table-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        background: var(--bg);
      }

      .json2table-table th {
        background: var(--header-bg);
        color: var(--text-secondary);
        padding: 12px 16px;
        text-align: left;
        border-bottom: 1px solid var(--border);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 11px;
        position: sticky;
        top: 0;
        z-index: 100;
        backdrop-filter: blur(8px);
        white-space: nowrap;
      }

      .json2table-table td {
        padding: 12px 16px;
        border-bottom: 1px solid var(--border);
        color: var(--text);
        vertical-align: top;
        line-height: 1.5;
        transition: background 0.15s;
      }

      .json2table-table tr:last-child td {
        border-bottom: none;
      }

      .json2table-table tr:hover td {
        background: var(--hover-bg);
      }

      /* Apply minimum width only to cells with substantial content */
      .json2table-table td.wide-content {
        min-width: 240px;
        max-width: 600px;
      }

      /* Badges */
      .expandable-array, .expandable-object {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        user-select: none;
      }

      .expandable-array {
        background: rgba(14, 165, 233, 0.1);
        color: var(--array-badge);
        border: 1px solid rgba(14, 165, 233, 0.2);
      }

      .expandable-object {
        background: rgba(139, 92, 246, 0.1);
        color: var(--object-badge);
        border: 1px solid rgba(139, 92, 246, 0.2);
      }

      .expandable-array:hover {
        background: rgba(14, 165, 233, 0.2);
      }

      .expandable-object:hover {
        background: rgba(139, 92, 246, 0.2);
      }

      /* Focus Button */
      .focus-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 20px;
        height: 20px;
        border-radius: 4px;
        border: none;
        background: transparent;
        color: var(--text-secondary);
        cursor: pointer;
        margin-left: 6px;
        opacity: 0;
        transition: all 0.2s;
      }

      td:hover .focus-btn {
        opacity: 1;
      }

      .focus-btn:hover {
        background: var(--hover-bg);
        color: var(--primary);
      }

      /* Breadcrumbs */
      #json2table-breadcrumb {
        padding: 12px 16px;
        background: var(--bg);
        border-bottom: 1px solid var(--border);
        position: sticky;
        top: 0;
        z-index: 101;
        display: flex;
        align-items: center;
        font-size: 12px;
        color: var(--text-secondary);
      }

      .breadcrumb-item {
        display: flex;
        align-items: center;
      }

      .breadcrumb-link {
        color: var(--primary);
        cursor: pointer;
        text-decoration: none;
        font-weight: 500;
        padding: 4px 8px;
        border-radius: 4px;
        transition: background 0.2s;
      }

      .breadcrumb-link:hover {
        background: var(--primary-light);
      }

      .breadcrumb-separator {
        margin: 0 4px;
        color: var(--text-secondary);
        opacity: 0.5;
      }

      .breadcrumb-current {
        font-weight: 600;
        color: var(--text);
        padding: 4px 8px;
      }

      /* Inline Expansion */
      .inline-array-expansion, .inline-object-expansion {
        margin-top: 12px;
        padding: 12px;
        background: var(--hover-bg);
        border-radius: 8px;
        border: 1px solid var(--border);
      }

      .inline-expansion-header {
        font-size: 11px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        margin-bottom: 8px;
        letter-spacing: 0.5px;
      }

      .inline-table {
        width: 100%;
        border-collapse: collapse;
      }

      .inline-table th {
        font-size: 10px;
        padding: 8px;
        background: transparent;
        border-bottom: 1px solid var(--border);
        color: var(--text-secondary);
      }

      .inline-table td {
        font-size: 11px;
        padding: 8px;
        border-bottom: 1px solid var(--border);
      }

      .inline-table tr:last-child td {
        border-bottom: none;
      }

      /* Value Types */
      .null-value { color: var(--null-color); font-style: italic; }
      .boolean-value { font-weight: 600; }
      .boolean-value.true { color: var(--bool-true); }
      .boolean-value.false { color: var(--bool-false); }
      .number-value { color: var(--number-color); font-family: 'JetBrains Mono', monospace; }
      .string-value { color: var(--string-color); }
      .date-value { color: var(--date-color); font-family: 'JetBrains Mono', monospace; }

      .nested-object-detailed {
        display: inline-block;
        padding: 4px 8px;
        background: var(--hover-bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        font-size: 11px;
        color: var(--text-secondary);
      }

      .nested-object-detailed strong {
        color: var(--text);
        font-weight: 600;
      }

      /* Search Highlight */
      .search-highlight {
        background: #fef08a;
        color: #854d0e;
        padding: 0 2px;
        border-radius: 2px;
      }

      /* Image Preview */
      .image-value-container {
        position: relative;
        display: inline-block;
      }

      .inline-image {
        border-radius: 6px;
        border: 1px solid var(--border);
        transition: transform 0.2s, box-shadow 0.2s;
      }

      .inline-image:hover {
        transform: scale(1.05);
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
      }

      .hover-expandable:hover + .image-preview,
      .image-value-container:hover .image-preview {
        opacity: 1;
        visibility: visible;
      }

      .image-preview {
        position: fixed;
        z-index: 1000;
        background: var(--header-bg);
        padding: 8px;
        border-radius: 8px;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        border: 1px solid var(--border);
        pointer-events: none;
        opacity: 0;
        visibility: hidden;
        transition: opacity 0.2s, visibility 0.2s;
        top: var(--mouse-y, 50%);
        left: var(--mouse-x, 50%);
        transform: var(--preview-transform, translate(15px, -50%));
      }

      .image-preview img {
        display: block;
        max-width: 300px;
        border-radius: 4px;
      }

      .preview-info {
        margin-top: 8px;
        font-size: 11px;
        color: var(--text-secondary);
        text-align: center;
      }
    `;
  }

  static getModalStyles() {
    return `
      .json2table-value-modal {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .modal-backdrop {
        position: absolute;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        backdrop-filter: blur(4px);
      }

      .modal-content {
        position: relative;
        background: var(--bg);
        width: 90%;
        max-width: 600px;
        max-height: 85vh;
        border-radius: 16px;
        box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--border);
      }

      .modal-header {
        padding: 16px 24px;
        border-bottom: 1px solid var(--border);
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--header-bg);
      }

      .modal-header h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 600;
        color: var(--text);
      }

      .modal-close {
        background: transparent;
        border: none;
        color: var(--text-secondary);
        cursor: pointer;
        padding: 4px;
        border-radius: 4px;
        transition: all 0.2s;
      }

      .modal-close:hover {
        background: var(--hover-bg);
        color: var(--error);
      }

      .modal-body {
        padding: 24px;
        overflow-y: auto;
      }

      .property-list {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .property-item {
        display: flex;
        gap: 12px;
        padding: 8px;
        border-radius: 6px;
        background: var(--hover-bg);
      }

      .property-key {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        color: var(--text-secondary);
        min-width: 100px;
      }

      .property-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 12px;
        color: var(--text);
        word-break: break-all;
      }
    `;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = StyleManager;
} else {
  window.StyleManager = StyleManager;
}
