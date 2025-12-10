// src/wizard/schema-loader.js

/**
 * Fetches a JSON schema for a given sector.
 * @param {string} sector - The name of the sector (e.g., 'battery', 'construction').
 * @returns {Promise<object>} A promise that resolves to the JSON schema object.
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
        console.log('Schema loaded successfully:', schema);
        return schema;
    } catch (error) {
        console.error('Failed to load schema:', error);
        throw error;
    }
}
