// src/wizard/schema-loader.js

const schemaCache = new Map();

/**
 * Recursively traverses a schema object and resolves any local $ref pointers.
 * @param {object} schemaNode - The current node in the schema to process.
 * @param {string} basePath - The base path for resolving relative $ref URLs.
 * @returns {Promise<object>} A promise that resolves to the node with all $refs resolved.
 */
async function resolveRefs(schemaNode, basePath, resolutionPath = new Set()) {
    if (typeof schemaNode !== 'object' || schemaNode === null) {
        return schemaNode;
    }

    if (Array.isArray(schemaNode)) {
        // Ensure resolutionPath is passed down in array mapping
        return Promise.all(schemaNode.map(item => resolveRefs(item, basePath, resolutionPath)));
    }

    if (schemaNode.$ref) {
        const refUrl = new URL(schemaNode.$ref, basePath).href;

        // --- CIRCULAR REFERENCE CHECK ---
        if (resolutionPath.has(refUrl)) {
            console.warn(`Circular reference detected at ${refUrl}. Not resolving again in this path.`);
            return { $ref: schemaNode.$ref, circular: true }; // Return a modified ref object
        }

        // Use cache to avoid re-fetching and re-resolving the same schema file
        if (schemaCache.has(refUrl)) {
            return schemaCache.get(refUrl);
        }

        // Add the current URL to the resolution path before recursing
        resolutionPath.add(refUrl);
        
        console.log(`Resolving $ref: ${refUrl}`);
        const response = await fetch(refUrl);
        if (!response.ok) {
            resolutionPath.delete(refUrl); // Clean up path on error
            throw new Error(`HTTP error! status: ${response.status} for ${refUrl}`);
        }
        const refSchema = await response.json();
        
        // Recursively resolve refs in the newly loaded schema, passing the updated path
        const resolvedSchema = await resolveRefs(refSchema, refUrl, resolutionPath);

        // Remove the URL from the path now that this branch of resolution is complete
        resolutionPath.delete(refUrl);

        // Cache the fully resolved schema for this URL
        schemaCache.set(refUrl, resolvedSchema);
        return resolvedSchema;
    }

    const resolvedNode = {};
    for (const key in schemaNode) {
        // Pass the resolutionPath down through object property recursion
        resolvedNode[key] = await resolveRefs(schemaNode[key], basePath, resolutionPath);
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
    console.log(`Fetching schema from: ${schemaPath}`);

    try {
        const response = await fetch(schemaPath);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const schema = await response.json();
        console.log('Schema loaded successfully, now resolving refs:', schema);

        // Create a base URL to resolve relative refs from
        const baseUrl = new URL(schemaPath, window.location.href).href;
        
        return await resolveRefs(schema, baseUrl);

    } catch (error) {
        console.error('Failed to load or resolve schema:', error);
        throw error;
    }
}
