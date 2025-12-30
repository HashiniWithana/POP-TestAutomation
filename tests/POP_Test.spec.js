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
});