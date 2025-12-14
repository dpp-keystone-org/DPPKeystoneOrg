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