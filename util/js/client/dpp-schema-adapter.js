import { transform, buildDictionary } from '../common/transformation/dpp-schema-logic.js?v=1770749483538';

// Using a global dictionary with memoization to avoid re-building on every call
const dictionary = {};

/**
 * Loader function for the client-side environment using fetch.
 * @param {string} path - The URL path to the ontology file.
 * @returns {Promise<object>} - A promise that resolves to the JSON content.
 */
async function loader(path) {
    const resp = await fetch(path);
    return resp.json();
}

/**
 * The client-side DPP transformer. It uses a profile-based engine to transform DPP data.
 * @param {object} productDoc - The raw DPP JSON document.
 * @param {object} options - The transformation options.
 * @param {string} options.profile - The name of the target profile (e.g., 'schema.org').
 * @param {string[]} options.ontologyPaths - An array of paths to ontology files.
 * @param {Function} options.documentLoader - The JSON-LD document loader.
 * @returns {Promise<Array>} A promise that resolves to an array of transformed objects.
 */
export async function transformDpp(productDoc, options) {
    const { ontologyPaths, documentLoader } = options;
    console.log("DPP Adapter Debug: Building dictionary with paths:", ontologyPaths);
    await buildDictionary(ontologyPaths, loader, documentLoader, dictionary);
    console.log("DPP Adapter Debug: Dictionary built. Transforming...");
    
    return transform(productDoc, options, dictionary);
}
