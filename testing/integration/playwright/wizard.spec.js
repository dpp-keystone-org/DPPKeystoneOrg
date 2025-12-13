import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/DPP Wizard/);
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

    // Select the sector
    const sectorSelector = page.locator('#sector-select');
    await sectorSelector.selectOption(sector);

    // Wait for the form to be generated
    const sectorFormContainer = page.locator('#form-container');
    
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
        await expect(page.locator('input[name="declarationCode"]')).toBeVisible();
        // Check for a known-good nested field
        await expect(page.locator('input[name="notifiedBody.address.streetAddress"]')).toBeVisible();
        
        // Check that the ontology column is being populated
        const row = page.locator('.grid-row:has(div:text-is("harmonisedStandardReference"))');
        const ontologyCell = row.locator('.grid-cell').nth(2);
        const tooltipCell = row.locator('.grid-cell').nth(3);
        
        // Assert the new structure: label in 3rd col, tooltip button in 4th
        await expect(ontologyCell).toHaveText('Harmonised Standard Reference (hEN)');
        const tooltipButton = tooltipCell.locator('button.tooltip-button');
        await expect(tooltipButton).toBeVisible();
        await expect(tooltipButton).toHaveAttribute('title', 'A reference (URI or identifier) to the applicable Harmonised European Standard (hEN) used for assessing the product.');

        // This test should now pass because the schema-loader fix also fixed EPD rendering
        await expect(page.locator('input[name="epd.gwp.a1"]')).toBeVisible();
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

test('should handle switching between sectors', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');
  const sectorSelector = page.locator('#sector-select');

  const sectors = {
    battery: 'input[name="batteryCategory"]',
    construction: 'input[name="declarationCode"]',
    electronics: 'input[name="torque"]',
    textile: 'button[data-array-name="fibreComposition"]',
  };

  for (const [sector, locator] of Object.entries(sectors)) {
    await sectorSelector.selectOption(sector);
    await expect(page.locator(locator)).toBeVisible();
  }

  // Also test switching back to a previously selected sector
  await sectorSelector.selectOption('battery');
  await expect(page.locator(sectors.battery)).toBeVisible();
});
