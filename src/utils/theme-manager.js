/**
 * Theme management utilities
 *
 * Design tokens live in ONE place (buildTokens) and are emitted for light, dark
 * and system modes. Colors are chosen to clear WCAG AA (4.5:1) against the
 * surface they actually sit on -- badge foregrounds are measured against their
 * own tinted background, not against the page background.
 */
class ThemeManager {
  static async getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['autoConvert', 'autoExpand', 'themeOverride', 'density'], (result) => {
        resolve({
          autoConvert: result.autoConvert !== false, // Default to true
          autoExpand: result.autoExpand !== false, // Default to true
          themeOverride: result.themeOverride || 'system',
          density: result.density || 'comfortable'
        });
      });
    });
  }

  static applyTheme() {
    const style = document.createElement('style');
    style.id = 'json2tableTheme';

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

      const existingStyle = document.getElementById('json2tableTheme');
      if (existingStyle) {
        existingStyle.remove();
      }

      document.head.appendChild(style);

      // Density is a document-level class so a toggle can flip it without
      // re-emitting the whole theme.
      this.applyDensity(settings.density);
    });
  }

  static applyDensity(density) {
    const root = document.documentElement;
    root.classList.remove('j2t-compact', 'j2t-comfortable');
    root.classList.add(density === 'compact' ? 'j2t-compact' : 'j2t-comfortable');
  }

  /**
   * The single source of truth for every color token.
   * @param {'light'|'dark'} mode
   */
  static buildTokens(mode) {
    const light = {
      /* Core */
      'primary': '#4f46e5',
      'primary-light': '#e0e7ff',
      'primary-contrast': '#ffffff',
      'bg': '#ffffff',
      'bg-color': '#ffffff',
      'surface-raised': '#f8fafc',
      'header-bg': '#f8fafc',
      'border': '#e2e8f0',
      'border-color': '#e2e8f0',
      'border-strong': '#cbd5e1',
      'text': '#1e293b',
      'text-color': '#1e293b',
      'text-secondary': '#475569',
      'muted-text': '#475569',
      'hover-bg': '#f1f5f9',
      'selected-bg': '#eef2ff',
      'focus-ring': '#4f46e5',

      /* Tree depth guides */
      'guide': '#dbe2ea',
      'guide-active': '#a5b4fc',

      /* UI Elements */
      'button-bg': '#ffffff',
      'button-border': '#cbd5e1',
      'button-active': '#4f46e5',
      'expand-bg': '#ffffff',

      /* Badges: fg measured against the 10% tint it sits on */
      'array-badge': '#0369a1',        /* 5.9:1 on white, 5.2:1 on tint */
      'array-badge-bg': 'rgba(3, 105, 161, 0.10)',
      'array-badge-border': 'rgba(3, 105, 161, 0.22)',
      'object-badge': '#6d28d9',       /* 7.1:1 on white, 6.2:1 on tint */
      'object-badge-bg': 'rgba(109, 40, 217, 0.10)',
      'object-badge-border': 'rgba(109, 40, 217, 0.22)',

      /* Value types. Strings deliberately inherit --text: coloring the most
         common type spends the signal on the default case. */
      'null-color': '#64748b',         /* 4.8:1 */
      'bool-true': '#047857',          /* 5.6:1 */
      'bool-false': '#b91c1c',         /* 6.5:1 */
      'string-color': '#1e293b',
      'number-color': '#b45309',       /* 5.0:1 */
      'date-color': '#be185d',         /* 6.0:1 */

      /* JSON syntax view */
      'json-string-color': '#047857',
      'json-number-color': '#b45309',
      'json-boolean-color': '#6d28d9',
      'json-null-color': '#64748b',
      'json-key-color': '#0369a1',

      /* Feedback */
      'success': '#047857',
      'error': '#b91c1c',
      'warning': '#b45309',
      'mark-bg': '#fde68a',
      'mark-fg': '#713f12',
      'mark-current-bg': '#f59e0b',
      'mark-current-fg': '#1c1917',
      'shadow-sm': '0 1px 2px rgba(15, 23, 42, 0.06)',
      'shadow-md': '0 4px 12px rgba(15, 23, 42, 0.10)',
      'shadow-lg': '0 12px 28px rgba(15, 23, 42, 0.16)'
    };

    const dark = {
      /* Core */
      'primary': '#818cf8',
      'primary-light': '#312e81',
      'primary-contrast': '#0f172a',
      'bg': '#0f172a',
      'bg-color': '#0f172a',
      'surface-raised': '#1e293b',
      'header-bg': '#1e293b',
      'border': '#334155',
      'border-color': '#334155',
      'border-strong': '#475569',
      'text': '#f1f5f9',
      'text-color': '#f1f5f9',
      'text-secondary': '#a8b6c8',
      'muted-text': '#a8b6c8',
      'hover-bg': '#1e293b',
      'selected-bg': '#1e2a4a',
      'focus-ring': '#818cf8',

      /* Tree depth guides */
      'guide': '#2b3a4f',
      'guide-active': '#4f46e5',

      /* UI Elements */
      'button-bg': '#1e293b',
      'button-border': '#475569',
      'button-active': '#6366f1',
      'expand-bg': '#0f172a',

      /* Badges */
      'array-badge': '#7dd3fc',        /* 10.8:1 on --bg */
      'array-badge-bg': 'rgba(125, 211, 252, 0.12)',
      'array-badge-border': 'rgba(125, 211, 252, 0.28)',
      'object-badge': '#c4b5fd',       /* 9.7:1 on --bg */
      'object-badge-bg': 'rgba(196, 181, 253, 0.12)',
      'object-badge-border': 'rgba(196, 181, 253, 0.28)',

      /* Value types */
      'null-color': '#94a3b8',         /* 7.0:1 */
      'bool-true': '#34d399',
      'bool-false': '#fca5a5',
      'string-color': '#f1f5f9',
      'number-color': '#fbbf24',
      'date-color': '#f9a8d4',

      /* JSON syntax view */
      'json-string-color': '#34d399',
      'json-number-color': '#fbbf24',
      'json-boolean-color': '#c4b5fd',
      'json-null-color': '#94a3b8',
      'json-key-color': '#7dd3fc',

      /* Feedback */
      'success': '#34d399',
      'error': '#fca5a5',
      'warning': '#fbbf24',
      'mark-bg': '#78350f',
      'mark-fg': '#fef3c7',
      'mark-current-bg': '#f59e0b',
      'mark-current-fg': '#1c1917',
      'shadow-sm': '0 1px 2px rgba(0, 0, 0, 0.4)',
      'shadow-md': '0 4px 12px rgba(0, 0, 0, 0.5)',
      'shadow-lg': '0 12px 28px rgba(0, 0, 0, 0.6)'
    };

    const tokens = mode === 'dark' ? dark : light;
    return Object.entries(tokens)
      .map(([key, value]) => `          --${key}: ${value};`)
      .join('\n');
  }

  /** Density tokens are mode-independent. */
  static getDensityCSS() {
    return `
      :root {
        --row-py: 9px;
        --row-px: 14px;
        --tree-indent: 18px;
        --font-size: 13px;
        --line-height: 1.45;
        --badge-py: 1px;
      }

      :root.j2t-compact {
        --row-py: 4px;
        --row-px: 10px;
        --tree-indent: 15px;
        --font-size: 12px;
        --line-height: 1.35;
        --badge-py: 0px;
      }
    `;
  }

  static getLightThemeCSS() {
    return `
      :root {
${this.buildTokens('light')}
        color-scheme: light;
      }
      ${this.getDensityCSS()}
    `;
  }

  static getDarkThemeCSS() {
    return `
      :root {
${this.buildTokens('dark')}
        color-scheme: dark;
      }
      ${this.getDensityCSS()}
    `;
  }

  static getSystemThemeCSS() {
    return `
      :root {
${this.buildTokens('light')}
        color-scheme: light dark;
      }

      @media (prefers-color-scheme: dark) {
        :root {
${this.buildTokens('dark')}
        }
      }
      ${this.getDensityCSS()}
    `;
  }

  /**
   * Syntax highlighting for JSON.
   *
   * Emits classes rather than inline colors resolved at call time. The old
   * implementation sniffed the theme by comparing --bg-color to a hard-coded
   * '#121212' that no theme ever set, so "force dark" on a light OS rendered
   * light syntax colors on a dark background. Classes + CSS variables make
   * that failure mode impossible.
   */
  static syntaxHighlightJson(json) {
    json = String(json).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      function (match) {
        let cls = 'number';
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? 'key' : 'string';
        } else if (/true|false/.test(match)) {
          cls = 'boolean';
        } else if (/null/.test(match)) {
          cls = 'null';
        }
        return `<span class="j2t-json-${cls}">${match}</span>`;
      }
    );
  }

  /**
   * Highlighted JSON with collapsible objects and arrays. Expects the output of
   * JSON.stringify(data, null, 2), where every non-empty container opens at the
   * end of a line and closes on a line of its own -- brackets inside strings
   * can never land in either position, so a line scan is reliable.
   *
   * The toggle glyph and the collapsed summary come from CSS (::before), so
   * selecting and copying the text yields plain JSON.
   */
  static foldableJsonHtml(json) {
    const lines = this.syntaxHighlightJson(json).split('\n');
    const root = { parts: [], count: 0 };
    const stack = [root];

    lines.forEach((line, i) => {
      const nl = i === 0 ? '' : '\n';
      const indentLen = line.length - line.trimStart().length;
      const indent = line.slice(0, indentLen);
      const content = line.slice(indentLen);

      if (stack.length > 1 && /^[\]}],?$/.test(content)) {
        const frame = stack.pop();
        const noun = frame.isArray
          ? (frame.count === 1 ? 'item' : 'items')
          : (frame.count === 1 ? 'property' : 'properties');
        stack[stack.length - 1].parts.push(
          frame.head,
          `<span class="j2t-fold-body">${frame.parts.join('')}\n${indent}</span>`,
          `<span class="j2t-fold-summary" data-summary="${frame.count} ${noun}" title="Expand"></span>`,
          `${content}</span>`
        );
        return;
      }

      const top = stack[stack.length - 1];
      top.count++;

      if (/[\[{]$/.test(content)) {
        stack.push({
          head: `${nl}${indent}<span class="j2t-fold"><button type="button" class="j2t-fold-toggle" aria-expanded="true" aria-label="Collapse"></button>${content}`,
          isArray: content.endsWith('['),
          parts: [],
          count: 0
        });
        return;
      }

      top.parts.push(nl + line);
    });

    // Malformed input (should not happen): flush any unclosed blocks as-is.
    while (stack.length > 1) {
      const frame = stack.pop();
      stack[stack.length - 1].parts.push(frame.head, ...frame.parts, '</span>');
    }

    return root.parts.join('');
  }

  /** Wire fold toggles inside a rendered JSON view. Alt+click applies to all nested blocks. */
  static wireJsonFolding(pre) {
    pre.addEventListener('click', (e) => {
      const trigger = e.target.closest('.j2t-fold-toggle, .j2t-fold-summary');
      if (!trigger || !pre.contains(trigger)) return;
      const fold = trigger.parentElement;
      const collapse = !fold.classList.contains('is-collapsed');
      const targets = e.altKey ? [fold, ...fold.querySelectorAll('.j2t-fold')] : [fold];
      targets.forEach(el => this.setFoldState(el, collapse));
    });
  }

  static setFoldState(fold, collapsed) {
    fold.classList.toggle('is-collapsed', collapsed);
    const toggle = fold.querySelector(':scope > .j2t-fold-toggle');
    if (toggle) {
      toggle.setAttribute('aria-expanded', String(!collapsed));
      toggle.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
    }
  }

  /** Collapse or expand every block; collapsing keeps the root open so the top level stays visible. */
  static setAllFolds(pre, collapsed) {
    pre.querySelectorAll('.j2t-fold').forEach((fold, i) => {
      this.setFoldState(fold, collapsed && i > 0);
    });
  }

  static getJsonViewStyles() {
    return `
      .j2t-fold-toggle {
        display: inline-block;
        width: 1.2em;
        margin-left: -1.2em;
        padding: 0;
        border: 0;
        background: none;
        color: var(--null-color);
        font: inherit;
        line-height: inherit;
        text-align: center;
        cursor: pointer;
        user-select: none;
      }
      .j2t-fold-toggle::before {
        content: '▾';
        display: inline-block;
        transition: transform 0.12s ease;
      }
      .j2t-fold.is-collapsed > .j2t-fold-toggle::before { transform: rotate(-90deg); }
      .j2t-fold-toggle:hover { color: var(--text); }
      .j2t-fold-toggle:focus-visible { outline: 2px solid currentColor; border-radius: 3px; }

      .j2t-fold.is-collapsed > .j2t-fold-body { display: none; }
      .j2t-fold:not(.is-collapsed) > .j2t-fold-summary { display: none; }
      .j2t-fold-summary {
        margin: 0 3px;
        padding: 0 6px;
        border-radius: 4px;
        background: var(--hover-bg);
        color: var(--null-color);
        font-style: italic;
        cursor: pointer;
        user-select: none;
      }
      .j2t-fold-summary::before { content: attr(data-summary); }
      .j2t-fold-summary:hover { color: var(--text); }

      .j2t-json-string  { color: var(--json-string-color); }
      .j2t-json-number  { color: var(--json-number-color); }
      .j2t-json-boolean { color: var(--json-boolean-color); }
      .j2t-json-null    { color: var(--json-null-color); }
      .j2t-json-key     { color: var(--json-key-color); font-weight: 600; }
    `;
  }

  static copyJsonToClipboard(triggerButton) {
    if (!window.currentJsonData) return;

    navigator.clipboard.writeText(window.currentJsonData).then(() => {
      const btn = triggerButton;
      if (!btn) return;
      const originalText = btn.textContent;
      btn.textContent = 'Copied!';
      btn.classList.add('is-success');
      setTimeout(() => {
        btn.textContent = originalText;
        btn.classList.remove('is-success');
      }, 2000);
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ThemeManager;
} else {
  window.ThemeManager = ThemeManager;
}
