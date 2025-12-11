import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/spec/wizard/index.html');

  // Expect a title "to contain" a substring.
  await expect(page).toHaveTitle(/DPP Wizard/);
});

test('loads construction sector form', async ({ page }) => {
  // Listen for all console events and log them to the test's console
  page.on('console', msg => {
    const logArgs = msg.args().map(arg => arg.toString().replace('JSHandle@', ''));
    console.log(`[BROWSER CONSOLE] ${msg.type().toUpperCase()}:`, ...logArgs);
  });

  await page.goto('/spec/wizard/index.html');

  // Select the "Construction" sector
  const sectorSelector = page.locator('#sector-select');
  await sectorSelector.selectOption('construction');

  // Wait for the form to be generated
  const sectorFormContainer = page.locator('#form-container');
  
  // Assert that the form container is not empty
  await expect(sectorFormContainer).not.toBeEmpty();

  // Specifically, check that it contains the grid rows for the form
  const gridRows = sectorFormContainer.locator('.grid-row');
  expect(await gridRows.count()).toBeGreaterThan(0);
});
