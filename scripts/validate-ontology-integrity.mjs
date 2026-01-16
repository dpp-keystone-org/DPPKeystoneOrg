import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');
const ONTOLOGY_ROOT = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology');
const CONTEXT_ROOT = path.join(PROJECT_ROOT, 'dist', 'spec', 'contexts', 'v1');
const SCHEMA_ROOT = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'json-schema');

// --- Reporter Class ---
class IntegrityReporter {
    constructor() {
        this.violations = {};
        this.hasErrors = false;
    }

    report(auditName, type, message, location) {
        if (!this.violations[auditName]) {
            this.violations[auditName] = [];
        }
        this.violations[auditName].push({ type, message, location });
        if (type === 'FAIL') {
            this.hasErrors = true;
        }
    }

    printSummary() {
        console.log('\n=== Ontology Integrity Report ===\n');
        
        if (Object.keys(this.violations).length === 0) {
            console.log('✅ All checks passed!');
            return;
        }

        for (const [auditName, items] of Object.entries(this.violations)) {
            console.log(`🔍 Audit: ${auditName}`);
            items.forEach(item => {
                const icon = item.type === 'FAIL' ? '❌' : '⚠️';
                console.log(`  ${icon} [${item.type}] ${item.message}`);
                console.log(`      Location: ${item.location}`);
            });
            console.log('');
        }

        if (this.hasErrors) {
            console.log('❌ Integrity check FAILED.');
            process.exit(1);
        } else {
            console.log('✅ Integrity check PASSED (with warnings).');
            process.exit(0);
        }
    }
}

// --- Ontology Loader (Node.js version) ---
const ontologyGraph = new Map();
const loadedFiles = new Set();
const contextMap = new Map(); // term -> expanded IRI

function resolveImportPath(currentFile, importUrl) {
    // Handle standard project URLs
    if (importUrl.startsWith('https://dpp-keystone.org/spec/ontology/')) {
        const relativePath = importUrl.replace('https://dpp-keystone.org/spec/ontology/', '');
        return path.join(ONTOLOGY_ROOT, relativePath);
    }
    // Handle relative paths (if any exist in the source)
    if (importUrl.startsWith('.')) {
        return path.resolve(path.dirname(currentFile), importUrl);
    }
    return null;
}

function loadOntologyFile(filePath) {
    if (loadedFiles.has(filePath)) return;
    loadedFiles.add(filePath);

    if (!fs.existsSync(filePath)) {
        console.warn(`Warning: Could not find ontology file: ${filePath}`);
        return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const json = JSON.parse(content);
    
    // Process Graph
    const graph = json['@graph'] || [];
    graph.forEach(term => {
        if (term['@id']) {
            ontologyGraph.set(term['@id'], {
                ...term,
                _definedIn: filePath // Metadata for reporting
            });
        }
    });

    // Process Imports
    if (json['owl:imports']) {
        const imports = Array.isArray(json['owl:imports']) ? json['owl:imports'] : [json['owl:imports']];
        imports.forEach(imp => {
            const importUrl = typeof imp === 'string' ? imp : imp['@id'];
            const resolvedPath = resolveImportPath(filePath, importUrl);
            if (resolvedPath) {
                loadOntologyFile(resolvedPath);
            }
        });
    }
}

function loadContexts() {
    if (!fs.existsSync(CONTEXT_ROOT)) {
        console.warn('Warning: Context directory not found.');
        return;
    }
    
    fs.readdirSync(CONTEXT_ROOT).forEach(file => {
        if (!file.endsWith('.jsonld')) return;
        const filePath = path.join(CONTEXT_ROOT, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        const ctx = content['@context'];
        
        processContextBlock(ctx);
    });
}

function processContextBlock(ctxBlock) {
    if (!ctxBlock) return;

    // Handle array of contexts
    if (Array.isArray(ctxBlock)) {
        ctxBlock.forEach(part => processContextBlock(part));
        return;
    }

    // Handle string (external context URL) - we skip these for now as we can't load them easily synchronously 
    // and they usually point to standard things like schema.org
    if (typeof ctxBlock === 'string') {
        return;
    }

    // Handle object
    if (typeof ctxBlock === 'object') {
        const dppkPrefix = ctxBlock['dppk'] || 'https://dpp-keystone.org/spec/v1/terms#';

        for (const [term, mapping] of Object.entries(ctxBlock)) {
            // Skip keywords
            if (term.startsWith('@')) continue;
            // Skip prefixes (simple heuristic)
            if (term === 'dppk' || term === 'xsd' || term === 'gs1' || term === 'schema' || term === 'unece') continue;

            let id = null;
            let nestedContext = null;

            if (typeof mapping === 'string') {
                id = mapping;
            } else if (typeof mapping === 'object') {
                id = mapping['@id'];
                nestedContext = mapping['@context'];
            }

            if (id) {
                // Expand dppk: prefix
                if (id.startsWith('dppk:')) {
                    id = id.replace('dppk:', dppkPrefix);
                }
                // contextMap.set(term, id);
                if (!contextMap.has(term)) {
                    contextMap.set(term, []);
                }
                const list = contextMap.get(term);
                if (!list.includes(id)) {
                    list.push(id);
                }
            }

            // Recurse into scoped context if present
            if (nestedContext) {
                processContextBlock(nestedContext);
            }
        }
    }
}

// --- Audits ---

function auditNumericUnits(reporter) {
    const numericRanges = [
        'xsd:decimal', 
        'xsd:float', 
        'xsd:double', 
        'xsd:integer',
        'http://www.w3.org/2001/XMLSchema#decimal',
        'http://www.w3.org/2001/XMLSchema#float',
        'http://www.w3.org/2001/XMLSchema#double',
        'http://www.w3.org/2001/XMLSchema#integer'
    ];

    ontologyGraph.forEach((term, id) => {
        // Resolve range (handle object or string form)
        let range = term['rdfs:range'];
        if (range && typeof range === 'object' && range['@id']) {
            range = range['@id'];
        }

        // Check if it's a numeric property
        if (range && numericRanges.includes(range)) {
            // Check for unit
            const unit = term['dppk:unit'];
            const unitInherited = term['dppk:unitInherited'];

            if (unit === 'unitless') {
                return; // Explicitly no unit
            }

            if (unitInherited === true || unitInherited === 'true') {
                return; // Unit is inherited from container
            }

            if (!unit) {
                const relativePath = path.relative(PROJECT_ROOT, term._definedIn);
                reporter.report(
                    'Numeric Unit Check',
                    'FAIL',
                    `Property '${id}' is numeric (${range}) but missing 'dppk:unit'.`,
                    relativePath
                );
            }
        }
    });
}

function auditSchemaMappings(reporter) {
    const usedIRIs = new Set();
    if (!fs.existsSync(SCHEMA_ROOT)) return usedIRIs;

    function checkSchemaProperties(schemaObj, schemaFile) {
        if (!schemaObj || typeof schemaObj !== 'object') return;

        // Check properties block
        if (schemaObj.properties) {
            for (const propName of Object.keys(schemaObj.properties)) {
                // Skip JSON-LD keywords that might be in properties (e.g. @type)
                if (propName.startsWith('@')) continue;

                if (!contextMap.has(propName)) {
                    reporter.report(
                        'Schema Mapping Integrity',
                        'FAIL',
                        `Schema property '${propName}' is not defined in any loaded Context.`,
                        path.relative(PROJECT_ROOT, schemaFile)
                    );
                } else {
                    const iris = contextMap.get(propName);
                    iris.forEach(iri => {
                        const compactIRI = iri.replace('https://dpp-keystone.org/spec/v1/terms#', 'dppk:');
                        
                        if (ontologyGraph.has(iri)) {
                            usedIRIs.add(iri);
                        } else if (ontologyGraph.has(compactIRI)) {
                            usedIRIs.add(compactIRI);
                        } else {
                             reporter.report(
                                'Schema Mapping Integrity',
                                'FAIL',
                                `Schema property '${propName}' maps to '${compactIRI}' which is NOT defined in the Ontology.`,
                                path.relative(PROJECT_ROOT, schemaFile)
                            );
                        }
                    });
                }
            }
        }

        // Recurse into definitions/properties/items
        for (const key of Object.keys(schemaObj)) {
            if (typeof schemaObj[key] === 'object') {
                checkSchemaProperties(schemaObj[key], schemaFile);
            }
        }
    }

    const files = fs.readdirSync(SCHEMA_ROOT).filter(f => f.endsWith('.schema.json'));
    files.forEach(file => {
        const filePath = path.join(SCHEMA_ROOT, file);
        const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        checkSchemaProperties(content, filePath);
    });

    return usedIRIs;
}

function auditDocumentation(reporter) {
    ontologyGraph.forEach((term, id) => {
        const relativePath = path.relative(PROJECT_ROOT, term._definedIn);

        // Check Label
        let hasLabel = false;
        if (term['rdfs:label']) {
            if (typeof term['rdfs:label'] === 'string') hasLabel = true;
            else if (Array.isArray(term['rdfs:label'])) {
                // Check for English label
                if (term['rdfs:label'].some(l => l['@language'] === 'en')) hasLabel = true;
            } else if (term['rdfs:label']['@value']) {
                 hasLabel = true; // Simplified check
            }
        }

        if (!hasLabel) {
            reporter.report(
                'Documentation Completeness',
                'FAIL',
                `Term '${id}' is missing an English rdfs:label.`,
                relativePath
            );
        }

        // Check Comment
        if (!term['rdfs:comment']) {
            reporter.report(
                'Documentation Completeness',
                'FAIL',
                `Term '${id}' is missing an rdfs:comment.`,
                relativePath
            );
        }
    });
}

function auditDeadCode(reporter, schemaUsedIRIs, contextMappedIRIs) {
    // Mark-and-Sweep Reachability Analysis
    // 1. Roots: Terms used in Schemas (schemaUsedIRIs) AND terms mapped in Contexts (contextMappedIRIs)
    // 2. Edges: References within Ontology Terms (predicates, objects)
    
    const aliveIRIs = new Set([...schemaUsedIRIs, ...contextMappedIRIs]);
    const queue = Array.from(aliveIRIs);

    // Add specific roots that might not be in schemas but are entry points
    const extraRoots = [
        'dppk:DigitalProductPassport', // Root class
    ];
    
    // Also treat all defined Classes as roots (they are the API surface of the ontology)
    ontologyGraph.forEach((term, id) => {
        let types = [];
        if (term['@type']) {
            types = Array.isArray(term['@type']) ? term['@type'] : [term['@type']];
        }
        
        if (types.includes('rdfs:Class') || types.includes('owl:Class')) {
            if (!aliveIRIs.has(id)) {
                aliveIRIs.add(id);
                queue.push(id);
            }
        }
    });

    extraRoots.forEach(root => {
        if (ontologyGraph.has(root) && !aliveIRIs.has(root)) {
            aliveIRIs.add(root);
            queue.push(root);
        }
    });

    while (queue.length > 0) {
        const currentId = queue.shift();
        const term = ontologyGraph.get(currentId);

        if (!term) continue; // Should not happen if graph is consistent, but safety first

        // Find all references *out* from this term
        // (i.e., this term uses X, so X is alive)
        for (const [key, value] of Object.entries(term)) {
            // Check the key (predicate) - e.g. "dppk:unit"
            if (key.startsWith('dppk:') || key.startsWith('https://dpp-keystone.org/')) {
                if (ontologyGraph.has(key) && !aliveIRIs.has(key)) {
                    aliveIRIs.add(key);
                    queue.push(key);
                }
            }

            // Check the values (objects)
            const values = Array.isArray(value) ? value : [value];
            values.forEach(item => {
                let target = null;
                if (typeof item === 'string') {
                    target = item;
                } else if (typeof item === 'object' && item['@id']) {
                    target = item['@id'];
                }

                if (target) {
                    // Check if target is a dppk term
                    if (target.startsWith('dppk:') || target.startsWith('https://dpp-keystone.org/')) {
                         if (ontologyGraph.has(target) && !aliveIRIs.has(target)) {
                            aliveIRIs.add(target);
                            queue.push(target);
                        }
                    }
                }
            });
        }
    }

    // 3. Report dead terms
    ontologyGraph.forEach((term, id) => {
        // Skip some common infrastructure terms if needed
        if (id.startsWith('dppk:')) {
            if (!aliveIRIs.has(id)) {
                 const relativePath = path.relative(PROJECT_ROOT, term._definedIn);
                 reporter.report(
                    'Dead Code Detection',
                    'WARN',
                    `Term '${id}' is defined in Ontology but is unreachable from Schemas.`,
                    relativePath
                );
            }
        }
    });
}

// --- Main Execution ---
async function run() {
    console.log('🚀 Starting Ontology Integrity Suite...');
    const reporter = new IntegrityReporter();

    // 1. Load Main Ontology
    const entryPoint = path.join(ONTOLOGY_ROOT, 'v1', 'dpp-ontology.jsonld');
    console.log(`📂 Loading ontologies starting from: ${path.relative(PROJECT_ROOT, entryPoint)}`);
    loadOntologyFile(entryPoint);
    console.log(`   Loaded ${ontologyGraph.size} terms from ${loadedFiles.size} files.`);

    // 2. Load Contexts
    console.log(`📂 Loading contexts from: ${path.relative(PROJECT_ROOT, CONTEXT_ROOT)}`);
    loadContexts();
    console.log(`   Loaded ${contextMap.size} context mappings.`);

    // 3. Run Audits
    console.log('🕵️  Running audits...');
    auditNumericUnits(reporter);
    const usedIRIs = auditSchemaMappings(reporter);
    
    // Collect all IRIs mapped in Contexts
    const contextMappedIRIs = new Set();
    contextMap.forEach((iris) => {
        iris.forEach(iri => {
            contextMappedIRIs.add(iri);
            const compactIRI = iri.replace('https://dpp-keystone.org/spec/v1/terms#', 'dppk:');
            contextMappedIRIs.add(compactIRI);
        });
    });

    auditDocumentation(reporter);
    auditDeadCode(reporter, usedIRIs, contextMappedIRIs);

    // 4. Report
    reporter.printSummary();
}

run().catch(err => {
    console.error('Fatal Error:', err);
    process.exit(1);
});
