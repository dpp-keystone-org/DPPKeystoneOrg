import jsonld from 'jsonld';
import { transformEPD, buildDictionary } from '../common/dpp-logic.js';

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
 * The client-side EPD Adapter. It learns from the ontology and transforms the expanded graph.
 * @param {object} productDoc - The raw DPP JSON document.
 * @param {string[]} ontologyPaths - An array of paths to ontology files.
 * @param {Function} documentLoader - The JSON-LD document loader.
 * @returns {Array} An array of schema.org certification objects.
 */
export async function EPDAdapter(productDoc, ontologyPaths, documentLoader) {
    await buildDictionary(ontologyPaths, loader, documentLoader, dictionary);
    const expanded = await jsonld.expand(productDoc, { documentLoader });
    
    return transformEPD(expanded, dictionary);
}
