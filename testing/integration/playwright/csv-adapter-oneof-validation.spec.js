import { test, expect } from '@playwright/test';
import path from 'path';

// Helper function to force hide the dropdown, preventing test interference.
const forceHideDropdown = async (page) => {
  await page.evaluate(() => {
    const dropdown = document.getElementById('autocomplete-dropdown');
    if (dropdown) {
      dropdown.classList.remove('visible');
    }
  });
};

test.describe('CSV Adapter - oneOf Validation', () => {
  const csvPath = path.resolve(process.cwd(), '../src/examples/csv/battery-product.csv');

  test.beforeEach(async ({ page }) => {
    // Navigate to the page via the test server.
    await page.goto('/csv-dpp-adapter/index.html');
    // Wait for the initial schema load to complete.
    await page.waitForFunction(() => window.dppSchemaLoaded === true);
  });

  // This is a shared setup sequence for all tests in this file. It serializes
  // operations to prevent race conditions between schema loading and table rendering.
  const setupTest = async (page) => {
    // 1. Load the file first. This renders the table with the default schema.
    await page.locator('#csv-file-input').setInputFiles(csvPath);
    await expect(page.locator('#mapping-tbody tr').last()).toBeVisible();

    // 2. NOW check the sector. This triggers an async schema update and re-render.
    await page.getByLabel('Battery').check();
    
    // 3. Robust Wait: Wait for a signal that the re-render with the NEW schema
    // is complete. The auto-mapping of a battery-specific field is a perfect signal.
    const mat1NameInput = page.locator('tr').filter({ has: page.getByText('Material 1 Name', { exact: true }) }).locator('input.dpp-field-input');
    await expect(mat1NameInput).toHaveValue('materialComposition[0].name');
  };

  test('should highlight rows with oneOf conflicts and then remove it', async ({ page }) => {
    await setupTest(page);

    const dppIdRow = page.locator('tr').filter({ has: page.getByText('DPP ID', { exact: true }) });
    const docUrlRow = page.locator('tr').filter({ has: page.getByText('DoC URL', { exact: true }) });
    
    const dppIdInput = dppIdRow.locator('input.dpp-field-input');
    const docUrlInput = docUrlRow.locator('input.dpp-field-input');
    const dppIdCheckbox = dppIdRow.locator('.review-checkbox');
    const docUrlCheckbox = docUrlRow.locator('.review-checkbox');

    // Create conflict and sync with UI by waiting for the checkbox side-effect.
    await dppIdInput.fill('dopc.declarationCode');
    await expect(dppIdCheckbox).toBeChecked();
    await docUrlInput.fill('dopc.url');
    await expect(docUrlCheckbox).toBeChecked();

    // Assert conflict styles
    await expect(dppIdRow).toHaveClass(/conflict-row/);
    await expect(docUrlRow).toHaveClass(/conflict-row/);
    await expect(dppIdInput).toHaveAttribute('title', /Conflict/);

    // Resolve conflict
    await docUrlInput.clear();
    await docUrlInput.dispatchEvent('input');
    
    // Assert conflict is resolved
    await expect(dppIdRow).not.toHaveClass(/conflict-row/);
    await expect(docUrlRow).not.toHaveClass(/conflict-row/);

    // Aggressive Cleanup
    await forceHideDropdown(page);
  });

  test('should proactively filter dropdown to prevent oneOf conflicts with nested fields', async ({ page }) => {
    await setupTest(page);

    // Create a oneOf selection and wait for the UI to update.
    const docUrlRow = page.locator('tr').filter({ has: page.getByText('DoC URL', { exact: true }) });
    const docUrlInput = docUrlRow.locator('input.dpp-field-input');
    const docUrlCheckbox = docUrlRow.locator('.review-checkbox');
    await docUrlInput.fill('dopc.url');
    await expect(docUrlCheckbox).toBeChecked();

    // Trigger Dropdown on a NUMERIC field to bypass type-filtering and isolate the oneOf logic.
    // "Mass (kg)" is numeric, and so is the target field "dopc.chlorideContent.21DegC".
    const massInput = page.locator('tr').filter({ has: page.getByText('Mass (kg)', { exact: true }) }).locator('input.dpp-field-input');
    await massInput.clear();
    await massInput.focus();

    const dropdown = page.locator('#autocomplete-dropdown');
    await expect(dropdown).toBeVisible();

    // Assertions
    await expect(dropdown.locator('li[data-value="dopc.declarationCode"]')).not.toBeVisible();
    // This is the core bug test, expected to fail because the oneOf logic is flawed.
    await expect(dropdown.locator('li[data-value="dopc.chlorideContent.21DegC"]')).not.toBeVisible();
    await expect(dropdown.locator('li[data-value="brand"]')).toBeVisible();

    // Aggressive Cleanup
    await forceHideDropdown(page);
  });

  test('should hide oneOf-conflicting fields by default and show them when toggled', async ({ page }) => {
    await setupTest(page);

    // Create a oneOf selection and wait for the UI to update.
    const docUrlRow = page.locator('tr').filter({ has: page.getByText('DoC URL', { exact: true }) });
    const docUrlInput = docUrlRow.locator('input.dpp-field-input');
    const docUrlCheckbox = docUrlRow.locator('.review-checkbox');
    await docUrlInput.fill('dopc.url');
    await expect(docUrlCheckbox).toBeChecked();

    // Trigger Dropdown and define locators
    const dppIdInput = page.locator('tr').filter({ has: page.getByText('DPP ID', { exact: true }) }).locator('input.dpp-field-input');
    await dppIdInput.clear();
    await dppIdInput.focus();
    
    const dropdown = page.locator('#autocomplete-dropdown');
    await expect(dropdown).toBeVisible();
    const conflictingItem = dropdown.locator('li[data-value="dopc.declarationCode"]');

    // Assert it's hidden by default
    await expect(conflictingItem).not.toBeVisible();

    // Enable toggle and assert it's now visible
    await page.locator('#show-incompatible-toggle').check();
    await dppIdInput.focus(); // Re-trigger
    await expect(dropdown).toBeVisible();
    await expect(conflictingItem).toBeVisible();
    await expect(conflictingItem).toHaveClass(/suggestion-incompatible/);

    // Hide the dropdown BEFORE attempting to click the toggle again.
    await forceHideDropdown(page);

    // Disable toggle and assert it's hidden again
    await page.locator('#show-incompatible-toggle').uncheck();
    await dppIdInput.focus(); // Re-trigger
    await expect(dropdown).toBeVisible();
    await expect(conflictingItem).not.toBeVisible();

    // Aggressive Cleanup
    await forceHideDropdown(page);
  });
});
