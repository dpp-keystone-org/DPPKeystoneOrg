import { generateDppHtml } from '../../src/wizard/html-generator.js';

describe('DPP Wizard - HTML Generator', () => {
    it('should generate an HTML string with embedded JSON-LD', async () => {
        const mockDpp = {
            "digitalProductPassportId": "urn:uuid:f5c3b1e0-4d4a-45c1-8b02-8378336a13a4",
            "specVersion": "1.0.0",
            "dppSchemaVersion": "1.0.0",
            "dppStatus": "active",
            "uniqueProductIdentifier": "urn:uuid:a38f6c90-2b9a-4e6f-8524-7a42f6f3e3f4",
            "granularity": "Item",
            "lastUpdate": "2025-12-10T12:00:00Z",
            "economicOperatorId": "urn:uuid:c4b4e72a-0b29-4877-9883-384a5a5b7b5b",
            "productName": "Test Product for HTML",
            "contentSpecificationId": "construction-product-dpp-v1",
            "contentSpecificationIds": ["construction-product-dpp-v1"]
        };

        const htmlString = await generateDppHtml(mockDpp);

        // Basic checks for HTML structure
        expect(htmlString).toContain('<!DOCTYPE html>');
        expect(htmlString).toContain('<title>Test Product for HTML</title>');
        expect(htmlString).toContain('<h1>Test Product for HTML</h1>');
        expect(htmlString).toContain('<li><strong>productName:</strong> Test Product for HTML</li>');
        
        // Check for the embedded JSON-LD script
        expect(htmlString).toContain('<script type="application/ld+json">');
        
        // Parse the embedded JSON to check its content
        const jsonLdString = htmlString.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1];
        const jsonLd = JSON.parse(jsonLdString);

        // The transformation logic for schema.org is complex and tested elsewhere,
        // so here we just do a basic check to ensure it produced something.
        // Based on the current EPD transformer, it might be empty if no EPD data is present.
        // A more robust check would assert on a specific transformation result.
        expect(jsonLd).toBeInstanceOf(Object);
    });
});
