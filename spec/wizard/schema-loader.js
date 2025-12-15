// src/wizard/schema-loader.js

const schemaCache = new Map();

/**
 * Recursively traverses a schema object and resolves any local $ref pointers.
 * @param {object} schemaNode - The current node in the schema to process.
 * @param {string} basePath - The base path for resolving relative $ref URLs.
 * @returns {Promise<object>} A promise that resolves to the node with all $refs resolved.
 */
async function resolveRefs(schemaNode, rootSchema, basePath, resolutionPath = new Set()) {
    if (typeof schemaNode !== 'object' || schemaNode === null) {
        return schemaNode;
    }

    if (Array.isArray(schemaNode)) {
        return Promise.all(schemaNode.map(item => resolveRefs(item, rootSchema, basePath, resolutionPath)));
    }

    if (schemaNode.$ref) {
        const refValue = schemaNode.$ref;

        // --- INTERNAL REFERENCE (JSON POINTER) ---
        if (refValue.startsWith('#')) {
            // console.log(`Resolving internal $ref: ${refValue}`);
            const pointer = refValue.substring(2).split('/');
            let definition = rootSchema;
            for (const key of pointer) {
                definition = definition[key];
                if (definition === undefined) {
                    throw new Error(`Internal $ref '${refValue}' not found.`);
                }
            }
            // Recursively resolve refs within the found definition
            return resolveRefs(definition, rootSchema, basePath, resolutionPath);
        }

        // --- EXTERNAL REFERENCE ---
        const refUrl = new URL(refValue, basePath).href;

        // --- CIRCULAR REFERENCE CHECK ---
        if (resolutionPath.has(refUrl)) {
            // console.warn(`Circular reference detected at ${refUrl}. Not resolving again in this path.`);
            return { $ref: refValue, circular: true }; // Return a modified ref object
        }

        if (schemaCache.has(refUrl)) {
            return schemaCache.get(refUrl);
        }

        resolutionPath.add(refUrl);
        
        // console.log(`Resolving external $ref: ${refUrl}`);
        const response = await fetch(refUrl);
        if (!response.ok) {
            resolutionPath.delete(refUrl);
            throw new Error(`HTTP error! status: ${response.status} for ${refUrl}`);
        }

        const refSchema = await response.json();
        
        const resolvedSchema = await resolveRefs(refSchema, refSchema, refUrl, resolutionPath);

        resolutionPath.delete(refUrl);
        schemaCache.set(refUrl, resolvedSchema);
        return resolvedSchema;
    }

    const resolvedNode = {};
    for (const key in schemaNode) {
        resolvedNode[key] = await resolveRefs(schemaNode[key], rootSchema, basePath, resolutionPath);
    }
    
    // After resolving all children, check for and process 'allOf'.
    if (resolvedNode.allOf) {
        const { allOf, ...parentSchema } = resolvedNode;
        const mergedSchema = allOf.reduce((acc, current) => {
            // Merge properties
            if (current.properties) {
                acc.properties = { ...acc.properties, ...current.properties };
            }
            // Merge required arrays and deduplicate
            if (current.required) {
                acc.required = [...new Set([...(acc.required || []), ...current.required])];
            }
            // A more comprehensive merge could handle other keywords too.
            // For now, properties and required are the most critical for form generation.
            return acc;
        }, { ...parentSchema }); // Start with the parent's own properties

        return mergedSchema;
    }

    return resolvedNode;
}


/**
 * Fetches a JSON schema for a given sector and resolves all its $ref pointers.
 * @param {string} sector - The name of the sector (e.g., 'battery', 'construction').
 * @returns {Promise<object>} A promise that resolves to the fully resolved JSON schema object.
 */
export async function loadSchema(sector) {
    if (!sector) {
        throw new Error('Sector must be specified.');
    }
    const schemaPath = `../validation/v1/json-schema/${sector}.schema.json`;
    // console.log(`Fetching schema from: ${schemaPath}`);

    try {
        const response = await fetch(schemaPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const schema = await response.json();
        // console.log('Schema loaded successfully, now resolving refs:', schema);

        const baseUrl = new URL(schemaPath, window.location.href).href;
        
        // Pass the schema itself as the root for resolving internal refs
        return await resolveRefs(schema, schema, baseUrl);

    } catch (error) {
        console.error('Failed to load or resolve schema:', error);
        throw error;
    }
}

/**
 * Clears the internal cache of loaded schemas. For testing purposes.
 */
export function clearSchemaCache() {
    schemaCache.clear();
}
