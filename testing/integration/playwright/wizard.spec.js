import { test, expect } from '@playwright/test';
import { CONTEXT_URL_TO_LOCAL_PATH_MAP, fillRequiredFields } from '../test-helpers.mjs';
import fs from 'fs';

test.beforeEach(async ({ page }) => {
  // Set up a route for each URL in the map to intercept network requests.
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
        // Fail silently in the test log if a file can't be read, Playwright will report the 404.
        route.abort();
      }
    });
  }
});

test('has title', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/DPP Wizard/);
});

test('core DPP fields should have default values on load', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  // Wait for the core form to be initialized. We can wait for a known element.
  const dppIdInput = page.locator('input[name="digitalProductPassportId"]');
  await expect(dppIdInput).toBeVisible();

  // Assert that the core fields have their default values
  await expect(dppIdInput).toHaveValue('https://dpp.example.com/dpp/77b583e8-8575-4862-986c-4863a2995f68');
  
  const upiInput = page.locator('input[name="uniqueProductIdentifier"]');
  await expect(upiInput).toHaveValue('https://pid.example.com/gtin/01234567890123');
});

test('should be invalid on load due to empty required fields', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  const generateBtn = page.locator('#generate-dpp-btn');
  const showErrorsBtn = page.locator('#show-errors-btn');

  // Wait for a core form element to ensure the wizard is initialized
  await expect(page.locator('input[name="digitalProductPassportId"]')).toBeVisible();

  // On initial load, required fields are empty, so the form should be invalid.
  // This test will fail until the initial validation logic is added.
  await expect(generateBtn).toBeHidden();
  await expect(showErrorsBtn).toBeVisible();

  // Check that the error count is correct.
  // dpp.schema.json has 3 required fields without default values:
  // granularity, lastUpdate, and economicOperatorId.
  await expect(showErrorsBtn).toContainText('Show Errors (3)');
});

test('wizard UI should be themed by keystone-style.css', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('/spec/wizard/index.html');

  // 1. Check for color theming via CSS variables
  const generateBtn = page.locator('#generate-dpp-btn');
  await expect(generateBtn).toBeVisible();

  // This assertion will fail until wizard.css is refactored to use CSS variables
  // from keystone-style.css. The hard-coded #007bff resolves to rgb(0, 123, 255).
  // The theme variable --keystone-blue (#0d6efd) resolves to rgb(13, 110, 253).
  await expect(generateBtn).toHaveCSS('background-color', 'rgb(13, 110, 253)');

  // 2. Check for layout theming via the .container class (by checking width)
  const wizardContainer = page.locator('#wizard-container');
  const box = await wizardContainer.boundingBox();
  
  // This assertion will fail until the wizard's HTML is wrapped in a <div class="container">
  // and the 800px max-width is removed from the wizard.css body style.
  expect(box.width).toBeGreaterThan(800);
});

const sectors = ['battery', 'construction', 'electronics', 'textile'];

for (const sector of sectors) {
  test(`loads ${sector} sector form`, async ({ page }) => {
    // Listen for all console events and log them to the test's console
    page.on('console', msg => {
      const logArgs = msg.args().map(arg => arg.toString().replace('JSHandle@', ''));
      console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}:`, ...logArgs);
    });

    await page.goto('/spec/wizard/index.html');

    // Add the sector form
    const addSectorBtn = page.locator(`button[data-sector="${sector}"]`);
    await addSectorBtn.click();

    // Wait for the form to be generated
    const sectorFormContainer = page.locator(`#sector-form-${sector}`);
    
    // Assert that the form container is not empty
    await expect(sectorFormContainer).not.toBeEmpty();

    // Specifically, check that it contains the grid rows for the form
    const gridRows = sectorFormContainer.locator('.grid-row');
    expect(await gridRows.count()).toBeGreaterThan(0);

    // Add sector-specific assertions to ensure the correct form is loaded
    switch (sector) {
      case 'battery':
        await expect(page.locator('input[name="batteryCategory"]')).toBeVisible();

        // Assert that the nominalVoltage field does not have '[object]' as its value
        const nominalVoltageInput = page.locator('input[name="nominalVoltage"]');
        await expect(nominalVoltageInput).toBeVisible();
        await expect(nominalVoltageInput).not.toHaveValue('[object]');

        // Test array of objects functionality for 'documents'
        const addButton = page.locator('button[data-array-name="documents"]');
        await expect(addButton).toBeVisible();

        // Add the first item
        await addButton.click();
        await expect(page.locator('input[name="documents.0.resourceTitle"]')).toBeVisible();
        await expect(page.locator('input[name="documents.0.contentType"]')).toBeVisible();
        await expect(page.locator('input[name="documents.0.language"]')).toBeVisible();
        await expect(page.locator('input[name="documents.0.url"]')).toBeVisible();

        // Add a second item
        await addButton.click();
        await expect(page.locator('input[name="documents.1.resourceTitle"]')).toBeVisible();

        // Remove the first item
        const controlRow = page.locator('.array-item-control-row[data-array-group="documents.0"]');
        const removeButton = controlRow.locator('button:text-is("Remove")');
        await removeButton.click();
        
        // Assert the first item is gone and the second is re-indexed
        await expect(page.locator('input[name="documents.0.resourceTitle"]')).toBeVisible();
        await expect(page.locator('input[name="documents.1.resourceTitle"]')).not.toBeVisible();
        break;
      case 'construction':
        await expect(page.locator('input[name="harmonisedStandardReference"]')).toBeVisible();
        // Check for a known-good nested field inside an optional object
        await page.locator('button[data-optional-object="notifiedBody"]').click();
        await page.locator('button[data-optional-object="address"]').click();
        await expect(page.locator('input[name="notifiedBody.address.streetAddress"]')).toBeVisible();
        
        // Check that the ontology column is being populated
        const row = page.locator('.grid-row:has(div:text-is("harmonisedStandardReference"))');
        const unitCell = row.locator('.grid-cell').nth(2);
        const ontologyCell = row.locator('.grid-cell').nth(3);
        const tooltipCell = row.locator('.grid-cell').nth(4);
        
        // Assert the new structure: unit in 3rd, label in 4th, tooltip in 5th
        await expect(unitCell).toBeEmpty();
        await expect(ontologyCell).toHaveText('Harmonised European Standard (hEN)');
        const tooltipButton = tooltipCell.locator('button.tooltip-button');
        await expect(tooltipButton).toBeVisible();

        // Test the modal functionality instead of the title attribute
        await tooltipButton.click();
        
        const modal = page.locator('.tooltip-modal');
        await expect(modal).toBeVisible();
        await expect(modal).toContainText('A reference (URI or identifier) to the applicable Harmonised European Standard (hEN) used for assessing the product.');

        const overlay = page.locator('.tooltip-modal-overlay');
        await expect(overlay).toBeVisible();

        // Close the modal and assert it's gone
        await modal.locator('.modal-close-btn').click();
        await expect(modal).not.toBeVisible();
        await expect(overlay).not.toBeVisible();

        // The EPD object is optional, so we need to add it first.
        await page.locator('button[data-optional-object="epd"]').click();
        await page.locator('button[data-optional-object="gwp"]').click();
        await expect(page.locator('input[name="epd.gwp.a1"]')).toBeVisible();

        // Check that the EPD labels are being rendered correctly for leaf nodes
        const epdRow = page.locator('.grid-row:has-text("epd.gwp.a1")');
        const epdUnitCell = epdRow.locator('.grid-cell').nth(2);
        const epdOntologyCell = epdRow.locator('.grid-cell').nth(3);
        await expect(epdUnitCell).not.toBeEmpty(); // Should have a unit like kg CO2 eq.
        await expect(epdOntologyCell).toHaveText('A1: Raw material supply');

        // And check for the "Governed By" standard in the tooltip
        const epdTooltipCell = epdRow.locator('.grid-cell').nth(4);
        const epdTooltipButton = epdTooltipCell.locator('button.tooltip-button');
        await expect(epdTooltipButton).toBeVisible();

        await epdTooltipButton.click();
        
        const epdModal = page.locator('.tooltip-modal');
        await expect(epdModal).toBeVisible();
        await expect(epdModal).toContainText('Standard: EN 15804:2012+A2:2019');

        // Close the modal and assert it's gone
        await epdModal.locator('.modal-close-btn').click();
        await expect(epdModal).not.toBeVisible();

        // FAILING TEST FOR TASK 3b: Assert hierarchical header row for 'epd.gwp'
        const headerRow = page.locator('.grid-row:has(.grid-cell:text-is("epd.gwp"))');
        await expect(headerRow).toHaveClass(/grid-row-header/); // Assert header style
        const headerValueCell = headerRow.locator('.grid-cell').nth(1);
        await expect(headerValueCell).not.toBeEmpty();
        await expect(headerValueCell.locator('button')).toHaveText('Remove');
        const headerUnitCell = headerRow.locator('.grid-cell').nth(2);
        await expect(headerUnitCell).toBeEmpty(); // No unit for a header row
        const headerOntologyCell = headerRow.locator('.grid-cell').nth(3);
        await expect(headerOntologyCell).toHaveText('Global Warming Potential');
        break;
      case 'electronics':
        await expect(page.locator('input[name="torque"]')).toBeVisible();
        break;
      case 'textile':
        // For array fields, the form builder creates an "Add" button
        await expect(page.locator('button[data-array-name="fibreComposition"]')).toBeVisible();
        break;
    }
  });
}


for (const sector of sectors) {
  test(`audit ontology labels for ${sector} sector`, async ({ page }) => {
    await page.goto('/spec/wizard/index.html');

    // Add the sector form
    const addSectorBtn = page.locator(`button[data-sector="${sector}"]`);
    await addSectorBtn.click();

    // Wait for the form to be generated and not be empty
    const sectorFormContainer = page.locator(`#sector-form-${sector}`);
    await expect(sectorFormContainer).not.toBeEmpty({ timeout: 10000 });

    const missingLabels = [];

    // Get all rows that represent a data field
    // This selector finds rows that have an input or select in the second cell, ignoring action buttons.
    const inputRows = sectorFormContainer.locator('.grid-row:has(.grid-cell:nth-child(2) > input, .grid-cell:nth-child(2) > select)');
    
    for (const row of await inputRows.all()) {
      const pathCell = row.locator('.grid-cell').nth(0);
      const labelCell = row.locator('.grid-cell').nth(3);
      
      const pathText = await pathCell.textContent();
      const labelText = await labelCell.textContent();

      // We only care about rows that have a path
      if (pathText && pathText.trim() !== '') {
        if (!labelText || labelText.trim() === '') {
          missingLabels.push(pathText.trim());
        }
      }
    }

    // The test fails if the missingLabels array is not empty, and Playwright will print the array content.
    expect(missingLabels, `The following fields in the '${sector}' sector are missing ontology labels`).toEqual([]);
  });
}

test('should allow adding and removing sector forms', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  const addBatteryBtn = page.locator('button[data-sector="battery"]');
  const batteryFormContainer = page.locator('#sector-form-battery');

  // 1. Add the battery sector form
  await addBatteryBtn.click();

  // 2. Assert that the battery form container is visible
  await expect(batteryFormContainer).toBeVisible();
  
  // 3. Assert that the button has transformed into a "Remove" button
  await expect(addBatteryBtn).toHaveText('Remove Battery');
  await expect(addBatteryBtn).toHaveClass(/remove-btn-active/);

  // 4. Click the button again to remove the form
  await addBatteryBtn.click();

  // 5. Assert that the form container is no longer attached
  await expect(batteryFormContainer).not.toBeAttached();

  // 6. Assert that the button has reverted to an "Add" button
  await expect(addBatteryBtn).toHaveText('Add Battery');
  await expect(addBatteryBtn).not.toHaveClass(/remove-btn-active/);
});

test('should manage multiple sector forms independently', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  const addBatteryBtn = page.locator('button[data-sector="battery"]');
  const addConstructionBtn = page.locator('button[data-sector="construction"]');
  
  const batteryFormContainer = page.locator('#sector-form-battery');
  const constructionFormContainer = page.locator('#sector-form-construction');

  // 1. Add Battery sector
  await addBatteryBtn.click();
  await expect(batteryFormContainer).toBeVisible();
  await expect(addBatteryBtn).toHaveText('Remove Battery');

  // 2. Add Construction sector
  await addConstructionBtn.click();
  await expect(constructionFormContainer).toBeVisible();
  await expect(addConstructionBtn).toHaveText('Remove Construction');

  // 3. Assert both forms are still visible
  await expect(batteryFormContainer).toBeVisible();
  await expect(constructionFormContainer).toBeVisible();

  // 4. Remove Battery sector
  await addBatteryBtn.click();

  // 5. Assert Battery is gone, but Construction remains
  await expect(batteryFormContainer).not.toBeAttached();
  await expect(constructionFormContainer).toBeVisible();
  await expect(addBatteryBtn).toHaveText('Add Battery');
  await expect(addConstructionBtn).toHaveText('Remove Construction'); // Should still be a remove button

  // 6. Re-add Battery sector
  await addBatteryBtn.click();
  await expect(batteryFormContainer).toBeVisible();
  await expect(addBatteryBtn).toHaveText('Remove Battery');

  // 7. Final check: both forms are visible again
  await expect(batteryFormContainer).toBeVisible();
  await expect(constructionFormContainer).toBeVisible();
});

test('should generate a DPP containing data from multiple sectors', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  // 1. Add sectors
  await page.locator('button[data-sector="battery"]').click();
  await page.locator('button[data-sector="electronics"]').click();
  
  // Wait for forms to be visible
  await expect(page.locator('input[name="batteryCategory"]')).toBeVisible();
  await expect(page.locator('input[name="torque"]')).toBeVisible();

  // 2. Use the helper to fill all required fields
  await fillRequiredFields(page, 'dpp');
  await fillRequiredFields(page, 'battery');
  await fillRequiredFields(page, 'electronics');

  // 3. Assert the form is valid and generate DPP.
  const generateBtn = page.locator('#generate-dpp-btn');
  await expect(generateBtn).toBeVisible();
  await generateBtn.click();

  // 4. Get and parse output JSON.
  const output = await page.locator('#json-output').textContent();
  const dpp = JSON.parse(output);

  // 5. Assert that some data from each sector is present.
  // The exact values are generated by our helper, so we just check for presence.
  expect(dpp.granularity).toBeDefined(); // From core 'dpp' schema
  expect(dpp.batteryCategory).toBeDefined(); // From Battery
  expect(dpp.torque).toBeDefined(); // From Electronics
  
  // 6. Assert that contentSpecificationIds are correctly set
  expect(dpp.contentSpecificationIds).toEqual(['battery-product-dpp-v1', 'electronics-product-dpp-v1']);
});

test('language selector dropdown should be visible', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');
  const languageSelector = page.locator('#language-selector');
  await expect(languageSelector).toBeVisible();
});

test('should show and hide an error summary', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  const generateBtn = page.locator('#generate-dpp-btn');
  const showErrorsBtn = page.locator('#show-errors-btn');

  // Wait for the form to load by waiting for a known field.
  const dppIdInput = page.locator('input[name="digitalProductPassportId"]');
  await expect(dppIdInput).toBeVisible();

  // 1. First, make the form valid by filling in the initially required fields one by one.
  await expect(showErrorsBtn).toContainText('Show Errors (3)');

  const granularityInput = page.locator('select[name="granularity"]');
  await granularityInput.selectOption('Model');
  await granularityInput.blur();
  await expect(showErrorsBtn).toContainText('Show Errors (2)');

  const lastUpdateInput = page.locator('input[name="lastUpdate"]');
  await lastUpdateInput.fill('2025-12-15T10:00');
  await lastUpdateInput.blur();
  await expect(showErrorsBtn).toContainText('Show Errors (1)');

  const operatorInput = page.locator('input[name="economicOperatorId"]');
  await operatorInput.fill('https://example.com/operator/123');
  await operatorInput.blur();
  
  // 2. Assert that the form is now valid.
  await expect(generateBtn).toBeVisible();
  await expect(showErrorsBtn).toBeHidden();

  // 3. Enter an invalid value into a different field.
  await dppIdInput.fill('this is not a valid uri');
  await dppIdInput.blur();
  
  // 4. Assert the buttons have switched visibility and the error count is 1.
  await expect(generateBtn).toBeHidden();
  await expect(showErrorsBtn).toBeVisible();
  await expect(showErrorsBtn).toContainText('Show Errors (1)');

  // 5. Click the "Show Errors" button and assert the modal appears with the error.
  await showErrorsBtn.click();
  const errorModal = page.locator('.error-summary-modal');
  await expect(errorModal).toBeVisible();
  await expect(errorModal).toContainText('digitalProductPassportId');

  // 6. Correct the invalid value.
  await dppIdInput.fill('https://dpp.example.com/dpp/some-valid-id');
  await dppIdInput.blur();

  // 7. Assert the buttons have switched back.
  await expect(generateBtn).toBeVisible();
  await expect(showErrorsBtn).toBeHidden();
});

test('should show an error for non-numeric text in a number field', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  const generateBtn = page.locator('#generate-dpp-btn');
  const showErrorsBtn = page.locator('#show-errors-btn');

  // 1. Make the core form valid.
  await expect(page.locator('input[name="digitalProductPassportId"]')).toBeVisible();
  const granularityInput = page.locator('select[name="granularity"]');
  await granularityInput.selectOption('Model');
  await granularityInput.blur();

  const versionInput = page.locator('input[name="dppSchemaVersion"]');
  await versionInput.fill('1.0.0');
  await versionInput.blur();

  const statusInput = page.locator('input[name="dppStatus"]');
  await statusInput.fill('Active');
  await statusInput.blur();

  const lastUpdateInput = page.locator('input[name="lastUpdate"]');
  await lastUpdateInput.fill('2025-12-15T10:00');
  await lastUpdateInput.blur();

  const operatorInput = page.locator('input[name="economicOperatorId"]');
  await operatorInput.fill('https://example.com/operator/123');
  await operatorInput.blur();


  // 2. Add battery sector to get a number field.
  await page.locator('button[data-sector="battery"]').click();
  const numberInput = page.locator('input[name="nominalVoltage"]');
  await expect(numberInput).toBeVisible();
  
  // 3. Fill all other required battery fields to isolate the number field.
  const productNameInput = page.locator('input[name="productName"]');
  await productNameInput.fill('Test Battery');
  await productNameInput.blur();

  await page.locator('button[data-array-name="documents"]').click();
  const docUrlInput = page.locator('input[name="documents.0.url"]');
  await docUrlInput.fill('https://example.com/doc');
  await docUrlInput.blur();

  const batteryCategoryInput = page.locator('input[name="batteryCategory"]');
  await batteryCategoryInput.fill('Test Category');
  await batteryCategoryInput.blur();

  const batteryChemistryInput = page.locator('input[name="batteryChemistry"]');
  await batteryChemistryInput.fill('LFP');
  await batteryChemistryInput.blur();

  const dateOfManufactureInput = page.locator('input[name="dateOfManufacture"]');
  await dateOfManufactureInput.fill('2025-01-01');
  await dateOfManufactureInput.blur();

  const ratedCapacityInput = page.locator('input[name="ratedCapacity"]');
  await ratedCapacityInput.fill('100');
  await ratedCapacityInput.blur();

  const recycledContentPercentageInput = page.locator('input[name="recycledContentPercentage"]');
  await recycledContentPercentageInput.fill('10');
  await recycledContentPercentageInput.blur();

  const stateOfHealthInput = page.locator('input[name="stateOfHealth"]');
  await stateOfHealthInput.fill('99');
  await stateOfHealthInput.blur();

  // 4. At this point, only "nominalVoltage" should be invalid (because it's empty and required).
  await expect(generateBtn).toBeHidden();
  await expect(showErrorsBtn).toBeVisible();
  await expect(showErrorsBtn).toContainText('Show Errors (1)');

  // 5. Use page.evaluate to set the value directly and dispatch an event.
  const numberInputName = 'nominalVoltage';
  await page.evaluate((name) => {
      const input = document.querySelector(`input[name="${name}"]`);
      if (input) {
          input.value = 'this is not a number';
          input.dispatchEvent(new Event('blur', { bubbles: true }));
      }
  }, numberInputName);
  
  // The value is invalid text, so the error count should still be 1.
  await expect(showErrorsBtn).toContainText('Show Errors (1)');

  // 6. Click the "Show Errors" button and assert the modal appears with the error.
  await showErrorsBtn.click();
  const errorModal = page.locator('.error-summary-modal');
  await expect(errorModal).toBeVisible();
  await expect(errorModal).toContainText('nominalVoltage');
  await errorModal.locator('.modal-close-btn').click(); // Close the modal

  // 7. Now, enter a valid number.
  await numberInput.fill('12.5');
  await numberInput.blur();

  // 8. Assert the form is now valid.
  await expect(generateBtn).toBeVisible();
  await expect(showErrorsBtn).toBeHidden();
});

test('should validate on blur, not on every keystroke', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  const generateBtn = page.locator('#generate-dpp-btn');
  const showErrorsBtn = page.locator('#show-errors-btn');
  const dppIdInput = page.locator('input[name="digitalProductPassportId"]');

  // 1. Wait for the form to be ready.
  await expect(dppIdInput).toBeVisible();
  
  // 2. Clear the default value and focus the input.
  await dppIdInput.fill('');
  await dppIdInput.focus();
  
  // 3. Type an invalid value character by character.
  await dppIdInput.press('t');
  await dppIdInput.press('e');
  await dppIdInput.press('s');
  await dppIdInput.press('t');

  // 4. Assert that the field is NOT invalid yet, because blur hasn't happened.
  // The 'Generate' button should still be visible (assuming other fields are valid, which they are not,
  // so we check that the error count has not increased).
  // The initial error count is 3. After clearing the field, it's still 3.
  // After typing 'test', it should still be 3, not 4.
  await expect(showErrorsBtn).toContainText('Show Errors (3)');
  await expect(dppIdInput).not.toHaveClass(/invalid/);

  // 5. Blur the field to trigger validation.
  await dppIdInput.blur();
  
  // 6. Assert that the field is NOW invalid.
  await expect(dppIdInput).toHaveClass(/invalid/);
  await expect(generateBtn).toBeHidden();
  await expect(showErrorsBtn).toBeVisible();
  await expect(showErrorsBtn).toContainText('Show Errors (4)');
  
  // 7. Click the error summary to confirm the field is listed.
  await showErrorsBtn.click();
  const errorModal = page.locator('.error-summary-modal');
  await expect(errorModal).toBeVisible();
  await expect(errorModal).toContainText('digitalProductPassportId');
});

test('should show an error for non-numeric text in an EPD field', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');
  const showErrorsBtn = page.locator('#show-errors-btn');

  // 1. Add the construction sector.
  await page.locator('button[data-sector="construction"]').click();
  
  // The EPD object is optional, so we need to add it first.
  await page.locator('button[data-optional-object="epd"]').click();
  await page.locator('button[data-optional-object="gwp"]').click();

  // 2. Wait for the EPD fields to be visible.
  const epdInput = page.locator('input[name="epd.gwp.a1"]');
  await expect(epdInput).toBeVisible();

  // 3. Fill the input with invalid text.
  await epdInput.fill('stuff');
  await epdInput.blur();

  // 4. Assert that the field is now invalid.
  await expect(epdInput).toHaveClass(/invalid/);
  
  // 5. Assert that the main error button shows the error.
  // The count should be large because the construction form has many required fields,
  // but we only care that our new error is added.
  const errorCountText = await showErrorsBtn.textContent();
  const errorCount = parseInt(errorCountText.match(/\((\d+)\)/)[1], 10);
  expect(errorCount).toBeGreaterThan(5); // 5 from core, plus many from construction.

  // 6. Click the button and verify the field is listed in the modal.
  await showErrorsBtn.click();
  const errorModal = page.locator('.error-summary-modal');
  await expect(errorModal).toBeVisible();
  await expect(errorModal).toContainText('epd.gwp.a1');
});

test('validation error messages should disappear when the input is corrected', async ({ page }) => {
    await page.goto('/spec/wizard/index.html');

    const versionInput = page.locator('input[name="dppSchemaVersion"]');
    const errorSpanLocator = page.locator('#dppSchemaVersion-error');

    // 1. Trigger an error by clearing a required field.
    await versionInput.fill('');
    await versionInput.blur();
    
    // 2. Assert that the error message span is visible.
    await expect(errorSpanLocator).toBeVisible();
    await expect(errorSpanLocator).toHaveText('This field is required');

    // 3. Correct the error.
    await versionInput.fill('1.0.0');
    await versionInput.blur();

    // 4. Assert that the error message span is now gone. This is expected to fail.
    await expect(errorSpanLocator).not.toBeVisible();
});

test('validation should not create duplicate error messages', async ({ page }) => {
    await page.goto('/spec/wizard/index.html');
    
    // 1. Add the construction sector to get the EPD fields.
    await page.locator('button[data-sector="construction"]').click();
    // The EPD object is optional, so we need to add it first.
    await page.locator('button[data-optional-object="epd"]').click();
    await page.locator('button[data-optional-object="gwp"]').click();

    const epdInput = page.locator('input[name="epd.gwp.a1"]');
    await expect(epdInput).toBeVisible();

    const errorSpanSelector = 'span#epd-gwp-a1-error';

    // 2. Trigger a validation error.
    await epdInput.fill('not a number');
    await epdInput.blur();
    await expect(epdInput).toHaveClass(/invalid/);
    await expect(page.locator(errorSpanSelector)).toBeVisible();
    await expect(page.locator(errorSpanSelector)).toHaveCount(1);
    await expect(page.locator(errorSpanSelector)).toHaveText('Must be a valid number.');

    // 3. Trigger the same validation error again.
    await epdInput.fill('still not a number');
    await epdInput.blur();
    
    // 4. Assert that there is still only ONE error message. This is the key check for the duplicate bug.
    await expect(page.locator(errorSpanSelector)).toHaveCount(1);
    
    // 5. Now, correct the input.
    await epdInput.fill('123.45');
    await epdInput.blur();

    // 6. Assert that the input is now valid and the error message is gone.
    await expect(epdInput).not.toHaveClass(/invalid/);
    await expect(page.locator(errorSpanSelector)).not.toBeVisible();
});

test.describe('Conditional Validation for Optional Objects', () => {
  test('should not render optional object fields by default, showing an "Add" button instead', async ({ page }) => {
    await page.goto('/spec/wizard/index.html');

    // 1. Add the construction sector form, which contains the optional 'epd' object.
    await page.locator('button[data-sector="construction"]').click();
    
    // 2. Wait for the form to be generated. A known field from the form is a good signal.
    await expect(page.locator('input[name="harmonisedStandardReference"]')).toBeVisible();

    // 3. Assert that a field within the optional 'epd' object is NOT visible by default.
    await expect(page.locator('input[name="epd.gwp.a1"]')).not.toBeVisible();

    // 4. Assert that a placeholder "Add EPD" button IS visible.
    await expect(page.locator('button[data-optional-object="epd"]')).toBeVisible();
  });

  test('should update error count when an optional object is added and removed', async ({ page }) => {
    await page.goto('/spec/wizard/index.html');
    const showErrorsBtn = page.locator('#show-errors-btn');

    // 1. Add the construction sector.
    await page.locator('button[data-sector="construction"]').click();
    
    // 2. Wait for form and get initial error count.
    // 3 from core. The construction sector's required fields are all inside
    // optional objects, so they don't add to the initial error count.
    await expect(showErrorsBtn).toContainText('Show Errors (3)', { timeout: 10000 });
    const initialErrorCount = 3;

    // 3. Add the optional 'epd' object and its nested 'gwp' object.
    await page.locator('button[data-optional-object="epd"]').click();
    await page.locator('button[data-optional-object="gwp"]').click();

    // 4. Assert that the error count has increased.
    // The 'epd' object and its children have 10 required fields.
    // This will fail (5z-h) because the new fields are not validated on add.
    const errorCountAfterAdd = initialErrorCount + 10; // 5 from core + 10 from epd.gwp
    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterAdd})`);

    // 5. Now, remove the 'epd' object, which contains 'gwp'.
    await page.locator('button[data-remove-optional-object="epd"]').click();

    // 6. Assert that the error count has returned to the initial value.
    // This will fail (5z-j) because the removal logic doesn't update validation state.
    await expect(showErrorsBtn).toContainText(`Show Errors (${initialErrorCount})`);
  });

  test('should update error count when an array item with required fields is added and removed', async ({ page }) => {
    await page.goto('/spec/wizard/index.html');
    const showErrorsBtn = page.locator('#show-errors-btn');

    // 1. Get initial error count from core schema.
    await expect(showErrorsBtn).toContainText('Show Errors (3)');
    const initialCoreErrorCount = 3;

    // 2. Add the battery sector.
    await page.locator('button[data-sector="battery"]').click();
    
    // 3. Wait for form and get new error count (5 from core + 8 from battery).
    const errorCountAfterSectorAdd = initialCoreErrorCount + 8;
    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterSectorAdd})`);

    // 4. Add an item to the 'documents' array.
    await page.locator('button[data-array-name="documents"]').click();

    // 5. Assert that the error count has increased by 1 (for the required 'documents.0.url' field). This will fail.
    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterSectorAdd + 1})`);

    // 6. Now, remove the item and assert the count returns to the previous value.
    await page.locator('.array-item-control-row[data-array-group="documents.0"] button:text-is("Remove")').click();
    await expect(showErrorsBtn).toContainText(`Show Errors (${errorCountAfterSectorAdd})`);
  });
});

test.describe('DPP Wizard - Input Validation', () => {
  test.beforeEach(async ({ page }) => {
      await page.goto('/spec/wizard/index.html');
      // Wait for the wizard to initialize (core form loaded)
      await expect(page.locator('input[name="digitalProductPassportId"]')).toBeVisible();
  });

  test('should trim whitespace from text inputs on blur', async ({ page }) => {
      // Use a custom field for this test as it's readily available
      await page.click('#add-voluntary-field-btn');
      
      const valueInput = page.locator('.voluntary-value').first();
      await valueInput.fill('  needs trimming  ');
      await valueInput.blur();
      
      // This is expected to fail until 5p-3d is implemented
      await expect(valueInput).toHaveValue('needs trimming');
  });

  test('should show error for control characters in text inputs', async ({ page }) => {
      await page.click('#add-voluntary-field-btn');
      
      const valueInput = page.locator('.voluntary-value').first();
      
      // Inject a control character (Bell \u0007) which should be rejected
      await valueInput.evaluate(el => {
          el.value = 'Bad\u0007Input';
          el.dispatchEvent(new Event('blur', { bubbles: true }));
      });
      
      // This is expected to fail until 5p-3d is implemented
      await expect(valueInput).toHaveClass(/invalid/);
      const errorMessage = page.locator('.voluntary-field-row .error-message');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('Invalid characters');
  });

  test('should enforce camelCase for custom field keys', async ({ page }) => {
      await page.click('#add-voluntary-field-btn');
      
      const nameInput = page.locator('.voluntary-name').first();
      await nameInput.fill('Invalid Key Name'); // Spaces and Title Case
      await nameInput.blur();
      
      // This is expected to fail until 5p-3d is implemented
      await expect(nameInput).toHaveClass(/invalid/);
      const errorMessage = page.locator('.voluntary-field-row .error-message');
      await expect(errorMessage).toBeVisible();
      await expect(errorMessage).toContainText('camelCase');
  });

  test('should update error count when custom fields have validation errors', async ({ page }) => {
      await page.goto('/spec/wizard/index.html');
      const showErrorsBtn = page.locator('#show-errors-btn');

      // 1. Get initial error count (core required fields).
      await expect(showErrorsBtn).toContainText('Show Errors (3)');
      const initialCount = 3;

      // 2. Add a custom field.
      await page.click('#add-voluntary-field-btn');
      const nameInput = page.locator('.voluntary-name').first();
      
      // 3. Enter an invalid key (space in name).
      await nameInput.fill('Invalid Key');
      await nameInput.blur();

      // 4. Assert error count increased.
      await expect(showErrorsBtn).toContainText(`Show Errors (${initialCount + 1})`);

      // 5. Fix the error.
      await nameInput.fill('validKey');
      await nameInput.blur();

      // 6. Assert error count returned to initial.
      await expect(showErrorsBtn).toContainText(`Show Errors (${initialCount})`);

      // 7. Add another field and make it invalid.
      await page.click('#add-voluntary-field-btn');
      const secondNameInput = page.locator('.voluntary-name').nth(1);
      await secondNameInput.fill('Another Invalid Key');
      await secondNameInput.blur();
      await expect(showErrorsBtn).toContainText(`Show Errors (${initialCount + 1})`);

      // 8. Remove the invalid row.
      const removeBtn = page.locator('.voluntary-field-row').nth(1).locator('button:text-is("Remove")');
      await removeBtn.click();

      // 9. Assert error count returned to initial (error cleared on remove).
      await expect(showErrorsBtn).toContainText(`Show Errors (${initialCount})`);
  });

  test('should require values for custom fields (except units)', async ({ page }) => {
      await page.click('#add-voluntary-field-btn');
      
      const nameInput = page.locator('.voluntary-name').first();
      const valueInput = page.locator('.voluntary-value').first();

      // 1. Check Value Field Required
      await valueInput.focus();
      await valueInput.blur();
      await expect(valueInput).toHaveClass(/invalid/);
      // We expect the generic "This field is required" message
      await expect(page.locator('.voluntary-field-row .error-message').last()).toHaveText('This field is required');

      // 2. Check Key Field Required
      await nameInput.focus();
      await nameInput.blur();
      await expect(nameInput).toHaveClass(/invalid/);
      await expect(page.locator('.voluntary-field-row .error-message').first()).toHaveText('This field is required');

      // 3. Check Unit Field Not Required
      const typeSelect = page.locator('.voluntary-type').first();
      await typeSelect.selectOption('Number');
      const unitInput = page.locator('.voluntary-unit').first();
      
      await unitInput.focus();
      await unitInput.blur();
      await expect(unitInput).not.toHaveClass(/invalid/);
  });

  test('should show error when custom field key collides with existing schema fields', async ({ page }) => {
      await page.goto('/spec/wizard/index.html');
      
      // 1. Do NOT add Battery sector explicitly.
      // We want to verify that collision detection works even for sectors not yet added to the form.

      // 2. Add custom field
      await page.click('#add-voluntary-field-btn');
      const nameInput = page.locator('.voluntary-name').first();

      // 3. Test Core collision
      await nameInput.fill('dppStatus'); // Core field
      await nameInput.blur();
      await expect(page.locator('.voluntary-field-row .error-message').first()).toHaveText('Field conflicts with Core');

      // 4. Test Sector collision
      await nameInput.fill('nominalVoltage'); // Battery field
      await nameInput.blur();
      await expect(page.locator('.voluntary-field-row .error-message').first()).toHaveText('Field conflicts with Battery');
  });

  test('should clear validation errors when changing voluntary field type', async ({ page }) => {
    const showErrorsBtn = page.locator('#show-errors-btn');

    // 1. Add a voluntary field
    await page.click('#add-voluntary-field-btn');
    const row = page.locator('.voluntary-field-row').last();
    const nameInput = row.locator('.voluntary-name');
    await nameInput.fill('myField');

    // 2. Select "Product Characteristic" (complex type with required fields)
    const typeSelect = row.locator('.voluntary-type');
    await typeSelect.selectOption({ label: 'Product Characteristic' });

    // 3. Wait for the required field to appear and be invalid (since it's empty)
    const charNameInput = row.locator('input[name="myField.characteristicName"]');
    await expect(charNameInput).toBeVisible();
    
    // Trigger validation by blurring the empty required field
    await charNameInput.focus();
    await charNameInput.blur();
    await expect(charNameInput).toHaveClass(/invalid/);

    // Assert that the error is tracked globally
    await expect(showErrorsBtn).toBeVisible();
    // We expect core errors (3) + 2 new errors (characteristicName, characteristicValue)
    await expect(showErrorsBtn).toContainText('Show Errors (5)'); 

    // 4. Change type to "Text" (simple type)
    await typeSelect.selectOption('Text');

    // 5. Assert that the complex fields are gone
    await expect(charNameInput).not.toBeVisible();

    // 6. Assert that the error count has decreased (bug: it stays at 4)
    // The previous error for 'myField.characteristicName' should be cleared.
    await expect(showErrorsBtn).toContainText('Show Errors (3)');
  });
});

test.describe('Design 016 - Dangling Field Overhaul', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/spec/wizard/index.html');
    // Wait for the wizard to initialize (core form loaded) to ensure ontologies are ready
    await expect(page.locator('input[name="digitalProductPassportId"]')).toBeVisible();
  });

  test('should load General Info and Packaging modules in the Voluntary Information section', async ({ page }) => {
    // 1. Click buttons in Section 2
    const addGeneralBtn = page.locator('button[data-sector="general-product"]');
    const addPackagingBtn = page.locator('button[data-sector="packaging"]');
    
    await expect(addGeneralBtn).toBeVisible();
    await expect(addPackagingBtn).toBeVisible();

    await addGeneralBtn.click();
    await addPackagingBtn.click();

    // 2. Assert forms are visible
    const generalForm = page.locator('#sector-form-general-product');
    const packagingForm = page.locator('#sector-form-packaging');
    
    await expect(generalForm).toBeVisible();
    await expect(packagingForm).toBeVisible();

    // 3. Assert they are inside the voluntary modules container
    const container = page.locator('#voluntary-modules-container');
    await expect(container).not.toBeEmpty();
    await expect(generalForm.locator('..')).toHaveId('voluntary-modules-container');
    await expect(packagingForm.locator('..')).toHaveId('voluntary-modules-container');

    // 4. Check content
    await expect(generalForm.locator('input[name="brand"]')).toBeVisible();
    await expect(packagingForm.locator('button[data-array-name="packagingMaterials"]')).toBeVisible();
  });

  test('should support Product Characteristic voluntary field type', async ({ page }) => {
    await page.click('#add-voluntary-field-btn');
    const row = page.locator('.voluntary-field-row').last();
    
    // Set Name
    const nameInput = row.locator('.voluntary-name');
    await nameInput.fill('myCharacteristic');

    // Select Type
    const typeSelect = row.locator('.voluntary-type');
    await typeSelect.selectOption({ label: 'Product Characteristic' });

    // Assert Fields
    const groupContainer = row.locator('.voluntary-group-container');
    // The fields are loaded asynchronously from a schema, so we just wait for them to appear
    await expect(groupContainer.locator('input[name="myCharacteristic.characteristicName"]')).toBeVisible();
    // 3. We expect the value field to be an editable text input, defaulting to string handling for mixed types.
    const valueInput = groupContainer.locator('input[name="myCharacteristic.characteristicValue"]');
    await expect(valueInput).toBeVisible();
    await expect(valueInput).toBeEditable();
    await expect(groupContainer.locator('input[name="myCharacteristic.testMethod"]')).toBeVisible();
  });

  test('should support Related Resource voluntary field type', async ({ page }) => {
    await page.click('#add-voluntary-field-btn');
    const row = page.locator('.voluntary-field-row').last();
    
    // Set Name
    const nameInput = row.locator('.voluntary-name');
    await nameInput.fill('myResource');

    // Select Type
    const typeSelect = row.locator('.voluntary-type');
    await typeSelect.selectOption({ label: 'Related Resource' });

    // Assert Fields (RelatedResource has resourceTitle, url, etc.)
    const groupContainer = row.locator('.voluntary-group-container');
    await expect(groupContainer.locator('input[name="myResource.resourceTitle"]')).toBeVisible();
    await expect(groupContainer.locator('input[name="myResource.url"]')).toBeVisible();
  });

  test('should generate valid JSON including General Info and Packaging data', async ({ page }) => {
    // 1. Add General Info
    await page.locator('button[data-sector="general-product"]').click();
    await page.locator('input[name="brand"]').fill('Test Brand');
    
    // 2. Add Packaging
    await page.locator('button[data-sector="packaging"]').click();
    await page.locator('button[data-array-name="packagingMaterials"]').click();
    await page.locator('input[name="packagingMaterials.0.packagingMaterialType"]').fill('Cardboard');

    // 3. Fill Core Required (to make valid)
    await fillRequiredFields(page, 'dpp');

    // 4. Generate
    await page.locator('#generate-dpp-btn').click();
    const output = await page.locator('#json-output').textContent();
    const dpp = JSON.parse(output);

    // 5. Assertions
    expect(dpp.brand).toBe('Test Brand');
    expect(dpp.packagingMaterials).toHaveLength(1);
    expect(dpp.packagingMaterials[0].packagingMaterialType).toBe('Cardboard');
    // Contexts check
    expect(JSON.stringify(dpp['@context'])).toContain('dpp-general-product.context.jsonld');
    expect(JSON.stringify(dpp['@context'])).toContain('dpp-packaging.context.jsonld');
  });
});
