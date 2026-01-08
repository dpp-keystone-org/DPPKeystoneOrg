import { parse as jsoncParse } from 'jsonc-parser';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { transformDpp } from '../dpp-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to read JSONC files for tests
const readJsonc = (filePath) => {
    const fullPath = path.resolve(__dirname, filePath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return jsoncParse(content);
};

describe('Server-side DPP to Schema.org Product Transformation', () => {
    let productDoc;

    beforeAll(() => {
        // Load main document
        productDoc = readJsonc('../../../../../src/examples/construction-product-dpp-v1.json');
    });

    it('should transform the DPP root into a schema:Product object with correct properties', async () => {
        // The document loader is needed to resolve contexts during the expansion
        const documentLoader = async (url, options) => {
            if (url.startsWith('https://dpp-keystone.org/spec/')) {
                const localPath = url.replace('https://dpp-keystone.org/spec', path.resolve(__dirname, '../../../../../src'));
                try {
                    const content = fs.readFileSync(localPath, 'utf-8');
                    return { contextUrl: null, document: jsoncParse(content), documentUrl: url };
                } catch (e) { 
                    // Fallback for any other case
                    return jsonld.documentLoaders.node()(url);
                 }
            }
            return jsonld.documentLoaders.node()(url);
        };

        const options = {
            profile: 'schema.org',
            ontologyPaths: [path.resolve(__dirname, '../../../../../src/ontology/v1/core/DoPC.jsonld')],
            documentLoader,
        };
        
        const transformedData = await transformDpp(productDoc, options);
        
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
        
        // Assertions for the nested Address
        const address = manufacturer.address;
        expect(address).toBeDefined();
        expect(address['@type']).toBe('PostalAddress');
        expect(address.streetAddress).toBe('123 Example Street');

        // Assertions for dopcDeclarations (additionalProperty)
        const additionalProperties = productResult.additionalProperty;
        expect(additionalProperties).toBeDefined();
        expect(additionalProperties.length).toBe(16);
        const dopcProperty = additionalProperties.find(p => p.name === 'Bond Strength (28 Days)');
        expect(dopcProperty).toEqual({
            "@type": "PropertyValue",
            "name": "Bond Strength (28 Days)",
            "value": 2.0,
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
        expect(safetySheet.url).toBe('https://example.com/docs/safety-data-sheet-456.pdf');
    });
});
