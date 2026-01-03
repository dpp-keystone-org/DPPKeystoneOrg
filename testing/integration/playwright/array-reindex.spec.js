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
    await page.goto('/spec/wizard/index.html');
    const showErrorsBtn = page.locator('#show-errors-btn');

    // 1. Get initial error count (core required fields).
    // Core has 3 required fields initially.
    await expect(showErrorsBtn).toContainText('Show Errors (3)');
    const initialCoreErrorCount = 3;

    // 2. Add the battery sector.
    await page.locator('button[data-sector="battery"]').click();
    
    // Battery has 8 required fields.
    const errorCountAfterSectorAdd = initialCoreErrorCount + 8;
    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterSectorAdd})`);

    // 3. Add 3 items to the 'documents' array.
    const addDocBtn = page.locator('button[data-array-name="documents"]');
    await addDocBtn.click(); // documents.0
    await addDocBtn.click(); // documents.1
    await addDocBtn.click(); // documents.2

    // Each document has a required 'url' field (and others, but let's focus on one).
    // documents.0.url, documents.1.url, documents.2.url are all required and empty.
    // However, they are NOT invalid immediately upon addition unless we trigger validation.
    // The current implementation DOES trigger validation on add:
    // "triggerValidationForGroup(insertionPoint, path);" in form-builder.js
    
    // Let's verify how many errors we have.
    // 3 items added. Each item has 1 required field: url (from related-resource.schema.json).
    // So 3 items * 1 field = 3 new errors.
    const expectedErrorsWith3Docs = errorCountAfterSectorAdd + 3;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWith3Docs})`);

    // 4. Fill in fields for documents.0 to make it VALID.
    await page.locator('input[name="documents.0.url"]').fill('http://example.com/0');
    await page.locator('input[name="documents.0.url"]').blur(); // Trigger validation

    // Now documents.0 is valid. Errors should decrease by 1.
    const expectedErrorsWithDoc0Valid = expectedErrorsWith3Docs - 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWithDoc0Valid})`);

    // 5. Fill in fields for documents.2 to make it VALID.
    await page.locator('input[name="documents.2.url"]').fill('http://example.com/2');
    await page.locator('input[name="documents.2.url"]').blur();

    // Now documents.2 is valid. Errors should decrease by another 1.
    const expectedErrorsWithDoc0And2Valid = expectedErrorsWithDoc0Valid - 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsWithDoc0And2Valid})`);

    // At this point:
    // documents.0 is VALID.
    // documents.1 is INVALID (1 error).
    // documents.2 is VALID.
    
    // 6. Remove documents.0 (the first valid one).
    // This will cause:
    // documents.1 (INVALID) -> becomes documents.0
    // documents.2 (VALID) -> becomes documents.1
    await page.locator('.array-item-control-row[data-array-group="documents.0"] button:text-is("Remove")').click();

    // Expected outcome so far:
    // The old documents.0 (valid) is gone.
    // The new documents.0 (was documents.1) is INVALID.
    // The new documents.1 (was documents.2) is VALID.
    // Total errors should still be: Base + 1.
    const expectedErrorsAfterRemove = errorCountAfterSectorAdd + 1;
    await expect(showErrorsBtn).toContainText(`Show Errors (${expectedErrorsAfterRemove})`);

    // 7. PROVE THE BUG: Fix the remaining invalid field (now documents.0.url).
    // If the state is desynchronized, the error count will NOT decrease,
    // because invalidFields still points to "documents.1.url" (phantom),
    // and fixing "documents.0.url" won't remove "documents.1.url" from the set.
    await page.locator('input[name="documents.0.url"]').fill('http://example.com/fixed');
    await page.locator('input[name="documents.0.url"]').blur();

    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterSectorAdd})`);
});
