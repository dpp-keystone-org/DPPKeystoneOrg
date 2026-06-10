import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

const EU_LANGUAGES = [
    'en', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hr', 
    'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'ga'
];

const I18N_FILES = [
    'index.i18n.json',
    'src/wizard/index.i18n.json',
    'src/validator/index.i18n.json',
    'src/explorer/index.i18n.json',
    'src/csv-dpp-adapter/index.i18n.json'
];

describe('i18n JSON Resource Integrity', () => {
    for (const file of I18N_FILES) {
        describe(`File: ${file}`, () => {
            let translations;

            beforeAll(async () => {
                const filePath = path.join(PROJECT_ROOT, file);
                const content = await fs.readFile(filePath, 'utf-8');
                translations = JSON.parse(content);
            });

            it('should load the translation file', () => {
                expect(translations).toBeDefined();
                expect(Object.keys(translations).length).toBeGreaterThan(0);
            });

            it('should contain all 24 EU languages for every string key', () => {
                const missingTranslations = [];

                for (const [key, langArray] of Object.entries(translations)) {
                    // Extract the languages present for this key
                    const presentLanguages = langArray.map(t => t['@language']);

                    // Find which of the 24 EU languages are missing
                    const missing = EU_LANGUAGES.filter(lang => !presentLanguages.includes(lang));

                    if (missing.length > 0) {
                        missingTranslations.push({ key, missing });
                    }
                }

                // If any translations are missing, we format a nice error message
                if (missingTranslations.length > 0) {
                    const errorLines = missingTranslations.map(
                        item => `Key "${item.key}" is missing: ${item.missing.join(', ')}`
                    );
                    throw new Error(
                        `Missing translations in ${file}:\n` + errorLines.join('\n')
                    );
                }
            });
        });
    }
});
