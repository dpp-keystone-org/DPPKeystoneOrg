import * as jsonldEngine from 'jsonld';
import { isDate, isDateTime, isDecimal, isInteger, isCountryCode, isURI, hasControlCharacters } from './ontology-validator.js?v=1780667998764';

// Robustly resolve the jsonld library instance across different environments
let _jsonld = jsonldEngine.default || jsonldEngine;
if (typeof _jsonld.expand !== 'function') {
    if (_jsonld.default && typeof _jsonld.default.expand === 'function') {
        _jsonld = _jsonld.default;
    } else if (typeof jsonldEngine.expand === 'function') {
        _jsonld = jsonldEngine;
    } else if (_jsonld.jsonld && typeof _jsonld.jsonld.expand === 'function') {
        _jsonld = _jsonld.jsonld;
    } else if (typeof globalThis.jsonld !== 'undefined' && typeof globalThis.jsonld.expand === 'function') {
        _jsonld = globalThis.jsonld;
    }
}
const _expand = _jsonld.expand;

/**
 * Custom Document Loader maps absolute live references natively on the network path 
 * without forcing local static paths, allowing external integrations.
 */
async function customDocumentLoader(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
        const document = await response.json();
        return {
            contextUrl: null,
            documentUrl: url,
            document: document
        };
    } catch (e) {
        throw e;
    }
}

/**
 * Computes implicit typing restrictions entirely extracted natively from the `@context` coercions 
 * dynamically bound during a native semantic expansion (e.g., {"@type": "xsd:date"}).
 */
export async function validateContextAwarePayload(dppData, customLoaderForTestingOverrides = null) {
    const errors = [];

    let expandedData;
    try {
        const loaderToUse = customLoaderForTestingOverrides || customDocumentLoader;
        expandedData = await _expand(dppData, { documentLoader: loaderToUse });
    } catch (e) {
        errors.push({
            instancePath: '/',
            schemaPath: '',
            keyword: 'format',
            params: { format: 'json-ld' },
            message: `JSON-LD Expansion Error: Payload failed to expand via embedded @context URLs. (${e.message})`
        });
        return { valid: false, errors };
    }

    function traverse(obj, path, currentIri) {
        if (Array.isArray(obj)) {
            obj.forEach((item, index) => {
                const arrayPath = obj.length === 1 ? path : `${path}[${index}]`;
                traverse(item, arrayPath, currentIri);
            });
        } else if (obj !== null && typeof obj === 'object') {
            if (obj['@value'] !== undefined) {
                validateLeaf(obj, path, currentIri);
            } else if (obj['@id'] !== undefined && Object.keys(obj).every(k => k === '@id' || k === '@type')) {
                // Leaf node containing an IRI value
                validateLeaf(obj, path, currentIri);
            } else {
                for (const [key, val] of Object.entries(obj)) {
                    if (key.startsWith('@')) continue;
                    const shortKey = key.split(/#|\//).pop();
                    traverse(val, path ? `${path}/${shortKey}` : `/${shortKey}`, key);
                }
            }
        }
    }

    function validateLeaf(leafObj, path, currentIri) {
        const value = leafObj['@value'] !== undefined ? leafObj['@value'] : leafObj['@id'];
        const type = leafObj['@type'];

        let range = type;
        if (type && type.startsWith('http://www.w3.org/2001/XMLSchema#')) {
            range = type.split('#')[1];
        }

        const shortName = currentIri ? currentIri.split(/#|\//).pop() : 'property';

        if (range === 'date' && !isDate(value)) {
            errors.push({ instancePath: path, schemaPath: '', keyword: 'format', params: { format: 'date' }, message: `${shortName} must be a valid date (YYYY-MM-DD)` });
        } else if (range === 'dateTime' && !isDateTime(value)) {
            errors.push({ instancePath: path, schemaPath: '', keyword: 'format', params: { format: 'dateTime' }, message: `${shortName} must be a valid dateTime` });
        } else if (range === 'decimal' && !isDecimal(value)) {
            errors.push({ instancePath: path, schemaPath: '', keyword: 'type', params: { type: 'decimal' }, message: `${shortName} must be a valid number` });
        } else if (range === 'integer' && !isInteger(value)) {
            errors.push({ instancePath: path, schemaPath: '', keyword: 'type', params: { type: 'integer' }, message: `${shortName} must be a whole number` });
        } else if ((range === 'anyURI' || leafObj['@id'] !== undefined) && !isURI(value)) {
            errors.push({ instancePath: path, schemaPath: '', keyword: 'format', params: { format: 'uri' }, message: `${shortName} must be a valid URI` });
        } else if (range === 'string' || typeof value === 'string') {
            if (shortName === 'addressCountry' && !isCountryCode(value)) {
                errors.push({ instancePath: path, schemaPath: '', keyword: 'pattern', params: { pattern: 'country code' }, message: `${shortName} must be a valid country code` });
            } else if (hasControlCharacters(value)) {
                errors.push({ instancePath: path, schemaPath: '', keyword: 'pattern', params: { pattern: 'no control characters' }, message: `Invalid characters detected in ${shortName}` });
            }
        }
    }

    traverse(expandedData, '', null);

    return {
        valid: errors.length === 0,
        errors
    };
}
