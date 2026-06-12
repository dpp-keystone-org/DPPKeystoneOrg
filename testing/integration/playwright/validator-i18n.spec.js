import { test, expect } from '@playwright/test';

test.describe('Validator Dynamic Translation', () => {

    test('dynamic validation errors translate correctly', async ({ page }) => {
        // Clear storage to start clean
        await page.addInitScript(() => {
            window.localStorage.clear();
        });

        // Load the validator page
        await page.goto('/validator/index.html');

        // Wait for schemas to load
        const btn = page.locator('#validate-btn');
        await expect(btn).toBeEnabled({ timeout: 30000 });

        // 1. Switch language to German
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // 2. Validate empty input to trigger UI error
        await btn.click();
        
        // Should show translated 'error-no-json'
        let errorBox = page.locator('.result-box.error');
        await expect(errorBox).toContainText('Bitte fügen Sie ein JSON-Objekt zur Validierung ein.');

        // 3. Trigger Ajv required error
        // A minimal valid DPP is quite complex, but an empty object will fail heavily
        await page.locator('#json-input').fill('{}');
        await btn.click();

        // 4. Verify Ajv errors translate
        // Instead of English "Validation Failed (X errors)", it should show German
        const heading = page.locator('.result-box.error h3');
        await expect(heading).toContainText('Validierung fehlgeschlagen');
        await expect(heading).toContainText('Fehler');

        // Find the error list item for missing 'digitalProductPassportId'
        // In English: "root: Missing required property: 'digitalProductPassportId'"
        // In German: "root: Dieses Feld ist erforderlich: 'digitalProductPassportId'"
        const errorList = page.locator('.result-box.error ul');
        await expect(errorList).toContainText("Dieses Feld ist erforderlich: 'digitalProductPassportId'");
    });
});
