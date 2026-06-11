const { test, expect } = require('@playwright/test');

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
        const addElectronicsBtn = page.locator('button[data-sector="electronics"]');
        await expect(addElectronicsBtn).toHaveText('Elektronik hinzufügen');

        // 2. Click "Add Electronics" to trigger dynamic UI generation
        await addElectronicsBtn.click();

        // 3. Verify that the button itself updated to "Remove Electronics" in German
        await expect(addElectronicsBtn).toHaveText('Elektronik entfernen');

        // 4. Verify that "Show Errors" is translated
        const showErrorsBtn = page.locator('#show-errors-btn');
        // The badge is inside the button, so textContent will include the number e.g. "Fehler anzeigen (0)"
        await expect(showErrorsBtn).toContainText('Fehler anzeigen');

        // 5. Expand an array to see the "Add Item" button
        // Let's assume the form has an array. We can just add a voluntary field.
        const addVoluntaryFieldBtn = page.locator('button.add-voluntary-prop-btn').first();
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
        await expect(addElectronicsBtn).not.toHaveText('Remove Electronics');
        await expect(addVoluntaryFieldBtn).not.toHaveText('Add Field');
        await expect(plainAddBtn).not.toHaveText('Add');
        await expect(removeBtns.last()).not.toHaveText('Remove');
        await expect(showErrorsBtn).not.toContainText('Show Errors');
    });

});
