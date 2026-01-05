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

    // Extract expected conditions from filtered data
    const expectedConditions = filteredData
      .map(row => row.conditions?.trim().toLowerCase())
      .filter(c => c);

    console.log(`\n=== TEST CONFIGURATION - LOCATION ${TEST_PARAMS.location} ===`);
    console.log(`Location: ${TEST_PARAMS.location}`);
    console.log(`Primary Anatomy: ${TEST_PARAMS.primaryAnatomy}`);
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
    
    // Add extra wait time to ensure canvas is fully loaded and interactive
    await page.waitForTimeout(2000);
    await page.waitForLoadState('networkidle');
    
    // LOOP through each row from Excel and click its coordinates
    console.log(`\n=== CLICKING CANVAS POINTS ===`);
    console.log(`Total points to click: ${filteredData.length}\n`);
    
    let allDisplayedConditions = [];
    
    for (let i = 0; i < filteredData.length; i++) {
      const row = filteredData[i];
      const canvasCoordinates = {
        x: Number(row.x ?? row.X) || TEST_PARAMS.fallbackCoordinates.x,
        y: Number(row.y ?? row.Y) || TEST_PARAMS.fallbackCoordinates.y
      };
      
      console.log(`[${i + 1}/${filteredData.length}] Condition: ${row.conditions}`);
      console.log(`    Clicking canvas at coordinates: (${canvasCoordinates.x}, ${canvasCoordinates.y})`);
      
      // Click on canvas
      await canvas.click({ 
        position: canvasCoordinates,
        force: true
      });
      
      await page.waitForTimeout(500);
      
      // Double click to ensure selection
      await canvas.dblclick({ 
        position: canvasCoordinates,
        force: true
      });

      // Wait for response
      await page.waitForTimeout(2000);
      await page.waitForLoadState('networkidle').catch(() => {});
      
      // Take screenshot for debugging
      await page.screenshot({ path: `test-results/location-${TEST_PARAMS.location}-point-${i + 1}.png` });
      
      // Check if proceed button appears
      const proceedButton = page.getByRole('button', { name: 'Proceed' });
      const continueButton = page.getByRole('button', { name: 'Continue' });
      const nextButton = page.getByRole('button', { name: 'Next' });
      
      let buttonFound = false;
      
      if (await proceedButton.isVisible().catch(() => false)) {
        console.log(`    ✓ Proceed button found`);
        await proceedButton.click();
        buttonFound = true;
      } else if (await continueButton.isVisible().catch(() => false)) {
        console.log(`    ✓ Continue button found`);
        await continueButton.click();
        buttonFound = true;
      } else if (await nextButton.isVisible().catch(() => false)) {
        console.log(`    ✓ Next button found`);
        await nextButton.click();
        buttonFound = true;
      } else {
        console.error(`    ✗ No button found for point (${canvasCoordinates.x}, ${canvasCoordinates.y})`);
      }
      
      if (buttonFound) {
        await page.waitForLoadState('networkidle').catch(() => {});
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
        
        console.log(`    Returned conditions: ${displayedConditions.length} - ${displayedConditions.join(', ')}`);
        
        // Store for final validation
        allDisplayedConditions.push({
          expectedCondition: row.conditions?.trim().toLowerCase(),
          displayedConditions: displayedConditions,
          coordinates: canvasCoordinates
        });
      }
    }
    
    console.log(`\n=== VALIDATION RESULTS - LOCATION ${TEST_PARAMS.location} ===\n`);
    
    // Validate each clicked point against expected and returned conditions
    let totalMatched = 0;
    let totalMissing = 0;
    
    allDisplayedConditions.forEach((result, index) => {
      console.log(`[Point ${index + 1}] Expected: "${result.expectedCondition}"`);
      console.log(`         Coordinates: (${result.coordinates.x}, ${result.coordinates.y})`);
      
      const isMatched = result.displayedConditions.some(displayed =>
        displayed.includes(result.expectedCondition) || result.expectedCondition.includes(displayed)
      );
      
      if (isMatched) {
        console.log(`         ✓ MATCHED - Found in: ${result.displayedConditions.join(', ')}`);
        totalMatched++;
      } else {
        console.log(`         ✗ MISSING - Returned conditions: ${result.displayedConditions.length > 0 ? result.displayedConditions.join(', ') : 'None'}`);
        totalMissing++;
      }
      console.log();
    });
    
    console.log(`\n=== SUMMARY ===`);
    console.log(`Total Points Clicked: ${allDisplayedConditions.length}`);
    console.log(`Matched: ${totalMatched}/${allDisplayedConditions.length}`);
    console.log(`Missing: ${totalMissing}/${allDisplayedConditions.length}`);
    console.log(`==========================\n`);
    
    if (totalMissing > 0) {
      throw new Error(`${totalMissing} condition(s) failed validation for Location ${TEST_PARAMS.location}`);
    }
    
    console.log(`✓ Location ${TEST_PARAMS.location} test completed successfully`);
  });
}

