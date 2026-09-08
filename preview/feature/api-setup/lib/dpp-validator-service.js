import { validateDpp } from '../util/js/common/validation/schema-validator.js?v=1788853271333';
import { validateAgainstOntology } from '../util/js/common/validation/ontology-validator.js?v=1788853271333';
import { validateContextAwarePayload } from '../util/js/common/validation/context-semantic-validator.js?v=1788853271333';
import { getServerSchemaContext, getServerOntologyMap, createServerDocumentLoader } from './server-resource-loader.js?v=1788853271333';

/**
 * Validates a DPP JSON object against both structural JSON Schema and semantic Ontology rules on the server.
 * 
 * @param {object} dppData - The raw DPP JSON payload.
 * @returns {Promise<{ valid: boolean, errors: Array<object> | null }>}
 */
export async function validateDppPayload(dppData) {
    if (!dppData || typeof dppData !== 'object' || Array.isArray(dppData)) {
        return {
            valid: false,
            errors: [{
                instancePath: '',
                message: 'Invalid payload: DPP data must be a non-null JSON object.'
            }]
        };
    }

    const schemaContext = await getServerSchemaContext();
    const schemaResult = validateDpp(dppData, schemaContext);
    
    let isValid = schemaResult.valid;
    let allErrors = schemaResult.errors ? [...schemaResult.errors] : [];

    // Ontology validation
    try {
        if (dppData['@context']) {
            const documentLoader = createServerDocumentLoader();
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

            const ontologyMap = await getServerOntologyMap(sector);
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
