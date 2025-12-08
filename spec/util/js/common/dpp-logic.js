import jsonld from 'jsonld';

const getValue = (node, property) => node?.[property]?.[0]?.['@value'];

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
 * Transforms an expanded EPD graph into an array of schema.org Certifications.
 * This is the core, environment-agnostic logic.
 * @param {object} expanded - The expanded JSON-LD graph.
 * @param {object} dictionary - The dictionary of indicator metadata.
 * @returns {Array} An array of schema.org certification objects.
 */
export function transformEPD(expanded, dictionary) {
    const productNode = expanded.find(n => n['https://dpp-keystone.org/spec/v1/terms#DPPID']);
    if (!productNode) throw new Error("Could not find the main Product node in the expanded graph.");

    const epdNode = productNode['https://dpp-keystone.org/spec/v1/terms#epd'][0];
    if (!epdNode) throw new Error("No EPD node found in the product!");

    const manufacturerNode = productNode['https://dpp-keystone.org/spec/v1/terms#manufacturer'][0];
    const manufacturerName = getValue(manufacturerNode, 'https://dpp-keystone.org/spec/v1/terms#organizationName') || 'Unknown';

    const certifications = [];

    for (const [indicatorUri, stagesIdList] of Object.entries(epdNode)) {
        if (indicatorUri.startsWith('@')) continue;

        const definition = dictionary[indicatorUri] || { unit: "Unknown", label: indicatorUri.split('#')[1] };
        
        const stagesNode = stagesIdList[0];
        if (!stagesNode) continue;

        for (const [stageUri, valueList] of Object.entries(stagesNode)) {
            if (stageUri.startsWith('@')) continue;
            
            const stageKey = stageUri.split('#')[1];
            const indicatorShortKey = indicatorUri.split('#')[1];
            const value = valueList[0]['@value'];

            certifications.push({
                "@context": "http://schema.org", "@type": "Certification",
                "name": `${indicatorShortKey}-${stageKey}`, "certificationStatus": "certificationActive",
                "issuedBy": { "@type": "Organization", "name": manufacturerName },
                "hasMeasurement": {
                    "@type": "PropertyValue", "name": `${definition.label} (${stageKey})`,
                    "value": Number(value), "unitText": definition.unit
                }
            });
        }
    }
    return certifications;
}
