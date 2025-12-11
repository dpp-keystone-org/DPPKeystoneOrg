
import { test, expect } from '@playwright/test';

test.describe('DPP Wizard - Construction Sector', () => {
  test('should load the construction sector form without errors', async ({ page }) => {
    const consoleMessages = [];
    page.on('console', msg => {
      console.log(`Browser Console: ${msg.text()}`);
      consoleMessages.push(msg.text());
    });

    // Navigate to the wizard page
    await page.goto('/spec/wizard/index.html');

    // Wait for the core form to be initialized
    await expect(page.locator('#core-form-container')).not.toBeEmpty();


    // Select the "Construction" sector from the dropdown
    await page.selectOption('#sector-select', 'construction');

    // Check for console errors
    const errors = consoleMessages.filter(msg => msg.startsWith('Failed to load or resolve schema:'));
    expect(errors).toHaveLength(0);

    // Check if the sector form container is visible and not empty
    const sectorFormContainer = page.locator('#form-container');
    await expect(sectorFormContainer).toBeVisible({ timeout: 10000 });
    await expect(sectorFormContainer).not.toBeEmpty();

    // Optional: A more specific check for a known field from the construction schema
    await expect(page.locator('input[name="declarationCode"]')).toBeVisible();
  });
});
