// src/wizard/ontology-loader.js

/**
 * Robustly extracts the string value from an RDFS property, handling both
 * simple strings and multilingual literal objects (e.g., { '@value': '...' }).
 * @param {string|object|Array} property - The RDFS property from the JSON-LD graph.
 * @returns {string} The extracted string value, or an empty string if not found.
 */
function getRdfsValue(property) {
    if (!property) return '';
    if (typeof property === 'string') return property;

    // Handle language-tagged array
    if (Array.isArray(property)) {
        const enEntry = property.find(entry => entry['@language'] === 'en');
        if (enEntry && enEntry['@value']) {
            return enEntry['@value'];
        }
        // Fallback to the first available value if no 'en' entry is found
        if (property[0] && property[0]['@value']) {
            return property[0]['@value'];
        }
    }

    // Handle single language-tagged object
    if (property['@value']) return property['@value'];

    return '';
}

/**
 * Internal recursive function to fetch, parse, and process an ontology file, including its imports.
 * @param {string} url - The URL of the ontology to load.
 * @param {Map<string, {label: string, comment: string}>} ontologyMap - The map to populate.
 * @param {Set<string>} loadedUrls - A set to track already loaded URLs to prevent infinite loops.
 * @param {boolean} isInitialCall - Flag to indicate if this is the first call in the recursion.
 * @returns {Promise<void>}
 */
async function loadAndParseOntology(url, ontologyMap, loadedUrls, isInitialCall = false) {
    if (loadedUrls.has(url)) {
        return; // Avoid infinite loops and redundant fetches
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorMsg = `HTTP error! status: ${response.status} for URL: ${url}`;
            if (isInitialCall) {
                throw new Error(errorMsg); // For initial call, failure is fatal.
            } else {
                console.error(errorMsg); // For imports, log error and skip.
                return;
            }
        }
        loadedUrls.add(url);
        const ontology = await response.json();

        // Process the graph of the current ontology
        if (ontology['@graph']) {
            for (const term of ontology['@graph']) {
                if (term['@id'] && (term['rdfs:label'] || term['rdfs:comment'])) {
                    const label = getRdfsValue(term['rdfs:label']);
                    const comment = getRdfsValue(term['rdfs:comment']);

                    let key = term['@id'];
                    if (key.includes(':')) {
                        key = key.split(':')[1];
                    }
                    
                    if (!ontologyMap.has(key)) {
                        ontologyMap.set(key, {
                            label: label || '',
                            comment: comment || ''
                        });
                    }
                }
            }
        }
        
        // Recursively process imports
        if (ontology['owl:imports']) {
            const imports = Array.isArray(ontology['owl:imports']) ? ontology['owl:imports'] : [ontology['owl:imports']];
            for (const importDef of imports) {
                const importUrl = typeof importDef === 'string' ? importDef : importDef['@id'];
                if (importUrl) {
                    // Browsers can resolve relative paths against the base; in Node/JSDOM we need a dummy base.
                    const DUMMY_BASE = 'http://localhost';
                    // The base for resolution is the URL of the file that contains the import.
                    const baseUrl = new URL(url, DUMMY_BASE).href;
                    const absoluteUrl = new URL(importUrl, baseUrl).href;
                    await loadAndParseOntology(absoluteUrl, ontologyMap, loadedUrls, false);
                }
            }
        }
    } catch (error) {
        // Re-throw if it's the initial call, otherwise just log.
        if (isInitialCall) throw error;
        else console.error(`Failed to load or parse ontology at ${url}`, error);
    }
}


/**
 * Fetches and parses a JSON-LD ontology file and its imports to extract metadata.
 * @param {string} sector - The sector whose ontology needs to be loaded (e.g., 'construction').
 * @returns {Promise<Map<string, {label: string, comment: string}>|null>} A map of term metadata, or null on failure.
 */
export async function loadOntology(sector) {
    const ontologyMap = new Map();
    const loadedUrls = new Set();
    let initialUrl;

    if (sector === 'dpp') {
        initialUrl = '../ontology/v1/dpp-ontology.jsonld';
    } else {
        const sectorPascalCase = sector.charAt(0).toUpperCase() + sector.slice(1);
        initialUrl = `../ontology/v1/sectors/${sectorPascalCase}.jsonld`;
    }

    try {
        await loadAndParseOntology(initialUrl, ontologyMap, loadedUrls, true);
        return ontologyMap;
    } catch (error) {
        console.error(`Failed to execute ontology loading for sector: ${sector}`, error);
        return null;
    }
}
