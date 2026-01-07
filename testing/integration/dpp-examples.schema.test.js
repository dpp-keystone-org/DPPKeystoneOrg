import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from './shacl-helpers.mjs';
import { validateDpp } from '../../src/util/js/common/validation/schema-validator.js';

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
    let schemaContext = {
        baseSchema: null,
        sectorSchemas: {},
        commonSchemas: []
    };

    beforeAll(async () => {
        // Load common schemas
        const loadSchema = async (filename) => {
            const schemaPath = path.join(SCHEMA_DIR, filename);
            return JSON.parse(await fs.promises.readFile(schemaPath, 'utf-8'));
        };

        const epdSchema = await loadSchema('epd.schema.json');
        const relatedResourceSchema = await loadSchema('related-resource.schema.json');
        const organizationSchema = await loadSchema('organization.schema.json');
        const postalAddressSchema = await loadSchema('postal-address.schema.json');
        const dopcSchema = await loadSchema('dopc.schema.json');
        const prodCharSchema = await loadSchema('product-characteristic.schema.json');

        schemaContext.commonSchemas = [
            epdSchema,
            relatedResourceSchema,
            organizationSchema,
            postalAddressSchema,
            dopcSchema,
            prodCharSchema
        ];

        // Load the base schema
        schemaContext.baseSchema = await loadSchema('dpp.schema.json');

        // Load all sector schemas
        for (const [id, filename] of Object.entries(conditionalSchemaMap)) {
            schemaContext.sectorSchemas[id] = await loadSchema(filename);
        }
    });

    test.each(testCases)('%s should be valid', async (exampleFile) => {
        // Load the example data
        const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // Validate using the shared library
        const result = validateDpp(data, schemaContext);

        // Provide detailed error logging if validation fails
        if (!result.valid) {
            console.log(`Validation errors for ${exampleFile}:`);
            console.log(JSON.stringify(result.errors, null, 2));
        }

        expect(result.valid).toBe(true);
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

        // Validate
        const result = validateDpp(data, schemaContext);

        // This test should fail validation
        expect(result.valid).toBe(false);

        // Check for the specific error
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'batteryCategory' },
                }),
            ])
        );
    });
});
