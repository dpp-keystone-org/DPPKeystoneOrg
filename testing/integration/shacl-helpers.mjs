import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Readable } from 'stream';
import jsonld from 'jsonld';
import N3Parser from '@rdfjs/parser-n3';
import datasetFactory from '@rdfjs/dataset';

// --- Pathing and Constants ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const PROJECT_ROOT = path.join(__dirname, '..', '..');

// This map redirects requests for production URLs to local files in the 'dist' directory.
const CONTEXT_URL_TO_LOCAL_PATH_MAP = {
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
    // Sectors
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Battery.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Battery.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Textile.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Textile.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Construction.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Construction.jsonld'),
    "https://dpp-keystone.org/spec/ontology/v1/sectors/Electronics.jsonld":
        path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'sectors', 'Electronics.jsonld'),
};

export const localFileDocumentLoader = async (url) => {
    // --- DIAGNOSTIC LOGGING ---
    console.log(`[Document Loader] Intercepted request for URL: ${url}`);

    if (url in CONTEXT_URL_TO_LOCAL_PATH_MAP) {
        console.log(`[Document Loader] SUCCESS: Found local mapping for ${url}`);
        const localPath = CONTEXT_URL_TO_LOCAL_PATH_MAP[url];
        console.log(`[Document Loader] Attempting to read local file: ${localPath}`);
        const fileContent = await fs.readFile(localPath, 'utf-8');
        const parsedDocument = JSON.parse(fileContent);
        return { contextUrl: null, documentUrl: url, document: parsedDocument };
    }

    console.error(`[Document Loader] FAILURE: No local mapping for ${url}. Falling back to network request.`);
    return jsonld.documentLoaders.node()(url);
};


// --- Helper Functions for SHACL ---

/**
 * Converts a JSON-LD document (in expanded form) to an RDF dataset.
 * This function is passed the `factory` so it can be used with different
 * RDF/JS environments (e.g., rdf-ext vs. a minimal one).
 */
export async function toRdfDataset(expanded) {
    const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
    const inputStream = Readable.from([nquads]);
    const parser = new N3Parser(); // Use default factory
    const quadStream = parser.import(inputStream);
    const dataset = datasetFactory.dataset(); // Create a proper RDF/JS dataset

    // The minimal @rdfjs/dataset doesn't have a .import() stream method,
    // so we handle the stream manually.
    return new Promise((resolve, reject) => {
        quadStream.on('data', (quad) => {
            dataset.add(quad); // Use the .add() method for datasets
        }).on('end', () => {
            resolve(dataset);
        }).on('error', reject);
    });
}

/**
 * Loads a SHACL or data file (which are JSON-LD documents) and converts it to an RDF dataset.
 */
export async function loadRdfFile(filePath) {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(fileContent);

    // --- DEBUGGING: Log the expanded document ---
    // This will show us what the JSON-LD processor produces after applying the context.
    // If this is an empty array [], it's the source of our problem.
    console.log(`--- Expanding ${path.basename(filePath)} ---`);
    const expanded = await jsonld.expand(json, {
        documentLoader: localFileDocumentLoader,
        processingMode: 'json-ld-1.1' // Explicitly use JSON-LD 1.1
    });
    console.log(JSON.stringify(expanded, null, 2));
    console.log(`--- End Expansion for ${path.basename(filePath)} ---`);
    return toRdfDataset(expanded);
}

/**
 * Combines multiple datasets into one.
 */
export function combineDatasets(datasets) {
    const combined = datasetFactory.dataset();
    for (const dataset of datasets) {
        for (const quad of dataset) {
            combined.add(quad);
        }
    }
    return combined;
}
