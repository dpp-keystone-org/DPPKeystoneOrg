import { jest } from '@jest/globals';
import { EPDAdapter } from '../dpp-adapter.js';
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

describe('Client-side EPDAdapter', () => {
    let productDoc;
    let epdOntology;
    // Store all contexts in a map for easy lookup
    const contexts = new Map();

    beforeAll(async () => {
        // Load main document and ontology
        productDoc = await readFixture('src/examples/construction-product-dpp-v1.json');
        epdOntology = await readFixture('src/ontology/v1/core/EPD.jsonld');
        
        // Load all the context files that might be requested
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld', await readFixture('src/contexts/v1/dpp-construction.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld', await readFixture('src/contexts/v1/dpp-core.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-product-details.context.jsonld', await readFixture('src/contexts/v1/dpp-product-details.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-epd.context.jsonld', await readFixture('src/contexts/v1/dpp-epd.context.jsonld'));
        contexts.set('https://dpp-keystone.org/spec/contexts/v1/dpp-dopc.context.jsonld', await readFixture('src/contexts/v1/dpp-dopc.context.jsonld'));
        
        // Setup fetch mock to serve the ontology and the contexts
        fetch.mockImplementation(url => {
            let json;
            if (url.includes('EPD.jsonld')) {
                json = epdOntology;
            } else if (contexts.has(url)) {
                json = contexts.get(url);
            } else {
                return Promise.resolve(new Response(JSON.stringify({}), { status: 404, statusText: 'Not Found' }));
            }
            return Promise.resolve(new Response(JSON.stringify(json)));
        });
    });

    it('should transform a product document into schema.org certifications', async () => {
        const ontologyPaths = ['http://mock.com/EPD.jsonld'];
        
        // This document loader now uses the mocked fetch, simulating a real browser
        const documentLoader = async (url) => {
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
        };
        
        const certifications = await EPDAdapter(productDoc, ontologyPaths, documentLoader);

        expect(certifications).toBeInstanceOf(Array);
        // The test data is different from the server-side test, so we expect a different count.
        // Let's check against the known data in construction-product-dpp-v1.json (14 indicators * 10 stages = 140)
        expect(certifications.length).toBe(140);

        const gwpCert = certifications.find(c => c.name === 'gwp-a1');
        expect(gwpCert).toBeDefined();
        expect(gwpCert['@type']).toBe('Certification');
        expect(gwpCert.name).toBe('gwp-a1');
        expect(gwpCert.hasMeasurement).toBeDefined();
        // The value in the example file is "3.48E+02", which is 348
        expect(gwpCert.hasMeasurement.value).toBe(348);
        expect(gwpCert.hasMeasurement.unitText).toBe('kg CO₂ eq'); // Updated to match server test data
        expect(gwpCert.hasMeasurement.name).toContain('Global Warming Potential');
    });
});
