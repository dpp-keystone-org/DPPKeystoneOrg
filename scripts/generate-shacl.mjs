import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KEYSTONE_VERSION } from '../src/lib/keystone-version.js';
import { loadOntologyDefinition, extractClassRequirements } from '../testing/scripts/shacl-fuzzer.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

const ONTOLOGY_ROOT = path.join(PROJECT_ROOT, 'dist', 'spec', 'ontology', KEYSTONE_VERSION);
const SHACL_OUT_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'shacl');

function findJsonldFiles(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
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

const SCHEMA_ROOT = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', KEYSTONE_VERSION, 'json-schema');

function extractRequiredProperties(dir, requiredSet = new Set()) {
    if (!fs.existsSync(dir)) return requiredSet;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            extractRequiredProperties(filePath, requiredSet);
        } else if (filePath.endsWith('.json')) {
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            findRequiredArrays(content, requiredSet);
        }
    }
    return requiredSet;
}

function findRequiredArrays(obj, requiredSet) {
    if (typeof obj !== 'object' || obj === null) return;
    if (Array.isArray(obj)) {
        obj.forEach(item => findRequiredArrays(item, requiredSet));
        return;
    }
    for (const [key, value] of Object.entries(obj)) {
        if (key === 'required' && Array.isArray(value)) {
            value.forEach(v => {
                if (typeof v === 'string') requiredSet.add(v);
            });
        }
        findRequiredArrays(value, requiredSet);
    }
}

function generateShacl() {
    console.log('Generating SHACL shapes from ontologies...');
    const files = findJsonldFiles(ONTOLOGY_ROOT);
    
    // Extract globally required properties from all JSON schemas
    const requiredProperties = extractRequiredProperties(SCHEMA_ROOT);
    console.log(`Discovered ${requiredProperties.size} required properties across JSON Schemas.`);
    
    const shapesGraph = {
        "@context": {
            "sh": "http://www.w3.org/ns/shacl#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
            "dppk": `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`,
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "@vocab": "http://www.w3.org/ns/shacl#",
            "node": { "@type": "@id" },
            "path": { "@type": "@id" },
            "targetClass": { "@type": "@id" },
            "class": { "@type": "@id" },
            "datatype": { "@type": "@id" }
        },
        "@id": "https://dpp-keystone.org/spec/validation/auto-generated/shapes",
        "@type": "ShapesGraph",
        "@graph": []
    };

    for (const file of files) {
        const ontology = loadOntologyDefinition(file);
        const graphNodes = ontology['@graph'] || [];
        
        const classes = graphNodes.filter(n => {
            const types = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
            return types && (types.includes('rdfs:Class') || types.includes('owl:Class'));
        });

        for (const cls of classes) {
            const requirements = extractClassRequirements(ontology, cls['@id']);
            if (requirements.length === 0) continue;

            const shape = {
                "@id": `https://dpp-keystone.org/spec/validation/auto-generated/shapes#${cls['@id'].split(':').pop()}Shape`,
                "@type": "NodeShape",
                "targetClass": cls['@id'],
                "property": []
            };

            for (const req of requirements) {
                const propRule = {
                    "path": req.property,
                    "message": `Auto-generated rule for ${req.property}`
                };
                
                // Cross-reference with JSON Schema presence requirements
                const propName = req.property.split('#').pop();
                if (requiredProperties.has(propName)) {
                    propRule.minCount = 1;
                    propRule.message += ' (Required by JSON Schema)';
                }
                
                // Map range to datatype or class
                if (req.range) {
                    if (req.range.startsWith('xsd:') || req.range === 'rdf:langString') {
                        propRule.datatype = req.range;
                    } else if (req.range.includes('Literal')) {
                        propRule.datatype = "xsd:double";
                    } else {
                        propRule.class = req.range;
                        propRule.nodeKind = { "@id": "sh:IRI" };
                    }
                }
                
                // Enums
                if (req.oneOf && req.oneOf.length > 0) {
                    propRule.in = { "@list": req.oneOf.map(val => ({ "@id": val })) };
                }
                
                shape.property.push(propRule);
            }
            
            shapesGraph["@graph"].push(shape);
        }
    }

    fs.mkdirSync(SHACL_OUT_DIR, { recursive: true });
    const outPath = path.join(SHACL_OUT_DIR, 'auto-generated.shacl.jsonld');
    fs.writeFileSync(outPath, JSON.stringify(shapesGraph, null, 2));
    console.log(`Successfully generated ${shapesGraph["@graph"].length} SHACL shapes to ${outPath}`);
}

generateShacl();
