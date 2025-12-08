import { parse as jsoncParse } from 'jsonc-parser';
import jsonld from 'jsonld';
import { promises as fs } from 'fs';
import { transformEPD, buildDictionary } from '../common/dpp-logic.js';

// Using a global dictionary with memoization to avoid re-building on every call
const dictionary = {};

/**
 * Loader function for the server-side environment using fs.
 * @param {string} path - The file system path to the ontology file.
 * @returns {Promise<object>} - A promise that resolves to the JSON content.
 */
async function loader(path) {
    const content = await fs.readFile(path, 'utf-8');
    return jsoncParse(content);
}

/**
 * The server-side EPD Adapter. It learns from the ontology and transforms the expanded graph.
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
