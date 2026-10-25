/**
 * Viewer page script - handles loading and displaying JSON data in a dedicated page
 */
(function () {
    'use strict';

    const container = document.getElementById('json2tableContainer');

    /** A situation the user can cause (reload, empty input): shown, not logged. */
    function expectedError(message) {
        return Object.assign(new Error(message), { expected: true });
    }

    /**
     * Show error message. Title and message are set as text: a parse error's
     * message quotes the data, which must never be read as markup.
     */
    function showError(title, message) {
        container.innerHTML = `
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-title"></div>
        <div class="error-message"></div>
        <div class="error-actions">
          <button class="btn btn-primary" id="error-close-btn">Close Tab</button>
        </div>
      </div>
    `;
        container.querySelector('.error-title').textContent = title;
        container.querySelector('.error-message').textContent = message;
        document.getElementById('error-close-btn').addEventListener('click', () => window.close());
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

                if (result[dataKey] === undefined) {
                    throw expectedError('Data not found. The data was already loaded and cleared, or it expired. Please convert the JSON again from the extension popup.');
                }

                // Stored as raw text so the original key order survives storage
                jsonData = JSONDetector.parse(result[dataKey]);

                // Clean up the stored data after loading (keeps storage clean)
                chrome.storage.local.remove([dataKey]);
            } else {
                throw expectedError('No data provided. Please use the extension to view JSON data.');
            }

            // Apply theme before rendering
            await ThemeManager.applyTheme();

            // Preserve the original JSON data before transformation
            const originalJsonData = jsonData;

            // Extract table data from JSON
            const tableData = JSONDetector.extractTableData(jsonData);

            if (tableData.length === 0) {
                throw expectedError('No suitable table data found in JSON');
            }

            // Clear loading state and create the table interface
            // Pass the original JSON data so it can be shown in JSON view
            container.innerHTML = '';
            UIUtils.createTableInterface(container, tableData, originalJsonData);

        } catch (error) {
            if (!error.expected) {
                console.error('Error loading JSON data:', error);
            }
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
