import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jsonld from 'jsonld';
import { parse as jsoncParse } from 'jsonc-parser';

// Recreate __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the root directory of the project to resolve paths correctly.
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// This mapping is the core of the override mechanism, allowing for offline testing.
const CONTEXT_URL_TO_LOCAL_PATH_MAP = {
    "https://dpp-keystone.org/contexts/v1/dpp-core.context.jsonld":
        path.join(PROJECT_ROOT, 'contexts', 'v1', 'dpp-core.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-construction.context.jsonld":
        path.join(PROJECT_ROOT, 'contexts', 'v1', 'dpp-construction.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-electronics.context.jsonld":
        path.join(PROJECT_ROOT, 'contexts', 'v1', 'dpp-electronics.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-battery.context.jsonld":
        path.join(PROJECT_ROOT, 'contexts', 'v1', 'dpp-battery.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-textile.context.jsonld":
        path.join(PROJECT_ROOT, 'contexts', 'v1', 'dpp-textile.context.jsonld'),
};

/**
 * A custom document loader for the jsonld.js library.
 * It intercepts requests for context URLs and serves them from the local filesystem.
 */
const localFileDocumentLoader = async (url) => {
    if (url in CONTEXT_URL_TO_LOCAL_PATH_MAP) {
        const localPath = CONTEXT_URL_TO_LOCAL_PATH_MAP[url];
        try {
            const fileContent = await fs.readFile(localPath, 'utf-8');
            const parsedDocument = jsoncParse(fileContent, [], { allowTrailingComma: true });
            return {
                contextUrl: null,
                documentUrl: url,
                document: parsedDocument
            };
        } catch (e) {
            throw new Error(`Error loading local context file ${localPath}: ${e.message}`);
        }
    }
    // Fallback to the default loader for any other URLs (e.g., schema.org)
    return jsonld.documentLoaders.node()(url);
};

describe('Simple DPP Expansion', () => {
    test('should correctly expand rail-dpp-v1.json using local contexts', async () => {
        const exampleFileName = 'rail-dpp-v1.json';
        const exampleFilePath = path.join(PROJECT_ROOT, 'docs', 'examples', exampleFileName);
        const fileContent = await fs.readFile(exampleFilePath, 'utf-8');
        const dppJson = jsoncParse(fileContent, [], { allowTrailingComma: true });

        // The core test: ensure contexts are wired correctly for expansion.
        const expanded = await jsonld.expand(dppJson, { documentLoader: localFileDocumentLoader });

        // A basic but effective assertion: expansion should produce a non-empty graph.
        expect(Array.isArray(expanded)).toBe(true);
        expect(expanded.length).toBeGreaterThan(0);
    });
});
