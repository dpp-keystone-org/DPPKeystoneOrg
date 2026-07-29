import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';
import { 
    loadOntologyDefinition, 
    extractClassRequirements, 
    synthesizeHappyPathGraph,
    generateMutations,
    runFuzzer,
    expandURI
} from '../../scripts/shacl-fuzzer.mjs';
import { loadRdfFile, combineDatasets } from '../../scripts/shacl-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..', '..');
const ONTOLOGY_ROOT = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION);

// Helper to recursively find jsonld files
function findJsonldFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findJsonldFiles(filePath, fileList);
        } else if (filePath.endsWith('.jsonld') && !filePath.includes('index')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const ontologyFiles = findJsonldFiles(ONTOLOGY_ROOT);

describe('Zero-Config SHACL Meta-Validation Fuzzer', () => {
    let shaclShapesDataset;

    beforeAll(async () => {
        const shapesDir = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl');
        const shapeFiles = findJsonldFiles(shapesDir);
        const shapeDatasets = await Promise.all(
            shapeFiles.map(file => loadRdfFile(file))
        );
        shaclShapesDataset = combineDatasets(shapeDatasets);
    });

    for (const file of ontologyFiles) {
        describe(`Ontology: ${path.basename(file)}`, () => {
            const ontology = loadOntologyDefinition(file);
            const graphNodes = ontology['@graph'] || [];
            
            // Find all classes in this ontology
            const classes = graphNodes.filter(n => {
                const types = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
                return types.includes('rdfs:Class') || types.includes('owl:Class');
            });

            if (classes.length === 0) {
                it('contains no classes', () => {
                    expect(true).toBe(true);
                });
            }

            for (const cls of classes) {
                describe(`Class: ${cls['@id']}`, () => {
                    const requirements = extractClassRequirements(ontology, cls['@id']);
                    
                    if (requirements.length === 0) {
                        it('has no properties defined', () => {
                            expect(true).toBe(true);
                        });
                    } else {
                        it(`successfully validates happy path and fails on ${requirements.length} mutations`, () => {
                            const context = ontology['@context'] || {};
                            const expandedTargetClass = expandURI(cls['@id'], context);
                            const happyGraph = synthesizeHappyPathGraph(requirements, expandedTargetClass);
                            const mutations = generateMutations(happyGraph, requirements);
                            
                            expect(() => runFuzzer(happyGraph, mutations, shaclShapesDataset)).not.toThrow();
                        });
                    }
                });
            }
        });
    }
});
