import { loadOntology } from './ontology-loader.js?v=1769696486423';

/**
 * Builds a flat, searchable index of all ontology terms.
 * @returns {Promise<Array<{id: string, label: string, comment: string, unit: string, source: string, domain: string, range: string}>>}
 */
export async function buildIndex() {
    const ontologyMap = await loadOntology('dpp');
    if (!ontologyMap) {
        console.error("Failed to load ontology for index.");
        return [];
    }

    const index = [];
    for (const [key, value] of ontologyMap.entries()) {
        let docUrl = null;
        let contextLabel = '';
        let contextDocUrl = null;

        if (value.definedIn) {
            const { type: modType, name: modName } = value.definedIn;
            // Format context label (e.g. "Core / Product")
            const prettyType = modType.charAt(0).toUpperCase() + modType.slice(1);
            contextLabel = `${prettyType} / ${modName}`;
            contextDocUrl = `../spec/ontology/v1/${modType}/${modName}/index.html`;

            // Determine if it's a Class or Property to generate the correct URL
            const rdfTypes = Array.isArray(value.type) ? value.type : [value.type];
            const isClass = rdfTypes.includes('rdfs:Class') || rdfTypes.includes('owl:Class');
            
            // Construct relative path to generated docs
            if (isClass) {
                docUrl = `../spec/ontology/v1/${modType}/${modName}/${key}.html`;
            } else {
                // Properties are anchored in the module index
                docUrl = `../spec/ontology/v1/${modType}/${modName}/index.html#${key}`;
            }
        }

        // Resolve Domain Link
        let domainLabel = '';
        let domainDocUrl = null;
        if (value.domain) {
            domainLabel = typeof value.domain === 'string' ? value.domain : value.domain['@id'];
            
            // Try to resolve the domain to a class in our map to find its documentation
            let domainKey = domainLabel;
            if (domainKey.includes(':')) {
                domainKey = domainKey.split(':')[1];
            }

            const domainClass = ontologyMap.get(domainKey);
            if (domainClass && domainClass.definedIn) {
                const { type: dType, name: dName } = domainClass.definedIn;
                domainDocUrl = `../spec/ontology/v1/${dType}/${dName}/${domainKey}.html`;
            }
        }

        index.push({
            id: key,
            // Prefer English, fall back to first available, or empty string
            label: value.label?.en || (value.label ? Object.values(value.label)[0] : '') || key,
            comment: value.comment?.en || (value.comment ? Object.values(value.comment)[0] : '') || '',
            unit: value.unit,
            source: value.source,
            domain: domainLabel,
            domainDocUrl: domainDocUrl,
            range: value.range,
            governedBy: value.governedBy,
            contextLabel: contextLabel,
            contextDocUrl: contextDocUrl,
            docUrl: docUrl
        });
    }

    // Sort alphabetically by ID for consistency
    return index.sort((a, b) => a.id.localeCompare(b.id));
}
