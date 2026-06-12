import { test, expect } from '@playwright/test';

test.describe('Wizard Dynamic Translation', () => {

    test('dynamic components translate correctly and maintain state', async ({ page }) => {
        // Clear storage to start clean
        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        // Load the wizard page
        await page.goto('/wizard/index.html');

        // 1. Switch language to German
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // Verify the static initial button translates
        const addSectorBtn = page.locator('button[data-sector="battery"]');
        await expect(addSectorBtn).toHaveText('Batterie hinzufügen');

        // 2. Click "Add Battery" to trigger dynamic UI generation
        await addSectorBtn.click();

        // 3. Verify that the button itself updated to "Remove Battery" in German
        await expect(addSectorBtn).toHaveText('Batterie entfernen');

        // 4. Verify that "Show Errors" is translated
        const showErrorsBtn = page.locator('#show-errors-btn');
        // The badge is inside the button, so textContent will include the number e.g. "Fehler anzeigen (0)"
        await expect(showErrorsBtn).toContainText('Fehler anzeigen');

        // 5. Expand an array to see the "Add Item" button
        // Let's assume the form has an array. We can just add a voluntary field.
        const addVoluntaryFieldBtn = page.locator('#add-voluntary-field-btn');
        await expect(addVoluntaryFieldBtn).toHaveText('Feld hinzufügen');
        
        await addVoluntaryFieldBtn.click();

        // 6. Verify that the newly injected row has a translated "Remove" button
        // Look for the last "remove" button that is in the grid
        const removeBtns = page.locator('button[data-i18n-key="remove"]');
        await expect(removeBtns.last()).toHaveText('Entfernen');

        // 7. Verify the plain "Add" button for optional objects (like manufacturerInfo) is translated
        const plainAddBtn = page.locator('button[data-i18n-key="add"]').first();
        await expect(plainAddBtn).toHaveText('Hinzufügen');

        // 8. Verify no English fallback text is visible on these dynamic components
        await expect(addSectorBtn).not.toHaveText('Remove Battery');
        await expect(addVoluntaryFieldBtn).not.toHaveText('Add Field');
        await expect(plainAddBtn).not.toHaveText('Add');
        await expect(removeBtns.last()).not.toHaveText('Remove');
        await expect(showErrorsBtn).not.toContainText('Show Errors');

        // 9. Click "Hinzufügen" to expand an optional object and ensure its new Remove button translates immediately
        await plainAddBtn.click();
        const expandedRemoveBtn = page.locator('button[data-remove-optional-object]').last();
        await expect(expandedRemoveBtn).toHaveText('Entfernen');
        await expect(expandedRemoveBtn).not.toHaveText('Remove');

        // 10. Click "Element hinzufügen" to add an array item and ensure its new Remove button translates immediately
        const addItemBtn = page.locator('button[data-i18n-key="add-item"]').first();
        // Check that the add item button is translated
        await expect(addItemBtn).toHaveText('Element hinzufügen');
        await addItemBtn.click();
        // The array item adds a new row with a generic remove button
        const arrayRemoveBtn = page.locator('button[data-i18n-key="remove"]').last();
        await expect(arrayRemoveBtn).toHaveText('Entfernen');
        await expect(arrayRemoveBtn).not.toHaveText('Remove');
    });

    test('nested dynamic group components trigger localization correctly', async ({ page }) => {
        // Clear storage to start clean
        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        await page.goto('/wizard/index.html');
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // 1. Click the global "Add Field" button
        const addVoluntaryFieldBtn = page.locator('#add-voluntary-field-btn');
        await addVoluntaryFieldBtn.click();

        // 2. Locate the .voluntary-type dropdown in the new row and select 'Group'
        const typeSelector = page.locator('.voluntary-type').last();
        await typeSelector.selectOption('Group');

        // 3. Assert that the newly injected button.add-voluntary-prop-btn appears and is translated
        const nestedAddBtn = page.locator('button.add-voluntary-prop-btn').last();
        await expect(nestedAddBtn).toHaveText('Feld hinzufügen');

        // 4. Click that nested button to spawn a sub-row
        await nestedAddBtn.click();

        // 5. Assert that the sub-row's "Remove" button is translated
        // The sub-row is inside the group container
        const removeBtns = page.locator('.voluntary-group-container button[data-i18n-key="remove"]');
        await expect(removeBtns.last()).toHaveText('Entfernen');
    });

    test('torture test: state preservation across complex language swaps and error events', async ({ page }) => {
        // Clear storage to start clean
        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        await page.goto('/wizard/index.html');
        const languageSelector = page.locator('#language-selector');
        
        // Ensure starting in English
        await languageSelector.selectOption('en');

        // 1. Add "Battery" sector
        const addBatteryBtn = page.locator('button[data-sector="battery"]');
        await addBatteryBtn.click();
        await expect(addBatteryBtn).toHaveText('Remove Battery');

        // 2. Expand the performance optional object
        const addPerformanceBtn = page.locator('button[data-optional-object="performance"]');
        await addPerformanceBtn.click();

        // Wait for it to be visible
        const removePerformanceBtn = page.locator('button[data-remove-optional-object="performance"]');
        await expect(removePerformanceBtn).toHaveText('Remove');

        // 3. Assert initial error count (3 from core + battery errors)
        const showErrorsBtn = page.locator('#show-errors-btn');
        await expect(showErrorsBtn).toContainText('Show Errors');
        const initialText = await showErrorsBtn.textContent();
        const match = initialText.match(/\((\d+)\)/);
        const errorCount = match ? match[1] : "0";

        // 4. Switch the language to German
        await languageSelector.selectOption('de');

        // 5. Assert the optional object's remove button dynamically updates
        await expect(removePerformanceBtn).toHaveText('Entfernen');

        // 6. Assert that the Error count badge translates perfectly but preserves the integer count
        await expect(showErrorsBtn).toContainText(`Fehler anzeigen (${errorCount})`);

        // 7. Click the "Battery" sector button to remove the sector
        await addBatteryBtn.click();

        // Wait for the form to disappear
        const batteryFormContainer = page.locator('#sector-form-battery');
        await expect(batteryFormContainer).not.toBeAttached();

        // 8. Assert the button text instantly reverts to "Batterie hinzufügen"
        await expect(addBatteryBtn).toHaveText('Batterie hinzufügen');

        // 9. Assert the error count has updated because the battery sector (and its errors) were removed
        // Core errors should be 3
        await expect(showErrorsBtn).toContainText('Fehler anzeigen (3)');

        // 10. Switch the language back to English
        await languageSelector.selectOption('en');

        // 11. Assert the sector button correctly swaps back
        await expect(addBatteryBtn).toHaveText('Add Battery');
        await expect(showErrorsBtn).toContainText('Show Errors (3)');

        // 12. Add Textile Sector for array torture test
        const addTextileBtn = page.locator('button[data-sector="textile"]');
        await addTextileBtn.click();
        const textileFormContainer = page.locator('#sector-form-textile');
        await expect(textileFormContainer).toBeAttached();

        // 13. Add two items to fibreComposition array
        const addFibreBtn = page.locator('button.add-array-item-btn[data-array-name="fibreComposition"]');
        await addFibreBtn.click();
        await addFibreBtn.click();

        // 14. Remove index 0 to test exact index preservation
        const firstRemoveBtn = page.locator('.array-item-control-row[data-array-group="fibreComposition.0"] button');
        await firstRemoveBtn.click();
        
        // Add one more so we have indexes 0 and 1 (since 1 shifted to 0)
        await addFibreBtn.click();

        // 15. Fill out the fibre composition inputs for index 0 and 1
        const fibre0Name = page.locator('input[name="fibreComposition.0.name"]');
        await fibre0Name.fill('Cotton');
        const fibre1Name = page.locator('input[name="fibreComposition.1.name"]');
        await fibre1Name.fill('Polyester');
        await fibre1Name.blur(); // Trigger validation for the last field

        // Capture error count before language swap
        const preSwapErrorText = await showErrorsBtn.textContent();

        // 16. Switch to German
        await languageSelector.selectOption('de');

        // 17. Verify structural preservation and text persistence
        await expect(fibre0Name).toHaveValue('Cotton');
        await expect(fibre1Name).toHaveValue('Polyester');

        // 18. Verify Remove buttons are translated and structural indices match
        const removeFibre0Btn = page.locator('.array-item-control-row[data-array-group="fibreComposition.0"] button');
        const removeFibre1Btn = page.locator('.array-item-control-row[data-array-group="fibreComposition.1"] button');
        await expect(removeFibre0Btn).toHaveText('Entfernen');
        await expect(removeFibre1Btn).toHaveText('Entfernen');

        // 19. Check error count stayed exactly the same after translation swap
        const postSwapErrorText = await showErrorsBtn.textContent();
        const preMatch = preSwapErrorText.match(/\((\d+)\)/);
        const postMatch = postSwapErrorText.match(/\((\d+)\)/);
        expect(preMatch[1]).toBe(postMatch[1]);
    });

    test('deep un-translated regressions on custom fields and objects', async ({ page }) => {
        // Clear storage to start clean
        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        await page.goto('/wizard/index.html');
        const languageSelector = page.locator('#language-selector');

        // 1. notifiedBody: click "Hinzufügen", click "Entfernen", button should say "Hinzufügen" again
        await languageSelector.selectOption('de');
        
        // Add construction sector which contains notifiedBody
        const addConstructionBtn = page.locator('button[data-sector="construction"]');
        await addConstructionBtn.click();

        const addNotifiedBodyBtn = page.locator('button[data-optional-object="notifiedBody"]');
        await expect(addNotifiedBodyBtn).toHaveText('Hinzufügen'); // Initial translated state
        await addNotifiedBodyBtn.click();
        
        const removeNotifiedBodyBtn = page.locator('button[data-remove-optional-object="notifiedBody"]');
        await removeNotifiedBodyBtn.click();

        // Should say "Hinzufügen" again, NOT "Add"
        await expect(addNotifiedBodyBtn).toHaveText('Hinzufügen');
        await expect(addNotifiedBodyBtn).not.toHaveText('Add');

        // 2. Custom fields placeholders
        const addVoluntaryFieldBtn = page.locator('#add-voluntary-field-btn');
        await addVoluntaryFieldBtn.click();

        const propNameInput = page.locator('input.voluntary-name').last();
        const propValueInput = page.locator('input.voluntary-value').last();
        
        // Assert placeholders are translated
        await expect(propNameInput).not.toHaveAttribute('placeholder', 'Property Name');
        await expect(propValueInput).not.toHaveAttribute('placeholder', 'Property Value');

        // 3. Type selector options shouldn't be hardcoded English
        const typeSelector = page.locator('select.voluntary-type').last();
        // Check that the dropdown options themselves are translated
        const optionsText = await typeSelector.innerText();
        // 'Text' is omitted because the German translation for 'Text' is also 'Text'
        expect(optionsText).not.toContain('Number');
        expect(optionsText).not.toContain('Group');

        // 4. Select "Organization" and verify fields are not called "Organization Name"
        // Organization is one of the schema types added to the customTypeRegistry
        // We select by value because value usually stays as the underlying schema ID/label
        await typeSelector.selectOption({ label: 'Organisation' });
        
        // Check if English properties leak into the UI
        const customFieldRow = page.locator('.voluntary-field-row').last();
        const customFieldText = await customFieldRow.innerText();
        expect(customFieldText).not.toContain('Organization Name');

        // 5. Click "Hinzufügen" on the address inside Organization. Click "Entfernen". Verify it reverts to "Hinzufügen".
        const addAddressBtn = customFieldRow.locator('button[data-optional-object="address"]').last();
        await expect(addAddressBtn).toHaveText('Hinzufügen');
        await addAddressBtn.click();
        
        const removeAddressBtn = customFieldRow.locator('button[data-remove-optional-object="address"]').last();
        await removeAddressBtn.click();
        
        await expect(addAddressBtn).toHaveText('Hinzufügen');
        await expect(addAddressBtn).not.toHaveText('Add');
    });

    test('type selector options are correctly translated (Spanish)', async ({ page }) => {
        await page.goto('/wizard/index.html');
        
        // Select Spanish
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('es');

        const addVoluntaryFieldBtn = page.locator('#add-voluntary-field-btn');
        await addVoluntaryFieldBtn.click();

        const typeSelector = page.locator('select.voluntary-type').last();
        const optionsText = await typeSelector.innerText();
        
        // Assert English is gone
        expect(optionsText).not.toContain('Number');
        expect(optionsText).not.toContain('Group');
        
        // Assert Spanish is present
        expect(optionsText).toContain('Texto');
        expect(optionsText).toContain('Número');
        expect(optionsText).toContain('Grupo');
    });
    test('validation errors and oneOf dropdowns are translated', async ({ page }) => {
        await page.goto('/wizard/index.html');
        
        // Select German
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // Add Construction sector to get complex fields (like additionalCertifications)
        const addConstructionBtn = page.locator('button[data-sector="construction"]');
        await addConstructionBtn.click();

        // Check validation error: trigger an error by clicking Show Errors
        const showErrorsBtn = page.locator('#show-errors-btn');
        await showErrorsBtn.click();

        // The error for required fields should be "Dieses Feld ist erforderlich"
        const errorsText = await page.locator('.error-message').first().innerText();
        expect(errorsText).toContain('erforderlich');
        expect(errorsText).not.toContain('required');

        // Close the modal that "Show Errors" opened so we can interact with the rest of the page
        await page.click('.modal-close-btn');

        // Now test oneOf dropdown. In Construction, `dopc` is an optional object of oneOf schemas.
        const addDopcBtn = page.locator('button[data-optional-object="dopc"]');
        await addDopcBtn.click();

        // A type selector should appear
        const typeSelector = page.locator('select.type-selector').last();
        const optionsText = await typeSelector.innerText();

        // Check for German translations in the oneOf dropdown
        expect(optionsText).toContain('Typ auswählen'); // "Select Type..."
        expect(optionsText).toContain('Leistungs- und Konformitätserklärung'); // "Declaration of Performance and Conformity"
        expect(optionsText).not.toContain('Select Type');
        
        // Change language to Spanish
        await languageSelector.selectOption('es');
        
        // Validation errors should instantly translate
        const esErrorsText = await page.locator('.error-message').first().innerText();
        expect(esErrorsText).toContain('obligatorio');
        expect(esErrorsText).not.toContain('erforderlich');
        
        // OneOf selector should instantly translate
        // CRUCIAL: This also asserts that the unpopulated `oneOf` dropdown SURVIVED the state-preserving
        // language swap re-render without collapsing back into an "Add" button!
        await expect(typeSelector).toBeVisible();
        const esOptionsText = await typeSelector.innerText();
        expect(esOptionsText).toContain('Seleccionar tipo');
        expect(esOptionsText).toContain('Declaración de prestaciones y conformidad');
    });

    test('expanded custom object labels and tooltips update on language swap', async ({ page }) => {
        await page.goto('/wizard/index.html');
        
        // Wait for the core schema and ontology to finish loading
        await expect(page.locator('#core-form-container input').first()).toBeVisible();

        // 1. Add a custom field
        const addVoluntaryFieldBtn = page.locator('#add-voluntary-field-btn');
        await addVoluntaryFieldBtn.click();
        
        // 2. Set type to Organization
        page.on('console', msg => console.log('PAGE LOG:', msg.text()));
        page.on('pageerror', err => console.log('PAGE ERROR:', err.message));

        const typeSelector = page.locator('select.voluntary-type').last();
        await typeSelector.selectOption({ label: 'Organization' });
        
        // 3. Verify English labels are present using auto-retrying expect
        const customFieldRow = page.locator('.voluntary-field-row').last();
        await expect(customFieldRow).toContainText('Organization Name');
        await expect(customFieldRow).toContainText('Trading Name');
        
        // 4. Swap language to Spanish
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('es');
        
        // 5. Verify labels instantly translate to Spanish
        await expect(customFieldRow).not.toContainText('Organization Name');
        await expect(customFieldRow).toContainText('Nombre de la Organización');
        await expect(customFieldRow).toContainText('Nombre comercial');
    });

    test('oneOf form data is preserved across language swap', async ({ page }) => {
        await page.goto('/wizard/index.html');
        
        // Wait for the core schema and ontology to finish loading
        await expect(page.locator('#core-form-container input').first()).toBeVisible();

        // 1. Add Construction sector
        const addConstructionBtn = page.locator('button[data-sector="construction"]');
        await addConstructionBtn.click();

        // 2. Add dopc
        const addDopcBtn = page.locator('button[data-optional-object="dopc"]');
        await addDopcBtn.click();

        // 3. Select actual dopc type
        const typeSelector = page.locator('select.type-selector').last();
        // Index 1 because Index 0 is the default placeholder "Select Type..."
        await typeSelector.selectOption({ label: 'Declaration of Performance and Conformity' });

        // Wait for the first field of dopc to render and set it
        const firstDopcInput = page.locator('input[name^="dopc."]').first();
        await expect(firstDopcInput).toBeVisible();
        await firstDopcInput.fill('flibbertygibbet');

        // 4. Swap language to German
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // 5. Verify the input value survived the swap
        const restoredInput = page.locator('input[name^="dopc."]').first();
        await expect(restoredInput).toBeVisible();
        await expect(restoredInput).toHaveValue('flibbertygibbet');
    });
});
