import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const validatorCache = new WeakMap();

/**
 * Checks whether a cached compiled Ajv validator still matches the current
 * inner schema references of `schemaContext` (protecting against in-place mutation).
 */
function isCacheEntryValid(cached, baseSchema, sectorSchemas, commonSchemas) {
    if (!cached || cached.baseSchema !== baseSchema) {
        return false;
    }

    const sectorKeys = Object.keys(sectorSchemas);
    if (sectorKeys.length !== cached.sectorKeys.length) {
        return false;
    }
    for (let i = 0; i < sectorKeys.length; i++) {
        const key = sectorKeys[i];
        if (key !== cached.sectorKeys[i] || sectorSchemas[key] !== cached.sectorRefs[i]) {
            return false;
        }
    }

    if (commonSchemas.length !== cached.commonRefs.length) {
        return false;
    }
    for (let i = 0; i < commonSchemas.length; i++) {
        if (commonSchemas[i] !== cached.commonRefs[i]) {
            return false;
        }
    }

    return true;
}

/**
 * Deep-clones Ajv error objects so callers cannot mutate shared validator state
 * and subsequent validations cannot clobber previously returned error arrays.
 */
function cloneErrors(errors) {
    if (!errors) {
        return [];
    }
    if (typeof structuredClone === 'function') {
        return structuredClone(errors);
    }
    return JSON.parse(JSON.stringify(errors));
}

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
    if (!schemaContext || typeof schemaContext !== 'object') {
        return { valid: false, errors: [{ message: 'Schema compilation error: Invalid schemaContext' }] };
    }

    const { baseSchema } = schemaContext;
    const safeSectorSchemas = schemaContext.sectorSchemas && typeof schemaContext.sectorSchemas === 'object'
        ? schemaContext.sectorSchemas
        : {};
    const safeCommonSchemas = Array.isArray(schemaContext.commonSchemas)
        ? schemaContext.commonSchemas
        : [];

    const cached = validatorCache.get(schemaContext);
    let validate;

    if (isCacheEntryValid(cached, baseSchema, safeSectorSchemas, safeCommonSchemas)) {
        validate = cached.validate;
    } else {
        const ajv = new Ajv2020({
            allErrors: true,
            allowMatchingProperties: true,
            allowUnionTypes: true,
            strict: false // Relax strict mode slightly for complex schema interactions
        });
        addFormats(ajv);

        // Add common schemas that might be referenced ($ref)
        safeCommonSchemas.forEach((schema) => {
            if (schema && schema.$id && !ajv.getSchema(schema.$id)) {
                ajv.addSchema(schema);
            }
        });

        // Start with the base schema, and unconditionally push all loaded conditional schemas (sectors, general products, packaging, etc.)
        // AJV evaluates JSON Schema Draft-2020-12 `if/then` conditional rules intrinsically upon execution.
        const sectorKeys = Object.keys(safeSectorSchemas);
        const sectorRefs = sectorKeys.map((key) => safeSectorSchemas[key]);
        const compositeSchema = {
            allOf: [baseSchema, ...sectorRefs]
        };

        try {
            validate = ajv.compile(compositeSchema);
        } catch (e) {
            return { valid: false, errors: [{ message: 'Schema compilation error: ' + e.message }] };
        }

        validatorCache.set(schemaContext, {
            validate,
            baseSchema,
            sectorKeys,
            sectorRefs,
            commonRefs: [...safeCommonSchemas]
        });
    }

    const isValid = validate(dppData);

    return {
        valid: isValid,
        errors: isValid ? null : cloneErrors(validate.errors)
    };
}
