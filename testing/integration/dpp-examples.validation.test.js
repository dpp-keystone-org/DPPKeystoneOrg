import path from 'path';
import SHACLValidator from 'rdf-validate-shacl';

import {
    PROJECT_ROOT,
    loadRdfFile,
    combineDatasets
} from './shacl-helpers.mjs';

/**
 * A helper function to find a human-readable name for a given node in a graph.
 * It checks a list of common "name" properties.
 * @param {import('@rdfjs/types').NamedNode | import('@rdfjs/types').BlankNode} node The node to find a name for.
 * @param {import('@rdfjs/types').DatasetCore} dataGraph The dataset containing the data.
 * @returns {string | null} The human-readable name or null if not found.
 */
function findHumanName(node, dataGraph) {
    if (!node) return null;

    // A list of common properties that serve as good human-readable names.
    const nameProperties = [
        'https://dpp-keystone.org/spec/v1/terms#productName', // Using full IRIs for clarity
        'https://schema.org/name',
        'https://dpp-keystone.org/spec/v1/terms#organizationName',
        'https://dpp-keystone.org/spec/v1/terms#name' // For DigitalDocument, etc.
    ];

    for (const prop of nameProperties) {
        // .match() finds all quads (statements) that match the pattern.
        // We can create named nodes directly without a factory in many RDF/JS libraries.
        const quads = dataGraph.match(node, { termType: 'NamedNode', value: prop });
        for (const quad of quads) {
            // Return the value of the first matching name property we find.
            return quad.object.value;
        }
    }
    return null; // No name found
}

/**
 * Logs a detailed, human-readable SHACL validation report.
 * @param {any} report The validation report from the SHACL validator.
 * @param {import('@rdfjs/types').DatasetCore} dataGraph The dataset that was validated.
 */
function logValidationReport(report, dataGraph) {
    console.log('--- SHACL Validation Report ---');
    console.log(`Violations Found: ${report.results.length}\n`);

    for (const result of report.results) {
        const message = result.message[0]?.value || 'No message';
        const path = result.path ? result.path.value : 'N/A';
        const focusNode = result.focusNode ? result.focusNode.value : 'N/A';
        const severity = result.severity ? result.severity.value.split('#')[1] : 'N/A';

        const humanName = findHumanName(result.focusNode, dataGraph);
        const focusNodeDisplay = humanName ? `${humanName} (${focusNode})` : focusNode;

        console.log(`Severity: ${severity}\n  Message: ${message}\n  Focus Node: ${focusNode}\n  Result Path: ${path}\n---------------------------------`);
    }
}

describe('DPP SHACL Validation', () => {

    // --- Test Cases ---
    // This array defines all the validation tests to be run.
    // Each entry specifies an example data file and the sector-specific
    // SHACL shape files that should be applied in addition to the core shapes.
    const testCases = [ // TODO: Add tests for battery, textile, and rail examples when they are available.
//        {
//            name: 'Electronics DPP - Public (drill-dpp-v1.json)',
//            exampleFile: 'drill-dpp-v1.json',
//            shapeFiles: ['electronics-shapes.shacl.jsonld']
//        },
//        {
//            name: 'Electronics DPP - Private (drill-dpp-v1-private.json)',
//            exampleFile: 'drill-dpp-v1-private.json',
//            shapeFiles: ['electronics-shapes.shacl.jsonld']
//        },
//        {
//            name: 'Battery DPP (battery-dpp-v1.json)',
//            exampleFile: 'battery-dpp-v1.json',
//            shapeFiles: ['battery-shapes.shacl.jsonld']
//        },
//        {
//            name: 'Textile DPP (sock-dpp-v1.json)',
//            exampleFile: 'sock-dpp-v1.json',
//            shapeFiles: ['textile-shapes.shacl.jsonld']
//        },
        {
            name: 'Construction DPP (rail-dpp-v1.json)',
            exampleFile: 'rail-dpp-v1.json',
            shapeFiles: ['construction-shapes.shacl.jsonld']
        },
    ];

    // Use test.each to run the same validation logic for each test case.
    test.each(testCases)('$name should conform to its SHACL shapes', async ({ exampleFile, shapeFiles }) => {
        // Add a log to clearly indicate which test is running.
        console.log(`\n--- Running SHACL Test for: ${exampleFile} ---`);

        // --- 1. Load Data and Sector-Specific Shapes ---
        const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'examples', exampleFile);
        const dataDataset = await loadRdfFile(exampleFilePath);

        const shapeDatasets = await Promise.all(
            shapeFiles.map(file => loadRdfFile(path.join(PROJECT_ROOT, 'dist', 'validation', 'v1', 'shacl', file)))
        );

        // --- 2. Combine Shapes and Validate ---
        const allShapes = combineDatasets(shapeDatasets);
        const validator = new SHACLValidator(allShapes);
        const report = await validator.validate(dataDataset);

        // --- 3. Assert Conformance ---
        // For debugging, you can log the report results
        if (!report.conforms) {
            logValidationReport(report, dataDataset);
        }

        // CRITICAL: Add a check to ensure that validation actually happened.
        // If report.results is empty, it means no shapes were applied, which is an error.
        // expect(report.results.length).toBeGreaterThan(0);

        expect(report.conforms).toBe(true);
    });
});