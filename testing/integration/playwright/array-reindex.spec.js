import { test, expect } from '@playwright/test';
import { CONTEXT_URL_TO_LOCAL_PATH_MAP } from '../test-helpers.mjs';
import fs from 'fs';

test.beforeEach(async ({ page }) => {
  for (const [url, localPath] of Object.entries(CONTEXT_URL_TO_LOCAL_PATH_MAP)) {
    await page.route(url, route => {
      try {
        const fileContent = fs.readFileSync(localPath, 'utf-8');
        route.fulfill({
          status: 200,
          contentType: 'application/json+ld',
          body: fileContent,
        });
      } catch (error) {
        route.abort();
      }
    });
  }
});

test('should maintain correct error count when removing array items shifts invalid fields', async ({ page }) => {
    page.on('console', msg => console.log(`[BROWSER]: ${msg.text()}`));
    await page.goto('/wizard/index.html');
    const showErrorsBtn = page.locator('#show-errors-btn');

    // 1. Get initial error count (core required fields).
    // Core has 3 required fields initially.
    await expect(showErrorsBtn).toContainText('Show Errors (3)');
    const initialCoreErrorCount = 3;

    // 2. Add the battery sector.
    await page.locator('button[data-sector="battery"]').click();
    
    // Battery has 4 required fields: batteryCategory, batteryChemistry, manufacturingDate, batteryMass.
    const errorCountAfterSectorAdd = initialCoreErrorCount + 4;
    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterSectorAdd})`);

    // 3. Add 3 items to the 'materialComposition' array.
    const addCompBtn = page.locator('button[data-array-name="materialComposition"]');
    await addCompBtn.click(); // materialComposition.0
    await addCompBtn.click(); // materialComposition.1
    await addCompBtn.click(); // materialComposition.2

    // Each component has 2 required fields: 'name' and 'weightPercentage'.
    // So 3 items * 2 fields = 6 new errors.
    const expectedErrorsWith3Items = errorCountAfterSectorAdd + 6;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWith3Items})`);

    // 4. Fill in fields for materialComposition.0 to make it VALID.
    // 'name' is now a simple string field.
    // Note: The form builder should render it as a standard text input.
    // We intentionally leave 'name' empty here to keep the item partially invalid,
    // in order to test the error shifting logic.
    await page.locator('input[name="materialComposition.0.weightPercentage"]').fill('10');
    await page.locator('input[name="materialComposition.0.weightPercentage"]').blur();
    
    // Validating weightPercentage removes 1 error.
    // 'name' remains invalid (required).
    
    // Step 4 revised: Fill weightPercentage for Item 0.
    // Expect errors to drop by 1.
    const expectedErrorsWithItem0Partial = expectedErrorsWith3Items - 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWithItem0Partial})`);

    // Step 5: Fill weightPercentage for Item 2.
    await page.locator('input[name="materialComposition.2.weightPercentage"]').fill('20');
    await page.locator('input[name="materialComposition.2.weightPercentage"]').blur();
    
    const expectedErrorsWithItem0And2Partial = expectedErrorsWithItem0Partial - 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWithItem0And2Partial})`);
    
    // 6. Remove materialComposition.0.
    // Item 0 was partially valid (weightPercentage filled).
    // Item 1 is fully invalid (nothing filled).
    // Item 2 is partially valid (weightPercentage filled).

    // Locate the remove button for the specific group
    await page.locator('[data-array-group="materialComposition.0"] button:has-text("Remove")').click();
    
    // After removing Item 0:
    // Old Item 1 (Invalid) becomes Item 0.
    // Old Item 2 (Partially Valid) becomes Item 1.
    
    // Total errors calculation:
    // We removed Item 0. It had 1 error remaining (name).
    // So total errors should decrease by 1.
    const expectedErrorsAfterRemove = expectedErrorsWithItem0And2Partial - 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsAfterRemove})`);

    // 7. Verify desynchronization bug logic.
    // The new Item 0 (was 1) should be fully invalid.
    // If we fill its weightPercentage, error count should drop by 1.
    await page.locator('input[name="materialComposition.0.weightPercentage"]').fill('30');
    await page.locator('input[name="materialComposition.0.weightPercentage"]').blur();
    
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsAfterRemove - 1})`);
});
