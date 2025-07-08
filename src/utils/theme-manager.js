/**
 * Theme management utilities
 */
class ThemeManager {
  static async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['autoConvert', 'autoExpand', 'themeOverride'], (result) => {
        resolve({
          autoConvert: result.autoConvert !== false, // Default to true
          autoExpand: result.autoExpand !== false, // Default to true
          themeOverride: result.themeOverride || 'system'
        });
      });
    });
  }

  static applyTheme() {
    // Add CSS variables for theming
    const style = document.createElement('style');
    style.id = 'json2tableTheme';
    
    // Get theme preference
    this.getSettings().then(settings => {
      let themeCSS = '';
      
      switch (settings.themeOverride) {
        case 'force_light':
          themeCSS = this.getLightThemeCSS();
          break;
        case 'force_dark':
          themeCSS = this.getDarkThemeCSS();
          break;
        case 'system':
        default:
          themeCSS = this.getSystemThemeCSS();
      }
      
      style.textContent = themeCSS;
    });
    
    document.head.appendChild(style);
  }

  static getLightThemeCSS() {
    return `
      :root {
        --bg-color: #ffffff;
        --text-color: #212121;
        --border-color: #e0e0e0;
        --header-bg: #f5f5f5;
        --hover-bg: #f5f5f5;
        --button-bg: #ffffff;
        --button-border: #e0e0e0;
        --button-active: #2196f3;
        --expand-bg: #ffffff;
        --array-badge: #9c27b0;
        --object-badge: #2196f3;
        --muted-text: #757575;
        --json-string-color: #4caf50;
        --json-number-color: #ff5252;
        --json-boolean-color: #9c27b0;
        --json-null-color: #757575;
        --json-key-color: #2196f3;
      }
    `;
  }

  static getDarkThemeCSS() {
    return `
      :root {
        --bg-color: #121212;
        --text-color: #e0e0e0;
        --border-color: #444444;
        --header-bg: #1e1e1e;
        --hover-bg: #2c2c2c;
        --button-bg: #1e1e1e;
        --button-border: #444444;
        --button-active: #2196f3;
        --expand-bg: #121212;
        --array-badge: #9c27b0;
        --object-badge: #2196f3;
        --muted-text: #b0b0b0;
        --json-string-color: #4caf50;
        --json-number-color: #ff5252;
        --json-boolean-color: #9c27b0;
        --json-null-color: #b0b0b0;
        --json-key-color: #2196f3;
      }
    `;
  }

  static getSystemThemeCSS() {
    return `
      :root {
        --bg-color: #ffffff;
        --text-color: #212121;
        --border-color: #e0e0e0;
        --header-bg: #f5f5f5;
        --hover-bg: #f5f5f5;
        --button-bg: #ffffff;
        --button-border: #e0e0e0;
        --button-active: #2196f3;
        --expand-bg: #ffffff;
        --array-badge: #9c27b0;
        --object-badge: #2196f3;
        --muted-text: #757575;
        --json-string-color: #4caf50;
        --json-number-color: #ff5252;
        --json-boolean-color: #9c27b0;
        --json-null-color: #757575;
        --json-key-color: #2196f3;
      }
      
      @media (prefers-color-scheme: dark) {
        :root {
          --bg-color: #121212;
          --text-color: #e0e0e0;
          --border-color: #444444;
          --header-bg: #1e1e1e;
          --hover-bg: #2c2c2c;
          --button-bg: #1e1e1e;
          --button-border: #444444;
          --button-active: #2196f3;
          --expand-bg: #121212;
          --array-badge: #9c27b0;
          --object-badge: #2196f3;
          --muted-text: #b0b0b0;
          --json-string-color: #4caf50;
          --json-number-color: #ff5252;
          --json-boolean-color: #9c27b0;
          --json-null-color: #b0b0b0;
          --json-key-color: #2196f3;
        }
      }
    `;
  }

  // Get colors for JSON syntax highlighting
  static getJsonColor(type) {
    // Check if we're in dark mode
    const isDarkMode = document.documentElement.style.getPropertyValue('--bg-color') === '#121212' ||
                      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    const lightColors = {
      string: '#4caf50',   // Material Green
      number: '#ff5252',   // Material Red
      boolean: '#9c27b0',  // Material Purple
      null: '#757575',     // Material secondary text
      key: '#2196f3'       // Material Blue
    };
    
    const darkColors = {
      string: '#4caf50',   // Material Green (consistent across themes)
      number: '#ff5252',   // Material Red (consistent across themes)
      boolean: '#9c27b0',  // Material Purple (consistent across themes)
      null: '#b0b0b0',     // Material secondary text on dark
      key: '#2196f3'       // Material Blue (consistent across themes)
    };
    
    const colors = isDarkMode ? darkColors : lightColors;
    return colors[type] || (isDarkMode ? '#e0e0e0' : '#212121');
  }

  // Syntax highlighting for JSON
  static syntaxHighlightJson(json) {
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span style="color: ' + ThemeManager.getJsonColor(cls) + '">' + match + '</span>';
    });
  }

  // Copy JSON to clipboard
  static copyJsonToClipboard() {
    if (window.currentJsonData) {
      navigator.clipboard.writeText(window.currentJsonData).then(() => {
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#10b981';
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.background = 'var(--button-active)';
        }, 2000);
      }).catch(err => {
        console.error('Failed to copy: ', err);
      });
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
} else {
  window.ThemeManager = ThemeManager;
}
