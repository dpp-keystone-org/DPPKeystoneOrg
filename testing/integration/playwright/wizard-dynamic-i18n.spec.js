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
    });

});
