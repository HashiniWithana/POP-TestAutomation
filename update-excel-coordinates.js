const XLSX = require('xlsx');

// Read the workbook
const workbook = XLSX.readFile('./test-data/condition-list.xlsx');
const sheetName = 'Multi User Version';
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet, { defval: '' });

// Update coordinates for Location 1 and Location 2
data.forEach(row => {
  if ((row.location === 1 || row.location === '1') && row['  Primary Anatomy ']?.trim() === 'Foot/Ankle/Leg') {
    row.x = 378;
    row.y = 73;
    console.log(`Updated Location 1: ${row.conditions} - (x: ${row.x}, y: ${row.y})`);
  }
  
  if ((row.location === 2 || row.location === '2') && row['  Primary Anatomy ']?.trim() === 'Foot/Ankle/Leg') {
    row.x = 385;
    row.y = 348;
    console.log(`Updated Location 2: ${row.conditions} - (x: ${row.x}, y: ${row.y})`);
  }
});

// Convert back to sheet
const newSheet = XLSX.utils.json_to_sheet(data);

// Replace the sheet
workbook.Sheets[sheetName] = newSheet;

// Save the workbook
XLSX.writeFile(workbook, './test-data/condition-list.xlsx');

console.log('\nExcel file updated successfully!');
