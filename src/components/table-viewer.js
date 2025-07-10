/**
 * Ultra-high-performance table viewer with expandable arrays
 */
class TableViewer {
  constructor(data) {
    this.originalData = data;
    this.filteredData = data;
    this.container = document.getElementById('json2table-table-container');
    this.rowHeight = 45; // Base row height
    this.visibleRows = Math.ceil(window.innerHeight / this.rowHeight) + 5;
    this.scrollTop = 0;
    this.columns = this.extractColumns(data);
    this.csvDelimiter = ','; // Default delimiter

    // Get CSV delimiter from settings
    chrome.storage.local.get(['csvDelimiter'], (result) => {
      if (result.csvDelimiter) {
        this.csvDelimiter = result.csvDelimiter;
      } else {
        // If not set, use the auto-detected delimiter based on locale
        this.csvDelimiter = this.getLikelyCsvDelimiter();
      }
    });

    // Add stable row IDs that don't change when filtering
    this.originalData = data.map((row, index) => ({
      ...row,
      __rowId: index // Stable identifier for expansions
    }));
    this.filteredData = this.originalData;

    // Array expansion tracking
    this.expandedArrays = new Set(); // Track which arrays are expanded
    this.arrayRowHeights = new Map(); // Track additional height per expanded array
    this.renderCache = new Map();
    this.modalOverlay = null;
    this.lastRenderTime = 0;
    this.renderThrottle = 16;
    this.rafId = null; // For requestAnimationFrame scroll handling
    this.boundScrollHandler = null; // Bound scroll handler reference
  }

  extractColumns(data) {
    // Ensure data is an array
    if (!Array.isArray(data) || data.length === 0) {
      return [];
    }

    // Track column statistics and preserve discovery order
    const columnStats = new Map();
    const columnOrder = []; // Track the order columns are first discovered
    const sampleSize = Math.min(data.length, 100); // Sample first 100 rows for analysis

    // Analyze columns and count non-null values, preserving discovery order
    data.slice(0, sampleSize).forEach(row => {
      if (row && typeof row === 'object') {
        Object.keys(row).forEach(key => {
          if (!columnStats.has(key)) {
            columnStats.set(key, { nonNullCount: 0, totalCount: 0 });
            columnOrder.push(key); // Remember the order we first saw this column
          }

          const stats = columnStats.get(key);
          stats.totalCount++;

          const value = row[key];
          // Count as non-null if it's not null, undefined, or empty string
          if (value !== null && value !== undefined && value !== '') {
            stats.nonNullCount++;
          }
        });
      }
    });

    // Sort columns: data density first, then preserve original order
    const sortedColumns = Array.from(columnStats.keys()).sort((a, b) => {
      // 1. Sort by data density (non-null percentage)
      const statsA = columnStats.get(a);
      const statsB = columnStats.get(b);
      const densityA = statsA.nonNullCount / statsA.totalCount;
      const densityB = statsB.nonNullCount / statsB.totalCount;

      if (densityA !== densityB) {
        return densityB - densityA; // Higher density first
      }

      // 2. Preserve original discovery order (not alphabetical)
      const orderA = columnOrder.indexOf(a);
      const orderB = columnOrder.indexOf(b);
      return orderA - orderB;
    });

    return sortedColumns;
  }

  render() {
    // Simple render - no virtual scrolling, just render all rows
    const html = `
      <table class="json2table-table">
        <thead style="position: sticky; top: 0; z-index: 1000; background: var(--header-bg); box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <tr>
            ${this.columns.map(col => `<th title="${col}">${UIUtils.formatColumnName(col)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${this.renderAllRows()}
        </tbody>
      </table>
    `;

    this.container.innerHTML = html;
    this.attachOptimizedEventListeners();
  }

  renderAllRows() {
    // Simply render all rows without any virtual scrolling complexity
    let html = '';
    for (let i = 0; i < this.filteredData.length; i++) {
      const row = this.filteredData[i];
      html += this.renderMainRow(row, i);
    }
    return html;
  }

  renderMainRow(row, rowIndex) {
    const stableRowId = row.__rowId; // Use stable ID instead of changing row index
    return `
      <tr data-row-index="${rowIndex}" class="main-row">
        ${this.columns.map(col => {
      const value = row[col];
      const cellContent = this.formatCellValueWithExpansion(value, stableRowId, col);
      // Determine if this cell needs wide content class
      const isWideContent = this.shouldUseWideContent(value, cellContent);
      const widthClass = isWideContent ? ' wide-content' : '';
      return `<td class="json2table-cell${widthClass}" data-col="${col}" data-row="${rowIndex}">
            ${cellContent}
          </td>`;
    }).join('')}
      </tr>
    `;
  }

  shouldUseWideContent(value, cellContent, context = 'main-table') {
    // Single digits, booleans, short numbers don't need wide columns
    if (typeof value === 'number' && Math.abs(value) < 1000) return false;
    if (typeof value === 'boolean') return false;
    if (value === null || value === undefined) return false;

    // Arrays and objects don't need wide content for expansion
    // since they have their own inline expansion mechanism
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return false; // No wide content for any expandable content
    }

    // String content - check length
    if (typeof value === 'string') {
      // Check if this string is an image URL - images don't need wide columns
      if (this.isImageUrl(value)) return false;
      // Short strings (like IDs, status, single words) don't need wide columns
      if (value.length <= 10) return false;
      // Medium strings might need some width
      if (value.length <= 30) return false;
      // Long strings definitely need wide columns
      return true;
    }

    // For rendered HTML content, check if it contains expansion elements
    if (typeof cellContent === 'string') {
      if (cellContent.includes('expandable-array') || cellContent.includes('expandable-object')) return true;
      // Check if this is image content - images don't need wide columns since they're constrained to 60px
      if (cellContent.includes('image-value-container') || cellContent.includes('inline-image')) return false;
      // Long rendered content
      if (cellContent.length > 50) return true;
    }

    return false;
  }

  getArrayColumns(arrayItems) {
    const columnSet = new Set();
    const columnPriority = new Map();

    // Sample more items for better column detection
    const sampleSize = Math.min(50, arrayItems.length);
    const sampleItems = arrayItems.slice(0, sampleSize);

    sampleItems.forEach((item, index) => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach(key => {
          columnSet.add(key);
          // Count frequency for prioritization
          columnPriority.set(key, (columnPriority.get(key) || 0) + 1);
        });
      } else {
        columnSet.add('value'); // For primitive arrays
      }
    });

    // Convert to array and sort by priority (frequency) and common field names
    const columns = Array.from(columnSet).sort((a, b) => {
      // Prioritize common important fields first
      const priorityFields = ['id', 'name', 'title', 'rating', 'comment', 'date', 'price', 'description'];
      const aPriority = priorityFields.indexOf(a.toLowerCase());
      const bPriority = priorityFields.indexOf(b.toLowerCase());

      if (aPriority !== -1 && bPriority !== -1) {
        return aPriority - bPriority;
      }
      if (aPriority !== -1) return -1;
      if (bPriority !== -1) return 1;

      // Then sort by frequency
      const aFreq = columnPriority.get(a) || 0;
      const bFreq = columnPriority.get(b) || 0;

      return bFreq - aFreq;
    });

    // Limit to 10 columns for better display
    return columns.slice(0, 10);
  }

  formatArrayCellValue(value) {
    if (value === null || value === undefined) return '<span class="null-value">-</span>';

    const stringValue = String(value);

    // Format dates
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        // Fall through to regular formatting
      }
    }

    // Format booleans
    if (typeof value === 'boolean') {
      return `<span class="boolean-value ${value ? 'true' : 'false'}">${value ? '✓' : '✗'}</span>`;
    }

    // Format numbers
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }

    // Return full string for complete text selection
    return stringValue;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  formatObjectPropertyValue(value) {
    if (value === null || value === undefined) return '<span class="null-value">-</span>';

    const stringValue = String(value);

    // Format dates
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      } catch (e) {
        // Fall through to regular formatting
      }
    }

    // Format booleans
    if (typeof value === 'boolean') {
      return `<span class="boolean-value ${value ? 'true' : 'false'}">${value ? '✓' : '✗'}</span>`;
    }

    // Format numbers
    if (typeof value === 'number') {
      return value % 1 === 0 ? value.toString() : value.toFixed(2);
    }

    // Handle arrays and objects
    if (Array.isArray(value)) {
      return `<span class="nested-array">[${value.length} items]</span>`;
    }

    if (typeof value === 'object' && value !== null) {
      return `<span class="nested-object">{${Object.keys(value).length} props}</span>`;
    }

    // Return full string for complete text selection
    return stringValue;
  }

  getValueType(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  formatCellValueWithExpansion(value, rowIndex, col) {
    if (value === null || value === undefined) return '';

    if (Array.isArray(value)) {
      const count = value.length;
      const arrayKey = `${rowIndex}-${col}`;
      const isExpanded = this.expandedArrays.has(arrayKey);
      const expandIcon = isExpanded ? '[-]' : '[+]';

      let html = `<span class="array-badge expandable-array" data-array-key="${arrayKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} array">
        ${expandIcon} [${count}] ${count === 1 ? 'item' : 'items'}
      </span>`;

      // Add inline expansion content
      if (isExpanded && value.length > 0) {
        const arrayColumns = this.getArrayColumns(value);
        html += `
          <div class="inline-array-expansion" data-array-key="${arrayKey}">
            <div class="inline-expansion-header">Array Items (${count}):</div>
            <div class="inline-array-table-wrapper">
              <table class="inline-table">
                <thead>
                  <tr>
                    ${arrayColumns.map(col => `<th>${UIUtils.formatColumnName(col)}</th>`).join('')}
                  </tr>
                </thead>
                <tbody>
                  ${value.map((item, itemIndex) => {
          if (typeof item === 'object' && item !== null) {
            return `<tr class="inline-table-row">
                        ${arrayColumns.map(acol => {
              const cellValue = item[acol];
              return `<td class="inline-table-cell">${cellValue !== undefined ? this.highlightSearchTerm(this.formatArrayCellValue(cellValue)) : '<span class="null-value">-</span>'}</td>`;
            }).join('')}
                      </tr>`;
          } else {
            return `<tr class="inline-table-row">
                        <td class="inline-table-cell" colspan="${arrayColumns.length}">
                          <span class="inline-value">${this.highlightSearchTerm(this.formatInlineValue(item))}</span>
                        </td>
                      </tr>`;
          }
        }).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
      }

      return html;
    }

    if (typeof value === 'object') {
      const propCount = Object.keys(value).length;
      if (propCount === 0) return '<span class="empty-object">{}</span>';

      const objectKey = `${rowIndex}-${col}-object`;
      const isExpanded = this.expandedArrays.has(objectKey); // Reuse same tracking set
      const expandIcon = isExpanded ? '[-]' : '[+]';

      let html = `<span class="object-badge expandable-object" data-object-key="${objectKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} object properties">
        ${expandIcon} {${propCount}} ${propCount === 1 ? 'property' : 'properties'}
      </span>`;

      // Add inline expansion content in table format
      if (isExpanded) {
        html += `
          <div class="inline-object-expansion" data-object-key="${objectKey}">
            <div class="inline-expansion-header">Properties (${propCount}):</div>
            <div class="inline-object-table-wrapper">
              <table class="inline-table">
                <thead>
                  <tr>
                    <th>Property</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  ${Object.entries(value).map(([key, val]) => {
          // Determine if this property value needs wide content class (inline context)
          const isWideContent = this.shouldUseWideContent(val, null, 'inline-table');
          const widthClass = isWideContent ? ' wide-content' : '';

          return `<tr class="inline-table-row">
                      <td class="inline-table-cell inline-property-name">${this.highlightSearchTerm(key)}</td>
                      <td class="inline-table-cell inline-property-value${widthClass}">${this.highlightSearchTerm(this.formatInlineValue(val, rowIndex, col, key))}</td>
                    </tr>`;
        }).join('')}
                </tbody>
              </table>
            </div>
          </div>`;
      }

      return html;
    }

    const stringValue = String(value);

    // Check if the string value is an image URL
    if (this.isImageUrl(stringValue)) {
      return this.renderImageValue(stringValue);
    }

    // Apply search highlighting to the value
    return this.highlightSearchTerm(stringValue);
  }

  formatInlineValue(value, parentRowIndex = null, parentCol = null, nestedKey = null) {
    if (value === null || value === undefined) return '<span class="null-value">null</span>';

    if (Array.isArray(value)) {
      // For nested arrays, make them expandable too
      if (parentRowIndex !== null && parentCol !== null && nestedKey !== null) {
        const nestedArrayKey = `${parentRowIndex}-${parentCol}-${nestedKey}-array`;
        const isExpanded = this.expandedArrays.has(nestedArrayKey);
        const expandIcon = isExpanded ? '[-]' : '[+]';

        let html = `<span class="array-badge expandable-array" data-array-key="${nestedArrayKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} nested array">
          ${expandIcon} [${value.length} items]
        </span>`;

        if (isExpanded && value.length > 0) {
          const arrayColumns = this.getArrayColumns(value);
          html += `
            <div class="inline-array-expansion" data-array-key="${nestedArrayKey}" style="margin-top: 4px;">
              <div class="inline-expansion-header" style="font-size: 10px;">Nested Array (${value.length}):</div>
              <div class="inline-array-table-wrapper">
                <table class="inline-table" style="font-size: 10px;">
                  <thead>
                    <tr>
                      ${arrayColumns.map(col => `<th style="font-size: 9px;">${UIUtils.formatColumnName(col)}</th>`).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${value.map((item, itemIndex) => {
            if (typeof item === 'object' && item !== null) {
              return `<tr class="inline-table-row">
                          ${arrayColumns.map(acol => {
                const cellValue = item[acol];
                return `<td class="inline-table-cell">${cellValue !== undefined ? this.formatArrayCellValue(cellValue) : '<span class="null-value">-</span>'}</td>`;
              }).join('')}
                        </tr>`;
            } else {
              return `<tr class="inline-table-row">
                          <td class="inline-table-cell" colspan="${arrayColumns.length}">
                            <span class="inline-value">${this.formatInlineValue(item)}</span>
                          </td>
                        </tr>`;
            }
          }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }

        return html;
      }

      return `<span class="nested-array">[${value.length} items]</span>`;
    }

    if (typeof value === 'object') {
      const keys = Object.keys(value);

      // For nested objects, make them expandable
      if (parentRowIndex !== null && parentCol !== null && nestedKey !== null) {
        const nestedObjectKey = `${parentRowIndex}-${parentCol}-${nestedKey}-object`;
        const isExpanded = this.expandedArrays.has(nestedObjectKey);
        const expandIcon = isExpanded ? '[-]' : '[+]';

        let html = `<span class="object-badge expandable-object" data-object-key="${nestedObjectKey}" title="Click to ${isExpanded ? 'collapse' : 'expand'} nested object">
          ${expandIcon} {${keys.length} props}
        </span>`;

        if (isExpanded) {
          html += `
            <div class="inline-object-expansion" data-object-key="${nestedObjectKey}" style="margin-top: 4px;">
              <div class="inline-expansion-header" style="font-size: 10px;">Nested Object (${keys.length}):</div>
              <div class="inline-object-table-wrapper">
                <table class="inline-table" style="font-size: 10px;">
                  <thead>
                    <tr>
                      <th style="font-size: 9px;">Property</th>
                      <th style="font-size: 9px;">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${Object.entries(value).map(([key, val]) => {
            // Apply smart width logic to nested object property values (inline context)
            const isWideContent = this.shouldUseWideContent(val, null, 'inline-table');
            const widthClass = isWideContent ? ' wide-content' : '';

            return `<tr class="inline-table-row">
                        <td class="inline-table-cell inline-property-name" style="font-size: 10px;">${key}</td>
                        <td class="inline-table-cell inline-property-value${widthClass}" style="font-size: 10px;">${this.formatInlineValue(val, parentRowIndex, parentCol, `${nestedKey}-${key}`)}</td>
                      </tr>`;
          }).join('')}
                  </tbody>
                </table>
              </div>
            </div>`;
        }

        return html;
      }

      // For simple objects with few properties, show them inline
      if (keys.length <= 4) {
        const props = keys.map(key => {
          const propValue = value[key];
          let displayValue;

          // Handle nested values more gracefully
          if (typeof propValue === 'object' && propValue !== null) {
            if (Array.isArray(propValue)) {
              displayValue = `[${propValue.length} items]`;
            } else {
              displayValue = `{${Object.keys(propValue).length} props}`;
            }
          } else if (typeof propValue === 'string' && propValue.length > 30) {
            displayValue = propValue.substring(0, 30) + '...';
          } else {
            displayValue = String(propValue);
          }

          return `<strong>${key}:</strong> ${displayValue}`;
        }).join(', ');

        return `<span class="nested-object-detailed">{${props}}</span>`;
      } else {
        // For complex objects, show summary
        return `<span class="nested-object">{${keys.length} props}</span>`;
      }
    }

    if (typeof value === 'boolean') {
      return `<span class="boolean-value ${value}">${value ? '✓' : '✗'}</span>`;
    }

    // Format dates
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        return `<span class="date-value">${date.toLocaleDateString()}</span>`;
      } catch (e) {
        // Fall through to regular formatting
      }
    }

    // Truncate very long strings (but check for images first)
    if (typeof value === 'string') {
      // Check if it's an image URL first
      if (this.isImageUrl(value)) {
        return this.renderImageValue(value);
      }
      // Then check for length truncation
      if (value.length > 50) {
        return value.substring(0, 50) + '...';
      }
    }

    const stringValue = String(value);
    // Return full string for complete text selection
    return stringValue;
  }

  highlightSearchTerm(text) {
    // If no search query or text is not a string, return as is
    if (!this.searchQuery || typeof text !== 'string') {
      return text;
    }

    // Create a case-insensitive regex to find all matches
    const regex = new RegExp(`(${this.escapeRegex(this.searchQuery)})`, 'gi');

    // Replace matches with highlighted spans
    return text.replace(regex, '<mark class="search-highlight">$1</mark>');
  }

  escapeRegex(string) {
    // Escape special regex characters
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  isImageUrl(url) {
    // Check if the URL string looks like an image
    if (typeof url !== 'string') return false;

    // Check for base64 encoded images
    if (/^data:image\/(jpeg|jpg|png|gif|webp|svg\+xml|bmp);base64,/i.test(url)) {
      return true;
    }

    // Check for base64 strings that might be images (common JPEG header)
    if (/^\/9j\//.test(url) || /^iVBORw0KGgo/.test(url) || /^R0lGOD/.test(url)) {
      return true;
    }

    // Must be a valid URL pattern for regular URLs
    if (!/^https?:\/\/.+/i.test(url)) return false;

    // Check for image file extensions
    const imageExtensions = /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico)(\?.*)?$/i;
    if (imageExtensions.test(url)) return true;

    // Check for common image hosting patterns
    const imageHostPatterns = [
      /cdn\..*\.(jpg|jpeg|png|gif|webp|svg)/i,
      /images?\./i,
      /img\./i,
      /photo/i,
      /picture/i,
      /thumbnail/i,
      /avatar/i
    ];

    return imageHostPatterns.some(pattern => pattern.test(url));
  }

  renderImageValue(imageUrl) {
    // Determine if it's a base64 image and format the src accordingly
    let imageSrc = imageUrl;
    let displayUrl = imageUrl;

    // Handle base64 images that don't have data: prefix
    if (/^\/9j\//.test(imageUrl) || /^iVBORw0KGgo/.test(imageUrl) || /^R0lGOD/.test(imageUrl)) {
      // Common base64 image headers - add data URI prefix
      let mimeType = 'jpeg'; // Default
      if (/^iVBORw0KGgo/.test(imageUrl)) mimeType = 'png';
      if (/^R0lGOD/.test(imageUrl)) mimeType = 'gif';

      imageSrc = `data:image/${mimeType};base64,${imageUrl}`;
      displayUrl = `Base64 ${mimeType.toUpperCase()} (${Math.round(imageUrl.length * 0.75 / 1024)}KB)`;
    } else if (/^data:image/.test(imageUrl)) {
      // Already has data: prefix, extract info for display
      const match = imageUrl.match(/^data:image\/([^;]+);base64,(.+)$/);
      if (match) {
        const format = match[1].toUpperCase();
        const base64Data = match[2];
        displayUrl = `Base64 ${format} (${Math.round(base64Data.length * 0.75 / 1024)}KB)`;
      }
    }

    // Generate unique ID for this image
    const imageId = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return `
      <div class="image-value-container" style="display: inline-flex; align-items: center; gap: 8px; width: fit-content;">        <img 
          id="${imageId}"
          src="${imageSrc}" 
          alt="Image" 
          class="inline-image hover-expandable"
          data-full-src="${imageSrc}"
          data-display-url="${displayUrl}"
          style="
            max-width: 80px; 
            max-height: 60px; 
            border-radius: 4px; 
            border: 1px solid #e5e7eb;
            object-fit: cover;
            cursor: pointer;
            flex-shrink: 0;
          "
          onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"
        />
        <div class="image-preview">
          <img src="${imageSrc}" alt="Enlarged image" onerror="this.parentElement.style.display='none';" />
          <div class="preview-info">${displayUrl.length > 60 ? displayUrl.substring(0, 60) + '...' : displayUrl}</div>
        </div>
        <div class="image-url-display" style="display: none; font-size: 11px; color: #6b7280; word-break: break-all;">
          ${this.highlightSearchTerm(displayUrl)}
        </div>
        <div class="image-fallback" style="display: none; font-size: 11px; color: #ef4444;">
          ${this.highlightSearchTerm(displayUrl)}
        </div>
      </div>
    `;
  }

  attachOptimizedEventListeners() {
    // Single delegated event listener for maximum performance
    this.container.removeEventListener('click', this.handleTableClick);
    this.handleTableClick = this.handleTableClick.bind(this);
    this.container.addEventListener('click', this.handleTableClick);

    // Add mouse tracking for image preview positioning
    this.container.removeEventListener('mousemove', this.handleMouseMove);
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.container.addEventListener('mousemove', this.handleMouseMove);
  }

  handleTableClick(e) {
    // Handle array expansion/collapse badges
    const arrayBadge = e.target.closest('.expandable-array');
    if (arrayBadge) {
      const arrayKey = arrayBadge.dataset.arrayKey;
      this.toggleArrayExpansion(arrayKey);
      return;
    }

    // Handle object expansion/collapse badges
    const objectBadge = e.target.closest('.expandable-object');
    if (objectBadge) {
      const objectKey = objectBadge.dataset.objectKey;
      this.toggleObjectExpansion(objectKey);
      return;
    }

    // Handle object modal for non-arrays
    const clickable = e.target.closest('.clickable');
    if (clickable) {
      const cell = clickable.closest('.json2table-cell');
      const rowIndex = parseInt(cell.dataset.row);
      const col = cell.dataset.col;
      const value = this.filteredData[rowIndex][col];

      if (typeof value === 'object' && !Array.isArray(value)) {
        this.showValueModal(value, `${col} (Row ${rowIndex + 1})`);
      }
    }
  }

  toggleArrayExpansion(arrayKey) {
    if (this.expandedArrays.has(arrayKey)) {
      this.expandedArrays.delete(arrayKey);
    } else {
      this.expandedArrays.add(arrayKey);
    }

    // Simple re-render without complex scroll handling
    this.render();
  }

  toggleObjectExpansion(objectKey) {
    if (this.expandedArrays.has(objectKey)) {
      this.expandedArrays.delete(objectKey);
    } else {
      this.expandedArrays.add(objectKey);
    }

    // Simple re-render without complex scroll handling
    this.render();
  }

  handleMouseMove(e) {
    // Update CSS variables for image preview positioning
    // Only update if we're hovering over an image
    if (e.target.classList && e.target.classList.contains('hover-expandable')) {
      const mouseX = e.clientX;
      const mouseY = e.clientY;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;

      // Adjust position to keep preview on screen
      let adjustedX = mouseX;
      let adjustedY = mouseY;

      // If too close to right edge, show on left side of cursor
      if (mouseX > windowWidth - 420) { // 400px preview width + 20px margin
        adjustedX = mouseX;
        document.documentElement.style.setProperty('--preview-transform', 'translate(-100%, -50%)');
      } else {
        document.documentElement.style.setProperty('--preview-transform', 'translate(15px, -50%)');
      }

      // Keep some margin from edges
      if (adjustedY < 50) adjustedY = 50;
      if (adjustedY > windowHeight - 50) adjustedY = windowHeight - 50;

      document.documentElement.style.setProperty('--mouse-x', adjustedX + 'px');
      document.documentElement.style.setProperty('--mouse-y', adjustedY + 'px');
    }
  }

  showValueModal(value, title) {
    // Remove existing modal
    if (this.modalOverlay) {
      this.modalOverlay.remove();
    }

    // Create optimized modal
    this.modalOverlay = document.createElement('div');
    this.modalOverlay.className = 'json2table-value-modal';
    this.modalOverlay.innerHTML = `
      <div class="modal-backdrop" onclick="this.parentElement.remove()">
        <div class="modal-content" onclick="event.stopPropagation()">
          <div class="modal-header">
            <h3>${title}</h3>
            <button class="modal-close" onclick="this.closest('.json2table-value-modal').remove()">×</button>
          </div>
          <div class="modal-body">
            ${this.renderValueContent(value)}
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this.modalOverlay);
  }

  renderValueContent(value) {
    if (Array.isArray(value)) {
      if (value.length === 0) return '<div class="empty-state">Empty array</div>';

      // For large arrays, show pagination
      if (value.length > 100) {
        return this.renderPaginatedArray(value);
      }

      return `
        <div class="array-content">
          <div class="content-header">Array (${value.length} items)</div>
          <div class="array-items">
            ${value.map((item, idx) => `
              <div class="array-item">
                <span class="item-index">[${idx}]</span>
                <span class="item-value">${this.formatModalValue(item)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    if (typeof value === 'object' && value !== null) {
      const entries = Object.entries(value);
      if (entries.length === 0) return '<div class="empty-state">Empty object</div>';

      return `
        <div class="object-content">
          <div class="content-header">Object (${entries.length} properties)</div>
          <div class="object-properties">
            ${entries.map(([key, val]) => `
              <div class="object-property">
                <span class="property-key">${key}:</span>
                <span class="property-value">${this.formatModalValue(val)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `<div class="simple-value">${String(value)}</div>`;
  }

  renderPaginatedArray(array) {
    const pageSize = 50;
    const totalPages = Math.ceil(array.length / pageSize);

    return `
      <div class="paginated-array">
        <div class="content-header">Large Array (${array.length} items) - Showing first ${Math.min(pageSize, array.length)}</div>
        <div class="array-items">
          ${array.slice(0, pageSize).map((item, idx) => `
            <div class="array-item">
              <span class="item-index">[${idx}]</span>
              <span class="item-value">${this.formatModalValue(item)}</span>
            </div>
          `).join('')}
        </div>
        ${totalPages > 1 ? `<div class="pagination-info">Showing 1-${pageSize} of ${array.length} items</div>` : ''}
      </div>
    `;
  }

  formatModalValue(value) {
    if (value === null) return '<span class="null-value">null</span>';
    if (value === undefined) return '<span class="undefined-value">undefined</span>';
    if (typeof value === 'string') return `<span class="string-value">"${value}"</span>`;
    if (typeof value === 'number') return `<span class="number-value">${value}</span>`;
    if (typeof value === 'boolean') return `<span class="boolean-value">${value}</span>`;
    if (Array.isArray(value)) return `<span class="nested-array">[Array: ${value.length} items]</span>`;
    if (typeof value === 'object') return `<span class="nested-object">{Object: ${Object.keys(value).length} props}</span>`;
    return String(value);
  }

  search(query) {
    if (!query.trim()) {
      this.filteredData = this.originalData;
      this.searchQuery = null; // Clear search highlighting
    } else {
      this.performSearch(query);
      this.searchQuery = query.toLowerCase(); // Store for highlighting
    }

    // Keep expansions when searching - don't clear them
    this.render();
  }

  performSearch(query) {
    const lowerQuery = query.toLowerCase();
    const startTime = performance.now();

    this.filteredData = this.originalData.filter(row => {
      // Quick string search first (fastest)
      const rowString = JSON.stringify(row).toLowerCase();
      if (rowString.includes(lowerQuery)) return true;

      // If not found in JSON string, skip expensive deep search
      return false;
    });

    console.log(`Search completed in ${performance.now() - startTime}ms`);
  }

  expandAll() {
    // Find all arrays and objects in the current filtered data and expand them recursively
    this.filteredData.forEach((row, rowIndex) => {
      const stableRowId = row.__rowId; // Use stable ID instead of changing index
      this.columns.forEach(col => {
        const value = row[col];
        this.expandAllNested(value, stableRowId, col, '');
      });
    });

    // Simple re-render
    this.render();
  }

  getLikelyCsvDelimiter() {
    const locale = navigator.language || navigator.userLanguage;
    // List of locales where semicolon is commonly used
    const semicolonLocales = [
      'de', // German
      'fr', // French
      'it', // Italian
      'es', // Spanish
      'ru', // Russian
      'pl', // Polish
      'nl', // Dutch
      'da', // Danish
      'fi', // Finnish
      'sv', // Swedish
      'cs', // Czech
      'hu', // Hungarian
      'tr', // Turkish
      'pt-PT', // Portuguese (Portugal)
      'sl', // Slovenian
      'sk', // Slovak
      'hr', // Croatian
      'lt', // Lithuanian
      'lv', // Latvian
      'et', // Estonian
      // Add more as needed
    ];
    // Check if the user's locale starts with any of the semicolon locales
    if (semicolonLocales.some(code => locale.startsWith(code))) {
      return ';';
    }
    return ',';
  }

  exportCSV() {
    const delimiter = this.csvDelimiter;
    const headers = this.columns.join(delimiter);
    const rows = this.filteredData.map(row =>
      this.columns.map(col => {
        const value = row[col] || '';
        let csvValue = '';

        if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
          // Convert arrays and objects to JSON string format
          csvValue = `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        } else {
          csvValue = `"${String(value).replace(/"/g, '""')}"`;
        }

        return csvValue;
      }).join(delimiter)
    );

    const csv = [headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'json-table-export.csv';
    a.click();

    URL.revokeObjectURL(url);
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableViewer;
} else {
  window.TableViewer = TableViewer;
}
