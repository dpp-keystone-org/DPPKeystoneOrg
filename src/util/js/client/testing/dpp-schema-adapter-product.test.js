import { jest } from '@jest/globals';
import { transformDpp } from '../dpp-schema-adapter.js';
import { promises as fs } from 'fs';
import path from 'path';
import { parse as jsoncParse } from 'jsonc-parser';

// Mock fetch
global.fetch = jest.fn();

// Resolve paths relative to the actual project root, not the 'testing' directory
const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const readFixture = async (filePath) => {
    // Correctly join paths from the project root
    const fullPath = path.join(PROJECT_ROOT, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    // Use jsonc-parser to allow comments in our JSON files
    return jsoncParse(content);
};

describe('DPP to Schema.org Product Transformation', () => {
    let productDoc;
    let epdOntology;
    let dopcOntology;
    // Store all contexts in a map for easy lookup
    const contexts = new Map();

    beforeAll(async () => {
        // Load main document
        productDoc = await readFixture('src/examples/construction-product-dpp-v1.json');
        dopcOntology = await readFixture('src/ontology/v1/core/DoPC.jsonld');
        
        // Load all the context files that might be requested during expansion
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld', await readFixture('src/contexts/v1/dpp-construction.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld', await readFixture('src/contexts/v1/dpp-core.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-general-product.context.jsonld', await readFixture('src/contexts/v1/dpp-general-product.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-packaging.context.jsonld', await readFixture('src/contexts/v1/dpp-packaging.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-epd.context.jsonld', await readFixture('src/contexts/v1/dpp-epd.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-dopc.context.jsonld', await readFixture('src/contexts/v1/dpp-dopc.context.jsonld'));
        
        // Setup fetch mock to serve the contexts
        fetch.mockImplementation(url => {
            if (contexts.has(url)) {
                return Promise.resolve(new Response(JSON.stringify(contexts.get(url))));
            }
            if (url.includes('DoPC.jsonld')) {
                return Promise.resolve(new Response(JSON.stringify(dopcOntology)));
            }
            // For this test, we don't need the EPD ontology, so we can return empty
            if (url.includes('EPD.jsonld')) {
                return Promise.resolve(new Response(JSON.stringify({})));
            }
            return Promise.reject(new Error(`Attempted to fetch unmocked URL: ${url}`));
        });
    });

    it('should transform the DPP root into a schema:Product object with correct properties', async () => {
        const options = {
            profile: 'schema.org',
            ontologyPaths: ['https://dpp-keystone.org/spec/ontology/v1/core/DoPC.jsonld'],
            documentLoader: async (url) => {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load context ${url}: ${await response.text()}`);
                }
                const document = await response.json();
                return {
                    contextUrl: null,
                    document,
                    documentUrl: url
                };
            }
        };
        
        const transformedData = await transformDpp(productDoc, options);
        
        // Find the schema:Product object in the results
        const productResult = transformedData.find(item => item['@type'] === 'Product');

        // Assertions for the Product object
        expect(productResult).toBeDefined();
        expect(productResult['@context']).toBe('http://schema.org');
        expect(productResult.name).toBe('One Thing');
        expect(productResult.model).toBe('70210534');
        expect(productResult['@id']).toBe('https://www.example.org/1234545');

        // Assertions for the nested Manufacturer (Organization)
        const manufacturer = productResult.manufacturer;
        expect(manufacturer).toBeDefined();
        expect(manufacturer['@type']).toBe('Organization');
        expect(manufacturer.name).toBe('ExampleCorp');
        expect(manufacturer.url).toBeUndefined(); // 'website' is not mapped to 'url' yet in the ontology for Organization
        
        // Assertions for the nested Address
        const address = manufacturer.address;
        expect(address).toBeDefined();
        expect(address['@type']).toBe('PostalAddress');
        expect(address.streetAddress).toBe('123 Example Street');
        expect(address.postalCode).toBe('12345');
        expect(address.addressLocality).toBe('Anytown');
        expect(address.addressCountry).toBe('Nowhereland');

        // Assertions for dopcDeclarations (additionalProperty)
        const additionalProperties = productResult.additionalProperty;
        expect(additionalProperties).toBeDefined();
        expect(Array.isArray(additionalProperties)).toBe(true);
        expect(additionalProperties.length).toBe(16);

        const dopcProperty = additionalProperties.find(p => p.name === 'Bond Strength (28 Days)');
        expect(dopcProperty).toEqual({
            "@type": "PropertyValue",
            "name": "Bond Strength (28 Days)",
            "value": 2.0, // Value in JSON is number
            "unitText": "MPa"
        });

        // Assertions for Document Links
        const instructions = productResult.instructionsForUse;
        expect(instructions).toBeDefined();
        expect(instructions['@type']).toBe('DigitalDocument');
        expect(instructions.name).toBe('User Manual for the Smart Thermostat Pro');
        expect(instructions.url).toBe('https://example.com/docs/user-manual-123.pdf');
        expect(instructions.encodingFormat).toBe('application/pdf');
        expect(instructions.inLanguage).toBe('en-GB');

        const safetySheet = productResult.safetyDataSheet;
        expect(safetySheet).toBeDefined();
        expect(safetySheet['@type']).toBe('DigitalDocument');
        expect(safetySheet.name).toBe('User Manual for the Smart Thermostat Pro'); // The example uses the same title
        expect(safetySheet.url).toBe('https://example.com/docs/safety-data-sheet-456.pdf');
        expect(safetySheet.encodingFormat).toBe('application/pdf');
        expect(safetySheet.inLanguage).toBe('en-GB');
    });
});
