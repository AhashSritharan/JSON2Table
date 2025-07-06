// Popup functionality for JSON2Table extension
document.addEventListener('DOMContentLoaded', function() {  const detectBtn = document.getElementById('detectJson');
  const statusDiv = document.getElementById('status');
  const autoConvertToggle = document.getElementById('autoConvertToggle');
  const autoExpandToggle = document.getElementById('autoExpandToggle');
  const themeSelect = document.getElementById('themeSelect');

  // Load saved settings
  loadSettings();

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
    chrome.storage.local.get(['autoConvert', 'autoExpand', 'themeOverride'], (result) => {
      // Auto-convert toggle (default to true)
      const autoConvert = result.autoConvert !== false;
      autoConvertToggle.classList.toggle('active', autoConvert);
      
      // Auto-expand toggle (default to true)
      const autoExpand = result.autoExpand !== false;
      autoExpandToggle.classList.toggle('active', autoExpand);
      
      // Theme selection (default to system)
      const theme = result.themeOverride || 'system';
      themeSelect.value = theme;
    });
  }
  // Save settings to storage
  function saveSettings() {
    const autoConvert = autoConvertToggle.classList.contains('active');
    const autoExpand = autoExpandToggle.classList.contains('active');
    const theme = themeSelect.value;
    
    chrome.storage.local.set({
      autoConvert: autoConvert,
      autoExpand: autoExpand,
      themeOverride: theme
    }, () => {
      showStatus('Settings saved', 'success');
      
      // Notify content script of setting changes
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'settingsChanged',
            autoConvert: autoConvert,
            autoExpand: autoExpand,
            themeOverride: theme
          }).catch(() => {
            // Ignore errors if content script not loaded
          });
        }
      });
    });
  }
  // Auto-convert toggle handler
  autoConvertToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    saveSettings();
  });

  // Auto-expand toggle handler
  autoExpandToggle.addEventListener('click', function() {
    this.classList.toggle('active');
    saveSettings();
  });

  // Theme selection handler
  themeSelect.addEventListener('change', function() {
    saveSettings();
  });// Detect and convert JSON on current page
  detectBtn.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
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
      showStatus('Error detecting JSON', 'error');
      console.error('Detection error:', error);
    }
  });
});
