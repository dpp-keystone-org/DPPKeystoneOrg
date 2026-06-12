import { test, expect } from '@playwright/test';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';

test.describe('Internationalization (i18n)', () => {
    test('dynamic language switching in generated spec docs', async ({ page }) => {
        // Navigate to a generated spec doc page
        await page.goto(`/spec/ontology/${KEYSTONE_VERSION}/core/Product/Product.html`);

        // Wait for the page to load and ensure the default language is English
        const titleSpan = page.locator('h2 .i18n-text').first();
        await expect(titleSpan).toHaveText('Product or Material');

        // Locate the language selector
        const languageSelector = page.locator('#language-selector');
        await expect(languageSelector).toBeVisible();

        // Switch to German
        await languageSelector.selectOption('de');

        // Verify the text instantly changes to German without a page reload
        await expect(titleSpan).toHaveText('Produkt oder Material');

        // Verify that the description also changed
        const commentSpan = page.locator('.class-section > p > .i18n-text').first();
        await expect(commentSpan).toHaveText(/Ein allgemeines Konzept/); // "Ein allgemeines Konzept..."
        
        // Let's just check the label to be safe and robust
        const propLabelSpan = page.locator('td a .i18n-text').first();
        await expect(propLabelSpan).not.toBeEmpty();

        // Switch back to English and verify it switches back
        await languageSelector.selectOption('en');
        await expect(titleSpan).toHaveText('Product or Material');
    });

    test('language preference persists across pages', async ({ page }) => {
        // Navigate to the main index page
        await page.goto('/index.html');
        
        // Select German on the main page
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // Navigate to a different page
        await page.goto(`/spec/ontology/${KEYSTONE_VERSION}/core/Product/Product.html`);

        // The widget should remember 'de' and the page should load in German
        const titleSpan = page.locator('h2 .i18n-text').first();
        await expect(titleSpan).toHaveText('Produkt oder Material');
        
        // The selector should also reflect the persisted choice
        await expect(page.locator('#language-selector')).toHaveValue('de');
    });
});
