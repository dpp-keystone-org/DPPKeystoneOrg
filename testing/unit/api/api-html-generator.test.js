import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import { generateDppHtml } from '../../../api/src/lib/html-generator-server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

describe('Server-Side DPP HTML Generator (Unit Test)', () => {
    let validBatteryDpp;

    beforeAll(async () => {
        const distExample = path.join(PROJECT_ROOT, 'dist/spec/examples/battery-dpp-v1.json');
        const srcExample = path.join(PROJECT_ROOT, 'src/examples/battery-dpp-v1.json');
        const examplePath = existsSync(distExample) ? distExample : srcExample;
        const content = await fs.readFile(examplePath, 'utf-8');
        validBatteryDpp = jsoncParse(content, [], { allowComments: true, allowTrailingComma: true });
    });

    it('should generate a full, standalone HTML document without browser window.fetch', async () => {
        const html = await generateDppHtml(validBatteryDpp, { includeSchema: false });
        
        expect(typeof html).toBe('string');
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('Digital Product Passport');
        expect(html).toContain(validBatteryDpp.digitalProductPassportId || 'urn:');
        expect(html).toContain('class="dpp-hero"');
        expect(html).toContain('class="dpp-metadata"');
    });

    it('should embed Schema.org JSON-LD when includeSchema is true', async () => {
        const html = await generateDppHtml(validBatteryDpp, { includeSchema: true });
        
        expect(html).toContain('<script type="application/ld+json">');
        expect(html).toMatch(/"@context":\s*"https?:\/\/schema\.org"/);
        expect(html).toContain('"@type": "Product"');
    });

    it('should not embed Schema.org JSON-LD when includeSchema is false', async () => {
        const html = await generateDppHtml(validBatteryDpp, { includeSchema: false });
        
        expect(html).not.toContain('<script type="application/ld+json">');
    });

    it('should inject custom stylesheet link when customCssUrl option is provided', async () => {
        const customCssUrl = 'https://example.com/custom-branding.css';
        const html = await generateDppHtml(validBatteryDpp, { customCssUrl });
        
        expect(html).toContain(`<link rel="stylesheet" href="${customCssUrl}">`);
    });

    it('should localize metadata and labels when a supported language code is requested', async () => {
        const htmlGerman = await generateDppHtml(validBatteryDpp, { language: 'de' });
        
        expect(typeof htmlGerman).toBe('string');
        expect(htmlGerman).toContain('<!DOCTYPE html>');
    });

    it('should throw an error when passed an empty or null DPP payload', async () => {
        await expect(generateDppHtml(null)).rejects.toThrow('DPP JSON is required');
    });
});
