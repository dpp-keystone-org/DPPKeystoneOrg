import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { KEYSTONE_VERSION } from '../src/lib/keystone-version.js';
import { loadOntologyDefinition, extractClassRequirements, expandURI } from '../testing/scripts/shacl-fuzzer.mjs';

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

function findJsonSchemas(dir, fileList = []) {
    if (!fs.existsSync(dir)) return fileList;
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            findJsonSchemas(filePath, fileList);
        } else if (filePath.endsWith('.json')) {
            fileList.push(filePath);
        }
    }
    return fileList;
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

const schemaMapping = {
    'Battery': ['battery.schema.json'],
    'Construction': ['construction.schema.json'],
    'Electronics': ['electronics.schema.json'],
    'IronSteel': ['iron-steel.schema.json'],
    'Textile': ['textile.schema.json'],
    'DoPC': ['dopc.schema.json'],
    'EPD': ['epd.schema.json'],
    'Organization': ['organization.schema.json', 'postal-address.schema.json'],
    'RelatedResource': ['related-resource.schema.json'],
    'MTC': ['mtc.schema.json'],
    'Product': ['general-product.schema.json', 'product-characteristic.schema.json', 'packaging.schema.json', 'component.schema.json'],
    'Header': ['dpp.schema.json'],
    'Compliance': ['certification.schema.json']
};

function generateShacl() {
    console.log('Generating SHACL shapes from ontologies...');
    const files = findJsonldFiles(ONTOLOGY_ROOT);
    const allSchemas = findJsonSchemas(SCHEMA_ROOT);
    
    fs.mkdirSync(SHACL_OUT_DIR, { recursive: true });
    let totalShapesGenerated = 0;

    for (const file of files) {
        const relativePath = path.relative(ONTOLOGY_ROOT, file);
        const relativeDir = path.dirname(relativePath);
        const baseName = path.basename(file, '.jsonld');
        const uriPath = (relativeDir === '.') ? baseName : `${relativeDir.split(path.sep).join('/')}/${baseName}`;
        const ontology = loadOntologyDefinition(file);
        const graphNodes = ontology['@graph'] || [];
        
        // Extract required properties for THIS specific ontology
        const requiredProperties = new Set();
        const mappedSchemas = schemaMapping[baseName] || [
            `${baseName.toLowerCase()}.schema.json`,
            `${baseName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase()}.schema.json`
        ];
        
        for (const schemaPath of allSchemas) {
            if (mappedSchemas.includes(path.basename(schemaPath))) {
                const content = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
                findRequiredArrays(content, requiredProperties);
            }
        }

        
        const classIds = new Set();
        for (const n of graphNodes) {
            const types = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
            if (types && (types.includes('rdfs:Class') || types.includes('owl:Class'))) {
                if (n['@id']) classIds.add(n['@id']);
            }
            if (n['rdfs:domain']) {
                const domains = Array.isArray(n['rdfs:domain']) ? n['rdfs:domain'] : [n['rdfs:domain']];
                for (const d of domains) {
                    if (typeof d === 'string') classIds.add(d);
                    else if (d['@id']) classIds.add(d['@id']);
                }
            }
        }

        if (classIds.size === 0) continue;


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
            "@id": `https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/${uriPath}`,
            "@type": "ShapesGraph",
            "@graph": []
        };

        for (const classId of classIds) {
            const requirements = extractClassRequirements(ontology, classId);
            if (requirements.length === 0) continue;

            const expandedTargetClass = expandURI(classId, ontology['@context']);
            const shape = {
                "@id": `https://dpp-keystone.org/spec/validation/${KEYSTONE_VERSION}/shacl/${uriPath}#${classId.split(':').pop()}Shape`,
                "@type": "NodeShape",
                "targetClass": expandedTargetClass,
                "property": []
            };

            for (const req of requirements) {
                const propRule = {
                    "path": req.expandedProperty || req.property,
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
                        propRule.class = req.expandedRange || req.range;
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

        if (shapesGraph["@graph"].length > 0) {
            const currentOutDir = path.join(SHACL_OUT_DIR, relativeDir);
            fs.mkdirSync(currentOutDir, { recursive: true });
            const outPath = path.join(currentOutDir, `${baseName}-shapes.shacl.jsonld`);
            fs.writeFileSync(outPath, JSON.stringify(shapesGraph, null, 2));
            console.log(`Successfully generated ${shapesGraph["@graph"].length} SHACL shapes to ${outPath}`);
            totalShapesGenerated += shapesGraph["@graph"].length;
        }
    }
    console.log(`Total generated shapes across all files: ${totalShapesGenerated}`);
}

generateShacl();
