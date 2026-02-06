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
 * @param {boolean} includeMetadata - Whether to include detailed metadata (type, format, enum).
 * @returns {Array<{path: string, isArray: boolean}>} An array of unique field objects.
 */
export function flattenSchema(schema, parentPath = '', inArray = false, includeMetadata = false) {
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
            const subFields = flattenSchema(schema.properties[key], currentPath, inArray, includeMetadata);
            
            if (subFields.length > 0) {
                addFields(subFields);
            } else {
                // It's a leaf (or at least has no further structure we recursed into).
                // Check if THIS specific property definition is an array of primitives 
                // (which wouldn't be caught by subFields if it has no 'properties').
                const isLeafArray = schema.properties[key].type === 'array';
                // Effectively, a field is "multivalued" if it is an array itself OR inside an array object.
                const field = { 
                    path: currentPath, 
                    isArray: inArray || isLeafArray 
                };
                if (includeMetadata) {
                     // We need to extract metadata from the property itself since it's a leaf here
                     const propSchema = schema.properties[key];
                     let type = propSchema.type;
                     if (Array.isArray(type)) {
                        const validTypes = type.filter(t => t !== 'null');
                        type = validTypes.length > 0 ? validTypes[0] : type[0];
                     }
                     field.type = type;
                     field.format = propSchema.format;
                     field.enum = propSchema.enum;
                }
                collected.set(currentPath, field);
            }
        }
    }

    // 2. Traverse Items (if array)
    if (schema.items && typeof schema.items === 'object') {
        const subFields = flattenSchema(schema.items, parentPath, true, includeMetadata); // true because we entered items
        if (subFields.length > 0) {
            addFields(subFields);
        } else if (parentPath) {
            // It's an array of primitives (e.g. items: { type: string })
            const field = { path: parentPath, isArray: true };
            if (includeMetadata && schema.items) {
                 // For array of primitives, the type is defined in `items`
                 let type = schema.items.type;
                 if (Array.isArray(type)) {
                    const validTypes = type.filter(t => t !== 'null');
                    type = validTypes.length > 0 ? validTypes[0] : type[0];
                 }
                 field.type = type;
                 field.format = schema.items.format;
                 field.enum = schema.items.enum;
            }
            collected.set(parentPath, field);
        }
    }

    // 3. Traverse Combinators (allOf, oneOf, anyOf)
    const combinators = ['allOf', 'oneOf', 'anyOf'];
    for (const combinator of combinators) {
        if (Array.isArray(schema[combinator])) {
            const isOneOf = combinator === 'oneOf';
            // Generate a simple group ID based on the parent path
            const groupId = isOneOf ? (parentPath || 'root') + '#oneOf' : null;

            schema[combinator].forEach((subSchema, index) => {
                // Pass parentPath and inArray context directly
                const subFields = flattenSchema(subSchema, parentPath, inArray, includeMetadata);
                
                if (isOneOf && includeMetadata) {
                    subFields.forEach(f => {
                        if (!f.oneOf) f.oneOf = [];
                        // Avoid duplicates
                        if (!f.oneOf.some(o => o.groupId === groupId && o.index === index)) {
                            f.oneOf.push({ groupId, index });
                        }
                    });
                }

                // addFields logic with merging
                subFields.forEach(f => {
                    if (collected.has(f.path)) {
                        const existing = collected.get(f.path);
                        // Merge oneOf info
                        if (f.oneOf) {
                            if (!existing.oneOf) existing.oneOf = [];
                            f.oneOf.forEach(newItem => {
                                if (!existing.oneOf.some(oldItem => oldItem.groupId === newItem.groupId && oldItem.index === newItem.index)) {
                                    existing.oneOf.push(newItem);
                                }
                            });
                        }
                    } else {
                        collected.set(f.path, f);
                    }
                });
            });
        }
    }

    // 4. Traverse Conditionals (if, then, else)
    const conditionals = ['if', 'then', 'else'];
    for (const cond of conditionals) {
        if (schema[cond]) {
            addFields(flattenSchema(schema[cond], parentPath, inArray, includeMetadata));
        }
    }
    
    // If we are at a leaf node in the recursion (no properties, combinators, etc found)
    // AND we have a valid parentPath, add it. 
    // This is catch-all for simple types that are not properties of something else (e.g. inside allOf).
    // But we need to be careful not to double-add.
    if (collected.size === 0 && parentPath && !schema.properties && !schema.items) {
        // Simple type check to avoid adding pure container logic objects
        if (schema.type || schema.enum) {
            
            const field = { 
                path: parentPath, 
                isArray: inArray || isCurrentNodeArray
            };

            if (includeMetadata) {
                // Extract Type
                let type = schema.type;
                if (Array.isArray(type)) {
                    // If type is ["string", "null"], grab "string"
                    const validTypes = type.filter(t => t !== 'null');
                    type = validTypes.length > 0 ? validTypes[0] : type[0];
                }
                field.type = type;
                field.format = schema.format;
                field.enum = schema.enum;
            }

            collected.set(parentPath, field);
        }
    }

    // Convert Map values to array and sort
    return Array.from(collected.values()).sort((a, b) => a.path.localeCompare(b.path));
}
