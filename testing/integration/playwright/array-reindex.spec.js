import { test, expect } from '@playwright/test';
import { CONTEXT_URL_TO_LOCAL_PATH_MAP } from '../../scripts/test-helpers.mjs';
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
    await page.locator('button[data-sector="battery-ev"]').click();
    
    // Battery has many required fields now.
    await expect(showErrorsBtn).toContainText(/Show Errors \(\d+\)/);
    // Give it a moment to stabilize the error count rendering
    await page.waitForTimeout(500);
    const textAfterSector = await showErrorsBtn.textContent();
    const errorCountAfterSectorAdd = parseInt(textAfterSector.match(/\((\d+)\)/)[1], 10);

    // 3. Add 3 items to the 'hazardousSubstances' array.
    const addCompBtn = page.locator('button[data-array-name="hazardousSubstances"]');
    await addCompBtn.click(); // hazardousSubstances.0
    await addCompBtn.click(); // hazardousSubstances.1
    await addCompBtn.click(); // hazardousSubstances.2

    // Each component has 1 required field: 'name'.
    // So 3 items * 1 field = 3 new errors.
    const expectedErrorsWith3Items = errorCountAfterSectorAdd + 3;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWith3Items})`);

    // 4. Fill in a non-required field for hazardousSubstances.0.
    // This should NOT change the error count.
    await page.locator('input[name="hazardousSubstances.0.percentage"]').fill('10');
    await page.locator('input[name="hazardousSubstances.0.percentage"]').blur();
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWith3Items})`);
    
    // 5. Fill in a non-required field for hazardousSubstances.2.
    // This should also NOT change the error count.
    await page.locator('input[name="hazardousSubstances.2.percentage"]').fill('20');
    await page.locator('input[name="hazardousSubstances.2.percentage"]').blur();
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWith3Items})`);
    
    // 6. Remove hazardousSubstances.0.
    // Item 0 was fully invalid (it had 1 error for the 'name' field).
    // Removing it should decrease the total error count by 1.
    await page.locator('[data-array-group="hazardousSubstances.0"] button:has-text("Remove")').click();
    
    // After removing Item 0:
    // Old Item 1 (Invalid) becomes Item 0.
    // Old Item 2 (Invalid) becomes Item 1.
    // Total errors should decrease by 1.
    const expectedErrorsAfterRemove = expectedErrorsWith3Items - 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsAfterRemove})`);

    // 7. Verify desynchronization bug logic.
    // The new Item 0 (was 1) should be fully invalid.
    // If we fill its NAME field, error count should drop by 1.
    await page.locator('input[name="hazardousSubstances.0.name"]').fill('Test Component');
    await page.locator('input[name="hazardousSubstances.0.name"]').blur();
    
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsAfterRemove - 1})`);
});
