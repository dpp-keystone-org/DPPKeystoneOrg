import path from 'path';
import SHACLValidator from 'rdf-validate-shacl';

import {
    PROJECT_ROOT,
    loadRdfFile,
    combineDatasets
} from '../scripts/shacl-helpers.mjs';

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

    const logResult = (result, depth = 0) => {
        const indent = '  '.repeat(depth);
        const message = result.message[0]?.value || 'No message';
        const path = result.path ? result.path.value : 'N/A';
        const focusNode = result.focusNode ? result.focusNode.value : 'N/A';
        const severity = result.severity ? result.severity.value.split('#')[1] : 'N/A';
        const sourceShape = result.sourceShape ? result.sourceShape.value : 'N/A';

        const humanName = findHumanName(result.focusNode, dataGraph);
        const focusNodeDisplay = humanName ? `${humanName} (${focusNode})` : focusNode;

        console.log(`${indent}Severity: ${severity}`);
        console.log(`${indent}Message: ${message}`);
        console.log(`${indent}Focus Node: ${focusNodeDisplay}`);
        console.log(`${indent}Result Path: ${path}`);
        console.log(`${indent}Source Shape: ${sourceShape}`);
        
        if (result.detail && result.detail.length > 0) {
            console.log(`${indent}Details:`);
            for (const detail of result.detail) {
                logResult(detail, depth + 1);
            }
        }
        console.log(`${indent}---------------------------------`);
    };

    for (const result of report.results) {
        logResult(result);
    }
}

describe('DPP SHACL Validation', () => {

    // --- Test Cases ---
    // This array defines all the validation tests to be run.
    // Each entry specifies an example data file and the sector-specific
    // SHACL shape files that should be applied in addition to the core shapes.
    const testCases = [
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
            name: 'Battery DPP (battery-dpp-v1.json)',
            exampleFile: 'battery-dpp-v1.json',
            shapeFiles: ['battery-shapes.shacl.jsonld']
        },
        {
            name: 'Textile DPP (sock-dpp-v1.json)',
            exampleFile: 'sock-dpp-v1.json',
            shapeFiles: ['textile-shapes.shacl.jsonld']
        },
        {
            name: 'Construction DPP (rail-dpp-v1.json)',
            exampleFile: 'rail-dpp-v1.json',
            shapeFiles: ['construction-shapes.shacl.jsonld']
        },
    ];

    // Use test.each to run the same validation logic for each test case.
    test.each(testCases)('$name should conform to its SHACL shapes', async ({ exampleFile, shapeFiles }) => {
        // --- 1. Load Data, Shapes, and Ontologies ---
        const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'spec', 'examples', exampleFile);
        const dataDataset = await loadRdfFile(exampleFilePath);

        // Load all shape files (core + sector-specific)
        const coreShapesPath = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', 'core-shapes.shacl.jsonld');
        const shapeFilePaths = [coreShapesPath, ...shapeFiles.map(file => path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'shacl', file))];
        const allShapeDatasets = await Promise.all(shapeFilePaths.map(p => loadRdfFile(p)));
        const shapesGraph = combineDatasets(allShapeDatasets);

        // The new `granularity` shape requires its class definition to be in the data graph.
        // We load ONLY the Header.jsonld ontology, which contains this definition, to avoid
        // loading other ontologies that might expose unrelated data model inconsistencies.
        const headerOntologyPath = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', 'v1', 'core', 'Header.jsonld');
        const headerOntologyDataset = await loadRdfFile(headerOntologyPath);

        // For validation, the data graph must contain both the instance data (from the example)
        // and the class definitions (from the ontology).
        const dataGraph = combineDatasets([dataDataset, headerOntologyDataset]);

        // --- 2. Validate ---
        const validator = new SHACLValidator(shapesGraph);
        const report = await validator.validate(dataGraph);

        // --- 3. Assert Conformance ---
        if (!report.conforms) {
            logValidationReport(report, dataGraph);
        }

        expect(report.conforms).toBe(true);
    });
});