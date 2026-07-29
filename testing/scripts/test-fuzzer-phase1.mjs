import path from 'path';
import { fileURLToPath } from 'url';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import { 
    loadOntologyDefinition, 
    extractClassRequirements, 
    synthesizeHappyPathGraph 
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
console.log('\n--- Extracted Requirements ---');
if (requirements.length === 0) {
    console.log('⚠️ No requirements found. Check if the targetClass is correct.');
} else {
    requirements.forEach(r => {
        console.log(`Property: ${r.property} (Range: ${r.range})`);
        if (r.oneOf) {
            console.log(`  Enum constraints: ${r.oneOf.join(', ')}`);
        }
    });
}

console.log('\n--- Generating Happy Path Graph ---');
const graph = synthesizeHappyPathGraph(requirements, `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#Product`);

console.log('\n--- Happy Path Quads ---');
for (const quad of graph) {
    const objectString = quad.object.termType === 'Literal' ? `"${quad.object.value}"^^<${quad.object.datatype.value}>` : `<${quad.object.value}>`;
    console.log(`<${quad.subject.value}> <${quad.predicate.value}> ${objectString}`);
}
