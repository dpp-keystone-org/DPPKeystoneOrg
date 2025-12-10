/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fileURLToPath } from 'url';

// Import the functions we want to test directly
import { buildForm } from '../../src/wizard/form-builder.js';
import { generateDpp } from '../../src/wizard/dpp-generator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFile = (filePath) => fs.readFile(path.resolve(__dirname, '../../', filePath), 'utf-8');
const loadJson = async (filePath) => JSON.parse(await loadFile(filePath));


describe('DPP Wizard - Full Integration Flow', () => {
    let ajv;
    let dppSchema;

    beforeAll(async () => {
        dppSchema = await loadJson('src/validation/v1/json-schema/dpp.schema.json');
        ajv = new Ajv2020({
            allowMatchingProperties: true,
            allowUnionTypes: true
        });
        addFormats(ajv);
    });

    it('should generate a valid DPP for the construction sector', async () => {
        // 1. Set up the DOM from our index.html
        const wizardHtml = await loadFile('src/wizard/index.html');
        document.body.innerHTML = wizardHtml;

        const sectorSelect = document.getElementById('sector-select');
        const formContainer = document.getElementById('form-container');
        const generateBtn = document.getElementById('generate-dpp-btn');
        const jsonOutput = document.getElementById('json-output');
        const voluntaryFieldsWrapper = document.getElementById('voluntary-fields-wrapper');

        // 2. Define a simple, non-conditional mock schema for the test
        const mockConstructionSchema = {
            "title": "DPP for Construction Products (Test)",
            "type": "object",
            "properties": {
                "productName": {
                    "title": "Product Name",
                    "description": "The official name of the product.",
                    "type": "string"
                }
            },
            "required": ["productName"]
        };
        
        // 3. Simulate user selecting the 'construction' sector and build the form
        sectorSelect.value = 'construction';
        const formFragment = buildForm(mockConstructionSchema);
        formContainer.innerHTML = '';
        formContainer.appendChild(formFragment);

        // 4. Programmatically fill the form
        const productNameInput = document.querySelector('[name="productName"]');
        expect(productNameInput).not.toBeNull(); // Ensure the form is actually there
        productNameInput.value = 'Test Construction Product';

        // 5. Simulate clicking the "Generate DPP" button by calling the function directly
        const dppObject = generateDpp(formContainer, voluntaryFieldsWrapper);

        // Add required top-level properties for the master schema to pass
        dppObject.digitalProductPassportId = "urn:uuid:f5c3b1e0-4d4a-45c1-8b02-8378336a13a4";
        dppObject.uniqueProductIdentifier = "urn:uuid:a38f6c90-2b9a-4e6f-8524-7a42f6f3e3f4";
        dppObject.granularity = "Item";
        dppObject.dppSchemaVersion = "1.0.0";
        dppObject.dppStatus = "active";
        dppObject.lastUpdate = "2025-12-10T12:00:00Z";
        dppObject.economicOperatorId = "urn:uuid:c4b4e72a-0b29-4877-9883-384a5a507b5b";
        dppObject.id = "urn:uuid:12345678-1234-5678-1234-567812345678";
        dppObject.specVersion = "1.0.0";

        // Add the contentSpecificationId based on selection
        dppObject.contentSpecificationId = "construction-product-dpp-v1";
        dppObject.contentSpecificationIds = ["construction-product-dpp-v1"];
        
        // Display the output
        jsonOutput.textContent = JSON.stringify(dppObject, null, 2);

        // 6. Get and validate the output
        const generatedDpp = JSON.parse(jsonOutput.textContent);
        const validate = ajv.compile(dppSchema);
        const valid = validate(generatedDpp);

        expect(validate.errors).toBeNull();
        expect(valid).toBe(true);
    });
});
