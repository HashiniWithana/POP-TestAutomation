import { test, expect } from '@playwright/test';

test('OrthoPoP login and select Point of Pain widget', async ({ page }) => {
  await page.goto('https://orthopop-dev.brainweber.net/login');

  // Fill in credentials and submit form
  await page.getByRole('textbox', { name: /username/i }).fill('hashini_qa');
  await page.getByRole('textbox', { name: /password/i }).fill('Hashini@123');
  await page.getByRole('button', { name: /log in/i }).click();

  // Wait for dashboard content 
  const dashboard = await page.waitForSelector('text=Begin your OrthoPoP Journey', { timeout: 15000 }).catch(() => null);
// Diagnostic output right before clicking
  console.log(await page.textContent('body'));
  await page.screenshot({ path: 'pain-debug.png', fullPage: true });

  // Try a container selector for robustness
  await page.locator('div.cursor-pointer:has-text("Point of Pain")').first().click();

 // await page.getByRole('button', { name: 'Accept' }).click();
});
