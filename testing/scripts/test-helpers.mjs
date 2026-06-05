import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.join(__dirname, '..', '..');

export async function setupTestEnvironment(testDirName) {
    const FIXTURES_DIR = path.resolve(PROJECT_ROOT, 'testing', 'fixtures', 'spec-docs');
    const TEMP_DIR = path.resolve(PROJECT_ROOT, 'testing', 'tmp', testDirName);

    await fs.rm(TEMP_DIR, { recursive: true, force: true });

    const distSpecDir = path.join(TEMP_DIR, 'dist', 'spec');

    const tempOntologyDir = path.join(distSpecDir, 'ontology', KEYSTONE_VERSION);
    const tempContextsDir = path.join(distSpecDir, 'contexts', KEYSTONE_VERSION);
    await fs.mkdir(path.join(tempOntologyDir, 'core'), { recursive: true });
    await fs.mkdir(path.join(tempOntologyDir, 'sectors'), { recursive: true });
    await fs.mkdir(tempContextsDir, { recursive: true });

    // Copy mock files
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-core.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-core.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'contexts', KEYSTONE_VERSION, 'mock-core.context.jsonld'),
        path.join(tempContextsDir, 'mock-core.context.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-core-toplevel.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-core-toplevel.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-complex-comment.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-complex-comment.jsonld')
    );


    return {
        fixturesDir: FIXTURES_DIR,
        tempDir: TEMP_DIR,
        distSpecDir: distSpecDir
    };
}

// This map redirects requests for production URLs to local files in the 'dist' directory.
export const CONTEXT_URL_TO_LOCAL_PATH_MAP = {
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-core.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-construction.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-construction.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-electronics.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-electronics.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-battery.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-textile.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-textile.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-general-product.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-general-product.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-packaging.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-packaging.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-epd.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-epd.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-dopc.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-dopc.context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-iron-steel.context.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', KEYSTONE_VERSION, 'dpp-iron-steel.context.jsonld'),


    // --- Ontology Files ---
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'dpp-ontology.jsonld'),
    // Core
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/Header.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'Header.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/Organization.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'Organization.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/Product.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'Product.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/Compliance.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'Compliance.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/RelatedResource.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'RelatedResource.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/EPD.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'EPD.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/core/DoPC.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'DoPC.jsonld'),
    // Sectors
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/sectors/Battery.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'sectors', 'Battery.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/sectors/Textile.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'sectors', 'Textile.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/sectors/Construction.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'sectors', 'Construction.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/sectors/Electronics.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'sectors', 'Electronics.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/sectors/IronSteel.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'sectors', 'IronSteel.jsonld'),
    [`https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/sectors/EUApparelSizeSystem.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'sectors', 'EUApparelSizeSystem.jsonld'),

    // --- SHACL Shape Files ---
    [`https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/core-shapes.shacl.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl', 'core-shapes.shacl.jsonld'),
    [`https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/battery-shapes.shacl.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl', 'battery-shapes.shacl.jsonld'),
    [`https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/construction-shapes.shacl.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl', 'construction-shapes.shacl.jsonld'),
    [`https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/electronics-shapes.shacl.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl', 'electronics-shapes.shacl.jsonld'),
    [`https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/textile-shapes.shacl.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl', 'textile-shapes.shacl.jsonld'),
    [`https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/iron-steel-shapes.shacl.jsonld`]:
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl', 'iron-steel-shapes.shacl.jsonld'),
};

export async function fillRequiredFields(page, sector) {
    // Wait for the testing object to be exposed on the window.
    await page.waitForFunction(() => window.testing);

    const counters = { string: 1, number: 1, uri: 1, date: 1 };

    // The data generation logic MUST run inside the browser context (page.evaluate)
    // to have access to the complete, resolved schema objects.
    const dataToFill = await page.evaluate(({ sector, counters }) => {

        function traverse(schema, ontologyMap, counters, results, pathPrefix) {
            let schemaToProcess = schema;

            // Check if this is a conditional schema and use the 'then' block if so.
            if (schema && schema.then && !schema.properties) {
                schemaToProcess = schema.then;
            }

            if (!schemaToProcess || !schemaToProcess.required || !schemaToProcess.properties) {
                return;
            }

            for (const key of schemaToProcess.required) {
                const prop = schemaToProcess.properties[key];
                if (!prop) continue;

                const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;

                if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
                    results[fullPath] = prop.enum[0];
                } else if (prop.type === 'object' && prop.properties) {
                    traverse(prop, ontologyMap, counters, results, fullPath);
                } else if (prop.format === 'uri') {
                    results[fullPath] = `https://example.com/${counters.uri++}`;
                } else if (prop.format === 'date-time') {
                    results[fullPath] = '2025-01-01T12:00';
                } else if (prop.format === 'date') {
                    results[fullPath] = '2025-01-01';
                } else if (prop.type === 'string') {
                    results[fullPath] = `Test ${counters.string++}`;
                } else if (prop.type === 'number' || prop.type === 'integer') {
                    results[fullPath] = counters.number++;
                }
            }
        }

        function generateRequiredFieldData(schema, ontologyMap, counters) {
            const results = {};
            traverse(schema, ontologyMap, counters, results, '');
            return results;
        }

        const { schema, ontologyMap } = (() => {
            if (sector === 'dpp') {
                const coreSchema = window.testing.getCoreSchema();
                return { schema: coreSchema, ontologyMap: null };
            }
            const sectorData = window.testing.getSectorData().get(sector);
            return { schema: sectorData.schema, ontologyMap: sectorData.ontologyMap };
        })();

        return generateRequiredFieldData(schema, ontologyMap, counters);

    }, { sector, counters });

    //console.log('Data to fill for sector', sector, ':', dataToFill);

    for (const [fieldName, value] of Object.entries(dataToFill)) {
        // Handle array buttons
        const parts = fieldName.split('.');
        if (parts.length > 1 && !isNaN(parseInt(parts[1], 10))) {
            const arrayName = parts[0];
            if (parts[1] === '0') {
                const addButton = page.locator(`button[data-array-name="${arrayName}"]`);
                if (await addButton.isVisible()) {
                    await addButton.click();
                }
            }
        }

        const input = page.locator(`[name="${fieldName}"]`);
        const tagName = await input.evaluate(el => el.tagName.toLowerCase());

        if (tagName === 'select') {
            // The 'value' from the generator for an enum is the one we should select.
            if (value) {
                await input.selectOption(String(value));
            }
        } else {
            // For other inputs, just fill them.
            await input.fill(String(value));
        }
        await input.blur();
    }
}