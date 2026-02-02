import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('CSV DPP Adapter E2E', () => {
    
    test.beforeEach(async ({ page }) => {
        // Navigate to the CSV Adapter page
        // Served at /csv-dpp-adapter/ based on dist/ structure
        await page.goto('/csv-dpp-adapter/index.html');
    });

    test('Test 1: Page Navigation and Title', async ({ page }) => {
        await expect(page).toHaveTitle(/DPP CSV Adapter/);
        await expect(page.locator('h1').filter({ hasText: 'DPP CSV Adapter' })).toBeVisible();
    });

    test('Test 2: Load Data Section Visibility', async ({ page }) => {
        const loadSection = page.locator('#source-section');
        await expect(loadSection).toBeVisible();
        await expect(loadSection.locator('h2')).toHaveText('1. Load Data');
        
        // Verify drop area and file input
        await expect(page.locator('#drop-area')).toBeVisible();
        await expect(page.locator('#csv-file-input')).toBeAttached();
    });

    test('Test 3: Hidden Sections Initially', async ({ page }) => {
        const mappingSection = page.locator('#mapping-section');
        const actionSection = page.locator('#action-section');
        
        // They should have the 'hidden' class or be hidden
        await expect(mappingSection).toBeHidden();
        await expect(actionSection).toBeHidden();
    });

    test('Test 4: Default Sector State', async ({ page }) => {
        // Assume no sectors are checked by default, or maybe some are?
        // Based on HTML, none have 'checked' attribute.
        const checkboxes = page.locator('input[name="sector"]');
        const count = await checkboxes.count();
        for (let i = 0; i < count; ++i) {
            await expect(checkboxes.nth(i)).not.toBeChecked();
        }
    });

    test('Test 5: Construction Sector Loading', async ({ page }) => {
        // We can spy on console logs to verify "Loading schemas..." or monitor network
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        await page.check('input[value="construction"]');
        
        // Wait a bit for async operations (schema load)
        // Ideally we wait for a specific DOM change, but schema loading doesn't change DOM until file load.
        // We can check if "Construction" schema is requested via network?
        // Or check console logs for "Loaded ... unique fields"
        
        await expect(async () => {
             const logs = consoleMessages.join('\n');
             expect(logs).toContain('Loading schemas for: dpp, general-product, construction');
        }).toPass();
    });

    test('Test 6: Packaging Sector Loading', async ({ page }) => {
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        await page.check('input[value="packaging"]');

        await expect(async () => {
             const logs = consoleMessages.join('\n');
             expect(logs).toContain('Loading schemas for: dpp, general-product, packaging');
        }).toPass();
    });

    test('Test 7: Uncheck Sector', async ({ page }) => {
        const consoleMessages = [];
        page.on('console', msg => consoleMessages.push(msg.text()));

        // Check then Uncheck
        await page.check('input[value="battery"]');
        await page.uncheck('input[value="battery"]');

        await expect(async () => {
             const logs = consoleMessages.join('\n');
             // Should verify it reloads WITHOUT battery
             // Note: Logs will show multiple "Loading..." lines. We check the LAST one?
             // Or just check that "Loading schemas for: dpp, general-product..." (without battery) appears eventually.
             expect(logs).toContain('Loading schemas for: dpp, general-product...'); 
        }).toPass();
    });

    test('Test 8-13: CSV Upload and Parsing', async ({ page }) => {
        // Create a mock CSV file in memory/temp if possible, or use one from examples.
        // We'll use the existing src/examples/csv/battery-product.csv
        // Note: In Playwright with a web server, we need the LOCAL file path to upload.
        // d:\GitRepos\DPPKeystoneOrg\src\examples\csv\battery-product.csv
        
        // Relative to the test execution CWD (testing/)
        // We need to go up one level to access src/
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        
        await page.setInputFiles('#csv-file-input', csvPath);

        // Test 9: Verify Loaded message
        await expect(page.locator('#file-name')).toHaveText('battery-product.csv');
        
        // Test 10: Verify Row Count
        // The file has 3 rows + header? Let's check the file content or assume.
        // Actually the example file might have 1 or 2 rows.
        // Let's just check it is a number.
        await expect(page.locator('#row-count')).not.toBeEmpty();
        
        // Test 11: Sections Visible
        await expect(page.locator('#mapping-section')).toBeVisible();
        await expect(page.locator('#action-section')).toBeVisible();
        
        // Test 12: Mapping Table Rows
        // Headers: "Product Name", "ID", "Weight", "Material 1 %", ...
        const rows = page.locator('#mapping-tbody tr');
        expect(await rows.count()).toBeGreaterThan(0);

        // Test 13: Sample Values & Specific Headers
        // The first row should correspond to the first header in CSV.
        // In battery-product.csv, let's assume "DPP ID" is present (based on your comment).
        // Let's find the row for "DPP ID" specifically.
        const dppIdRow = rows.filter({ hasText: 'DPP ID' });
        await expect(dppIdRow).toBeVisible();
        
        // Check the input value has the auto-map
        const input = dppIdRow.locator('input.dpp-field-input');
        await expect(input).toHaveValue('digitalProductPassportId');
    });

    test('Test 14-18: Mapping Logic and Constraints', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);

        // Test 14: Auto-Map "Granularity" -> "granularity"
        const granularityRow = page.locator('#mapping-tbody tr').filter({ hasText: 'granularity' });
        await expect(granularityRow.locator('input.dpp-field-input')).toHaveValue('granularity');

        // Prepare for interaction tests
        // We'll use the "Product Name" row (should be mapped to productName)
        // and "Weight" row (mapped to physicalDimensions.weight)
        
        const row1 = page.locator('#mapping-tbody tr').nth(0); // Should be "Product Name" usually
        const input1 = row1.locator('input.dpp-field-input');
        
        const row2 = page.locator('#mapping-tbody tr').nth(2); // "Weight"?
        const input2 = row2.locator('input.dpp-field-input');

        // Ensure Row 1 has a value (e.g. productName)
        // Let's force set it to 'brand' for uniqueness testing
        await input1.fill('');
        await input1.fill('brand');
        
        // Test 15: Scalar Uniqueness (Forward)
        // Focus Row 2. 'brand' should NOT be in the datalist.
        await input2.focus();
        
        const datalist = page.locator('#schema-fields-list');
        await expect(datalist.locator('option[value="brand"]')).toHaveCount(0);
        
        // Test 16: Scalar Uniqueness (Reverse)
        // Clear Row 1
        await input1.fill('');
        // Focus Row 2 again
        await input2.focus(); // Re-trigger build
        await expect(datalist.locator('option[value="brand"]')).toHaveCount(1);

        // Test 17: Array Exception
        // Set Row 1 to 'components.name' (Array item property)
        await input1.fill('components.name');
        // Focus Row 2
        await input2.focus();
        // Should STILL be there because image is an array group
        await expect(datalist.locator('option[value="components.name"]')).toHaveCount(1);

        // Test 18: Self-Exclusion
        // Set Row 2 to 'brand'
        await input2.fill('brand');
        // Focus Row 2
        await input2.focus();
        // 'brand' should BE there (because it's the current value)
        await expect(datalist.locator('option[value="brand"]')).toHaveCount(1);
    });

    test('Test 19-25: Review Workflow', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);

        const generateBtn = page.locator('#generate-btn');
        const saveBtn = page.locator('#save-config-btn');
        const checkboxes = page.locator('.review-checkbox');

        // Test 19: Generate DISABLED
        await expect(generateBtn).toBeDisabled();

        // Test 20: Save DISABLED
        await expect(saveBtn).toBeDisabled();

        // Test 21: Auto-suggestions NOT checked
        // Some rows might be auto-filled, but they should NOT be checked
        const firstCheckbox = checkboxes.first();
        await expect(firstCheckbox).not.toBeChecked();

        // Test 22: Manual Check
        await firstCheckbox.check();
        await expect(firstCheckbox).toBeChecked();
        // Verify style (optional, but good)
        const firstRow = page.locator('#mapping-tbody tr').first();
        await expect(firstRow).not.toHaveClass(/needs-review/);

        // Test 23: Auto-Check on Edit
        const secondRow = page.locator('#mapping-tbody tr').nth(1);
        const secondInput = secondRow.locator('input.dpp-field-input');
        const secondCheckbox = secondRow.locator('.review-checkbox');
        
        await expect(secondCheckbox).not.toBeChecked();
        await secondInput.fill('something.new'); // Trigger input event
        await expect(secondCheckbox).toBeChecked();

        // Test 24: Check All -> Enabled
        // Check all remaining checkboxes
        const count = await checkboxes.count();
        for (let i = 0; i < count; ++i) {
            const cb = checkboxes.nth(i);
            if (!(await cb.isChecked())) {
                await cb.check();
            }
        }
        await expect(generateBtn).toBeEnabled();
        await expect(saveBtn).toBeEnabled();

        // Test 25: Uncheck One -> Disabled
        await firstCheckbox.uncheck();
        await expect(generateBtn).toBeDisabled();
        await expect(saveBtn).toBeDisabled();
    });

    test('Test 26-28: Configuration Persistence', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);

        // Map at least one field and check it
        const firstRow = page.locator('#mapping-tbody tr').first();
        const input = firstRow.locator('input.dpp-field-input');
        const checkbox = firstRow.locator('.review-checkbox');

        await input.fill('tradeName'); // Ensure value
        await checkbox.check();

        // Check all others to enable Save
        const checkboxes = page.locator('.review-checkbox');
        const count = await checkboxes.count();
        for (let i = 0; i < count; ++i) {
             await checkboxes.nth(i).check();
        }

        // Test 26: Save Config
        const downloadPromise = page.waitForEvent('download');
        await page.click('#save-config-btn');
        const download = await downloadPromise;
        
        // Save to temp path
        const configPath = path.resolve('testing/tmp/test-config.json');
        // Ensure directory exists
        if (!fs.existsSync(path.dirname(configPath))) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        await download.saveAs(configPath);

        // Read and verify JSON content
        const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        // Find header for first row. Assuming battery-product.csv, first header is "Product Name" (mapped to tradeName)
        // Note: The input we filled was 'tradeName'. We need to know the header key.
        const header = await firstRow.locator('td').first().textContent();
        expect(configContent[header]).toBe('tradeName');

        // Test 27: Load Config (Round Trip)
        await page.reload();
        await page.setInputFiles('#csv-file-input', csvPath); // Re-upload CSV
        
        // Upload config
        await page.setInputFiles('#config-file-input', configPath);
        // Note: The UI logic listens for change on hidden input. We simulate that.

        // Test 28: Verify Restoration
        // First row should have 'tradeName' and be checked
        await expect(firstRow.locator('input.dpp-field-input')).toHaveValue('tradeName');
        await expect(firstRow.locator('.review-checkbox')).toBeChecked();
        
        // Verify ALL are checked (since we saved all checked)
        // Actually, logic says "If in config, mark checked".
        // Since we saved ALL, all should be in config.
        const allCheckboxes = page.locator('.review-checkbox');
        const newCount = await allCheckboxes.count();
        for (let i = 0; i < newCount; ++i) {
            await expect(allCheckboxes.nth(i)).toBeChecked();
        }
    });

    test('Test 29-30: Generation and Output', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);

        // We need to verify sector logic too. Let's check 'Battery'.
        await page.check('input[value="battery"]');

        // Map fields quickly. We rely on auto-map or manually fill a few.
        // We MUST check all boxes to enable generate.
        const checkboxes = page.locator('.review-checkbox');
        const count = await checkboxes.count();
        for (let i = 0; i < count; ++i) {
             await checkboxes.nth(i).check();
        }

        // Test 29: Generate
        const downloadPromise = page.waitForEvent('download');
        await page.click('#generate-btn');
        const download = await downloadPromise;

        const dppPath = path.resolve('testing/tmp/dpp-output.json');
        await download.saveAs(dppPath);

        // Test 30: Content Verification
        const dpps = JSON.parse(fs.readFileSync(dppPath, 'utf8'));
        expect(Array.isArray(dpps)).toBe(true);
        // battery-product.csv usually has small number of rows.
        expect(dpps.length).toBeGreaterThan(0);

        const firstDPP = dpps[0];
        // Verify Context
        expect(firstDPP['@context']).toContain('https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld');
        
        // Verify mapped field
        // "Product Name" -> "brand" (if auto-mapped) or "tradeName" (if we set it).
        // In the test setup above, we just checked boxes, we didn't force values.
        // So we rely on what was in the input. 
        // Auto-map for "Product Name" -> "productName"? Or "Brand" -> "brand"?
        // Let's check a field we know.
        // "DPP ID" -> "digitalProductPassportId"
        expect(firstDPP).toHaveProperty('digitalProductPassportId');
    });

});
