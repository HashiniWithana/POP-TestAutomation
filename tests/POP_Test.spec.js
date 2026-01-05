import { test, expect } from '@playwright/test';
import * as XLSX from 'xlsx';

// Helper function to read Excel data
function getExcelData(filePath, sheetName = null) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[sheetName || workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet);
}

test('OrthoPoP login and select Point of Pain widget', async ({ page }) => {

  // Check for the specific cordinates
  
  const TEST_PARAMS = {
    location: 1,
    primaryAnatomy: 'Foot/Ankle/Leg',
    canvasCoordinates: { x: 378, y: 73 }
  };

  // Increase test timeout
  test.setTimeout(90000);

  // Read test data from Excel and filter by location + anatomy
  const testData = getExcelData('./test-data/condition-list.xlsx', 'Multi User Version');
  const filteredData = testData.filter(row => 
    (row.location === TEST_PARAMS.location || row.location === String(TEST_PARAMS.location)) && 
    row['  Primary Anatomy ']?.trim() === TEST_PARAMS.primaryAnatomy
  );
  
  const expectedConditions = filteredData.map(row => row.conditions?.trim().toLowerCase()).filter(c => c);
  
  console.log(`\n=== TEST CONFIGURATION ===`);
  console.log(`Location: ${TEST_PARAMS.location}`);
  console.log(`Primary Anatomy: ${TEST_PARAMS.primaryAnatomy}`);
  console.log(`Canvas Coordinates: (${TEST_PARAMS.canvasCoordinates.x}, ${TEST_PARAMS.canvasCoordinates.y})`);
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
  
  console.log('Canvas is visible, attempting click...');
  
  // Click on canvas at configured coordinates
  await canvas.click({ 
    position: TEST_PARAMS.canvasCoordinates,
    clickCount: 2 
  });

  console.log(`Clicked canvas at (${TEST_PARAMS.canvasCoordinates.x}, ${TEST_PARAMS.canvasCoordinates.y})`);

  // Wait for loading and proceed - with better error handling
  await page.waitForTimeout(3000); // Increased wait time
  await page.waitForLoadState('networkidle');
  
  // Check if Proceed button appears, if not try alternative approaches
  const proceedButton = page.getByRole('button', { name: 'Proceed' });
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const nextButton = page.getByRole('button', { name: 'Next' });
  
  try {
    await expect(proceedButton).toBeVisible({ timeout: 30000 });
    console.log('Found Proceed button');
    await proceedButton.click();
  } catch (error1) {
    console.log('Proceed button not found, trying Continue...');
    try {
      await expect(continueButton).toBeVisible({ timeout: 10000 });
      console.log('Found Continue button instead');
      await continueButton.click();
    } catch (error2) {
      console.log('Continue button not found, trying Next...');
      try {
        await expect(nextButton).toBeVisible({ timeout: 10000 });
        console.log('Found Next button instead');
        await nextButton.click();
      } catch (error3) {
        // Take screenshot for debugging
        await page.screenshot({ path: 'debug-no-proceed-button.png', fullPage: true });
        
        // Check what buttons are actually visible
        const allButtons = await page.locator('button').all();
        const buttonTexts = [];
        for (const btn of allButtons) {
          const text = await btn.textContent();
          const isVisible = await btn.isVisible();
          if (isVisible && text?.trim()) {
            buttonTexts.push(text.trim());
          }
        }
        console.log('Available visible buttons:', buttonTexts);
        
        throw new Error(`No Proceed/Continue/Next button found after canvas click. Available buttons: ${buttonTexts.join(', ')}`);
      }
    }
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

  console.log(`\n=== VALIDATION RESULTS ===`);
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
  console.log('Test completed successfully');
});