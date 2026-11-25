import { validateDpp } from '../../../src/util/js/common/validation/schema-validator.js';
import { validateAgainstOntology } from '../../../src/util/js/common/validation/ontology-validator.js';
import { validateContextAwarePayload } from '../../../src/util/js/common/validation/context-semantic-validator.js';
import { getServerSchemaContext, getServerOntologyMap, createServerDocumentLoader } from './server-resource-loader.js';

import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';

/**
 * Validates a DPP JSON object against both structural JSON Schema and semantic Ontology rules on the server.
 * 
 * @param {object} dppData - The raw DPP JSON payload.
 * @param {object} [options={}] - Options: { version }.
 * @returns {Promise<{ valid: boolean, errors: Array<object> | null }>}
 */
export async function validateDppPayload(dppData, options = {}) {
    if (!dppData || typeof dppData !== 'object' || Array.isArray(dppData)) {
        return {
            valid: false,
            errors: [{
                instancePath: '',
                message: 'Invalid payload: DPP data must be a non-null JSON object.'
            }]
        };
    }

    const version = options.version || KEYSTONE_VERSION;
    const schemaContext = await getServerSchemaContext(version);
    const schemaResult = validateDpp(dppData, schemaContext);
    
    let isValid = schemaResult.valid;
    let allErrors = schemaResult.errors ? [...schemaResult.errors] : [];

    // Ontology validation
    try {
        if (dppData['@context']) {
            const documentLoader = createServerDocumentLoader(version);
            const contextResult = await validateContextAwarePayload(dppData, documentLoader);
            if (!contextResult.valid) {
                isValid = false;
                allErrors = allErrors.concat(contextResult.errors);
            }
        } else {
            let sector = 'dpp';
            if (dppData.contentSpecificationIds && Array.isArray(dppData.contentSpecificationIds)) {
                for (const specId of dppData.contentSpecificationIds) {
                    if (specId.includes('battery')) sector = 'battery';
                    else if (specId.includes('textile')) sector = 'textile';
                    else if (specId.includes('steel') || specId.includes('iron')) sector = 'iron-steel';
                    else if (specId.includes('construction')) sector = 'construction';
                    else if (specId.includes('electronic')) sector = 'electronics';
                }
            }

            const ontologyMap = await getServerOntologyMap(sector, version);
            const ontologyResult = validateAgainstOntology(dppData, ontologyMap);
            if (!ontologyResult.valid) {
                isValid = false;
                allErrors = allErrors.concat(ontologyResult.errors);
            }
        }
    } catch (e) {
        console.warn('Ontology validation warning:', e.message);
    }

    return {
        valid: isValid && allErrors.length === 0,
        errors: allErrors.length > 0 ? allErrors : null
    };
}
