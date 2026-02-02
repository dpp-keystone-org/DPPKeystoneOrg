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
            // Merge type (simple strategy: take the first one found, or if both exist and differ, could be an issue but assuming consistency for now)
            if (!acc.type && current.type) {
                acc.type = current.type;
            }

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
    const schemaPath = `../spec/validation/v1/json-schema/${sector}.schema.json`;
    //console.log(`[DEBUG] Fetching schema from: ${schemaPath}`);

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

/**
 * Flatten a JSON schema into a list of dot-notation field paths with metadata.
 * Handles properties, items (arrays), allOf, oneOf, anyOf, and if/then/else conditionals.
 * 
 * @param {object} schema - The resolved JSON schema object.
 * @param {string} parentPath - The current path prefix (used for recursion).
 * @param {boolean} inArray - Whether the current path is inside an array context.
 * @returns {Array<{path: string, isArray: boolean}>} An array of unique field objects.
 */
export function flattenSchema(schema, parentPath = '', inArray = false) {
    if (!schema || typeof schema !== 'object') {
        return [];
    }

    let collected = new Map(); // Use Map to deduplicate by path

    const addFields = (fields) => {
        fields.forEach(f => collected.set(f.path, f));
    };

    // Determine current array context
    // If the *current* node is an array, then its children (via items) are in an array.
    // However, if we are *already* in an array (from parent), that state persists.
    const isCurrentNodeArray = schema.type === 'array';
    
    // 1. Traverse Properties
    if (schema.properties) {
        for (const key in schema.properties) {
            const currentPath = parentPath ? `${parentPath}.${key}` : key;
            const subFields = flattenSchema(schema.properties[key], currentPath, inArray);
            
            if (subFields.length > 0) {
                addFields(subFields);
            } else {
                // It's a leaf (or at least has no further structure we recursed into).
                // Check if THIS specific property definition is an array of primitives 
                // (which wouldn't be caught by subFields if it has no 'properties').
                const isLeafArray = schema.properties[key].type === 'array';
                // Effectively, a field is "multivalued" if it is an array itself OR inside an array object.
                collected.set(currentPath, { 
                    path: currentPath, 
                    isArray: inArray || isLeafArray 
                });
            }
        }
    }

    // 2. Traverse Items (if array)
    if (schema.items && typeof schema.items === 'object') {
        // If we are at 'components' (array), we traverse 'components.items'.
        // The path usually stays 'components' for the array itself, but for *content* of objects inside:
        // 'components.name'.
        // So we recurse into items with the SAME parentPath? 
        // No, typically 'items' defines the structure of the elements.
        // If items has properties, we recurse.
        // We pass `inArray: true` because we are now inside the array.
        
        // Note: We don't append '.items' to the path for user-friendliness, usually.
        // But if it's a primitive array, we might want to capture the path itself.
        
        const subFields = flattenSchema(schema.items, parentPath, true); // true because we entered items
        if (subFields.length > 0) {
            addFields(subFields);
        } else if (parentPath) {
            // It's an array of primitives (e.g. items: { type: string })
            collected.set(parentPath, { path: parentPath, isArray: true });
        }
    }

    // 3. Traverse Combinators (allOf, oneOf, anyOf)
    const combinators = ['allOf', 'oneOf', 'anyOf'];
    for (const combinator of combinators) {
        if (Array.isArray(schema[combinator])) {
            schema[combinator].forEach(subSchema => {
                // Pass parentPath and inArray context directly
                addFields(flattenSchema(subSchema, parentPath, inArray));
            });
        }
    }

    // 4. Traverse Conditionals (if, then, else)
    const conditionals = ['if', 'then', 'else'];
    for (const cond of conditionals) {
        if (schema[cond]) {
            addFields(flattenSchema(schema[cond], parentPath, inArray));
        }
    }
    
    // If we are at a leaf node in the recursion (no properties, combinators, etc found)
    // AND we have a valid parentPath, add it. 
    // This is catch-all for simple types that are not properties of something else (e.g. inside allOf).
    // But we need to be careful not to double-add.
    if (collected.size === 0 && parentPath && !schema.properties && !schema.items) {
        // Simple type check to avoid adding pure container logic objects
        if (schema.type || schema.enum) {
            collected.set(parentPath, { 
                path: parentPath, 
                isArray: inArray || isCurrentNodeArray 
            });
        }
    }

    // Convert Map values to array and sort
    return Array.from(collected.values()).sort((a, b) => a.path.localeCompare(b.path));
}
