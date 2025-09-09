// Debug test for table viewer expansion issue

// Simulate the problematic data structure
const testData = [
    {
        property: 'name',
        value: 'John Doe',
        __rowId: 0
    },
    {
        property: 'items',
        value: [
            { id: 1, name: 'Item 1' },
            { id: 2, name: 'Item 2' }
        ],
        __rowId: 1
    },
    {
        property: 'status',
        value: 'active',
        __rowId: 2
    }
];

console.log('Test data structure:', testData);

// Test the expand key generation
const row = testData[1]; // The row with the array
const col = 'value';
const stableRowId = row.__rowId;

let expandRowId = stableRowId;
if (col === 'value' && row.property) {
    expandRowId = `${stableRowId}-${row.property}`;
}

console.log('Original stableRowId:', stableRowId);
console.log('Generated expandRowId:', expandRowId);
console.log('Expected array key:', `${expandRowId}-${col}`);

// This should generate: "1-items-value" as the array key
