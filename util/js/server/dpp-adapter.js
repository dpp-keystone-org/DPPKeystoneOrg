import { parse as jsoncParse } from 'jsonc-parser';
import { promises as fs } from 'fs';
import { transform, buildDictionary } from '../common/dpp-logic.js?v=1768414137213';

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
 * The server-side DPP transformer. It uses a profile-based engine to transform DPP data.
 * @param {object} productDoc - The raw DPP JSON document.
 * @param {object} options - The transformation options.
 * @param {string} options.profile - The name of the target profile (e.g., 'schema.org').
 * @param {string[]} options.ontologyPaths - An array of paths to ontology files.
 * @param {Function} options.documentLoader - The JSON-LD document loader.
 * @returns {Promise<Array>} A promise that resolves to an array of transformed objects.
 */
export async function transformDpp(productDoc, options) {
    const { ontologyPaths, documentLoader } = options;
    await buildDictionary(ontologyPaths, loader, documentLoader, dictionary);
    
    return transform(productDoc, options, dictionary);
}
