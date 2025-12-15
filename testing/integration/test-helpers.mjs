import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.join(__dirname, '..', '..');

export async function setupTestEnvironment(testDirName) {
    const FIXTURES_DIR = path.resolve(PROJECT_ROOT, 'testing', 'fixtures', 'spec-docs');
    const TEMP_DIR = path.resolve(PROJECT_ROOT, 'testing', 'tmp', testDirName);
    
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    
    const distSpecDir = path.join(TEMP_DIR, 'dist', 'spec');
    
    const tempOntologyDir = path.join(distSpecDir, 'ontology', 'v1');
    const tempContextsDir = path.join(distSpecDir, 'contexts', 'v1');
    await fs.mkdir(path.join(tempOntologyDir, 'core'), { recursive: true });
    await fs.mkdir(path.join(tempOntologyDir, 'sectors'), { recursive: true });
    await fs.mkdir(tempContextsDir, { recursive: true });

    // Copy mock files
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-core.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'contexts', 'v1', 'mock-core.context.jsonld'),
        path.join(tempContextsDir, 'mock-core.context.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core-toplevel.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-core-toplevel.jsonld')
    );


    return {
        fixturesDir: FIXTURES_DIR,
        tempDir: TEMP_DIR,
        distSpecDir: distSpecDir
    };
}

// This map redirects requests for production URLs to local files in the 'dist' directory.
export const CONTEXT_URL_TO_LOCAL_PATH_MAP = {
    "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-core.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-construction.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-electronics.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-electronics.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-battery.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-textile.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-textile.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-product-details.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-product-details.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-epd.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-epd.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-dopc.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1', 'dpp-dopc.context.jsonld'),

    // --- Ontology Files ---
    "https://dpp-keystone.org/spec/ontology/v1/dpp-ontology.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'dpp-ontology.jsonld'),
    // Core
    "https://dpp-keystone.org/spec/ontology/v1/core/Header.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'Header.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/Organization.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'Organization.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/Product.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'Product.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/Compliance.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'Compliance.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/ProductDetails.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'ProductDetails.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/RelatedResource.jsonld":
    path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'RelatedResource.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/EPD.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'EPD.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/core/DoPC.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'DoPC.jsonld'),
    // Sectors
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Battery.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Battery.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Textile.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Textile.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Construction.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Construction.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Electronics.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Electronics.jsonld'),

    // --- SHACL Shape Files ---
    "https://dpp-keystone.org/spec/validation/v1/shacl/core-shapes.shacl.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', 'core-shapes.shacl.jsonld'),
    "https://dpp-keystone.org/spec/validation/v1/shacl/battery-shapes.shacl.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', 'battery-shapes.shacl.jsonld'),
    "https://dpp-keystone.org/spec/validation/v1/shacl/construction-shapes.shacl.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', 'construction-shapes.shacl.jsonld'),
    "https://dpp-keystone.org/spec/validation/v1/shacl/electronics-shapes.shacl.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', 'electronics-shapes.shacl.jsonld'),
    "https://dpp-keystone.org/spec/validation/v1/shacl/textile-shapes.shacl.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', 'textile-shapes.shacl.jsonld'),
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

    console.log('Data to fill for sector', sector, ':', dataToFill);

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
    }
}