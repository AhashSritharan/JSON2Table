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
    return this.getSettings().then(settings => {
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

      // Remove existing theme style if present
      const existingStyle = document.getElementById('json2tableTheme');
      if (existingStyle) {
        existingStyle.remove();
      }

      document.head.appendChild(style);
    });
  }

  static getLightThemeCSS() {
    return `
      :root {
        /* Core Colors */
        --primary: #6366f1;
        --primary-light: #e0e7ff;
        --bg: #ffffff;
        --bg-color: #ffffff;
        --header-bg: #f8fafc;
        --border: #e2e8f0;
        --border-color: #e2e8f0;
        --text: #1e293b;
        --text-color: #1e293b;
        --text-secondary: #64748b;
        --muted-text: #64748b;
        --hover-bg: #f1f5f9;
        
        /* UI Elements */
        --button-bg: #ffffff;
        --button-border: #e2e8f0;
        --button-active: #6366f1;
        --expand-bg: #ffffff;
        
        /* Badges & Types */
        --array-badge: #0ea5e9;
        --object-badge: #8b5cf6;
        --null-color: #94a3b8;
        --bool-true: #10b981;
        --bool-false: #ef4444;
        --string-color: #334155;
        --number-color: #f59e0b;
        --date-color: #ec4899;
        
        /* Legacy JSON View Colors */
        --json-string-color: #10b981;
        --json-number-color: #ef4444;
        --json-boolean-color: #8b5cf6;
        --json-null-color: #94a3b8;
        --json-key-color: #0ea5e9;
      }
    `;
  }

  static getDarkThemeCSS() {
    return `
      :root {
        /* Core Colors */
        --primary: #6366f1;
        --primary-light: #312e81;
        --bg: #0f172a;
        --bg-color: #0f172a;
        --header-bg: #1e293b;
        --border: #334155;
        --border-color: #334155;
        --text: #f1f5f9;
        --text-color: #f1f5f9;
        --text-secondary: #94a3b8;
        --muted-text: #94a3b8;
        --hover-bg: #1e293b;
        
        /* UI Elements */
        --button-bg: #1e293b;
        --button-border: #334155;
        --button-active: #6366f1;
        --expand-bg: #0f172a;
        
        /* Badges & Types */
        --array-badge: #0ea5e9;
        --object-badge: #8b5cf6;
        --null-color: #94a3b8;
        --bool-true: #10b981;
        --bool-false: #ef4444;
        --string-color: #e2e8f0;
        --number-color: #f59e0b;
        --date-color: #ec4899;
        
        /* Legacy JSON View Colors */
        --json-string-color: #10b981;
        --json-number-color: #ef4444;
        --json-boolean-color: #8b5cf6;
        --json-null-color: #94a3b8;
        --json-key-color: #0ea5e9;
      }
    `;
  }

  static getSystemThemeCSS() {
    return `
      /* Default to Light Theme */
      :root {
        /* Core Colors */
        --primary: #6366f1;
        --primary-light: #e0e7ff;
        --bg: #ffffff;
        --bg-color: #ffffff;
        --header-bg: #f8fafc;
        --border: #e2e8f0;
        --border-color: #e2e8f0;
        --text: #1e293b;
        --text-color: #1e293b;
        --text-secondary: #64748b;
        --muted-text: #64748b;
        --hover-bg: #f1f5f9;
        
        /* UI Elements */
        --button-bg: #ffffff;
        --button-border: #e2e8f0;
        --button-active: #6366f1;
        --expand-bg: #ffffff;
        
        /* Badges & Types */
        --array-badge: #0ea5e9;
        --object-badge: #8b5cf6;
        --null-color: #94a3b8;
        --bool-true: #10b981;
        --bool-false: #ef4444;
        --string-color: #334155;
        --number-color: #f59e0b;
        --date-color: #ec4899;
        
        /* Legacy JSON View Colors */
        --json-string-color: #10b981;
        --json-number-color: #ef4444;
        --json-boolean-color: #8b5cf6;
        --json-null-color: #94a3b8;
        --json-key-color: #0ea5e9;
      }
      
      @media (prefers-color-scheme: dark) {
        :root {
          /* Core Colors */
          --primary: #6366f1;
          --primary-light: #312e81;
          --bg: #0f172a;
          --bg-color: #0f172a;
          --header-bg: #1e293b;
          --border: #334155;
          --border-color: #334155;
          --text: #f1f5f9;
          --text-color: #f1f5f9;
          --text-secondary: #94a3b8;
          --muted-text: #94a3b8;
          --hover-bg: #1e293b;
          
          /* UI Elements */
          --button-bg: #1e293b;
          --button-border: #334155;
          --button-active: #6366f1;
          --expand-bg: #0f172a;
          
          /* Badges & Types */
          --array-badge: #0ea5e9;
          --object-badge: #8b5cf6;
          --null-color: #94a3b8;
          --bool-true: #10b981;
          --bool-false: #ef4444;
          --string-color: #e2e8f0;
          --number-color: #f59e0b;
          --date-color: #ec4899;
          
          /* Legacy JSON View Colors */
          --json-string-color: #10b981;
          --json-number-color: #ef4444;
          --json-boolean-color: #8b5cf6;
          --json-null-color: #94a3b8;
          --json-key-color: #0ea5e9;
        }
      }
    `;
  }

  // Get colors for JSON syntax highlighting
  static getJsonColor(type) {
    // Check if we're in dark mode
    // Check if we're in dark mode
    const isDarkMode = getComputedStyle(document.documentElement).getPropertyValue('--bg-color').trim() === '#121212' ||
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
