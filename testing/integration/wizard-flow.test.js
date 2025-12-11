/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

// NOTE: We do not import the modules to be mocked or tested at the top level.
// They will be imported dynamically within the test.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFile = (filePath) => fs.readFile(path.resolve(__dirname, '../../', filePath), 'utf-8');
const loadJson = async (filePath) => JSON.parse(await loadFile(filePath));

// A simple utility to wait for async DOM changes
const waitFor = (callback) => {
    return new Promise(resolve => {
        const check = () => {
            const result = callback();
            if (result) {
                resolve(result);
            } else {
                setTimeout(check, 10); // Poll every 10ms
            }
        };
        check();
    });
};


describe('DPP Wizard - Full Integration Flow', () => {
    let ajv;
    let dppSchema;
    let wizardHtml;

    beforeAll(async () => {
        // Load the real master schema for final validation
        dppSchema = await loadJson('src/validation/v1/json-schema/dpp.schema.json');
        wizardHtml = await loadFile('src/wizard/index.html');
        ajv = new Ajv2020({ allowMatchingProperties: true, allowUnionTypes: true });
        addFormats(ajv);
    });

    beforeEach(() => {
        // Reset DOM and Jest's module registry before each test
        document.body.innerHTML = wizardHtml;
        jest.resetModules();
    });

    it('should load the core form on page load and generate a valid DPP', async () => {
        // 1. Define mock schemas
        const mockDppSchema = {
            "title": "Digital Product Passport",
            "type": "object",
            "properties": {
                "digitalProductPassportId": { "title": "DPP ID", "type": "string" },
                "uniqueProductIdentifier": { "title": "Unique Product ID", "type": "string" },
                "granularity": { "title": "Granularity", "type": "string", "enum": ["Item", "Batch", "Model"] }
            },
            "required": ["digitalProductPassportId", "uniqueProductIdentifier", "granularity"]
        };
        const mockConstructionSchema = {
            "$id": "https://dpp.keystone.org/validation/v1/json-schema/construction.schema.json",
            "title": "Digital Product Passport for Construction Products",
            "type": "object",
            "properties": { "productName": { "title": "Product Name", "type": "string" } }
        };

        // 2. Mock the modules before importing them
        const loadSchemaMock = jest.fn();
        jest.unstable_mockModule('../../src/wizard/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        
        const loadOntologyMock = jest.fn();
        jest.unstable_mockModule('../../src/wizard/ontology-loader.js', () => ({
            loadOntology: loadOntologyMock,
        }));
        
        // Setup the mock implementations
        loadSchemaMock
            .mockResolvedValueOnce(mockDppSchema) // First call for 'dpp'
            .mockResolvedValueOnce(mockConstructionSchema); // Second call for 'construction'

        const mockOntologyMap = new Map([
            ['productName', { label: 'Product Name', comment: 'The official name of the construction product.' }]
        ]);
        loadOntologyMock.mockResolvedValue(mockOntologyMap);

        // 3. Dynamically import the wizard's initializer function
        const { initializeWizard } = await import('../../src/wizard/wizard.js');

        // 4. Manually initialize the wizard logic
        await initializeWizard();

        // 5. Wait for the core form to be rendered and assert its presence
        const coreInput = await waitFor(() => document.querySelector('#core-form-container input[name="digitalProductPassportId"]'));
        expect(coreInput).not.toBeNull();

        // Assert the new grid layout is used for the core form
        const coreGrid = document.querySelector('#core-form-container .sector-form-grid');
        expect(coreGrid).not.toBeNull();
        const firstCoreCell = coreGrid.querySelector('.grid-cell');
        expect(firstCoreCell.textContent).toBe('digitalProductPassportId');
        
        // 6. Programmatically fill out the forms
        coreInput.value = 'urn:uuid:f5c3b1e0-4d4a-45c1-8b02-8378336a13a4';
        document.querySelector('[name="uniqueProductIdentifier"]').value = 'urn:uuid:a38f6c90-2b9a-4e6f-8524-7a42f6f3e3f4';
        document.querySelector('[name="granularity"]').value = 'Batch'; // Select from the enum dropdown
        
        // 7. Simulate user selecting a sector
        const sectorSelect = document.getElementById('sector-select');
        sectorSelect.value = 'construction';
        sectorSelect.dispatchEvent(new Event('change'));
        
        // Wait for the sector-specific grid to render and validate it
        const sectorGrid = await waitFor(() => document.querySelector('#form-container .sector-form-grid'));
        expect(sectorGrid).not.toBeNull();

        // With the new recursive builder, the construction schema will now be rendered dynamically
        const productNameInput = sectorGrid.querySelector('input[name="productName"]');
        expect(productNameInput).not.toBeNull();
        productNameInput.value = 'Test Construction Product';

        // Assert that the ontology description is now present in the third column
        const ontologyCell = sectorGrid.querySelector('.grid-cell:nth-child(3)');
        expect(ontologyCell).not.toBeNull();
        expect(ontologyCell.textContent).toBe('The official name of the construction product.');

        // 8. Simulate clicking the "Generate DPP" button
        const generateBtn = document.getElementById('generate-dpp-btn');
        generateBtn.click();

        // 9. Get the generated JSON from the output and validate it
        const jsonOutput = document.getElementById('json-output');
        const generatedDpp = JSON.parse(jsonOutput.textContent);

        // Manually add the remaining required fields that are not in the form
        const finalDpp = {
            ...generatedDpp,
            dppSchemaVersion: "1.0.0",
            dppStatus: "active",
            lastUpdate: "2025-12-10T12:00:00Z",
            economicOperatorId: "urn:uuid:c4b4e72a-0b29-4877-9883-384a5a5b7b5b"
        };
        
        const validate = ajv.compile(dppSchema);
        const valid = validate(finalDpp);

        expect(validate.errors).toBeNull();
        expect(valid).toBe(true);
        
        // Also check that the core and sector data is present
        expect(finalDpp.digitalProductPassportId).toBe('urn:uuid:f5c3b1e0-4d4a-45c1-8b02-8378336a13a4');
        expect(finalDpp.productName).toBe('Test Construction Product');
        expect(finalDpp.granularity).toBe('Batch');
        expect(finalDpp.contentSpecificationId).toBe('construction-product-dpp-v1');
        expect(finalDpp.contentSpecificationIds).toEqual(['construction-product-dpp-v1']);
    });
});
