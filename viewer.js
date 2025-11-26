/**
 * Viewer page script - handles loading and displaying JSON data in a dedicated page
 */
(function () {
    'use strict';

    const container = document.getElementById('json2tableContainer');

    /**
     * Show error message
     */
    function showError(title, message) {
        container.innerHTML = `
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-title">${title}</div>
        <div class="error-message">${message}</div>
        <div class="error-actions">
          <button class="btn btn-primary" onclick="window.close()">Close Tab</button>
          <button class="btn btn-secondary" onclick="history.back()">Go Back</button>
        </div>
      </div>
    `;
    }

    /**
     * Load and display JSON data
     */
    async function loadAndDisplayJSON() {
        try {
            // Get the data key from URL hash (e.g., #data=abc123)
            const hash = window.location.hash;
            let jsonData = null;

            if (hash.startsWith('#data=')) {
                // Load data from chrome.storage using the key
                const dataKey = hash.substring(6); // Remove '#data='
                const result = await chrome.storage.local.get([dataKey]);

                if (!result[dataKey]) {
                    throw new Error('Data not found. It may have expired or been cleared.');
                }

                jsonData = result[dataKey];

                // Clean up the stored data after loading (optional - keeps storage clean)
                chrome.storage.local.remove([dataKey]);
            } else {
                throw new Error('No data provided. Please use the extension to view JSON data.');
            }

            // Apply theme before rendering
            ThemeManager.applyTheme();

            // Extract table data from JSON
            const tableData = JSONDetector.extractTableData(jsonData);

            if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
                throw new Error('No suitable table data found in JSON');
            }

            // Verify the table data contains objects
            if (!tableData.some(item => item && typeof item === 'object' && !Array.isArray(item))) {
                throw new Error('Table data must contain objects');
            }

            // Clear loading state and create the table interface
            container.innerHTML = '';
            UIUtils.createTableInterface(container, tableData);

        } catch (error) {
            console.error('Error loading JSON data:', error);
            showError('Failed to Load Data', error.message);
        }
    }

    // Start loading when page is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadAndDisplayJSON);
    } else {
        loadAndDisplayJSON();
    }
})();
