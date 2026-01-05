const XLSX = require('xlsx');

const workbook = XLSX.readFile('./test-data/condition-list.xlsx');
const sheetName = 'Multi User Version';
const sheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(sheet);

// Filter for Location 2 and Foot/Ankle/Leg
const location2Data = data.filter(row => 
  (row.location === 2 || row.location === '2') && 
  row['  Primary Anatomy ']?.trim() === 'Foot/Ankle/Leg'
);

console.log('\n=== LOCATION 2 DATA FROM EXCEL ===');
console.log(`Total rows found for Location 2: ${location2Data.length}\n`);

if (location2Data.length > 0) {
  const firstRow = location2Data[0];
  console.log('First row coordinates:');
  console.log(`  x: ${firstRow.x ?? firstRow.X}`);
  console.log(`  y: ${firstRow.y ?? firstRow.Y}`);
  console.log(`  Condition: ${firstRow.conditions}`);
  console.log(`  Primary Anatomy: ${firstRow['  Primary Anatomy ']}`);
  
  console.log('\nAll conditions for Location 2:');
  location2Data.forEach((row, index) => {
    console.log(`  ${index + 1}. ${row.conditions} (x: ${row.x ?? row.X}, y: ${row.y ?? row.Y})`);
  });
} else {
  console.log('No data found for Location 2 with Primary Anatomy "Foot/Ankle/Leg"');
}

console.log('\n=== Available sheet names ===');
console.log(workbook.SheetNames);
