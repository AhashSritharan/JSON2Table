# JSON2Table - Auto-Conversion Features

## 🔄 Automatic JSON Detection & Conversion

JSON2Table now includes sophisticated automatic detection that seamlessly converts JSON pages without user intervention, inspired by the proven json-formatter extension methodology.

### 🎯 Detection Algorithm

The auto-detection system uses a multi-step validation process:

#### 1. Page Structure Analysis
```javascript
// Searches for body > pre elements (standard for JSON responses)
const originalPreElement = (() => {
  const bodyChildren = document.body.children;
  for (let i = 0; i < length; i++) {
    const child = bodyChildren[i];
    if (child.tagName === 'PRE') return child;
  }
  return null;
})();
```

#### 2. Content Validation
- **Size Limits**: Maximum 3MB (3,000,000 characters) for performance
- **Syntax Check**: Must start with `{` or `[` (ignoring whitespace)
- **Parse Verification**: Valid JSON.parse() without errors
- **Structure Requirements**: Must be object or array (not primitive values)

#### 3. Table Suitability Check
- Arrays must contain objects for table conversion
- Objects must have array properties with object items
- Minimum viable data structure validation

### 🎨 Theming System

#### Theme Options
1. **System** (Default): Follows OS dark/light mode preference
2. **Force Light**: Always use light theme
3. **Force Dark**: Always use dark theme

#### CSS Variable Architecture
```css
:root {
  --bg-color: #ffffff;          /* Background color */
  --text-color: #333333;        /* Primary text */
  --border-color: #e1e5e9;      /* Borders and lines */
  --header-bg: #f8f9fa;         /* Table headers */
  --hover-bg: #f5f5f5;          /* Row hover state */
  --button-bg: #ffffff;         /* Button backgrounds */
  --button-border: #dee2e6;     /* Button borders */
  --button-active: #007bff;     /* Active button state */
  --expand-bg: #e3f2fd;         /* Expanded row background */
  --array-badge: #9c27b0;       /* Array badge color */
  --object-badge: #2196f3;      /* Object badge color */
}
```

#### Dynamic Theme Application
```css
/* System theme with dark mode support */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-color: #1a1a1a;
    --text-color: #eeeeee;
    /* ... dark theme variables */
  }
}
```

### 🔧 Toggle Controls

#### Raw/Table View Toggle
- **Fixed Position**: Top-right corner with high z-index
- **Instant Switching**: No reload required
- **Visual Feedback**: Active state highlighting
- **Keyboard Accessible**: Proper focus management

#### Control Implementation
```javascript
// Toggle between table and raw JSON view
buttonRaw.addEventListener('click', () => {
  tableContainer.hidden = true;
  rawJsonContainer.hidden = false;
  // Update button states
});
```

## ⚙️ Settings & Configuration

### 🔄 Auto-Convert Toggle
**Location**: Extension popup → Settings section  
**Default**: Enabled (true)  
**Behavior**: When enabled, automatically converts JSON pages on load

#### Storage Implementation
```javascript
// Save settings to Chrome storage
chrome.storage.local.set({
  autoConvert: true,
  themeOverride: 'system'
});

// Settings sync across tabs
chrome.tabs.sendMessage(tabId, { 
  action: 'settingsChanged',
  autoConvert: enabled,
  themeOverride: theme
});
```

### 🎨 Theme Selection
**Options**: System, Light, Dark  
**Storage**: Persistent across browser sessions  
**Application**: Immediate effect on active tables

### 📱 Settings UI
- **Toggle Switch**: Visual on/off switch for auto-convert
- **Dropdown Menu**: Theme selection with three options
- **Live Updates**: Settings apply immediately without reload
- **Status Feedback**: Success notifications for setting changes

## 🚀 Performance Optimizations

### ⚡ Detection Performance
- **Content Length Check**: Early exit for oversized content
- **Regex Validation**: Fast syntax checking before parsing
- **Parse Error Handling**: Graceful fallback without page disruption
- **DOM Manipulation**: Minimal DOM changes during conversion

### 🎯 Conversion Performance  
- **Container Reuse**: Efficient DOM element management
- **Theme Caching**: CSS injection optimization
- **Event Delegation**: Single event handler for toggle controls
- **Memory Management**: Cleanup of original pre elements

### 📊 Table Performance
- **Virtual Scrolling**: Handle 50,000+ rows smoothly
- **Render Caching**: LRU cache for repeated row rendering
- **Dynamic Heights**: Efficient calculation for expanded content
- **Search Optimization**: JSON.stringify-based fast filtering

## 🔍 Integration Benefits

### 🔄 Seamless User Experience
- **Zero Configuration**: Works out of the box with sensible defaults
- **Non-Intrusive**: Only activates on suitable JSON content
- **Fallback Support**: Manual conversion for edge cases
- **Visual Consistency**: Matches system theme preferences

### 🛠️ Developer Benefits
- **API Testing**: Instant table view for API responses
- **JSON Debugging**: Easy exploration of complex nested data
- **Data Analysis**: Quick insights into JSON structure and content
- **Export Capabilities**: CSV export for further analysis

### 🌐 Browser Integration
- **All URLs Support**: Works on any domain or local files
- **Security Conscious**: Minimal permissions, local processing
- **Standards Compliant**: Uses modern web APIs and CSS features
- **Cross-Platform**: Consistent behavior across operating systems

## 📈 Usage Analytics

### 🎯 Optimal Use Cases
1. **API Development**: Testing REST endpoints with JSON responses
2. **Data Analysis**: Exploring large JSON datasets 
3. **Configuration Files**: Viewing complex JSON configurations
4. **Log Analysis**: Structured log file examination
5. **Documentation**: JSON schema exploration

### ⚠️ Limitations
- **File Size**: 3MB limit for performance (configurable)
- **Structure Requirements**: Must be objects/arrays for table conversion
- **Browser Specific**: Chrome extension only
- **Local Processing**: No server-side processing capabilities

## 🔮 Future Enhancements

### Planned Features
- **Custom Size Limits**: User-configurable file size limits
- **Export Formats**: JSON, Excel, and PDF export options
- **Search Persistence**: Remember search terms across sessions
- **Column Customization**: Hide/show/reorder columns
- **Filter Presets**: Save common filter configurations

### Performance Improvements
- **Worker Threads**: Background processing for large files
- **Progressive Loading**: Chunk-based loading for massive datasets
- **Cache Optimization**: Intelligent cache warming strategies
- **Memory Profiling**: Advanced memory usage optimization
