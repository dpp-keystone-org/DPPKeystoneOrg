import { promises as fs } from 'fs';
import path from 'path';
import { parse as jsoncParse } from 'jsonc-parser';
import SHACLValidator from 'rdf-validate-shacl';
import factory from 'rdf-ext';
import {
    PROJECT_ROOT,
    loadRdfFile,
    combineDatasets
} from './shacl-helpers.mjs';

// --- Test Suite ---

describe('DPP SHACL Validation', () => {
    let coreShapes;

    // Before running any tests, load the core shapes that apply to all DPPs.
    beforeAll(async () => {
        const coreShapesPath = path.join(PROJECT_ROOT, 'validation', 'v1', 'shacl', 'core-shapes.shacl.jsonld');
        coreShapes = await loadRdfFile(coreShapesPath, { factory });
    });

    test('drill-dpp-v1.json should conform to core and construction shapes', async () => {
        // --- 1. Load Data and Shapes ---
        const exampleFileName = 'drill-dpp-v1.json';
        const exampleFilePath = path.join(PROJECT_ROOT, 'docs', 'examples', exampleFileName);
        const dataDataset = await loadRdfFile(exampleFilePath, { factory });
        
        const constructionShapesPath = path.join(PROJECT_ROOT, 'validation', 'v1', 'shacl', 'construction-shapes.shacl.jsonld');
        const constructionShapes = await loadRdfFile(constructionShapesPath, { factory });

        // --- 2. Combine Shapes and Validate ---
        const allShapes = combineDatasets([coreShapes, constructionShapes], { factory });
        const validator = new SHACLValidator(allShapes, { factory });
        const report = await validator.validate(dataDataset);

        // --- 5. Assert Conformance ---
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