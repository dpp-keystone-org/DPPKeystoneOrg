import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

/**
 * Validates a DPP JSON object against a set of schemas.
 * 
 * @param {object} dppData - The DPP data object to validate.
 * @param {object} schemaContext - An object containing the necessary schemas.
 * @param {object} schemaContext.baseSchema - The base DPP schema (e.g., dpp.schema.json).
 * @param {object} [schemaContext.sectorSchemas] - A map of sector schemas keyed by specification ID.
 * @param {Array<object>} [schemaContext.commonSchemas] - An array of common schemas referenced by others (e.g., epd, organization).
 * @returns {object} An object with `valid` (boolean) and `errors` (array or null).
 */
export function validateDpp(dppData, schemaContext) {
    const { baseSchema, sectorSchemas = {}, commonSchemas = [] } = schemaContext;

    // Initialize AJV
    const ajv = new Ajv2020({
        allErrors: true,
        allowMatchingProperties: true,
        allowUnionTypes: true,
        strict: false // Relax strict mode slightly for complex schema interactions
    });
    addFormats(ajv);

    // Add common schemas that might be referenced ($ref)
    commonSchemas.forEach(schema => {
        // Ensure schema has an ID to be referenced by
        if (schema.$id) {
            // Check if already added to avoid errors if called multiple times or duplicates
            if (!ajv.getSchema(schema.$id)) {
                ajv.addSchema(schema);
            }
        }
    });

    // Start with the base schema
    const schemasToApply = [baseSchema];

    // Determine conditional schemas based on contentSpecificationIds
    if (dppData.contentSpecificationIds && Array.isArray(dppData.contentSpecificationIds)) {
        for (const id of dppData.contentSpecificationIds) {
            if (sectorSchemas[id]) {
                schemasToApply.push(sectorSchemas[id]);
            }
        }
    }

    // Create a composite schema
    const compositeSchema = {
        // $async: true, // Removed to ensure synchronous validation
        allOf: schemasToApply
    };

    // Compile and validate
    // Note: We use compile() then validate() to get the errors. 
    // For a dynamic composite schema, we might just validate directly, 
    // but compile is safer for proper referencing.
    let validate;
    try {
        validate = ajv.compile(compositeSchema);
    } catch (e) {
        // Fallback or error handling for invalid schema construction
        return { valid: false, errors: [{ message: 'Schema compilation error: ' + e.message }] };
    }

    const isValid = validate(dppData);

    return {
        valid: isValid,
        errors: isValid ? null : validate.errors
    };
}
