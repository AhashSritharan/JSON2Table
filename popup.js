// Popup functionality for JSON2Table extension
document.addEventListener('DOMContentLoaded', function() {
  const detectBtn = document.getElementById('detectJson');
  const viewerBtn = document.getElementById('openViewer');
  const statusDiv = document.getElementById('status');
  const autoConvertToggle = document.getElementById('autoConvertToggle');
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
    chrome.storage.local.get(['autoConvert', 'themeOverride'], (result) => {
      // Auto-convert toggle (default to true)
      const autoConvert = result.autoConvert !== false;
      autoConvertToggle.classList.toggle('active', autoConvert);
      
      // Theme selection (default to system)
      const theme = result.themeOverride || 'system';
      themeSelect.value = theme;
    });
  }

  // Save settings to storage
  function saveSettings() {
    const autoConvert = autoConvertToggle.classList.contains('active');
    const theme = themeSelect.value;
    
    chrome.storage.local.set({
      autoConvert: autoConvert,
      themeOverride: theme
    }, () => {
      showStatus('Settings saved', 'success');
      
      // Notify content script of setting changes
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, { 
            action: 'settingsChanged',
            autoConvert: autoConvert,
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

  // Theme selection handler
  themeSelect.addEventListener('change', function() {
    saveSettings();
  });

  // Detect and convert JSON on current page
  detectBtn.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Try automatic detection first
      const autoResult = await chrome.tabs.sendMessage(tab.id, { 
        action: 'autoConvert' 
      });
      
      if (autoResult.converted) {
        showStatus(`Auto-converted JSON (${Math.round(autoResult.rawLength/1024)}KB)`, 'success');
        window.close();
        return;
      }
      
      // Fall back to manual detection
      const result = await chrome.tabs.sendMessage(tab.id, { 
        action: 'detectJSON' 
      });
      
      if (result.hasData) {
        const showResult = await chrome.tabs.sendMessage(tab.id, { 
          action: 'showTable' 
        });
        
        if (showResult.success) {
          showStatus('JSON converted to table', 'success');
          window.close();
        } else {
          showStatus(showResult.message || 'Error showing table', 'error');
        }
      } else {
        showStatus(autoResult.note || 'No JSON data detected', 'error');
      }
    } catch (error) {
      showStatus('Error detecting JSON', 'error');
      console.error('Detection error:', error);
    }
  });

  // Open table viewer (for pages already converted)
  viewerBtn.addEventListener('click', async function() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'showViewer' 
      });
      
      window.close();
    } catch (error) {
      showStatus('Error opening viewer', 'error');
      console.error('Viewer error:', error);
    }
  });
});
