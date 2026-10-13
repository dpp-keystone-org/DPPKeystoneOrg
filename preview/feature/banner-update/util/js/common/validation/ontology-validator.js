/**
 * Standalone Ontology Validator
 * Scans a JSON structure and enforces semantic formatting boundaries imported by the domain's ontology map.
 */

function isDate(value) {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}(Z|[+-]\d{2}:?\d{2})?$/.test(value);
}

function isDateTime(value) {
    if (typeof value !== 'string') return false;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(value);
}

function isDecimal(value) {
    if (value === null || value === '' || typeof value === 'boolean' || Array.isArray(value)) return false;
    const num = Number(value);
    return !isNaN(num) && isFinite(num);
}

function isInteger(value) {
    if (!isDecimal(value)) return false;
    return Number(value) % 1 === 0;
}

function isCountryCode(value) {
    if (typeof value !== 'string') return false;
    return /^[A-Z]{2,3}$/.test(value.toUpperCase());
}

function isURI(value) {
    if (typeof value !== 'string') return false;
    if (/\s/.test(value)) return false; // Invalidates structural spaces

    // A reasonably relaxed format to support full URLs, schema-less domains, URNs, and relative paths
    // Requirements: Must contain a colon (scheme), a dot (domain/extension), or start with a slash (local API)
    return /(:|^\/|\.[a-z0-9]+)/i.test(value);
}

function hasControlCharacters(value) {
    if (typeof value !== 'string') return false;
    // eslint-disable-next-line no-control-regex
    const controlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    return controlChars.test(value);
}

export { isDate, isDateTime, isDecimal, isInteger, isCountryCode, isURI, hasControlCharacters };

/**
 * Validates a structured JSON object directly against data configurations mapped by an Ontology.
 * @param {object} dppData The payload to inspect
 * @param {Map} ontologyMap A key/value mapping of property names to metadata definitions (e.g. range, unit)
 * @returns {object} An envelope indicating validity, containing any string/format violations
 */
export function validateAgainstOntology(dppData, ontologyMap) {
    const errors = [];
    if (!ontologyMap || typeof dppData !== 'object' || dppData === null) {
        return { valid: true, errors: [] };
    }

    function traverse(obj, path, parentKey) {
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                traverse(item, `${path}[${index}]`, parentKey);
            });
        } else if (obj !== null && typeof obj === 'object') {
            for (const [key, val] of Object.entries(obj)) {
                traverse(val, path ? `${path}/${key}` : `/${key}`, key);
            }
        } else {
            // It's a primitive leaf. Check if parentKey is in the ontology Map.
            if (parentKey && ontologyMap.has(parentKey)) {
                const info = ontologyMap.get(parentKey);
                if (info && info.range) {
                    const range = info.range;

                    if (range === 'date' && !isDate(obj)) {
                        errors.push({
                            instancePath: path,
                            schemaPath: '',
                            keyword: 'format',
                            params: { format: 'date' },
                            message: `${parentKey} must be a valid date (YYYY-MM-DD)`
                        });
                    } else if (range === 'dateTime' && !isDateTime(obj)) {
                        errors.push({
                            instancePath: path,
                            schemaPath: '',
                            keyword: 'format',
                            params: { format: 'dateTime' },
                            message: `${parentKey} must be a valid dateTime (YYYY-MM-DDThh:mm:ssZ)`
                        });
                    } else if (range === 'decimal' && !isDecimal(obj)) {
                        errors.push({
                            instancePath: path,
                            schemaPath: '',
                            keyword: 'type',
                            params: { type: 'decimal' },
                            message: `${parentKey} must be a valid number`
                        });
                    } else if (range === 'integer' && !isInteger(obj)) {
                        errors.push({
                            instancePath: path,
                            schemaPath: '',
                            keyword: 'type',
                            params: { type: 'integer' },
                            message: `${parentKey} must be a whole number`
                        });
                    } else if (range === 'anyURI' && !isURI(obj)) {
                        errors.push({
                            instancePath: path,
                            schemaPath: '',
                            keyword: 'format',
                            params: { format: 'uri' },
                            message: `${parentKey} must be a valid URI`
                        });
                    } else if (range === 'string') {
                        // Check string heuristics based on key or content
                        if (parentKey === 'addressCountry' && !isCountryCode(obj)) {
                            errors.push({
                                instancePath: path,
                                schemaPath: '',
                                keyword: 'pattern',
                                params: { pattern: 'country code' },
                                message: `${parentKey} must be a valid 2 or 3 letter country code`
                            });
                        } else if (hasControlCharacters(obj)) {
                            errors.push({
                                instancePath: path,
                                schemaPath: '',
                                keyword: 'pattern',
                                params: { pattern: 'no control characters' },
                                message: `Invalid characters detected in ${parentKey}`
                            });
                        }
                    }
                }
            }
        }
    }

    traverse(dppData, '', null);

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validates that a raw JSON-LD ontology term contains translations for the required languages.
 * @param {object} term The JSON-LD node
 * @param {string[]} requiredLanguages The required language codes
 * @returns {object} { valid: boolean, errors: string[] }
 */
const EU_LANGUAGES = [
    'en', 'bg', 'cs', 'da', 'de', 'el', 'es', 'et', 'fi', 'fr', 'hr', 
    'hu', 'it', 'lt', 'lv', 'mt', 'nl', 'pl', 'pt', 'ro', 'sk', 'sl', 'sv', 'ga'
];

export function validateTermTranslations(term, requiredLanguages = EU_LANGUAGES, fieldsToCheck = ['rdfs:label', 'rdfs:comment']) {
    const errors = [];
    
    if (!term || typeof term !== 'object') {
        return { valid: true, errors: [] };
    }

    const checkField = (fieldName) => {
        const value = term[fieldName];
        if (!value) return; 
        
        if (typeof value === 'string') {
            errors.push(`'${fieldName}' is a plain string, missing language tags. Required: ${requiredLanguages.length} languages.`);
            return;
        }
        
        const values = Array.isArray(value) ? value : [value];
        const foundLangs = new Set();
        
        values.forEach(val => {
            if (val && typeof val === 'object' && val['@language']) {
                foundLangs.add(val['@language']);
            }
        });
        
        const missingLangs = requiredLanguages.filter(lang => !foundLangs.has(lang));
        if (missingLangs.length > 0) {
            errors.push(`'${fieldName}' is missing ${missingLangs.length} required languages (e.g., ${missingLangs.slice(0, 3).join(', ')}...)`);
        }
    };

    fieldsToCheck.forEach(checkField);

    return {
        valid: errors.length === 0,
        errors
    };
}

/**
 * Validates that a raw JSON-LD ontology term does not use generic RDFS properties where OWL properties are required.
 * @param {object} term The JSON-LD node
 * @returns {object} { valid: boolean, errors: string[] }
 */
export function validateTermStructure(term) {
    const errors = [];
    
    if (!term || typeof term !== 'object') {
        return { valid: true, errors: [] };
    }

    const type = term['@type'];
    if (!type) {
        return { valid: true, errors: [] };
    }

    const types = Array.isArray(type) ? type : [type];
    
    // Check if any type indicates a property
    const isProperty = types.some(t => t.includes('Property'));
    
    if (isProperty) {
        const hasValidOwlType = types.some(t => t === 'owl:ObjectProperty' || t === 'owl:DatatypeProperty');
        if (!hasValidOwlType) {
            errors.push(`Term '${term['@id'] || 'unknown'}' has an invalid property type ('${types.join(', ')}'). Properties must be defined as 'owl:ObjectProperty' or 'owl:DatatypeProperty'.`);
        }
    }

    return {
        valid: errors.length === 0,
        errors
    };
}
