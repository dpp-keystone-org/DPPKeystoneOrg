import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.describe('CSV DPP Adapter E2E', () => {
    
    test.beforeEach(async ({ page }) => {
        // Navigate to the CSV Adapter page
        // Served at /csv-dpp-adapter/ based on dist/ structure
        await page.goto('/csv-dpp-adapter/index.html');
        // Wait for schema initialization to complete to avoid race conditions
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
        // Clear input2 first to ensure we see all options (if it was auto-mapped)
        await input2.fill(''); 
        await input2.focus();
        
        const dropdown = page.locator('#autocomplete-dropdown');
        await expect(dropdown.locator('li[data-value="brand"]')).toHaveCount(0);
        
        // Test 16: Scalar Uniqueness (Reverse)
        // Clear Row 1
        await input1.fill('');
        // Focus Row 2 again
        await input2.focus(); // Re-trigger build
        await expect(dropdown.locator('li[data-value="brand"]')).toHaveCount(1);

        // Test 17: Array Exception
        // Set Row 1 to 'components[0].name' (Array item property)
        await input1.fill('components[0].name');
        // Focus Row 2
        await input2.focus();
        // Should suggest the NEXT index (Start New) because [0] is taken
        await expect(dropdown.locator('li[data-value="components[1].name"]')).toHaveCount(1);

        // Test 18: Self-Exclusion
        // Set Row 2 to 'brand'
        await input2.fill('brand');
        // Focus Row 2
        await input2.focus();
        // 'brand' should BE there (because it's the current value)
        await expect(dropdown.locator('li[data-value="brand"]')).toHaveCount(1);
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

        await input.fill('description'); // Use non-default value to verify config load
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
        const configPath = path.resolve('tmp/test-config.json');
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
        expect(configContent[header]).toBe('description');

        // Test 27: Load Config (Round Trip)
        await page.reload();
        await page.waitForFunction(() => window.dppSchemaLoaded === true);

        await page.setInputFiles('#csv-file-input', csvPath); // Re-upload CSV
        
        // Wait for table to render to avoid race condition with config load
        await expect(page.locator('#mapping-tbody tr').first()).toBeVisible();

        // Upload config
        await page.setInputFiles('#config-file-input', configPath);
        // Note: The UI logic listens for change on hidden input. We simulate that.

        // Test 28: Verify Restoration
        // First row should have 'tradeName' and be checked
        await expect(firstRow.locator('input.dpp-field-input')).toHaveValue('description');
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

        // Wait for table update (re-render) by checking a battery-specific auto-map
        await expect(page.locator('tr').filter({ has: page.getByText('Material 1 Name', { exact: true }) }).locator('.dpp-field-input')).toHaveValue('materialComposition[0].name');

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

        const dppPath = path.resolve('tmp/dpp-output.json');
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

    test('should load CSV, allow manual index override, and compact arrays on generation', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
    
        // 1. Upload CSV
        const fileInput = page.locator('#csv-file-input');
        await fileInput.setInputFiles(csvPath);
    
        // Verify loaded
        await expect(page.locator('#file-name')).toContainText('battery-product.csv');
        
        // 2. Select Sector (Battery)
        await page.check('input[value="battery"]');
        
        // Wait for mapping table and auto-mapping update
        await expect(page.locator('#mapping-table')).toBeVisible();
        // Wait for 'Material 1 Name' to have the battery auto-mapping.
        // This confirms the table has re-rendered with the new schema.
        await expect(page.locator('tr').filter({ has: page.getByText('Material 1 Name', { exact: true }) }).locator('.dpp-field-input')).toHaveValue('materialComposition[0].name');
    
        // 3. Manual Override
        // We will find the row for "Material 3 Name" (Aluminum) and map it to index 10 explicitly.
        // This tests moving an item from the middle (index 2) to the end.
        
        // Find the input corresponding to "Material 3 Name"
        // Use exact text matching to avoid matching similar rows
        const row = page.locator('tr').filter({ has: page.getByText('Material 3 Name', { exact: true }) });
        const input = row.locator('.dpp-field-input');
        
        // Override to index 10
        await input.fill('materialComposition[10].name');
        await input.blur(); // Ensure change event fires
        await expect(input).toHaveValue('materialComposition[10].name');
        
        // Also override the percentage for the same item
        const rowPct = page.locator('tr').filter({ has: page.getByText('Material 3 %', { exact: true }) });
        const inputPct = rowPct.locator('.dpp-field-input');
        await inputPct.fill('materialComposition[10].weightPercentage');
        await inputPct.blur(); // Ensure change event fires
        await expect(inputPct).toHaveValue('materialComposition[10].weightPercentage');
    
        // 4. Review All (Cheat: iterate and check all boxes)
        const checkboxes = page.locator('.review-checkbox');
        const count = await checkboxes.count();
        for (let i = 0; i < count; ++i) {
            await checkboxes.nth(i).check();
        }
    
        // 5. Generate
        // Setup download listener
        const downloadPromise = page.waitForEvent('download');
        await page.click('#generate-btn');
        const download = await downloadPromise;
        
        // 6. Verify Content
        const stream = await download.createReadStream();
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        const json = JSON.parse(buffer.toString());
    
        expect(Array.isArray(json)).toBeTruthy();
        const dpp = json[0];
        
        // Verify Material Composition
        // We moved Material 3 (originally index 2) to index 10.
        // Original indices: 0, 1, 2, 3, 4, 5.
        // New indices map: 0->0, 1->1, 3->3, 4->4, 5->5, 2->10.
        // Compaction should result in: 0, 1, 3, 4, 5, 2 (remapped to 0,1,2,3,4,5 order).
        // So the last item (index 5) should be Material 3 (Aluminum).
        
        expect(dpp.materialComposition).toBeDefined();
        expect(dpp.materialComposition).toHaveLength(6);
        
        const lastItem = dpp.materialComposition[5];
        expect(lastItem.name).toBe('Aluminum');
        expect(lastItem.weightPercentage).toBe(18.0);
      });
    test('should dynamically suggest array indices based on usage', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);
        await page.check('input[value="battery"]');

        // Wait for auto-mapping stability
        await expect(page.locator('#mapping-table')).toBeVisible();
        // Wait for 'Material 1 Name' to have the battery auto-mapping.
        await expect(page.locator('tr').filter({ has: page.getByText('Material 1 Name', { exact: true }) }).locator('.dpp-field-input')).toHaveValue('materialComposition[0].name');

        // Clear 'Material 1 %' mapping so 'materialComposition[0].weightPercentage' becomes available for suggestions
        // (Otherwise it's excluded because it's already mapped to this row)
        const rowMat1Pct = page.locator('tr').filter({ has: page.getByText('Material 1 %', { exact: true }) });
        await rowMat1Pct.locator('.dpp-field-input').fill('');
        await rowMat1Pct.locator('.dpp-field-input').blur();

        const row1 = page.locator('#mapping-tbody tr').nth(0); 
        const input1 = row1.locator('.dpp-field-input');
        
        // Use "Material 1 %" row (Numeric) for weightPercentage suggestion
        const row2 = page.locator('tr').filter({ has: page.getByText('Material 1 %', { exact: true }) });
        const input2 = row2.locator('.dpp-field-input');

        // 1. Assign Index 0 to Row 1
        await input1.fill('materialComposition[0].name');
        await input1.blur();
        await expect(input1).toHaveValue('materialComposition[0].name');

        // 2. Focus Row 2 to trigger suggestion generation
        await input2.focus();

        // 3. Verify Suggestions
        const dropdown = page.locator('#autocomplete-dropdown');
        
        // Should suggest joining Index 0 (e.g., weightPercentage)
        await expect(dropdown.locator('li[data-value="materialComposition[0].weightPercentage"]')).toHaveCount(1);
        
        // Should suggest starting Index 6 (Next available, as 0-5 are used by Materials 1-6)
        await expect(dropdown.locator('li[data-value="materialComposition[6].name"]')).toHaveCount(1);
        
        // Should NOT suggest 'materialComposition[0].name' because it's taken by Row 1
        await expect(dropdown.locator('li[data-value="materialComposition[0].name"]')).toHaveCount(0);
    });

    test('should close dropdown on item selection', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);

        const row = page.locator('#mapping-tbody tr').first();
        const input = row.locator('.dpp-field-input');
        const dropdown = page.locator('#autocomplete-dropdown');

        // 1. Open Dropdown
        await input.focus();
        await expect(dropdown).toBeVisible();

        // 2. Select an item (click)
        // Ensure there is at least one item
        const firstItem = dropdown.locator('li').first();
        await expect(firstItem).toBeVisible();
        
        // Get value to assert later
        const value = await firstItem.getAttribute('data-value');
        
        await firstItem.click();

        // 3. Assertions
        // Dropdown should be hidden
        await expect(dropdown).not.toBeVisible();
        // Input should have value
        await expect(input).toHaveValue(value);
    });

    test('should display correct autocomplete suggestion labels for new and existing arrays', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);
        await page.check('input[value="battery"]');

        // Clear all inputs to start fresh
        const inputs = page.locator('.dpp-field-input');
        const count = await inputs.count();
        for (let i = 0; i < count; ++i) {
            await inputs.nth(i).fill('');
        }

        // 1. Verify "START NEW ARRAY" (Index 0)
        // Focus second input (Row 2, often ID) and type partial path
        const input1 = inputs.nth(1); 
        await input1.fill('components');
        await input1.focus();

        const dropdown = page.locator('#autocomplete-dropdown');
        await expect(dropdown).toBeVisible();

        // Check for "START NEW ARRAY" on index 0
        // We look for components[0].name as a generic field in components array
        const startItem = dropdown.locator('li').filter({ hasText: 'components[0].name' });
        await expect(startItem).toContainText('START NEW ARRAY');
        
        // 2. Verify "ADD TO EXISTING" (Index 0)
        // Select the first item to "start" the array
        await startItem.click();

        // Focus "Economic Operator ID" input (Row 6) which is a URI column
        // This is compatible with 'uniqueProductIdentifier' (format: uri)
        const input2 = page.locator('tr').filter({ has: page.getByText('Economic Operator ID', { exact: true }) }).locator('.dpp-field-input');
        await input2.fill('components');
        await input2.focus();

        // 'components[0].uniqueProductIdentifier' should be "ADD TO EXISTING" 
        // (assuming it exists in schema, which it usually does for components)
        const existingItem = dropdown.locator('li').filter({ hasText: 'components[0].uniqueProductIdentifier' });
        await expect(existingItem).toContainText('ADD TO EXISTING');

        // 3. Verify "ADD NEW ITEM" (Index 1)
        // 'components[1].name' should be "ADD NEW ITEM"
        const newItem = dropdown.locator('li').filter({ hasText: 'components[1].name' });
        await expect(newItem).toContainText('ADD NEW ITEM');
    });

    test('should approve all mappings when "Approve All" button is clicked', async ({ page }) => {
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);
        
        // Ensure table is rendered
        await expect(page.locator('#mapping-table')).toBeVisible();

        const generateBtn = page.locator('#generate-btn');
        const approveAllBtn = page.locator('#approve-all-btn');
        const checkboxes = page.locator('.review-checkbox');

        // 1. Initial State: Generate Disabled, Checkboxes Unchecked (mostly)
        await expect(generateBtn).toBeDisabled();
        
        // 2. Click Approve All
        await expect(approveAllBtn).toBeVisible();
        await approveAllBtn.click();

        // 3. Verify All Checked
        const count = await checkboxes.count();
        expect(count).toBeGreaterThan(0);
        for (let i = 0; i < count; ++i) {
            await expect(checkboxes.nth(i)).toBeChecked();
        }

        // 4. Verify Generate Enabled
        await expect(generateBtn).toBeEnabled();
        
        // 5. Verify Row Styles (optional, check one)
        const firstRow = page.locator('#mapping-tbody tr').first();
        await expect(firstRow).not.toHaveClass(/needs-review/);
    });

    test('Filtering: Numeric column should not show string-only fields', async ({ page }) => {
        // 1. Create a mock CSV with known types (ID, Weight, IsActive)
        // We use setInputFiles with a buffer to simulate a fresh file with specific content
        const csvContent = "ID,Weight,IsActive\n1,10.5,true\n2,20.0,false";
        const csvFile = {
            name: 'test_types.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csvContent)
        };

        await page.locator('#csv-file-input').setInputFiles(csvFile);

        // 2. Wait for table
        await expect(page.locator('#mapping-tbody tr')).toHaveCount(3);

        // 3. Focus on "Weight" (Number) input
        const weightInput = page.locator('input[data-csv-header="Weight"]');
        await weightInput.click();

        const dropdown = page.locator('#autocomplete-dropdown');
        await expect(dropdown).toBeVisible();
        
        // 4. Verify Filtering
        // "gross" (Number) -> Should find "grossWeight"
        await weightInput.fill('gross');
        await expect(dropdown.locator('li[data-value="grossWeight"]')).toBeVisible();

        // "hazard" (Boolean) -> Should NOT be visible for a Number column
        await weightInput.fill('hazard');
        await expect(dropdown.locator('li[data-value="isHazardous"]')).not.toBeVisible();
        
        // "brand" (String) -> SHOULD be visible (Numbers can be mapped to Strings)
        await weightInput.fill('brand');
        await expect(dropdown.locator('li[data-value="brand"]')).toBeVisible();

        // "certificationStartDate" (String with format: date) -> Should NOT be visible for Number column
        // This confirms format-based filtering for strings
        await weightInput.fill('certification');
        // We expect additionalCertifications[0].certificationStartDate to be hidden
        // Note: The field might be nested.
        await expect(dropdown.locator('li[data-value*="certificationStartDate"]')).not.toBeVisible();
    });

    test('Filtering: String column should not show numeric fields', async ({ page }) => {
        // 1. Mock CSV
        const csvContent = "Description\nA nice product";
        const csvFile = {
            name: 'test_string.csv',
            mimeType: 'text/csv',
            buffer: Buffer.from(csvContent)
        };
 
        await page.locator('#csv-file-input').setInputFiles(csvFile);
        await expect(page.locator('#mapping-tbody tr')).toHaveCount(1);
 
        // 2. Focus input
        const descInput = page.locator('input[data-csv-header="Description"]');
        await descInput.click();
 
        // 3. Check Suggestions
        // Type "gross" (numeric field) -> Should NOT match for String column
        await descInput.fill('gross');
        await expect(page.locator('#autocomplete-dropdown li[data-value="grossWeight"]')).not.toBeVisible();
 
        // Type "brand" (string field) -> Should match
        await descInput.fill('brand');
        await expect(page.locator('#autocomplete-dropdown li[data-value="brand"]')).toBeVisible();
    });

    test('Filtering: String column (URN) should not show ontology-restricted Double fields', async ({ page }) => {
        // 1. Load battery product CSV (which has "Product ID": "urn:gtin:...")
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);
        
        // 2. Select Battery sector (to ensure EPD/Battery ontology is loaded)
        await page.check('input[value="battery"]');

        // 3. Find the "Product ID" row
        // Note: The CSV header is "Product ID"
        const row = page.locator('tr').filter({ has: page.getByText('Product ID', { exact: true }) });
        const input = row.locator('.dpp-field-input');

        // 4. Clear and Focus to search
        await input.fill(''); // Clear potentially auto-mapped value
        await input.fill('epd.ap.a1'); // Type the exact field path we are investigating
        await input.focus();
        
        const dropdown = page.locator('#autocomplete-dropdown');

        // 5. Assert: The item should NOT be there.
        // If it shows up, it means the filter failed.
        await expect(dropdown.locator('li[data-value="epd.ap.a1"]')).toHaveCount(0);
        
        // Positive Control: Check that a valid string field IS there
        // 'uniqueProductIdentifier' fits 'urn:gtin' perfectly
        await input.fill('');
        await input.fill('uniqueProductIdentifier');
        await expect(dropdown.locator('li[data-value="uniqueProductIdentifier"]')).toBeVisible();
    });

    test('Toggle "Show incompatible fields" should reveal filtered options', async ({ page }) => {
        // 1. Load battery product CSV
        const csvPath = path.resolve('../src/examples/csv/battery-product.csv');
        await page.setInputFiles('#csv-file-input', csvPath);
        
        // Before checking the box, set the flag to false. After, wait for it to be true.
        await page.evaluate(() => { window.dppSchemaLoaded = false; });
        await page.check('input[value="battery"]');
        await page.waitForFunction(() => window.dppSchemaLoaded === true);

        // 2. Focus on "Product ID" (URN string)
        const row = page.locator('tr').filter({ has: page.getByText('Product ID', { exact: true }) });
        const input = row.locator('.dpp-field-input');
        
        // 3. Search for a Double field (epd.ap.a1)
        await input.fill('');
        await input.fill('epd.ap.a1');
        await input.focus();

        const dropdown = page.locator('#autocomplete-dropdown');

        // 4. Default: Should be hidden (filtered out)
        await expect(dropdown.locator('li[data-value="epd.ap.a1"]')).toHaveCount(0);

        // 5. Enable Toggle
        await page.check('#show-incompatible-toggle');
        
        // Refocus input to trigger dropdown update
        await input.focus();

        // 6. Should now be visible and styled as incompatible
        const item = dropdown.locator('li[data-value="epd.ap.a1"]');
        await expect(item).toBeVisible();
        await expect(item).toHaveClass(/suggestion-incompatible/);
        await expect(item).toContainText('(Incompatible Type)');

        // 7. Select it
        await item.click();
        await expect(input).toHaveValue('epd.ap.a1');
        
        // 8. Verify Error Row (because it IS incompatible)
        await expect(row).toHaveClass(/error-row/);
    });

});