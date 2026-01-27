import { jest } from '@jest/globals';
import { transformDpp } from '../dpp-schema-adapter.js';
import { promises as fs } from 'fs';
import path from 'path';
import { parse as jsoncParse } from 'jsonc-parser';

// Mock fetch
global.fetch = jest.fn();

const PROJECT_ROOT = path.resolve(process.cwd(), '..');
const readFixture = async (filePath) => {
    const fullPath = path.join(PROJECT_ROOT, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return jsoncParse(content);
};

describe('Client-side DPP Transformer', () => {
    let productDoc;
    let epdOntology;
    let epdIndicators;
    let epdLifecycle;
    let epdMetadata;
    // Store all contexts in a map for easy lookup
    const contexts = new Map();

    beforeAll(async () => {
        // Load main document and ontology
        productDoc = await readFixture('src/examples/construction-product-dpp-v1.json');
        epdOntology = await readFixture('src/ontology/v1/core/EPD.jsonld');
        epdIndicators = await readFixture('src/ontology/v1/core/EPDIndicators.jsonld');
        epdLifecycle = await readFixture('src/ontology/v1/core/EPDLifecycle.jsonld');
        epdMetadata = await readFixture('src/ontology/v1/core/EPDMetadata.jsonld');
        
        // Load all the context files that might be requested
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld', await readFixture('src/contexts/v1/dpp-construction.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld', await readFixture('src/contexts/v1/dpp-core.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-general-product.context.jsonld', await readFixture('src/contexts/v1/dpp-general-product.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-packaging.context.jsonld', await readFixture('src/contexts/v1/dpp-packaging.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-epd.context.jsonld', await readFixture('src/contexts/v1/dpp-epd.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-dopc.context.jsonld', await readFixture('src/contexts/v1/dpp-dopc.context.jsonld'));
        
        // Setup fetch mock to serve the ontology and the contexts
        fetch.mockImplementation(url => {
            let json;
            if (url.includes('EPD.jsonld')) {
                json = epdOntology;
            } else if (url.includes('EPDIndicators.jsonld')) {
                json = epdIndicators;
            } else if (url.includes('EPDLifecycle.jsonld')) {
                json = epdLifecycle;
            } else if (url.includes('EPDMetadata.jsonld')) {
                json = epdMetadata;
            } else if (contexts.has(url)) {
                json = contexts.get(url);
            } else {
                return Promise.resolve(new Response(JSON.stringify({}), { status: 404, statusText: 'Not Found' }));
            }
            return Promise.resolve(new Response(JSON.stringify(json)));
        });
    });

    it('should transform the EPD data into a single schema.org Certification', async () => {
        const options = {
            profile: 'schema.org',
            ontologyPaths: [
                'http://mock.com/EPD.jsonld',
                'http://mock.com/EPDIndicators.jsonld',
                'http://mock.com/EPDLifecycle.jsonld',
                'http://mock.com/EPDMetadata.jsonld'
            ],
            documentLoader: async (url) => {
                const response = await fetch(url);
                if (!response.ok) {
                    throw new Error(`Failed to load context ${url}: ${response.statusText}`);
                }
                const document = await response.json();
                return {
                    contextUrl: null, // Let the library handle this
                    document,
                    documentUrl: url
                };
            }
        };
        
        const transformedData = await transformDpp(productDoc, options);

        const certifications = transformedData.filter(item => item['@type'] === 'Certification');

        // There should be exactly one certification object for the EPD
        expect(certifications).toHaveLength(1);

        const epdCertification = certifications[0];
        expect(epdCertification.name).toBe('Environmental Product Declaration');
        expect(epdCertification['@type']).toBe('Certification');

        // The certification should contain a list of measurements
        const measurements = epdCertification.hasMeasurement;
        expect(measurements).toBeInstanceOf(Array);
        // The test data in construction-product-dpp-v1.json has 14 indicators * 10 stages = 140 measurements
        expect(measurements).toHaveLength(140);

        // Spot-check one of the measurements (GWP for stage A1)
        const gwpA1 = measurements.find(m => m.propertyID === 'gwp-a1');
        expect(gwpA1).toBeDefined();
        expect(gwpA1['@type']).toBe('PropertyValue');
        // The value in the example file is "3.48E+02", which is 348
        expect(gwpA1.value).toBe(348);
        expect(gwpA1.unitText).toBe('kg CO₂ eq');
        expect(gwpA1.name).toBe('Global Warming Potential (a1)');
    });
});
