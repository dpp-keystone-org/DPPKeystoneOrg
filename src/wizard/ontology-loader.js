// src/wizard/ontology-loader.js

/**
 * Fetches and parses a JSON-LD ontology file to extract label and comment metadata for its terms.
 * @param {string} sector - The sector whose ontology needs to be loaded (e.g., 'construction').
 * @returns {Promise<Map<string, {label: string, comment: string}>>} A map where keys are term IDs (IRIs) 
 * and values are objects containing the term's label and comment.
 */
export async function loadOntology(sector) {
    const ontologyMap = new Map();
    // Assumption: a sector name like 'construction' maps to a file named 'Construction.jsonld'
    const sectorPascalCase = sector.charAt(0).toUpperCase() + sector.slice(1);
    const url = `../ontology/v1/sectors/${sectorPascalCase}.jsonld`;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const ontology = await response.json();

        if (ontology['@graph']) {
            for (const term of ontology['@graph']) {
                if (term['@id'] && (term['rdfs:label'] || term['rdfs:comment'])) {
                    const label = term['rdfs:label'] ? term['rdfs:label']['@value'] : '';
                    const comment = term['rdfs:comment'] ? term['rdfs:comment']['@value'] : '';
                    
                    ontologyMap.set(term['@id'], {
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
