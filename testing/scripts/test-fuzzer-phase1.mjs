import path from 'path';
import { fileURLToPath } from 'url';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import { 
    loadOntologyDefinition, 
    extractClassRequirements, 
    synthesizeHappyPathGraph,
    generateMutations
} from './shacl-fuzzer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..', '..');

// We use the compiled ontology in dist/ so that {{VERSION}} variables are already replaced
const ontologyFile = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION, 'core', 'Product.jsonld');

console.log(`Loading ontology: ${ontologyFile}`);
const ontology = loadOntologyDefinition(ontologyFile);

const targetClass = 'dppk:Product';
console.log(`Extracting requirements for: ${targetClass}`);

const requirements = extractClassRequirements(ontology, targetClass);
console.log('\n--- Generating Happy Path Graph ---');
const graph = synthesizeHappyPathGraph(requirements, `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#Product`);
console.log(`Happy path graph created with ${graph.size} quads.`);

console.log('\n--- Generating Mutations (Fuzzing) ---');
const mutations = generateMutations(graph, requirements);
console.log(`Successfully generated ${mutations.length} fuzzed graphs to test the ${requirements.length} properties.`);

console.log('\n--- Sample Mutations Generated ---');
const sampleMutations = mutations.slice(0, 4);
sampleMutations.forEach(m => {
    console.log(`- Type: [${m.type}] on Property: [${m.property.split('#').pop()}] (Total Quads: ${m.graph.size})`);
});
console.log('\nAll mutation graphs are ready to be fed to the SHACL validator in Phase 3!');
