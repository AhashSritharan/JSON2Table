/**
 * Message handler for communication with popup and background scripts
 */
class MessageHandler {
  static init() {
    // Message listener for communication with popup
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'detectJson') {
        // Use forced conversion for manual detection (bypass auto-convert setting)
        AutoJSONDetector.checkAndConvert(true).then(result => {
          if (result.converted) {
            sendResponse({
              success: true,
              recordCount: result.rawLength ? Math.round(result.rawLength / 1024) + 'KB' : 'Unknown size',
              converted: true
            });
          } else {
            sendResponse({ success: false, note: result.note || 'No suitable JSON found' });
          }
        }).catch(error => {
          console.error('JSON detection error:', error);
          sendResponse({ success: false, error: error.message });
        });

        return true; // Will respond asynchronously
      }

      if (request.action === 'settingsChanged') {
        // Handle settings changes from popup
        // Settings are automatically saved to chrome.storage by popup.js

        // If there's an active table viewer, update its CSV delimiter if needed
        if (request.csvDelimiter !== undefined && window.tableViewer) {
          window.tableViewer.csvDelimiter = request.csvDelimiter;
        }

        // No response needed
        return false;
      }

      if (request.action === 'convertManualJson') {
        // Handle manual JSON conversion from popup
        try {
          const jsonData = request.jsonData;

          console.log('Received manual JSON conversion request', jsonData);
          console.log('window.showTableViewer available:', !!window.showTableViewer);

          // Process the JSON data the same way as auto-detection
          const tableData = JSONDetector.extractTableData(jsonData);

          console.log('Extracted table data:', tableData);

          if (!tableData || !Array.isArray(tableData) || tableData.length === 0) {
            sendResponse({ success: false, error: 'No suitable table data found in JSON' });
            return true;
          }

          // Verify the table data contains objects
          if (!tableData.some(item => item && typeof item === 'object' && !Array.isArray(item))) {
            sendResponse({ success: false, error: 'Table data must contain objects' });
            return true;
          }

          // Use the showTableViewer function from content-main.js
          if (window.showTableViewer) {
            window.showTableViewer(tableData);
            console.log('Successfully called showTableViewer with processed data');
            sendResponse({ success: true });
          } else {
            console.error('showTableViewer function not available on window object');
            sendResponse({ success: false, error: 'Table viewer not available - content script may not be loaded' });
          }
        } catch (error) {
          console.error('Manual JSON conversion error:', error);
          sendResponse({ success: false, error: error.message });
        }

        return true; // Will respond asynchronously
      }

      if (request.action === 'detectJSON') {
        // Use the same successful auto-convert logic
        AutoJSONDetector.checkAndConvert().then(result => {
          sendResponse({ hasData: result.converted, result: result });
        }).catch(error => {
          sendResponse({ hasData: false, error: error.message });
        });
        return true;
      } else if (request.action === 'showTable') {
        // Use the same successful auto-convert logic
        AutoJSONDetector.checkAndConvert().then(result => {
          if (result.converted) {
            sendResponse({ success: true });
          } else {
            sendResponse({ success: false, message: result.note || 'No suitable table data found' });
          }
        }).catch(error => {
          sendResponse({ success: false, message: error.message });
        });
        return true;
      } else if (request.action === 'autoConvert') {
        AutoJSONDetector.checkAndConvert().then(result => {
          sendResponse(result);
        });
        return true; // Will respond asynchronously
      }
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessageHandler;
} else {
  window.MessageHandler = MessageHandler;
}
