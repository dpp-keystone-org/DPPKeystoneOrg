import fs from 'fs/promises';
import path from 'path';
import jsonld from 'jsonld';
import { fileURLToPath } from 'url';
import SHACLValidator from '../testing/node_modules/rdf-validate-shacl/index.js';
import datasetFactory from '../testing/node_modules/@rdfjs/dataset/index.js';
import N3Parser from '../testing/node_modules/@rdfjs/parser-n3/index.js';
import { Readable } from 'stream';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Use dist to match the test environment
const SPEC_DIR = path.join(PROJECT_ROOT, 'dist', 'spec');
const CONTEXTS_DIR = path.join(SPEC_DIR, 'contexts', 'v1');
const SHAPES_DIR = path.join(SPEC_DIR, 'validation', 'v1', 'shacl');

const CONTEXT_MAP = {
    "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-core.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-battery.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-epd.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-epd.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-dopc.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-dopc.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-general-product.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-general-product.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-packaging.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-packaging.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-textile.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-textile.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-electronics.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-electronics.context.jsonld'),
    "https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld": path.join(CONTEXTS_DIR, 'dpp-construction.context.jsonld'),
};

const customLoader = async (url) => {
    if (CONTEXT_MAP[url]) {
        try {
            const content = await fs.readFile(CONTEXT_MAP[url], 'utf-8');
            return {
                contextUrl: null,
                documentUrl: url,
                document: JSON.parse(content)
            };
        } catch (e) {
            console.error(`Failed to load local context ${url}:`, e.message);
            throw e;
        }
    }
    return jsonld.documentLoaders.node()(url);
};

// --- RDF Helpers (copied from shacl-helpers.mjs) ---
async function toRdfDataset(expanded) {
    const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
    const inputStream = Readable.from([nquads]);
    const parser = new N3Parser();
    const quadStream = parser.import(inputStream);
    const dataset = datasetFactory.dataset();

    return new Promise((resolve, reject) => {
        quadStream.on('data', (quad) => {
            dataset.add(quad);
        }).on('end', () => {
            resolve(dataset);
        }).on('error', reject);
    });
}

async function loadRdfFile(filePath) {
    // console.log(`Loading RDF file: ${filePath}`);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const json = JSON.parse(fileContent);
    const expanded = await jsonld.expand(json, {
        documentLoader: customLoader,
        processingMode: 'json-ld-1.1'
    });
    return toRdfDataset(expanded);
}

function combineDatasets(datasets) {
    const combined = datasetFactory.dataset();
    for (const dataset of datasets) {
        for (const quad of dataset) {
            combined.add(quad);
        }
    }
    return combined;
}

async function run() {
    try {
        // 1. Load Data
        const examplePath = path.join(PROJECT_ROOT, 'src', 'examples', 'battery-dpp-v1.json'); // Still reading from src as input
        console.log(`Reading example from: ${examplePath}`);
        const dataDataset = await loadRdfFile(examplePath);

        // Also load Header ontology as the test does
        const headerOntologyPath = path.join(SPEC_DIR, 'ontology', 'v1', 'core', 'Header.jsonld');
        const headerOntologyDataset = await loadRdfFile(headerOntologyPath);
        
        const dataGraph = combineDatasets([dataDataset, headerOntologyDataset]);

        // 2. Load Shapes
        const coreShapesPath = path.join(SHAPES_DIR, 'core-shapes.shacl.jsonld');
        const batteryShapesPath = path.join(SHAPES_DIR, 'battery-shapes.shacl.jsonld');
        
        console.log(`Loading shapes from: ${coreShapesPath} and ${batteryShapesPath}`);
        const coreShapesDataset = await loadRdfFile(coreShapesPath);
        const batteryShapesDataset = await loadRdfFile(batteryShapesPath);
        
        const shapesGraph = combineDatasets([coreShapesDataset, batteryShapesDataset]);

        // --- DEBUG: Dump Shapes Graph ---
        console.log('\n--- Shapes Graph Dump (Filtered N-Quads) ---');
        for (const quad of shapesGraph) {
            const p = quad.predicate.value;
            if (p.includes('label') || p.includes('comment') || p.includes('message')) {
                continue;
            }
            // Filter out internal SHACL structure noise if needed, but keeping paths is important
            console.log(`${quad.subject.value} ${quad.predicate.value} ${quad.object.value} .`);
        }
        console.log('--- End Shapes Graph Dump ---\n');

        // --- DEBUG: Compare Predicates ---
        console.log('--- Debugging Predicate Matching ---');
        const targetPredicate = 'https://dpp-keystone.org/spec/v1/terms#manufacturerInfo';
        
        const dataQuad = [...dataGraph].find(q => q.predicate.value === targetPredicate);
        const shapeQuad = [...shapesGraph].find(q => q.object.value === targetPredicate); // Usually sh:path points to the predicate

        if (dataQuad) {
            console.log(`Data Graph has predicate: '${dataQuad.predicate.value}'`);
        } else {
            console.log(`Data Graph MISSING predicate: ${targetPredicate}`);
        }

        if (shapeQuad) {
            console.log(`Shapes Graph has path:      '${shapeQuad.object.value}'`);
        } else {
            console.log(`Shapes Graph MISSING path:   ${targetPredicate}`);
        }

        if (dataQuad && shapeQuad) {
            const p1 = dataQuad.predicate.value;
            const p2 = shapeQuad.object.value;
            if (p1 === p2) {
                 console.log('Predicates match exactly.');
            } else {
                 console.log('Predicates DO NOT match.');
                 console.log(`P1: ${p1} (Len: ${p1.length})`);
                 console.log(`P2: ${p2} (Len: ${p2.length})`);
            }
        }

        // --- DEBUG: Check Battery Mass Datatype ---
        console.log('\n--- Debugging Battery Mass Datatype ---');
        const massQuad = [...dataGraph].find(q => q.predicate.value === 'https://dpp-keystone.org/spec/v1/terms#batteryMass');
        if (massQuad) {
            console.log(`Value: ${massQuad.object.value}`);
            console.log(`Datatype: ${massQuad.object.datatype.value}`);
            console.log(`TermType: ${massQuad.object.termType}`);
        }

        // 3. Validate
        console.log('Running SHACL validation...');
        const validator = new SHACLValidator(shapesGraph);
        const report = await validator.validate(dataGraph);

        if (report.conforms) {
            console.log('Validation SUCCESS: The data conforms to the shapes.');
        } else {
            console.log('Validation FAILURE: Violations found.');
            console.log(`Total Violations: ${report.results.length}`);
            
            for (const result of report.results) {
                 const message = result.message[0]?.value || 'No message';
                 const path = result.path ? result.path.value : 'N/A';
                 console.log(`
  Message: ${message}`);
                 console.log(`  Path: ${path}`);
                 console.log(`  FocusNode: ${result.focusNode.value}`);
            }
        }

    } catch (e) {
        console.error('Error running debug script:', e);
    }
}

run();