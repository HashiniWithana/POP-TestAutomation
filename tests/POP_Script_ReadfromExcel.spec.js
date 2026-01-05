import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

// Helper function to read Excel data
function getExcelData(filePath, sheetName = null) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

// Test configuration for multiple locations
const TEST_LOCATIONS = [
  {
    location: 1,
    primaryAnatomy: 'Foot/Ankle/Leg',
    fallbackCoordinates: { x: 378, y: 73 }
  },
  {
    location: 2,
    primaryAnatomy: 'Foot/Ankle/Leg',
    fallbackCoordinates: { x: 385, y: 348 }
   
  }
];

// Loop through each location and create a test
for (const config of TEST_LOCATIONS) {
  test(`OrthoPoP - Location ${config.location} - ${config.primaryAnatomy}`, async ({ page }) => {

    const TEST_PARAMS = config;

    // Increase test timeout
    test.setTimeout(90000);

    // Read test data from Excel and filter by location + anatomy
    const testData = getExcelData('./test-data/condition-list.xlsx', 'Multi User Version');
    const filteredData = testData.filter(row => 
      (row.location === TEST_PARAMS.location || row.location === String(TEST_PARAMS.location)) && 
      row['  Primary Anatomy ']?.trim() === TEST_PARAMS.primaryAnatomy
    );

    if (filteredData.length === 0) {
      throw new Error(`No rows found in Excel for Location ${TEST_PARAMS.location} and Anatomy "${TEST_PARAMS.primaryAnatomy}"`);
    }

    // Read X/Y coordinates from the first matching Excel row
    const firstRow = filteredData[0];
    const canvasCoordinates = {
      x: Number(firstRow.x ?? firstRow.X) || TEST_PARAMS.fallbackCoordinates.x,
      y: Number(firstRow.y ?? firstRow.Y) || TEST_PARAMS.fallbackCoordinates.y
    };

    if (!firstRow.x && !firstRow.X && !firstRow.y && !firstRow.Y) {
      console.log(`Using fallback coordinates (${canvasCoordinates.x}, ${canvasCoordinates.y}) since x/y columns not found in Excel.`);
    } else if (Number(firstRow.x ?? firstRow.X) === 0 || Number(firstRow.y ?? firstRow.Y) === 0) {
      console.warn('X or Y coordinate is 0 in Excel, using fallback coordinates.');
    }

    const expectedConditions = filteredData
      .map(row => row.conditions?.trim().toLowerCase())
      .filter(c => c);

    console.log(`\n=== TEST CONFIGURATION - LOCATION ${TEST_PARAMS.location} ===`);
    console.log(`Location: ${TEST_PARAMS.location}`);
    console.log(`Primary Anatomy: ${TEST_PARAMS.primaryAnatomy}`);
    console.log(`Canvas Coordinates from Excel: (${canvasCoordinates.x}, ${canvasCoordinates.y})`);
    console.log(`Expected Conditions (${expectedConditions.length}):`, expectedConditions);
    console.log(`==========================\n`);

    // Login flow
    await page.goto('https://orthopop-dev.brainweber.net/login');

    // Wait for login form to be fully loaded
    await page.waitForLoadState('networkidle');
    
    // Fill in credentials and submit form
    await page.getByLabel('Username').fill('hashini_qa');
    await page.getByLabel('Password').fill('Hashini@123');
    
    // Click login button and wait for navigation
    await Promise.all([
      page.waitForURL('**/dashboard/**', { timeout: 15000 }),
      page.getByRole('button', { name: /log in/i }).click()
    ]);

    // Wait for dashboard content to load
    await page.waitForSelector('text=Begin your OrthoPoP Journey', { timeout: 15000 });
    
    // Click on the "Point of Pain" card
    await page.locator('div.cursor-pointer').filter({ hasText: 'Point of Pain' }).click();
    
    // Wait for navigation to next step
    await page.waitForLoadState('networkidle');

    await page.getByRole('button', { name: 'Accept' }).click();
    
    await page.locator('div').filter({ hasText: 'Foot / Ankle / Leg' }).nth(5).click();
  
    await page.getByRole('img', { name: 'Left' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('img', { name: 'Lateral View' }).click();
    await page.getByRole('img', { name: 'layer' }).click();
    await page.getByTitle('Muscle').click();

    // Wait for canvas to be visible and interactive
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });
    
    // For Location 2, pause to manually identify coordinates
    // if (TEST_PARAMS.location === 2) {
    //   console.log('\n⏸️  PAUSED FOR LOCATION 2 - Manually click on the correct spot on the canvas');
    //   console.log('The browser will stay open. After clicking, note the coordinates and update the script.');
    //   console.log('Press Ctrl+C to stop the test.\n');
    //   await page.pause();
    // }
    
    // Click on canvas at coordinates read from Excel
    await canvas.click({ 
      position: canvasCoordinates,
      clickCount: 2 
    });

    // Wait for loading and proceed
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // Take screenshot for debugging
    await page.screenshot({ path: `test-results/location-${TEST_PARAMS.location}-after-canvas-click.png` });
    
    // Try multiple button variations
    const proceedButton = page.getByRole('button', { name: 'Proceed' });
    const continueButton = page.getByRole('button', { name: 'Continue' });
    const nextButton = page.getByRole('button', { name: 'Next' });
    
    if (await proceedButton.isVisible().catch(() => false)) {
      await proceedButton.click();
    } else if (await continueButton.isVisible().catch(() => false)) {
      await continueButton.click();
    } else if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
   } 
    else {
      console.error(`ERROR: No Proceed/Continue/Next button found for Location ${TEST_PARAMS.location}`);
      console.error(`Coordinates used: (${canvasCoordinates.x}, ${canvasCoordinates.y})`);
      throw new Error(`No Proceed/Continue/Next button found. Check screenshot at test-results/location-${TEST_PARAMS.location}-after-canvas-click.png`);
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // Extract displayed conditions from the page
    let displayedConditions = [];
    
    // Try to find condition elements using various strategies
    let conditionElements = [];
    const selectors = [
      '[data-testid="condition-item"]',
      '[data-testid*="condition"]',
      '[class*="condition"]',
      'ul > div, ul > li, [role="listitem"]'
    ];

    for (const selector of selectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        conditionElements = await page.locator(selector).all();
        break;
      }
    }

    // Fallback: Search by text for expected conditions
    if (conditionElements.length === 0) {
      for (const expectedCondition of expectedConditions) {
        const matchingElements = await page.getByText(expectedCondition, { exact: false }).all();
        if (matchingElements.length > 0) {
          conditionElements.push(...matchingElements);
        }
      }
    }

    // Extract text from elements
    for (const element of conditionElements) {
      const text = await element.textContent();
      if (text?.trim()) {
        displayedConditions.push(text.trim().toLowerCase());
      }
    }

    console.log(`\n=== VALIDATION RESULTS - LOCATION ${TEST_PARAMS.location} ===`);
    console.log(`Displayed Conditions (${displayedConditions.length}):`, displayedConditions);
    
    // Compare expected vs displayed conditions
    const matchedConditions = [];
    const missingConditions = [];

    for (const expectedCondition of expectedConditions) {
      const isPresent = displayedConditions.some(displayed => 
        displayed.includes(expectedCondition) || expectedCondition.includes(displayed)
      );
      
      if (isPresent) {
        matchedConditions.push(expectedCondition);
      } else {
        missingConditions.push(expectedCondition);
      }
    }

    // Report results
    console.log(`\nMatched: ${matchedConditions.length}/${expectedConditions.length}`);
    if (matchedConditions.length > 0) {
      console.log('✓ Matched conditions:', matchedConditions);
    }
    
    if (missingConditions.length > 0) {
      console.error(`\n MISSING CONDITIONS (${missingConditions.length}):`);
      missingConditions.forEach(condition => {
        console.error(`  - "${condition}"`);
        console.error(`    Location: ${TEST_PARAMS.location}`);
        console.error(`    Anatomy: ${TEST_PARAMS.primaryAnatomy}`);
      });
    } else {
      console.log('\n All expected conditions matched!');
    }
    
    console.log(`==========================\n`);
    console.log(`Location ${TEST_PARAMS.location} test completed successfully`);
  });
}
