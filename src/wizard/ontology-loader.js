// src/wizard/ontology-loader.js

/**
 * Robustly extracts the string value from an RDFS property, handling both
 * simple strings and multilingual literal objects (e.g., { '@value': '...' }).
 * @param {string|object} property - The RDFS property from the JSON-LD graph.
 * @returns {string} The extracted string value, or an empty string if not found.
 */
function getRdfsValue(property) {
    if (!property) return '';
    if (typeof property === 'string') return property;
    if (property['@value']) return property['@value'];
    return '';
}

/**
 * Fetches and parses a JSON-LD ontology file to extract label and comment metadata for its terms.
 * @param {string} sector - The sector whose ontology needs to be loaded (e.g., 'construction').
 * @returns {Promise<Map<string, {label: string, comment: string}>>} A map where keys are term IDs (IRIs) 
 * and values are objects containing the term's label and comment.
 */
export async function loadOntology(sector) {
    const ontologyMap = new Map();
    let url;

    if (sector === 'dpp') {
        url = '../ontology/v1/dpp-ontology.jsonld';
    } else {
        // Assumption: a sector name like 'construction' maps to a file named 'Construction.jsonld'
        const sectorPascalCase = sector.charAt(0).toUpperCase() + sector.slice(1);
        url = `../ontology/v1/sectors/${sectorPascalCase}.jsonld`;
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const ontology = await response.json();

        if (ontology['@graph']) {
            for (const term of ontology['@graph']) {
                if (term['@id'] && (term['rdfs:label'] || term['rdfs:comment'])) {
                    const label = getRdfsValue(term['rdfs:label']);
                    const comment = getRdfsValue(term['rdfs:comment']);

                    let key = term['@id'];
                    if (key.includes(':')) {
                        key = key.split(':')[1];
                    }

                    ontologyMap.set(key, {
                        label: label || '',
                        comment: comment || ''
                    });
                }
            }
        }
        return ontologyMap;
    } catch (error) {
        console.error(`Failed to load or parse ontology for sector: ${sector}`, error);
        return null;
    }
}
