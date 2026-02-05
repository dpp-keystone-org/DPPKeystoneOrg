import fs from 'fs';
import path from 'path';

const schemaDir = 'dist/spec/validation/v1/json-schema';

// Helper to recursively scan a schema object
function scanSchema(schema, types, formats) {
    if (!schema || typeof schema !== 'object') return;

    // Direct type/format on this node
    if (schema.type) {
        if (Array.isArray(schema.type)) {
            schema.type.forEach(t => types.add(t));
        } else {
            types.add(schema.type);
        }
    }
    if (schema.format) {
        formats.add(schema.format);
    }

    // Recursion for standard keywords
    ['properties', 'definitions', '$defs', 'patternProperties'].forEach(key => {
        if (schema[key]) {
            Object.values(schema[key]).forEach(sub => scanSchema(sub, types, formats));
        }
    });

    ['items', 'additionalProperties', 'not', 'if', 'then', 'else'].forEach(key => {
        if (schema[key] && typeof schema[key] === 'object') {
            scanSchema(schema[key], types, formats);
        }
    });

    ['allOf', 'anyOf', 'oneOf'].forEach(key => {
        if (Array.isArray(schema[key])) {
            schema[key].forEach(sub => scanSchema(sub, types, formats));
        }
    });
}

function main() {
    if (!fs.existsSync(schemaDir)) {
        console.error(`Directory not found: ${schemaDir}. Make sure to build the project first.`);
        return;
    }

    const types = new Set();
    const formats = new Set();

    const files = fs.readdirSync(schemaDir).filter(f => f.endsWith('.json'));
    
    files.forEach(file => {
        const content = fs.readFileSync(path.join(schemaDir, file), 'utf-8');
        try {
            const schema = JSON.parse(content);
            scanSchema(schema, types, formats);
        } catch (e) {
            console.error(`Error parsing ${file}:`, e.message);
        }
    });

    console.log('--- Unique Types ---');
    [...types].sort().forEach(t => console.log(t));

    console.log('\n--- Unique Formats ---');
    [...formats].sort().forEach(f => console.log(f));
}

main();
