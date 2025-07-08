# JSON2Table - Modular Structure

This project has been refactored from a single large `content.js` file into a modular structure following best practices.

## File Structure

```
src/
├── components/
│   └── table-viewer.js          # TableViewer class - handles table rendering and interactions
├── core/
│   ├── auto-json-detector.js    # AutoJSONDetector class - handles automatic JSON detection
│   └── message-handler.js       # MessageHandler class - handles communication with popup
├── utils/
│   ├── data-flattener.js        # DataFlattener class - data preparation utilities
│   ├── json-detector.js         # JSONDetector class - JSON detection and validation
│   ├── style-manager.js         # StyleManager class - CSS styles management
│   ├── theme-manager.js         # ThemeManager class - theme and settings management
│   └── ui-utils.js              # UIUtils class - UI utility functions
└── content-main.js              # Main coordinator script
```

## Module Dependencies

The modules are loaded in this order in `manifest.json`:

1. **Utils** (no dependencies):
   - `json-detector.js` - Core JSON detection logic
   - `data-flattener.js` - Data preparation utilities
   - `theme-manager.js` - Theme and settings management
   - `style-manager.js` - CSS styles management
   - `ui-utils.js` - UI utilities

2. **Components** (depends on utils):
   - `table-viewer.js` - Main table component

3. **Core** (depends on utils and components):
   - `auto-json-detector.js` - Automatic detection logic
   - `message-handler.js` - Message handling

4. **Main** (coordinates everything):
   - `content-main.js` - Main application coordinator

## Benefits of This Structure

### 1. **Separation of Concerns**
- **Utils**: Pure utility functions with no dependencies
- **Components**: Reusable UI components
- **Core**: Business logic and application flow
- **Main**: Application initialization and coordination

### 2. **Maintainability**
- Each file has a single responsibility
- Easier to locate and fix bugs
- Simpler to add new features
- Clear dependency hierarchy

### 3. **Testability**
- Each module can be tested independently
- Mock dependencies easily
- Unit tests are more focused

### 4. **Reusability**
- Components can be reused in different contexts
- Utils can be shared across projects
- Clear interfaces between modules

### 5. **Performance**
- Only load what's needed
- Better caching by browsers
- Easier to optimize individual modules

## Module Descriptions

### JSONDetector (`utils/json-detector.js`)
- Detects JSON data in web pages
- Validates data structure for table conversion
- Extracts table-suitable data from various JSON formats

### DataFlattener (`utils/data-flattener.js`)
- Prepares data for table display
- Keeps objects intact for expandable display
- Handles performance optimization for large datasets

### ThemeManager (`utils/theme-manager.js`)
- Manages light/dark themes
- Handles user settings
- Provides syntax highlighting for JSON
- Manages clipboard operations

### StyleManager (`utils/style-manager.js`)
- Contains all CSS styles
- Provides methods to inject styles
- Separates styling from logic

### UIUtils (`utils/ui-utils.js`)
- UI utility functions
- Page manipulation
- Interface creation
- View toggling logic

### TableViewer (`components/table-viewer.js`)
- Main table rendering component
- Handles user interactions
- Manages search, filtering, and expansion
- Exports data to CSV

### AutoJSONDetector (`core/auto-json-detector.js`)
- Automatic JSON detection on page load
- Coordinates between detection and display
- Handles conversion flow

### MessageHandler (`core/message-handler.js`)
- Handles communication with popup
- Manages extension messages
- Coordinates between components

### ContentMain (`content-main.js`)
- Main application coordinator
- Initializes all components
- Handles application lifecycle

## Migration from Original

The original `content.js` file (2873 lines) has been split into 9 focused modules:

- **utils/json-detector.js**: 82 lines
- **utils/data-flattener.js**: 42 lines  
- **utils/theme-manager.js**: 178 lines
- **utils/style-manager.js**: 456 lines
- **utils/ui-utils.js**: 289 lines
- **components/table-viewer.js**: 1247 lines
- **core/auto-json-detector.js**: 89 lines
- **core/message-handler.js**: 67 lines
- **content-main.js**: 61 lines

**Total: ~2511 lines** (some reduction due to removed redundancy)

## Development Workflow

1. **Adding new features**: Identify the appropriate module based on responsibility
2. **Bug fixes**: Locate the specific module handling the problematic functionality
3. **Testing**: Test individual modules in isolation
4. **Refactoring**: Easier to refactor small, focused modules

## Future Improvements

1. **Add TypeScript**: Convert to TypeScript for better type safety
2. **Add unit tests**: Create tests for each module
3. **Bundle optimization**: Use a bundler like webpack for production
4. **Documentation**: Add JSDoc comments for better API documentation
