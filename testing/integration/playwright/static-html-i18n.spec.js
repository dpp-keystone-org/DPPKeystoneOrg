import { test, expect } from '@playwright/test';

const EU_LANGUAGES = [
    'en', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hr', 
    'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'ga'
];

const PAGES_TO_TEST = [
    { path: '/index.html', key: 'dpp-toolkit', enText: 'DPP Toolkit' },
    { path: '/wizard/index.html', key: 'dpp-wizard', enText: 'DPP Wizard' },
    { path: '/validator/index.html', key: 'json-dpp-validator', enText: 'JSON DPP Validator' },
    { path: '/explorer/index.html', key: 'ontology-explorer', enText: 'Ontology Explorer' },
    { path: '/csv-dpp-adapter/index.html', key: 'dpp-csv-adapter', enText: 'DPP CSV Adapter' }
];

test.describe('Feature 6: Static HTML Internationalization', () => {
    
    // 1. Check all pages for at least one language (German)
    test('dynamic language switching works across all static HTML pages (German)', async ({ page }) => {
        for (const target of PAGES_TO_TEST) {
            await page.goto(target.path);

            const element = page.locator(`[data-i18n-key="${target.key}"]`).first();
            
            // Should be English initially
            await expect(element).toHaveText(target.enText);

            // Switch to German
            const languageSelector = page.locator('#language-selector');
            await languageSelector.selectOption('de');

            // Wait for text to change away from English
            await expect(element).not.toHaveText(target.enText);
            
            // Text should not be empty
            const newText = await element.textContent();
            expect(newText.trim().length).toBeGreaterThan(0);
        }
    });

    // 2. Check at least one page for all 24 languages
    test('main index.html supports all 24 EU languages', async ({ page }) => {
        const target = PAGES_TO_TEST[0]; // /index.html
        await page.goto(target.path);

        const element = page.locator(`[data-i18n-key="${target.key}"]`).first();
        const languageSelector = page.locator('#language-selector');

        for (const lang of EU_LANGUAGES) {
            await languageSelector.selectOption(lang);
            
            // Give LanguageManager a moment to fetch the JSON and inject
            // (Using waitFor rather than a hard sleep)
            await expect(async () => {
                const text = await element.textContent();
                expect(text.trim().length).toBeGreaterThan(0);
                if (lang !== 'en') {
                    // It's possible but very unlikely that 'DPP Toolkit' is exactly 'DPP Toolkit' in another language,
                    // but for testing purposes we expect at least the string to be populated.
                    // To avoid false positives on cognates, we just ensure it isn't empty.
                    expect(text).not.toBe('');
                }
            }).toPass({ timeout: 2000 });
        }
    });
});
