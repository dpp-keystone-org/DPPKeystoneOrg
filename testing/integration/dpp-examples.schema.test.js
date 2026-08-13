import fs from 'fs';
import path from 'path';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import { PROJECT_ROOT } from '../scripts/shacl-helpers.mjs';
import { validateDpp } from '../../src/util/js/common/validation/schema-validator.js';

// --- Configuration ---

const SCHEMA_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'json-schema');
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'examples');

// --- Test Cases ---
const testCases = [
    'drill-dpp-v1.json',
    'drill-dpp-v1-private.json',
    'battery-dpp-v1.json',
    'battery-lmv-dpp-v1.json',
    'battery-industrial-dpp-v1.json',
    'sock-dpp-v2.json',
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

        // Load common schemas dynamically
        const sharedDir = path.join(SCHEMA_DIR, 'shared');
        const sharedFiles = await fs.promises.readdir(sharedDir);
        for (const file of sharedFiles) {
            if (file.endsWith('.schema.json')) {
                schemaContext.commonSchemas.push(await loadSchema(path.join('shared', file)));
            }
        }

        // Load the base schema
        schemaContext.baseSchema = await loadSchema('dpp.schema.json');

        // Load all sector schemas dynamically
        const sectorDir = path.join(SCHEMA_DIR, 'sector');
        
        const loadNestedSchemas = async (dirPath, prefix) => {
            const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    await loadNestedSchemas(path.join(dirPath, entry.name), path.join(prefix, entry.name));
                } else if (entry.name.endsWith('.schema.json')) {
                    schemaContext.commonSchemas.push(await loadSchema(path.join(prefix, entry.name)));
                }
            }
        };

        const sectorFiles = await fs.promises.readdir(sectorDir, { withFileTypes: true });
        for (const entry of sectorFiles) {
            if (entry.isDirectory()) {
                await loadNestedSchemas(path.join(sectorDir, entry.name), path.join('sector', entry.name));
            } else if (entry.name.endsWith('.schema.json')) {
                schemaContext.sectorSchemas[entry.name] = await loadSchema(path.join('sector', entry.name));
            }
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

    const createBatteryTests = (exampleFile, specId) => {
        test(`${exampleFile} should activate and be INVALID if batteryCategory is missing`, async () => {
            const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
            const data = JSON.parse(await fs.promises.readFile(exampleFilePath, 'utf-8'));

            delete data.batteryCategory;
            const result = validateDpp(data, schemaContext);
            expect(result.valid).toBe(false);
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        keyword: 'required',
                        params: { missingProperty: 'batteryCategory' },
                    }),
                ])
            );
        });

        test(`${exampleFile} should inactivate and be VALID if batteryCategory is missing but specId is removed`, async () => {
            const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
            const data = JSON.parse(await fs.promises.readFile(exampleFilePath, 'utf-8'));

            delete data.batteryCategory;
            data.contentSpecificationIds = data.contentSpecificationIds.filter(id => id !== specId);
            
            const result = validateDpp(data, schemaContext);
            if (!result.valid) {
                console.log(result.errors);
            }
            expect(result.valid).toBe(true);
        });
    };

    createBatteryTests('battery-dpp-v1.json', `https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/json-schema/sector/battery-ev.schema.json`);
    createBatteryTests('battery-lmv-dpp-v1.json', `https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/json-schema/sector/battery-lmv.schema.json`);
    createBatteryTests('battery-industrial-dpp-v1.json', `https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/json-schema/sector/battery-industrial.schema.json`);
});
