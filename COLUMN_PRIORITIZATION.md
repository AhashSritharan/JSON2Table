# JSON2Table Extension - Column Prioritization Feature

## New Feature: Smart Column Ordering

### Overview
The JSON2Table extension now intelligently prioritizes columns based on data density, automatically moving columns with mostly null values to the end of the table.

### How It Works

#### 1. Data Analysis
- Analyzes the first 100 rows of data (or all rows if fewer than 100)
- Calculates the percentage of non-null values for each column
- Non-null includes any value that is not `null`, `undefined`, or empty string `""`

#### 2. Column Sorting Algorithm
Columns are sorted by:
1. **Data Density** (descending) - Columns with more data appear first
2. **Alphabetical Order** (ascending) - For columns with equal density

#### 3. Visual Indicators
Each column header now includes a density indicator:
- **● (Green)** - 80%+ of rows have data (high density)
- **◐ (Yellow)** - 50-79% of rows have data (medium density) 
- **◑ (Red)** - 20-49% of rows have data (low density)
- **○ (Gray)** - <20% of rows have data (very low density)

#### 4. Enhanced Tooltips
Hover over any column header to see:
- Column name
- Data density percentage
- Exact count: "filled rows / total rows"

### Example Scenarios

#### Before (Alphabetical Order):
```
active | bonus | department | email | id | manager | meta_1 | meta_2 | ... | name | phone | salary
```

#### After (Density-Based Order):
```
active | department | email | id | name | salary | startDate | bonus | manager | phone | optional_1 | optional_2 | rare_field_1 | rare_field_2 | meta_1 | meta_2 | ... | unused_3
```

### Benefits

1. **Improved User Experience**: Important data columns appear first
2. **Reduced Scrolling**: No need to scroll past empty columns to find data
3. **Visual Feedback**: Density indicators help identify data quality at a glance
4. **Better Data Discovery**: Quickly identify which fields actually contain useful information

### Technical Implementation

#### Files Modified:
- `src/components/table-viewer.js` - Enhanced `extractColumns()` and `render()` methods
- Added `calculateColumnStats()` method for real-time density calculation

#### Key Features:
- **Performance Optimized**: Only analyzes sample data for column ordering
- **Real-time Updates**: Density indicators reflect current filtered data
- **Backwards Compatible**: Works with all existing JSON structures

### Testing
Use the provided test files to see the feature in action:
- `test-column-priority.html` - Comprehensive test with various density levels
- `test-with-nulls.json` - Simple test case with many null values

### Configuration
Currently automatic with no configuration needed. The feature:
- ✅ Works with all JSON structures (arrays, objects, nested data)
- ✅ Adapts to data filtering and searching
- ✅ Maintains performance with large datasets
- ✅ Provides visual feedback without cluttering the interface
