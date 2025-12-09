import fs from 'fs';
import path from 'path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { PROJECT_ROOT } from './shacl-helpers.mjs';

// --- Configuration ---

const SCHEMA_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'json-schema');
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'examples');

// Map contentSpecificationIds to their corresponding schema files.
const conditionalSchemaMap = {
    'draft_construction_specification_id': 'construction.schema.json',
    'draft_battery_specification_id': 'battery.schema.json',
    'draft_electronics_specification_id': 'electronics.schema.json',
    'draft_textile_specification_id': 'textile.schema.json',
    // Add other conditional schemas here as they are created.
};

// --- Test Cases ---
const testCases = [
    'drill-dpp-v1.json',
    'drill-dpp-v1-private.json',
    'battery-dpp-v1.json',
    'sock-dpp-v1.json',
    'rail-dpp-v1.json',
    'construction-product-dpp-v1.json',
];

describe('DPP JSON Schema Validation', () => {
    let ajv;
    let baseSchema;
    let epdSchema;

    beforeAll(async () => {
        // Load schemas that are cross-referenced by other schemas
        const epdSchemaPath = path.join(SCHEMA_DIR, 'epd.schema.json');
        epdSchema = JSON.parse(await fs.promises.readFile(epdSchemaPath, 'utf-8'));

        // Load the base schema once for all tests
        const baseSchemaPath = path.join(SCHEMA_DIR, 'dpp.schema.json');
        baseSchema = JSON.parse(await fs.promises.readFile(baseSchemaPath, 'utf-8'));
    });

    beforeEach(() => {
        // Create a fresh AJV instance for each test to avoid schema conflicts.
        ajv = new Ajv2020({
            allErrors: true,
            allowMatchingProperties: true,
            allowUnionTypes: true
        });
        addFormats(ajv);

        // Add schemas that are referenced by others
        ajv.addSchema(epdSchema);
    });

    test.each(testCases)('%s should be valid', async (exampleFile) => {
        // Load the example data
        const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // Start with the base schema
        const schemasToApply = [baseSchema];

        // Check for conditional schemas to apply
        if (data.contentSpecificationIds && Array.isArray(data.contentSpecificationIds)) {
            for (const id of data.contentSpecificationIds) {
                if (conditionalSchemaMap[id]) {
                    const conditionalSchemaFile = conditionalSchemaMap[id];
                    const schemaPath = path.join(SCHEMA_DIR, conditionalSchemaFile);
                    const schemaContent = await fs.promises.readFile(schemaPath, 'utf-8');
                    schemasToApply.push(JSON.parse(schemaContent));
                }
            }
        }

        // Create a composite schema using allOf
        const compositeSchema = { allOf: schemasToApply };

        // Compile and validate
        const validate = ajv.compile(compositeSchema);
        const isValid = validate(data);

        // Provide detailed error logging if validation fails
        if (!isValid) {
            console.log(`Validation errors for ${exampleFile}:`);
            console.log(JSON.stringify(validate.errors, null, 2));
        }

        expect(isValid).toBe(true);
    });

    test('construction-product-dpp-v1.json should be INVALID if epd is missing', async () => {
        // Load the example data
        const exampleFile = 'construction-product-dpp-v1.json';
        const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // --- Intentionally invalidate the data ---
        delete data.epd;
        // -----------------------------------------

        // Start with the base schema
        const schemasToApply = [baseSchema];

        // Check for conditional schemas to apply (which should be the construction schema)
        if (data.contentSpecificationIds && Array.isArray(data.contentSpecificationIds)) {
            for (const id of data.contentSpecificationIds) {
                if (conditionalSchemaMap[id]) {
                    const conditionalSchemaFile = conditionalSchemaMap[id];
                    const schemaPath = path.join(SCHEMA_DIR, conditionalSchemaFile);
                    const schemaContent = await fs.promises.readFile(schemaPath, 'utf-8');
                    schemasToApply.push(JSON.parse(schemaContent));
                }
            }
        }

        // Create a composite schema using allOf
        const compositeSchema = { allOf: schemasToApply };

        // Compile and validate
        const validate = ajv.compile(compositeSchema);
        const isValid = validate(data);

        // This test should fail validation
        expect(isValid).toBe(false);

        // Optional: Check for the specific error
        expect(validate.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'epd' },
                }),
            ])
        );
    });

    test('battery-dpp-v1.json should be INVALID if batteryCategory is missing', async () => {
        // Load the example data
        const exampleFile = 'battery-dpp-v1.json';
        const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // --- Intentionally invalidate the data ---
        delete data.batteryCategory;
        // -----------------------------------------

        // Start with the base schema
        const schemasToApply = [baseSchema];

        // Check for conditional schemas to apply
        if (data.contentSpecificationIds && Array.isArray(data.contentSpecificationIds)) {
            for (const id of data.contentSpecificationIds) {
                if (conditionalSchemaMap[id]) {
                    const conditionalSchemaFile = conditionalSchemaMap[id];
                    const schemaPath = path.join(SCHEMA_DIR, conditionalSchemaFile);
                    const schemaContent = await fs.promises.readFile(schemaPath, 'utf-8');
                    schemasToApply.push(JSON.parse(schemaContent));
                }
            }
        }

        // Create a composite schema using allOf
        const compositeSchema = { allOf: schemasToApply };

        // Compile and validate
        const validate = ajv.compile(compositeSchema);
        const isValid = validate(data);

        // This test should fail validation
        expect(isValid).toBe(false);

        // Optional: Check for the specific error
        expect(validate.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'batteryCategory' },
                }),
            ])
        );
    });
});