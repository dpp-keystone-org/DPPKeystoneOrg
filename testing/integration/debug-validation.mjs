import path from 'path';
import { promises as fs } from 'fs';
import SHACLValidator from 'rdf-validate-shacl';

import Environment from '@rdfjs/environment';
import N3Parser from '@rdfjs/parser-n3';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import DataFactory from '@rdfjs/data-model/Factory.js';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';

import { PROJECT_ROOT, loadRdfFile, combineDatasets } from './shacl-helpers.mjs';

const factory = new Environment([DataFactory, DatasetFactory, N3Parser, ClownfaceFactory, NamespaceFactory]);

async function main() {
    console.log('Starting DEBUG SHACL validation...');

    // Corrected Path: dist/spec/validation/v1/shacl
    const shapesDir = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl');
    console.log(`Loading shapes from: ${shapesDir}`);
    const shapeFiles = await fs.readdir(shapesDir);

    const shapeDatasets = await Promise.all(
        shapeFiles
            .filter(file => file.endsWith('.shacl.jsonld'))
            .map(file => loadRdfFile(path.join(shapesDir, file), { factory }))
    );

    const allShapes = combineDatasets(shapeDatasets, { factory });

    const filesToTest = ['rail-dpp-v1.json', 'sock-dpp-v1.json'];
    
    for (const exampleFileName of filesToTest) {
        // Corrected Path: dist/spec/examples
        const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'spec', 'examples', exampleFileName);
        console.log(`\nValidating example file: ${exampleFilePath}`);
        
        // We also need the ontology for "GranularityValue" or other classes if the shapes rely on checking instance types that are defined in ontology
        // The test helper loaded Header.jsonld. Let's do that too.
        const headerOntologyPath = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'Header.jsonld');
        const headerOntologyDataset = await loadRdfFile(headerOntologyPath, { factory });

        const dataDataset = await loadRdfFile(exampleFilePath, { factory });
        
        const dataGraph = combineDatasets([dataDataset, headerOntologyDataset], { factory });

        const validator = new SHACLValidator(allShapes, { factory });
        const report = await validator.validate(dataGraph);

        if (report.conforms) {
            console.log(`✅ SUCCESS: ${exampleFileName} conforms.`);
        } else {
            console.error(`❌ FAILURE: ${exampleFileName} does NOT conform.`);
            console.error('Validation Report:');
            for (const result of report.results) {
                console.error(`\n- Severity: ${result.severity?.value}`);
                console.error(`  Message: ${result.message.map(m => m.value).join(', ')}`);
                console.error(`  Focus Node: ${result.focusNode?.value}`);
                console.error(`  Path: ${result.path?.value}`);
                console.error(`  Source Shape: ${result.sourceShape?.value}`);
                if (result.detail && result.detail.length > 0) {
                    console.error('  Details:');
                    for (const detail of result.detail) {
                        console.error(`    - Message: ${detail.message.map(m => m.value).join(', ')}`);
                        console.error(`      Source Shape: ${detail.sourceShape?.value}`);
                    }
                }
            }
        }
    }
}

main().catch(error => {
    console.error(error);
});
