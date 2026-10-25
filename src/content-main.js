/**
 * Content script entry point: converts the page if it is JSON, and listens
 * for the popup.
 */
(function () {
  'use strict';

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => AutoJSONDetector.checkAndConvert(), 100);
    });
  } else {
    setTimeout(() => AutoJSONDetector.checkAndConvert(), 100);
  }

  MessageHandler.init();
})();
