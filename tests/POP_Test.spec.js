import { test, expect } from '@playwright/test';

test('OrthoPoP login and select Point of Pain widget', async ({ page }) => {
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
  
  // Click on the "Point of Pain" card - the entire card is clickable
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

 

  await page.locator('canvas').dblclick({ position: { x: 378, y: 73 } });

  const canvas = page.locator('canvas');
await expect(canvas).toBeVisible({ timeout: 10000 });

 // Only click Proceed when it is visible
  await expect(page.getByRole('button', { name: 'Proceed' })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: 'Proceed' }).click();
await page.waitForLoadState('networkidle');


const diagnosisText = await page.locator('.diagnosis-list').textContent();


expect(diagnosisText.toLowerCase()).toContain('common peroneal nerve compression neuropathy');
  

});
