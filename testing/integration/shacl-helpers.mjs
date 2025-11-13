import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import jsonld from 'jsonld';
import { parse as jsoncParse } from 'jsonc-parser';
import N3Parser from '@rdfjs/parser-n3';

// --- Pathing and Constants ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.join(__dirname, '..', '..');

const CONTEXT_URL_TO_LOCAL_PATH_MAP = {
    "https://dpp-keystone.org/contexts/v1/dpp-core.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'contexts', 'v1', 'dpp-core.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-construction.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'contexts', 'v1', 'dpp-construction.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-electronics.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'contexts', 'v1', 'dpp-electronics.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-battery.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'contexts', 'v1', 'dpp-battery.context.jsonld'),
    "https://dpp-keystone.org/contexts/v1/dpp-textile.context.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'contexts', 'v1', 'dpp-textile.context.jsonld'),
};

export const localFileDocumentLoader = async (url) => {
    if (url in CONTEXT_URL_TO_LOCAL_PATH_MAP) {
        const localPath = CONTEXT_URL_TO_LOCAL_PATH_MAP[url];
        const fileContent = await fs.readFile(localPath, 'utf-8');
        const parsedDocument = jsoncParse(fileContent, [], { allowTrailingComma: true });
        return { contextUrl: null, documentUrl: url, document: parsedDocument };
    }
    return jsonld.documentLoaders.node()(url);
};


// --- Helper Functions for SHACL ---

/**
 * Converts a JSON-LD document (in expanded form) to an RDF dataset.
 * This function is passed the `factory` so it can be used with different
 * RDF/JS environments (e.g., rdf-ext vs. a minimal one).
 */
export async function toRdfDataset(expanded, { factory }) {
    const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
    const inputStream = Readable.from([nquads]);
    const parser = new N3Parser({ factory });
    const quadStream = parser.import(inputStream);
    const dataset = factory.dataset();

    // The minimal @rdfjs/dataset doesn't have a .import() stream method,
    // so we handle the stream manually.
    return new Promise((resolve, reject) => {
        quadStream.on('data', (quad) => {
            dataset.add(quad);
        }).on('end', () => {
            resolve(dataset);
        }).on('error', reject);
    });
}

/**
 * Loads a SHACL or data file (which are JSON-LD documents) and converts it to an RDF dataset.
 */
export async function loadRdfFile(filePath, { factory }) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const json = jsoncParse(fileContent, [], { allowTrailingComma: true });
    const expanded = await jsonld.expand(json, { documentLoader: localFileDocumentLoader });
    return toRdfDataset(expanded, { factory });
}

/**
 * Combines multiple datasets into one.
 */
export function combineDatasets(datasets, { factory }) {
    const combined = factory.dataset();
    for (const dataset of datasets) {
        for (const quad of dataset) { combined.add(quad); }
    }
    return combined;
}
