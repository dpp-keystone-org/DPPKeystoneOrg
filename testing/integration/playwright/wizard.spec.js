import { test, expect } from '@playwright/test';
import { CONTEXT_URL_TO_LOCAL_PATH_MAP } from '../test-helpers.mjs';
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

        // Check that the EPD labels are being rendered correctly for leaf nodes
        const epdRow = page.locator('.grid-row:has-text("epd.gwp.a1")');
        const epdOntologyCell = epdRow.locator('.grid-cell').nth(2);
        await expect(epdOntologyCell).toHaveText('A1: Raw material supply');

        // FAILING TEST FOR TASK 3b: Assert hierarchical header row for 'epd.gwp'
        const headerRow = page.locator('.grid-row:has(.grid-cell:text-is("epd.gwp"))');
        await expect(headerRow).toHaveClass(/grid-row-header/); // Assert header style
        const headerValueCell = headerRow.locator('.grid-cell').nth(1);
        await expect(headerValueCell).toBeEmpty(); // Assert non-editable
        const headerOntologyCell = headerRow.locator('.grid-cell').nth(2);
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

for (const sector of sectors) {
  test(`audit ontology labels for ${sector} sector`, async ({ page }) => {
    await page.goto('/spec/wizard/index.html');

    // Select the sector
    const sectorSelector = page.locator('#sector-select');
    await sectorSelector.selectOption(sector);

    // Wait for the form to be generated and not be empty
    const sectorFormContainer = page.locator('#form-container');
    await expect(sectorFormContainer).not.toBeEmpty({ timeout: 10000 });

    const missingLabels = [];

    // Get all rows that represent a data field
    // This selector finds rows that have an input, select, or button in the second cell
    const inputRows = sectorFormContainer.locator('.grid-row:has(.grid-cell:nth-child(2) > input, .grid-cell:nth-child(2) > select, .grid-cell:nth-child(2) > button)');
    
    for (const row of await inputRows.all()) {
      const pathCell = row.locator('.grid-cell').nth(0);
      const labelCell = row.locator('.grid-cell').nth(2);
      
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
