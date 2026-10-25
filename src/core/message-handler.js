/**
 * Messages from the popup: "Detect & Convert" and live settings changes.
 */
class MessageHandler {
  static init() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'detectJson') {
        // An explicit request: convert even with auto-convert off, and even
        // when the JSON sits inside an ordinary page.
        AutoJSONDetector.checkAndConvert(true).then(result => {
          if (result.converted) {
            sendResponse({
              success: true,
              recordCount: Math.round(result.rawLength / 1024) + 'KB',
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
        // Settings are already saved by the popup; apply the visible ones live.
        if (request.csvDelimiter !== undefined && window.tableViewer) {
          window.tableViewer.csvDelimiter = request.csvDelimiter;
        }
        if (request.themeOverride !== undefined) {
          ThemeManager.applyTheme();
        }
        if (request.density !== undefined) {
          ThemeManager.applyDensity(request.density);
        }
        return false;
      }

      return false;
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = MessageHandler;
} else {
  window.MessageHandler = MessageHandler;
}
