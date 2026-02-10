import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('CSV DPP Adapter E2E', () => {

    // A common setup function for tests that need a valid, post-validation state.
    const loadCsvAndFixValidation = async (page) => {
        const csvPath = path.resolve(process.cwd(), '../src/examples/csv/battery-product.csv');
        await page.locator('#csv-file-input').setInputFiles(csvPath);
        
        // Wait for table to appear
        await expect(page.locator('#mapping-tbody tr').last()).toBeVisible();
    
        // Select battery sector to ensure all fields are available
        await page.getByLabel('Battery').check();
        // Wait for re-render by checking for a battery-specific auto-map
        await expect(page.locator('tr').filter({ has: page.getByText('Material 1 Name', { exact: true }) }).locator('.dpp-field-input')).toHaveValue('materialComposition[0].name');
    
        // Manually map all required fields that the auto-mapper misses to clear validation errors.
        const mappingsToFix = {
            'Product ID': 'uniqueProductIdentifier',
            'Mass (kg)': 'batteryMass',
            'Manufacturer City': 'manufacturerInfo.address.addressLocality',
            'Manufacturer Zip': 'manufacturerInfo.address.postalCode',
            'Recycled Pre 1 %': 'preConsumerRecycledMaterialComposition[0].weightPercentage',
            'Recycled Post 1 %': 'postConsumerRecycledMaterialComposition[0].weightPercentage',
            'Recycled Post 2 %': 'postConsumerRecycledMaterialComposition[1].weightPercentage'
        };

        for (const [csvHeader, schemaPath] of Object.entries(mappingsToFix)) {
            const input = page.locator('tr').filter({ has: page.getByText(csvHeader, { exact: true }) }).locator('input.dpp-field-input');
            await input.fill(schemaPath);
        }
        
        // Assert that we are in a valid state by polling the UI.
        await expect(async () => {
            await expect(page.locator('#show-errors-btn')).toBeHidden();
            await expect(page.locator('#generate-btn')).toBeVisible();
        }).toPass();
    };
    
    test.beforeEach(async ({ page }) => {
        await page.goto('/csv-dpp-adapter/index.html');
        await page.waitForFunction(() => window.dppSchemaLoaded === true);
    });

    test('Test 1: Page Navigation and Title', async ({ page }) => {
        await expect(page).toHaveTitle(/DPP CSV Adapter/);
        await expect(page.locator('h1').filter({ hasText: 'DPP CSV Adapter' })).toBeVisible();
    });

    test('Test 2: Load Data Section Visibility', async ({ page }) => {
        const loadSection = page.locator('#source-section');
        await expect(loadSection).toBeVisible();
        await expect(loadSection.locator('h2')).toHaveText('1. Load Data');
        
        await expect(page.locator('#drop-area')).toBeVisible();
        await expect(page.locator('#csv-file-input')).toBeAttached();
    });

    test('Test 3: Hidden Sections Initially', async ({ page }) => {
        await expect(page.locator('#mapping-section')).toBeHidden();
        await expect(page.locator('#action-section')).toBeHidden();
    });

    test('Test 4: Default Sector State', async ({ page }) => {
        const checkboxes = page.locator('input[name="sector"]');
        const count = await checkboxes.count();
        for (let i = 0; i < count; ++i) {
            await expect(checkboxes.nth(i)).not.toBeChecked();
        }
    });

    test('Test 5: Construction Sector Loading', async ({ page }) => {
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        await page.check('input[value="construction"]');
        
        await expect(async () => {
             const logs = consoleMessages.join('\n');
             expect(logs).toContain('Loading schemas for: dpp, general-product, construction');
        }).toPass();
    });

    // This group of tests now validates the new error-handling behavior on initial load.
    test('Test 8-13: CSV Upload and Initial Validation', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);

        // Test 9: Verify Loaded message
        await expect(page.locator('#file-name')).toHaveText('battery-product.csv');
        
        // Test 10: Verify Row Count
        await expect(page.locator('#row-count')).not.toBeEmpty();
        
        // Test 11: Sections Visible
        await expect(page.locator('#mapping-section')).toBeVisible();
        await expect(page.locator('#action-section')).toBeVisible();
        
        // Test 12: NEW BEHAVIOR - "Show Errors" button should be visible
        await expect(page.locator('#show-errors-btn')).toBeVisible();
        await expect(page.locator('#generate-btn')).toBeHidden();
        await expect(page.locator('#error-count-badge')).toHaveText('2'); // Now expecting 'uniqueProductIdentifier' and 'contentSpecificationIds'

        // Test 13: NEW BEHAVIOR - Check modal content
        await page.click('#show-errors-btn');
        const modal = page.locator('.error-summary-modal');
        await expect(modal).toBeVisible();
        const errorItems = modal.locator('li');
        await expect(errorItems).toHaveCount(2);

        const errorTexts = await errorItems.allTextContents();
        expect(errorTexts.some(text => text.includes('Empty mapping for required field: uniqueProductIdentifier'))).toBe(true);
        expect(errorTexts.some(text => text.includes('Empty mapping for required field: contentSpecificationIds'))).toBe(true);
    });

    test('Test 14-18: Mapping Logic and Constraints', async ({ page }) => {
        await loadCsvAndFixValidation(page); // Use new helper

        const row1 = page.locator('#mapping-tbody tr').nth(0);
        const input1 = row1.locator('input.dpp-field-input');
        
        const row2 = page.locator('#mapping-tbody tr').nth(2);
        const input2 = row2.locator('input.dpp-field-input');

        await input1.fill('');
        await input1.fill('brand');
        
        await input2.fill(''); 
        await input2.focus();
        
        const dropdown = page.locator('#autocomplete-dropdown');
        await expect(dropdown.locator('li[data-value="brand"]')).toHaveCount(0);
        
        await input1.fill('');
        await input2.focus();
        await expect(dropdown.locator('li[data-value="brand"]')).toHaveCount(1);
    });

    test('Test 19-25: Review Workflow', async ({ page }) => {
        await loadCsvAndFixValidation(page); // Use new helper

        const generateBtn = page.locator('#generate-btn');
        const saveBtn = page.locator('#save-config-btn');
        const checkboxes = page.locator('.review-checkbox');

        // Test 19: After validation fix, Generate should be VISIBLE but DISABLED (pending review)
        await expect(generateBtn).toBeVisible();
        await expect(generateBtn).toBeDisabled();

        // Test 20: Save should be VISIBLE but DISABLED
        await expect(saveBtn).toBeVisible();
        await expect(saveBtn).toBeDisabled();

        // Test 21 & 22
        const firstCheckbox = checkboxes.first();
        await expect(firstCheckbox).not.toBeChecked();
        await firstCheckbox.check();
        await expect(firstCheckbox).toBeChecked();

        // Test 23
        const secondRow = page.locator('#mapping-tbody tr').nth(1);
        const secondInput = secondRow.locator('input.dpp-field-input');
        const secondCheckbox = secondRow.locator('.review-checkbox');
        const originalValue = await secondInput.inputValue();
        await secondInput.fill('something.new');
        await expect(secondCheckbox).toBeChecked();
        await secondInput.fill(originalValue); // Restore original value

        // Test 24: Check All -> Enabled
        await page.click('#approve-all-btn');
        await expect(async () => {
            await expect(generateBtn).toBeEnabled();
            await expect(saveBtn).toBeEnabled();
        }).toPass();

        // Test 25: Uncheck One -> Disabled
        await firstCheckbox.uncheck();
        await expect(generateBtn).toBeDisabled();
        await expect(saveBtn).toBeDisabled();
    });

    test('Test 26-28: Configuration Persistence', async ({ page }) => {
        await loadCsvAndFixValidation(page); // Use new helper

        const firstRow = page.locator('#mapping-tbody tr').nth(0);
        const secondRow = page.locator('#mapping-tbody tr').nth(1);
        const input1 = firstRow.locator('input.dpp-field-input');
        const input2 = secondRow.locator('input.dpp-field-input');
        const saveBtn = page.locator('#save-config-btn');

        // Get original values
        const originalValue1 = await input1.inputValue();
        const originalValue2 = await input2.inputValue();

        // Swap them
        await input1.fill(originalValue2);
        await input2.fill(originalValue1);

        // Approve all and check if save is enabled
        await page.click('#approve-all-btn');
        await expect(async () => {
            await expect(saveBtn).toBeEnabled();
        }).toPass();

        // Test 26: Save Config
        const downloadPromise = page.waitForEvent('download');
        await page.click('#save-config-btn');
        const download = await downloadPromise;

        const configPath = path.resolve(process.cwd(), 'tmp/test-config.json');
        if (!fs.existsSync(path.dirname(configPath))) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        await download.saveAs(configPath);

        const header1 = await firstRow.locator('td').first().textContent();
        const header2 = await secondRow.locator('td').first().textContent();
        const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        expect(configContent[header1]).toBe(originalValue2);
        expect(configContent[header2]).toBe(originalValue1);

        // Test 27 & 28: Load Config (Round Trip)
        await page.reload();
        await page.waitForFunction(() => window.dppSchemaLoaded === true);

        await page.setInputFiles('#csv-file-input', path.resolve(process.cwd(), '../src/examples/csv/battery-product.csv'));
        await expect(page.locator('#mapping-tbody tr').first()).toBeVisible();
        await page.setInputFiles('#config-file-input', configPath);

        await expect(input1).toHaveValue(originalValue2);
        await expect(input2).toHaveValue(originalValue1);
        await expect(firstRow.locator('.review-checkbox')).toBeChecked();
        await expect(secondRow.locator('.review-checkbox')).toBeChecked();
    });

    test('Test 29-30: Generation and Output', async ({ page }) => {
        await loadCsvAndFixValidation(page); // Use new helper

        // Map fields and approve all
        await page.click('#approve-all-btn');

        // Test 29: Generate
        const downloadPromise = page.waitForEvent('download');
        await page.click('#generate-btn');
        const download = await downloadPromise;

        const dppPath = path.resolve(process.cwd(), 'tmp/dpp-output.json');
        await download.saveAs(dppPath);

        // Test 30: Content Verification
        const dpps = JSON.parse(fs.readFileSync(dppPath, 'utf8'));
        expect(Array.isArray(dpps)).toBe(true);
        expect(dpps.length).toBeGreaterThan(0);

        const firstDPP = dpps[0];
        expect(firstDPP['@context']).toContain('https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld');
        expect(firstDPP).toHaveProperty('digitalProductPassportId');
    });
});
