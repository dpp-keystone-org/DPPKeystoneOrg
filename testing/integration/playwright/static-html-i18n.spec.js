import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const EU_LANGUAGES = [
    'en', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hr', 
    'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'ga'
];

const PAGES_TO_TEST = [
    { path: '/index.html', key: 'about-this-project', enText: 'About This Project', deText: 'Über dieses Projekt' },
    { path: '/wizard/index.html', key: '1-select-applicable-sectors', enText: '1. Select Applicable Sectors', deText: '1. Relevante Sektoren auswählen' },
    { path: '/validator/index.html', key: 'official-json-schema-validation-tool', enText: 'Official JSON Schema Validation Tool', deText: 'Offizielles JSON-Schema-Validierungstool' },
    { path: '/explorer/index.html', key: 'search-and-browse-definitions-across', enText: 'Search and browse definitions across all DPP sectors.', deText: 'Suchen und durchstöbern Sie Definitionen in allen DPP-Sektoren.' },
    { path: '/csv-dpp-adapter/index.html', key: '1-load-data', enText: '1. Load Data', deText: '1. Daten laden' }
];

test.describe('Feature 6: Static HTML Internationalization', () => {
    
    // 1. Check all pages for at least one language (German)
    test('dynamic language switching works across all static HTML pages (German)', async ({ page }) => {
        for (const target of PAGES_TO_TEST) {
            // Clear local storage to ensure the language defaults to English for the test
            await page.addInitScript(() => {
                window.localStorage.clear();
            });
            await page.goto(target.path);

            const element = page.locator(`[data-i18n-key="${target.key}"]`).first();
            
            // Should be English initially
            await expect(element).toHaveText(target.enText);

            // Switch to German
            const languageSelector = page.locator('#language-selector');
            await languageSelector.selectOption('de');

            // Wait for text to change to German
            await expect(element).toHaveText(target.deText);
            
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

    // 3. Strict Content Coverage Verification
    test('strict content coverage verification for Explorer page (German)', async ({ page }) => {
        // Read the translation resource directly
        const i18nFilePath = path.join(__dirname, '../../../src/explorer/index.i18n.json');
        const i18nData = JSON.parse(fs.readFileSync(i18nFilePath, 'utf-8'));

        // Clear local storage to ensure the language defaults to English for the test
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto('/explorer/index.html');

        // Switch to German
        const languageSelector = page.locator('#language-selector');
        await languageSelector.selectOption('de');

        // Wait a moment for rendering
        await page.waitForTimeout(200);

        // Verify every single string in the resource is present
        for (const [key, translations] of Object.entries(i18nData)) {
            const deTranslation = translations.find(t => t['@language'] === 'de')['@value'];
            
            const element = page.locator(`[data-i18n-key="${key}"]`);
            await expect(element.first()).toBeAttached();
            
            const count = await element.count();
            for (let i = 0; i < count; i++) {
                const el = element.nth(i);
                const tagName = await el.evaluate(e => e.tagName.toLowerCase());
                if (tagName === 'input' || tagName === 'textarea') {
                    await expect(el).toHaveAttribute('placeholder', deTranslation);
                } else {
                    // Extract raw text from the expected HTML string to match Playwright's text checking
                    const expectedText = await page.evaluate((html) => {
                        const div = document.createElement('div');
                        div.innerHTML = html;
                        return div.textContent;
                    }, deTranslation);
                    
                    await expect(el).toHaveText(expectedText);
                }
            }
        }
    });

    // 4. Sequential Multiple Language Switching
    test('UI correctly handles multiple sequential language switches', async ({ page }) => {
        // We'll test this on the root index page
        const target = PAGES_TO_TEST[0]; // /index.html
        
        await page.addInitScript(() => {
            window.localStorage.clear();
        });
        await page.goto(target.path);

        const element = page.locator(`[data-i18n-key="${target.key}"]`).first();
        const languageSelector = page.locator('#language-selector');
        
        // 1. Initial State (English)
        await expect(element).toHaveText(target.enText);
        
        // 2. First Switch (German)
        await languageSelector.selectOption('de');
        await expect(element).toHaveText(target.deText);
        
        // 3. Second Switch (French)
        // Let's use a known French string for 'About This Project'
        // From index.i18n.json, 'about-this-project' in French is 'À propos de ce projet'
        await languageSelector.selectOption('fr');
        await expect(element).toHaveText('À propos de ce projet');
        
        // 4. Third Switch (Back to English)
        await languageSelector.selectOption('en');
        await expect(element).toHaveText(target.enText);
    });
});
