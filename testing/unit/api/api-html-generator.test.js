import { promises as fs } from 'fs';
import path from 'path';
import { generateDppHtml } from '../../../src/lib/html-generator-server.js';

describe('Server-Side DPP HTML Generator (Unit Test)', () => {
    let validBatteryDpp;

    beforeAll(async () => {
        const examplePath = path.resolve(process.cwd(), 'src/examples/battery-industrial-dpp-v1.json');
        const content = await fs.readFile(examplePath, 'utf-8');
        validBatteryDpp = JSON.parse(content);
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
        expect(html).toContain('"@context": "https://schema.org"');
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
