import * as jsonldEngine from 'jsonld';

// Robustly resolve the jsonld library instance across different environments
let jsonld = jsonldEngine.default || jsonldEngine;

// Search for the object that has the 'expand' method
if (typeof jsonld.expand !== 'function') {
    if (jsonld.default && typeof jsonld.default.expand === 'function') {
        jsonld = jsonld.default;
    } else if (typeof jsonldEngine.expand === 'function') {
        jsonld = jsonldEngine;
    } else if (jsonld.jsonld && typeof jsonld.jsonld.expand === 'function') {
        jsonld = jsonld.jsonld;
    } else if (typeof globalThis.jsonld !== 'undefined' && typeof globalThis.jsonld.expand === 'function') {
        // Fallback for UMD builds in browser that attach to window/globalThis
        jsonld = globalThis.jsonld;
    }
}

import { profile as schemaOrgProfile } from './profiles/schema.org.js?v=1770754341743';

const profiles = {
    'schema.org': schemaOrgProfile,
};

/**
 * Parses ontology files to build a dictionary of indicator metadata.
 * This is a generic function that accepts a loader for environment-specific data fetching.
 * @param {string[]} ontologyPaths - An array of paths or URLs to ontology files.
 * @param {Function} loader - An async function that takes a path and returns the JSON content.
 * @param {Function} documentLoader - The JSON-LD document loader.
 * @param {object} dictionary - The dictionary object to populate.
 */
export async function buildDictionary(ontologyPaths, loader, documentLoader, dictionary) {
    if (Object.keys(dictionary).length > 0) return;

    for (const ontologyPath of ontologyPaths) {
        const ontology = await loader(ontologyPath);
        const expanded = await jsonld.expand(ontology, { documentLoader });
        
        const nodes = expanded[0]?.['@graph'] || expanded;

        nodes.forEach(node => {
            const id = node['@id'];
            if (!id) return;
            const unitArr = node['https://dpp-keystone.org/spec/v1/terms#unit'];
            const labelArr = node['http://www.w3.org/2000/01/rdf-schema#label'];

            if (unitArr) {
                let label = id;
                if (labelArr) {
                    const en = labelArr.find(l => l['@language'] === 'en');
                    label = en ? en['@value'] : (labelArr[0] ? labelArr[0]['@value'] : id);
                }
                dictionary[id] = {
                    unit: unitArr[0]['@value'],
                    label: label
                };
            }
        });
    }
}

/**
 * A generic transformation engine for DPP data.
 * @param {object} dpp - The raw DPP JSON-LD document.
 * @param {object} options - The transformation options.
 * @param {string} options.profile - The name of the target profile to use (e.g., 'schema.org').
 * @param {Function} options.documentLoader - The JSON-LD document loader.
 * @param {object} dictionary - The dictionary of indicator metadata.
 * @returns {Promise<Array>} A promise that resolves to an array of transformed objects.
 */
export async function transform(dpp, options, dictionary) {
    const { profile: profileName, documentLoader } = options;

    // --- Start: Type Inference Logic ---
    const specIdToType = {
        'draft_construction_specification_id': 'https://dpp-keystone.org/spec/v1/terms#ConstructionProduct',
        // Future sector-specific IDs can be added here
    };
    const DPP_BASE_TYPE = 'https://dpp-keystone.org/spec/v1/terms#DigitalProductPassport';

    // Ensure dpp['@type'] is an array and contains the base DPP type.
    // This allows data providers to omit the @type property if a contentSpecificationId is present.
    if (!dpp['@type']) {
        dpp['@type'] = [];
    } else if (!Array.isArray(dpp['@type'])) {
        dpp['@type'] = [dpp['@type']];
    }
    if (!dpp['@type'].includes(DPP_BASE_TYPE)) {
        dpp['@type'].push(DPP_BASE_TYPE);
    }
    
    // Infer sector-specific types from contentSpecificationIds
    if (Array.isArray(dpp.contentSpecificationIds)) {
        for (const id of dpp.contentSpecificationIds) {
            if (specIdToType[id] && !dpp['@type'].includes(specIdToType[id])) {
                dpp['@type'].push(specIdToType[id]);
            }
        }
    }
    // --- End: Type Inference Logic ---

    const profile = profiles[profileName];
    if (!profile) {
        throw new Error(`Transformation profile "${profileName}" not found.`);
    }

    const expanded = await jsonld.expand(dpp, { documentLoader });

    const rootNode = expanded.find(n => {
        if (!n['@type']) return false;
        const types = Array.isArray(n['@type']) ? n['@type'] : [n['@type']];
        return types.includes(DPP_BASE_TYPE);
    });
    if (!rootNode) {
        throw new Error("Could not find the main DigitalProductPassport node in the expanded graph.");
    }
    
    let results = [];
    for (const transformation of profile.transformations) {
        const sourceData = rootNode[transformation.source]?.[0];
        if (sourceData) {
            const transformedData = transformation.transformer(sourceData, dictionary, rootNode);
            results = results.concat(transformedData);
        }
    }

    return results;
}
