import path from 'path';
import SHACLValidator from 'rdf-validate-shacl';

import Environment from '@rdfjs/environment';
import N3Parser from '@rdfjs/parser-n3';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import DataFactory from '@rdfjs/data-model/Factory.js';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';

import {
    PROJECT_ROOT,
    loadRdfFile,
    combineDatasets
} from './shacl-helpers.mjs';

// Create a pre-configured RDF/JS environment, identical to the one in the standalone script.
// This bundles a factory, dataset, parser, and clownface support.
const factory = new Environment([DataFactory, DatasetFactory, N3Parser, ClownfaceFactory, NamespaceFactory]);

describe('DPP SHACL Validation', () => {
    let coreShapes;

    // Before running any tests, load the core shapes that apply to all DPPs.
    beforeAll(async () => {
        const coreShapesPath = path.join(PROJECT_ROOT, 'dist', 'validation', 'v1', 'shacl', 'core-shapes.shacl.jsonld');
        coreShapes = await loadRdfFile(coreShapesPath, { factory });
    });

    // --- Test Cases ---
    // This array defines all the validation tests to be run.
    // Each entry specifies an example data file and the sector-specific
    // SHACL shape files that should be applied in addition to the core shapes.
    const testCases = [ // TODO: Add tests for battery, textile, and rail examples when they are available.
        {
            name: 'Electronics DPP - Public (drill-dpp-v1.json)',
            exampleFile: 'drill-dpp-v1.json',
            shapeFiles: ['electronics-shapes.shacl.jsonld']
        },
        {
            name: 'Electronics DPP - Private (drill-dpp-v1-private.json)',
            exampleFile: 'drill-dpp-v1-private.json',
            shapeFiles: ['electronics-shapes.shacl.jsonld']
        },
        {
            name: 'Construction DPP (rail-dpp-v1.json)',
            exampleFile: 'rail-dpp-v1.json',
            shapeFiles: ['construction-shapes.shacl.jsonld']
        },
    ];

    // Use test.each to run the same validation logic for each test case.
    test.each(testCases)('$name should conform to its SHACL shapes', async ({ exampleFile, shapeFiles }) => {
        // --- 1. Load Data and Sector-Specific Shapes ---
        const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'examples', exampleFile);
        const dataDataset = await loadRdfFile(exampleFilePath, { factory });

        const sectorShapes = await Promise.all(
            shapeFiles.map(file => loadRdfFile(path.join(PROJECT_ROOT, 'dist', 'validation', 'v1', 'shacl', file), { factory }))
        );

        // --- 2. Combine Shapes and Validate ---
        const allShapes = combineDatasets([coreShapes, ...sectorShapes], { factory });
        const validator = new SHACLValidator(allShapes, { factory });
        const report = await validator.validate(dataDataset);

        // --- 3. Assert Conformance ---
        // For debugging, you can log the report results
        if (!report.conforms) {
            console.log('Validation Report Results:');
            for (const result of report.results) {
                console.log(`- Path: ${result.path?.value}`);
                console.log(`  Message: ${result.message[0]?.value}`);
                console.log(`  Focus Node: ${result.focusNode?.value}`);
                console.log(`  Severity: ${result.severity?.value}`);
            }
        }

        expect(report.conforms).toBe(true);
    });
});