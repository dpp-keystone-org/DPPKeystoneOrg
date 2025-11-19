import fs from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { PROJECT_ROOT } from './shacl-helpers.mjs';

// --- Setup ---

// Initialize AJV using the specialized Ajv2020 constructor.
// This pre-configures the instance with all necessary Draft 2020-12 meta-schemas,
// completely avoiding the complex manual loading process.
const ajv = new Ajv2020({ 
    allErrors: true,
    allowMatchingProperties: true,
    allowUnionTypes: true
});

// Add formats like "date-time" and "uri-reference" to the validator immediately.
addFormats(ajv);

describe('DPP JSON Schema Validation', () => {
    let validate;

    // Before running any tests, load and compile the main DPP header schema.
    beforeAll(async () => {
        const schemaPath = path.join(PROJECT_ROOT, 'dist', 'validation', 'v1', 'json-schema', 'dpp-header.schema.json');
        const schemaContent = await fs.promises.readFile(schemaPath, 'utf-8');
        const schema = JSON.parse(schemaContent);
        validate = ajv.compile(schema);
    });

    // --- Test Cases ---
    // An array of the example files to be validated against the schema.
    const testCases = [
        'drill-dpp-v1.json',
        'drill-dpp-v1-private.json',
        'battery-dpp-v1.json',
        'sock-dpp-v1.json',
        'rail-dpp-v1.json',
    ];

    // Use test.each to run the same validation logic for each example file.
    test.each(testCases)('%s should be valid against the DPP Header JSON Schema', async (exampleFile) => {
        const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'examples', exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        const isValid = validate(data);

        // Provide detailed error logging if validation fails
        if (!isValid) {
            console.log(`Validation errors for ${exampleFile}:`);
            console.log(JSON.stringify(validate.errors, null, 2));
        }

        expect(isValid).toBe(true);
    });
});