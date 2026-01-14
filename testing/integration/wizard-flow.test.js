/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { TextDecoder, TextEncoder } from 'util';

global.TextDecoder = TextDecoder;
global.TextEncoder = TextEncoder;

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
        localStorage.clear();
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
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        
        const loadOntologyMock = jest.fn();
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: loadOntologyMock,
        }));
        
        // Setup the mock implementations
        loadSchemaMock
            .mockResolvedValueOnce(mockDppSchema) // First call for 'dpp'
            .mockResolvedValueOnce(mockConstructionSchema); // Second call for 'construction'

        const mockOntologyMap = new Map([
            ['digitalProductPassportId', { label: { en: 'DPP Identifier' }, comment: { en: 'The unique identifier for the DPP.' } }],
            ['uniqueProductIdentifier', { label: { en: 'Unique Product ID' }, comment: { en: 'The unique identifier for the product.' } }],
            ['granularity', { label: { en: 'Granularity' }, comment: { en: 'The granularity of the DPP.' } }],
            ['productName', { label: { en: 'Product Name' }, comment: { en: 'The official name of the construction product.' } }]
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
        
        // 7. Simulate user adding a sector
        const addConstructionBtn = document.querySelector('button[data-sector="construction"]');
        addConstructionBtn.click();
        
        // Wait for the sector-specific grid to render and validate it
        const sectorGrid = await waitFor(() => document.querySelector('#sector-form-construction .sector-form-grid'));
        expect(sectorGrid).not.toBeNull();

        // With the new recursive builder, the construction schema will now be rendered dynamically
        const productNameInput = sectorGrid.querySelector('input[name="productName"]');
        expect(productNameInput).not.toBeNull();
        productNameInput.value = 'Test Construction Product';

        // Assert the new 5-column layout and tooltip
        const nameRow = productNameInput.closest('.grid-row');
        const unitCell = nameRow.querySelector('.grid-cell:nth-child(3)');
        const ontologyCell = nameRow.querySelector('.grid-cell:nth-child(4)');
        const tooltipCell = nameRow.querySelector('.grid-cell:nth-child(5)');
        expect(unitCell).not.toBeNull();
        expect(ontologyCell).not.toBeNull();
        expect(tooltipCell).not.toBeNull();

        expect(unitCell.textContent).toBe(''); // No unit for this property
        expect(ontologyCell.textContent).toBe('Product Name'); // 4th cell has the label
        const tooltipButton = tooltipCell.querySelector('button.tooltip-button');
        expect(tooltipButton).not.toBeNull();

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
        expect(finalDpp.contentSpecificationIds).toEqual(['construction-product-dpp-v1']);
        expect(finalDpp['@context']).toBe('https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld');
    });

    it('should update labels and tooltips when the language is changed', async () => {
        // 1. Define mock schema and multi-language ontology
        const mockDppSchema = {
            "properties": { "multiLangProp": { "title": "Multi-Language Prop", "type": "string" } }
        };
        const mockOntologyMap = new Map([
            ['multiLangProp', {
                label: { en: 'English Label', de: 'Deutscher Label' },
                comment: { en: 'English Comment', de: 'Deutscher Kommentar' }
            }]
        ]);

        // 2. Mock the modules
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: jest.fn().mockResolvedValue(mockDppSchema),
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(mockOntologyMap),
        }));

        // 3. Initialize the wizard
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();

        const coreContainer = document.getElementById('core-form-container');

        // --- Assert initial English state ---
        const initialRow = await waitFor(() => coreContainer.querySelector('.grid-row'));
        expect(initialRow).not.toBeNull();

        const initialLabelCell = initialRow.querySelector('.grid-cell:nth-child(4)');
        expect(initialLabelCell.textContent).toBe('English Label');

        const initialTooltipButton = initialRow.querySelector('button.tooltip-button');
        expect(initialTooltipButton).not.toBeNull();
        initialTooltipButton.click();
        let modal = await waitFor(() => document.querySelector('.tooltip-modal'));
        expect(modal.textContent).toContain('English Comment');
        modal.querySelector('.modal-close-btn').click();
        await waitFor(() => !document.querySelector('.tooltip-modal'));

        // --- Simulate language change ---
        const languageSelector = document.getElementById('language-selector');
        languageSelector.value = 'de';
        languageSelector.dispatchEvent(new Event('change'));

        // --- Assert updated German state ---
        // The form re-renders, so we must wait for the new content and re-query elements.
        await waitFor(() => coreContainer.querySelector('.grid-cell:nth-child(4)')?.textContent === 'Deutscher Label');
        
        const updatedRow = coreContainer.querySelector('.grid-row');
        const updatedLabelCell = updatedRow.querySelector('.grid-cell:nth-child(4)');
        expect(updatedLabelCell.textContent).toBe('Deutscher Label');

        const updatedTooltipButton = updatedRow.querySelector('button.tooltip-button');
        expect(updatedTooltipButton).not.toBeNull();
        updatedTooltipButton.click();
        modal = await waitFor(() => document.querySelector('.tooltip-modal'));
        expect(modal.textContent).toContain('Deutscher Kommentar');
        modal.querySelector('.modal-close-btn').click();
        await waitFor(() => !document.querySelector('.tooltip-modal'));
    });

    it('should synchronize fields with the same name across different sectors', async () => {
        // 1. Define mock schemas with a shared field 'manufacturer'
        const mockSectorASchema = {
            "type": "object",
            "properties": { "manufacturer": { "type": "string" } }
        };
        const mockSectorBSchema = {
            "type": "object",
            "properties": { "manufacturer": { "type": "string" } }
        };

        // 2. Mock modules
        const loadSchemaMock = jest.fn();
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(new Map()),
        }));

        loadSchemaMock.mockImplementation((sector) => {
            if (sector === 'sector-a') return Promise.resolve(mockSectorASchema);
            if (sector === 'sector-b') return Promise.resolve(mockSectorBSchema);
            return Promise.resolve({ type: 'object', properties: {} }); // Default/Core
        });

        // 3. Inject buttons for mock sectors
        const btnA = document.createElement('button');
        btnA.dataset.sector = 'sector-a';
        btnA.className = 'sector-btn';
        document.body.appendChild(btnA);
        const btnB = document.createElement('button');
        btnB.dataset.sector = 'sector-b';
        btnB.className = 'sector-btn';
        document.body.appendChild(btnB);

        // 4. Initialize and Add sectors
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();
        btnA.click();
        btnB.click();

        // 5. Wait for forms and find inputs
        const formA = await waitFor(() => document.querySelector('#sector-form-sector-a'));
        const formB = await waitFor(() => document.querySelector('#sector-form-sector-b'));
        const inputA = formA.querySelector('input[name="manufacturer"]');
        const inputB = formB.querySelector('input[name="manufacturer"]');

        // 6. Sync Test: Typing in A should update B
        inputA.value = 'SyncValue';
        inputA.dispatchEvent(new Event('input', { bubbles: true }));

        expect(inputB.value).toBe('SyncValue');
    });

    it('should generate valid JSON with merged shared fields from multiple sectors', async () => {
        // 1. Define mock schemas with a shared field 'manufacturer' and unique fields
        const mockSectorASchema = {
            "type": "object",
            "properties": { 
                "manufacturer": { "type": "string" },
                "sectorAProp": { "type": "string" }
            }
        };
        const mockSectorBSchema = {
            "type": "object",
            "properties": { 
                "manufacturer": { "type": "string" },
                "sectorBProp": { "type": "string" }
            }
        };

        // 2. Mock modules
        const loadSchemaMock = jest.fn();
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(new Map()),
        }));

        loadSchemaMock.mockImplementation((sector) => {
            if (sector === 'sector-a') return Promise.resolve(mockSectorASchema);
            if (sector === 'sector-b') return Promise.resolve(mockSectorBSchema);
            return Promise.resolve({ type: 'object', properties: {} }); // Default/Core
        });

        // 3. Inject buttons
        const btnA = document.createElement('button');
        btnA.dataset.sector = 'sector-a';
        btnA.className = 'sector-btn';
        document.body.appendChild(btnA);
        const btnB = document.createElement('button');
        btnB.dataset.sector = 'sector-b';
        btnB.className = 'sector-btn';
        document.body.appendChild(btnB);

        // 4. Initialize and Add sectors
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();
        btnA.click();
        btnB.click();

        // 5. Fill inputs
        const formA = await waitFor(() => document.querySelector('#sector-form-sector-a'));
        const formB = await waitFor(() => document.querySelector('#sector-form-sector-b'));
        
        // Unique fields
        formA.querySelector('input[name="sectorAProp"]').value = 'ValueA';
        formB.querySelector('input[name="sectorBProp"]').value = 'ValueB';

        // Shared field (sync is active, so typing in one updates other)
        const inputA = formA.querySelector('input[name="manufacturer"]');
        inputA.value = 'SharedManufacturer';
        inputA.dispatchEvent(new Event('input', { bubbles: true }));

        // 6. Generate JSON
        const generateBtn = document.getElementById('generate-dpp-btn');
        generateBtn.click();

        const jsonOutput = document.getElementById('json-output');
        const generatedDpp = JSON.parse(jsonOutput.textContent);

        // 7. Assertions
        expect(generatedDpp.sectorAProp).toBe('ValueA');
        expect(generatedDpp.sectorBProp).toBe('ValueB');
        expect(generatedDpp.manufacturer).toBe('SharedManufacturer');
        
        // Ensure no duplication in keys (JSON.parse handles this, but we can check if it's an array or something weird)
        expect(Array.isArray(generatedDpp.manufacturer)).toBe(false);

        // Check context array
        expect(generatedDpp['@context']).toEqual([
            'https://dpp-keystone.org/spec/contexts/v1/dpp-sector-a.context.jsonld',
            'https://dpp-keystone.org/spec/contexts/v1/dpp-sector-b.context.jsonld'
        ]);
    });

    it('should generate valid JSON for voluntary complex types (Organization)', async () => {
        // 1. Define mock schema for Organization
        const mockOrgSchema = {
            "type": "object",
            "properties": {
                "orgName": { "type": "string" },
                "orgId": { "type": "string" }
            }
        };

        // 2. Mock modules
        const loadSchemaMock = jest.fn();
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(new Map()),
        }));

        loadSchemaMock.mockImplementation((name) => {
            if (name === 'organization') return Promise.resolve(mockOrgSchema);
            return Promise.resolve({ type: 'object', properties: {} }); // Default
        });

        // 3. Initialize Wizard
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();

        // 4. Add Voluntary Field
        const addBtn = document.getElementById('add-voluntary-field-btn');
        addBtn.click();

        // 5. Find the row and configure it
        const voluntaryWrapper = document.getElementById('voluntary-fields-wrapper');
        const row = await waitFor(() => voluntaryWrapper.lastElementChild);
        
        const keyInput = row.querySelector('input[type="text"]');
        keyInput.value = 'myOrg';
        keyInput.dispatchEvent(new Event('input'));

        const typeSelect = row.querySelector('select');
        // Find option with text 'Organization' to ensure we select the right one
        const orgOption = Array.from(typeSelect.options).find(opt => opt.text === 'Organization');
        typeSelect.value = orgOption.value;
        typeSelect.dispatchEvent(new Event('change', { bubbles: true }));

        // 6. Wait for sub-form and fill data
        const orgNameInput = await waitFor(() => row.querySelector('input[name="myOrg.orgName"]'));
        const orgIdInput = row.querySelector('input[name="myOrg.orgId"]');
        orgNameInput.value = 'Acme Corp';
        orgIdInput.value = 'ORG-123';

        // 7. Generate and Assert
        document.getElementById('generate-dpp-btn').click();
        const generatedDpp = JSON.parse(document.getElementById('json-output').textContent);

        expect(generatedDpp.myOrg).toEqual({
            orgName: 'Acme Corp',
            orgId: 'ORG-123'
        });
    });

    it('should load the General Product module and generate valid JSON', async () => {
        // 1. Load the real General Product schema
        const generalProductSchema = await loadJson('src/validation/v1/json-schema/general-product.schema.json');

        // 2. Mock modules
        const loadSchemaMock = jest.fn();
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(new Map()),
        }));

        loadSchemaMock.mockImplementation((sector) => {
            if (sector === 'general-product') return Promise.resolve(generalProductSchema);
            return Promise.resolve({ type: 'object', properties: {} }); // Default
        });

        // 3. Inject button for General Product
        const btn = document.createElement('button');
        btn.dataset.sector = 'general-product';
        btn.className = 'sector-btn';
        document.body.appendChild(btn);

        // 4. Initialize Wizard
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();
        btn.click();

        // 5. Fill fields
        const form = await waitFor(() => document.querySelector('#sector-form-general-product'));
        expect(form).not.toBeNull();
        
        // Check if fields exist
        const brandInput = form.querySelector('input[name="brand"]');
        expect(brandInput).not.toBeNull();
        brandInput.value = 'KeystoneBrand';

        const weightInput = form.querySelector('input[name="netWeight"]');
        if (weightInput) {
            weightInput.value = '10.5';
        }

        // Test Components Array
        const addComponentBtn = await waitFor(() => form.querySelector('button[data-array-name="components"]'));
        if (addComponentBtn) {
            addComponentBtn.click();
            const compNameInput = await waitFor(() => form.querySelector('input[name="components.0.name"]'));
            if (compNameInput) compNameInput.value = 'TestComponent';
        }

        // 6. Generate
        document.getElementById('generate-dpp-btn').click();
        const generatedDpp = JSON.parse(document.getElementById('json-output').textContent);

        expect(generatedDpp.brand).toBe('KeystoneBrand');
        if (generatedDpp.components) {
            expect(generatedDpp.components[0].name).toBe('TestComponent');
        }
        // Check context
        expect(generatedDpp['@context']).toContain('https://dpp-keystone.org/spec/contexts/v1/dpp-general-product.context.jsonld');
    }, 30000);

    it('should load the Packaging module and generate valid JSON', async () => {
        // 1. Load the real Packaging schema
        const packagingSchema = await loadJson('src/validation/v1/json-schema/packaging.schema.json');

        // 2. Mock modules
        const loadSchemaMock = jest.fn();
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: loadSchemaMock,
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(new Map()),
        }));

        loadSchemaMock.mockImplementation((sector) => {
            if (sector === 'packaging') return Promise.resolve(packagingSchema);
            return Promise.resolve({ type: 'object', properties: {} }); // Default
        });

        // 3. Inject button for Packaging
        const btn = document.createElement('button');
        btn.dataset.sector = 'packaging';
        btn.className = 'sector-btn';
        document.body.appendChild(btn);

        // 4. Initialize Wizard
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();
        btn.click();

        // 5. Fill fields
        const form = await waitFor(() => document.querySelector('#sector-form-packaging'));
        expect(form).not.toBeNull();
        
        // This is a nested array "packagingMaterials" -> [ { ... } ]
        // The wizard should render an "Add" button for the array.
        const addPkgBtn = await waitFor(() => form.querySelector('button[data-array-name="packagingMaterials"]'));
        expect(addPkgBtn).not.toBeNull();
        addPkgBtn.click();

        // Wait for the array items to appear
        const materialInput = await waitFor(() => form.querySelector('input[name="packagingMaterials.0.packagingMaterialType"]'));
        expect(materialInput).not.toBeNull();
        
        materialInput.value = 'Cardboard';

        // 6. Generate
        document.getElementById('generate-dpp-btn').click();
        const generatedDpp = JSON.parse(document.getElementById('json-output').textContent);

        expect(generatedDpp.packagingMaterials).toHaveLength(1);
        expect(generatedDpp.packagingMaterials[0].packagingMaterialType).toBe('Cardboard');
        // Check context
        expect(generatedDpp['@context']).toContain('https://dpp-keystone.org/spec/contexts/v1/dpp-packaging.context.jsonld');
    }, 30000);

    it('should display user-friendly labels in the error summary for custom fields', async () => {
        // 1. Mock minimal modules
        jest.unstable_mockModule('../../src/lib/schema-loader.js', () => ({
            loadSchema: jest.fn().mockResolvedValue({ type: 'object', properties: {} }),
        }));
        jest.unstable_mockModule('../../src/lib/ontology-loader.js', () => ({
            loadOntology: jest.fn().mockResolvedValue(new Map()),
        }));

        // 2. Initialize Wizard
        const { initializeWizard } = await import('../../src/wizard/wizard.js');
        await initializeWizard();

        // 3. Add Voluntary Field
        const addBtn = document.getElementById('add-voluntary-field-btn');
        addBtn.click();

        // 4. Find the row and enter an invalid prefixed key
        const voluntaryWrapper = document.getElementById('voluntary-fields-wrapper');
        const row = await waitFor(() => voluntaryWrapper.lastElementChild);
        
        const keyInput = row.querySelector('.voluntary-name');
        keyInput.value = 'undefinedPrefix:test';
        keyInput.dispatchEvent(new Event('blur')); // Trigger validation

        // 5. Wait for the error count badge to update
        const badge = document.getElementById('error-count-badge');
        await waitFor(() => badge.textContent === '1');

        // 6. Open "Show Errors" modal
        const showErrorsBtn = document.getElementById('show-errors-btn');
        showErrorsBtn.click();
        
        const modal = await waitFor(() => document.querySelector('.error-summary-modal'));
        expect(modal).not.toBeNull();

        // 7. Assert that the link text is the user's input, not the ID
        const errorLink = modal.querySelector('li a');
        expect(errorLink.textContent).toBe('undefinedPrefix:test');
        expect(errorLink.textContent).not.toMatch(/custom-key-/);
    });
});
