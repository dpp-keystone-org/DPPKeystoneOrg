import path from 'path';
import SHACLValidator from 'rdf-validate-shacl';

import Environment from '@rdfjs/environment';
import N3Parser from '@rdfjs/parser-n3';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import DataFactory from '@rdfjs/data-model/Factory.js';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';

import { PROJECT_ROOT, loadRdfFile, combineDatasets } from './shacl-helpers.mjs';

// Create a pre-configured RDF/JS environment
// This bundles a factory, dataset, parser, and clownface support
const factory = new Environment([DataFactory, DatasetFactory, N3Parser, ClownfaceFactory, NamespaceFactory]);

// --- Main Validation Logic ---

async function main() {
    console.log('Starting SHACL validation...');

    // --- 1. Load Core and Sector-Specific Shapes ---
    const coreShapesPath = path.join(PROJECT_ROOT, 'validation', 'v1', 'shacl', 'core-shapes.shacl.jsonld');
    const coreShapes = await loadRdfFile(coreShapesPath, { factory });

    const constructionShapesPath = path.join(PROJECT_ROOT, 'validation', 'v1', 'shacl', 'construction-shapes.shacl.jsonld');
    const constructionShapes = await loadRdfFile(constructionShapesPath, { factory });

    const allShapes = combineDatasets([coreShapes, constructionShapes], { factory });

    // --- 2. Load and Prepare Data ---
    const exampleFileName = 'drill-dpp-v1.json';
    console.log(`\nValidating example file: ${exampleFileName}`);
    const exampleFilePath = path.join(PROJECT_ROOT, 'docs', 'examples', exampleFileName);
    const dataDataset = await loadRdfFile(exampleFilePath, { factory });

    // --- 3. Validate ---
    const validator = new SHACLValidator(allShapes, { factory });
    const report = await validator.validate(dataDataset);

    // --- 4. Report Results ---
    if (report.conforms) {
        console.log(`✅ SUCCESS: ${exampleFileName} conforms to the SHACL shapes.`);
    } else {
        console.error(`❌ FAILURE: ${exampleFileName} does not conform to the SHACL shapes.`);
        console.error('Validation Report:');
        for (const result of report.results) {
            console.error(`- Path: ${result.path?.value}`);
            console.error(`  Message: ${result.message.map(m => m.value).join(', ')}`);
            console.error(`  Focus Node: ${result.focusNode?.value}`);
            console.error(`  Severity: ${result.severity?.value}`);
        }
        process.exit(1); // Exit with an error code
    }
}

main().catch(error => {
    console.error('An unexpected error occurred during validation:', error);
    process.exit(1);
});
