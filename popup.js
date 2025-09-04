// Popup functionality for JSON2Table extension
document.addEventListener('DOMContentLoaded', function () {
  const detectBtn = document.getElementById('detectJson');
  const convertBtn = document.getElementById('convertJson');
  const jsonInput = document.getElementById('jsonInput');
  const pasteBtn = document.getElementById('pasteBtn');
  const formatBtn = document.getElementById('formatBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusDiv = document.getElementById('status');
  const autoConvertToggle = document.getElementById('autoConvertToggle');
  const autoExpandToggle = document.getElementById('autoExpandToggle');
  const themeSelect = document.getElementById('themeSelect');
  const csvDelimiterSelect = document.getElementById('csvDelimiterSelect');

  // Load saved settings
  loadSettings();

  // Enable/disable convert button based on input
  jsonInput.addEventListener('input', function () {
    const hasContent = this.value.trim().length > 0;
    convertBtn.disabled = !hasContent;
  });

  // Paste from clipboard
  pasteBtn.addEventListener('click', async function () {
    try {
      const text = await navigator.clipboard.readText();
      jsonInput.value = text;
      convertBtn.disabled = text.trim().length === 0;
      jsonInput.focus();
    } catch (error) {
      showStatus('Could not access clipboard. Please paste manually.', 'error');
    }
  });

  // Clear input
  clearBtn.addEventListener('click', function () {
    jsonInput.value = '';
    convertBtn.disabled = true;
    jsonInput.focus();
  });

  // Format JSON
  formatBtn.addEventListener('click', function () {
    const jsonText = jsonInput.value.trim();
    if (!jsonText) {
      showStatus('Please enter JSON data to format', 'error');
      return;
    }

    const validation = validateJSON(jsonText);
    if (validation.valid) {
      jsonInput.value = JSON.stringify(validation.data, null, 2);
      showStatus('JSON formatted successfully', 'success');
    } else {
      showStatus(`Cannot format - Invalid JSON: ${validation.error}`, 'error');
    }
  });

  // Validate JSON format
  function validateJSON(jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return { valid: true, data: parsed };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  // Check if current tab is a restricted URL where extensions can't run
  function isRestrictedUrl(url) {
    const restrictedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'about:',
      'data:',
      'file://',
      'ftp://'
    ];

    return restrictedPrefixes.some(prefix => url.startsWith(prefix));
  }

  // Get user-friendly error message for restricted URLs
  function getRestrictedUrlMessage(url) {
    if (url.startsWith('chrome://')) {
      return 'Cannot run on Chrome internal pages. Please navigate to a regular website first.';
    } else if (url.startsWith('about:')) {
      return 'Cannot run on browser internal pages. Please navigate to a regular website first.';
    } else if (url.startsWith('file://')) {
      return 'Cannot run on local files. Please navigate to a website or upload the file to a web service.';
    } else if (url.startsWith('chrome-extension://') || url.startsWith('moz-extension://')) {
      return 'Cannot run on extension pages. Please navigate to a regular website first.';
    } else {
      return 'Cannot run on this type of page. Please navigate to a regular website first.';
    }
  }

  // Show status message
  function showStatus(message, type = 'success') {
    statusDiv.textContent = message;
    statusDiv.className = `status ${type}`;
    statusDiv.style.display = 'block';

    setTimeout(() => {
      statusDiv.style.display = 'none';
    }, 3000);
  }
  // Load settings from storage
  function loadSettings() {
    chrome.storage.local.get(['autoConvert', 'autoExpand', 'themeOverride', 'csvDelimiter'], (result) => {
      // Auto-convert toggle (default to true)
      const autoConvert = result.autoConvert !== false;
      autoConvertToggle.classList.toggle('active', autoConvert);

      // Auto-expand toggle (default to true)
      const autoExpand = result.autoExpand !== false;
      autoExpandToggle.classList.toggle('active', autoExpand);

      // Theme selection (default to system)
      const theme = result.themeOverride || 'system';
      themeSelect.value = theme;

      // CSV delimiter selection (detect default if not set)
      if (result.csvDelimiter) {
        csvDelimiterSelect.value = result.csvDelimiter;
      } else {
        // Auto-detect the appropriate delimiter and set it as the default
        const defaultDelimiter = getLikelyCsvDelimiter();
        csvDelimiterSelect.value = defaultDelimiter;
        // Save this default to storage
        chrome.storage.local.set({ csvDelimiter: defaultDelimiter });
      }
    });
  }

  // Function to determine the likely CSV delimiter based on locale
  function getLikelyCsvDelimiter() {
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

  // Save settings to storage
  function saveSettings() {
    const autoConvert = autoConvertToggle.classList.contains('active');
    const autoExpand = autoExpandToggle.classList.contains('active');
    const theme = themeSelect.value;
    const csvDelimiter = csvDelimiterSelect.value;

    chrome.storage.local.set({
      autoConvert: autoConvert,
      autoExpand: autoExpand,
      themeOverride: theme,
      csvDelimiter: csvDelimiter
    }, () => {
      showStatus('Settings saved', 'success');

      // Notify content script of setting changes
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            action: 'settingsChanged',
            autoConvert: autoConvert,
            autoExpand: autoExpand,
            themeOverride: theme,
            csvDelimiter: csvDelimiter
          }).catch(() => {
            // Ignore errors if content script not loaded
          });
        }
      });
    });
  }
  // Auto-convert toggle handler
  autoConvertToggle.addEventListener('click', function () {
    this.classList.toggle('active');
    saveSettings();
  });

  // Auto-expand toggle handler
  autoExpandToggle.addEventListener('click', function () {
    this.classList.toggle('active');
    saveSettings();
  });

  // Theme selection handler
  themeSelect.addEventListener('change', function () {
    saveSettings();
  });

  // CSV delimiter selection handler
  csvDelimiterSelect.addEventListener('change', function () {
    saveSettings();
  });

  // Convert manual JSON input
  convertBtn.addEventListener('click', async function () {
    const jsonText = jsonInput.value.trim();

    if (!jsonText) {
      showStatus('Please enter some JSON data', 'error');
      return;
    }

    // Validate JSON
    const validation = validateJSON(jsonText);
    if (!validation.valid) {
      showStatus(`Invalid JSON: ${validation.error}`, 'error');
      return;
    }

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a restricted URL where content scripts can't run
      if (isRestrictedUrl(tab.url)) {
        showStatus(getRestrictedUrlMessage(tab.url), 'error');
        return;
      }

      console.log('Sending convertManualJson message with data:', validation.data);

      // Send the parsed JSON data to content script
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'convertManualJson',
        jsonData: validation.data,
        jsonText: jsonText
      });

      console.log('Received response:', result);

      if (result.success) {
        showStatus('JSON converted to table successfully!', 'success');
        jsonInput.value = ''; // Clear the input
        convertBtn.disabled = true;
        window.close();
      } else {
        showStatus(result.error || 'Failed to convert JSON', 'error');
        console.error('Conversion failed:', result.error);
      }
    } catch (error) {
      // This catch block now handles genuine errors, not just restricted URLs
      showStatus('Unable to connect to page - please try refreshing and try again', 'error');
      console.error('Conversion error:', error);
    }
  });// Detect and convert JSON on current page
  detectBtn.addEventListener('click', async function () {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      // Check if we're on a restricted URL where content scripts can't run
      if (isRestrictedUrl(tab.url)) {
        showStatus(getRestrictedUrlMessage(tab.url), 'error');
        return;
      }

      // Use the working auto-convert logic for manual detection
      const result = await chrome.tabs.sendMessage(tab.id, {
        action: 'detectJson'
      });

      if (result.success) {
        showStatus(`JSON converted to table (${result.recordCount})`, 'success');
        window.close();
      } else {
        showStatus(result.note || result.error || 'No JSON data detected', 'error');
      }
    } catch (error) {
      showStatus('Unable to connect to page - please try refreshing and try again', 'error');
      console.error('Detection error:', error);
    }
  });
});
