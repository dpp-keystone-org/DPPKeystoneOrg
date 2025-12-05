
import { parse as jsoncParse } from 'jsonc-parser';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';

// Using a global dictionary with memoization to avoid re-building on every call
const dictionary = {};

/**
 * Parses the ontology files to build a dictionary of indicator metadata.
 * This makes the transformation logic data-driven, not hardcoded.
 * @param {string[]} ontologyPaths - An array of paths to ontology files.
 * @param {Function} documentLoader - The JSON-LD document loader.
 */
async function buildDictionary(ontologyPaths, documentLoader) {
    if (Object.keys(dictionary).length > 0) return dictionary;

    for (const ontologyPath of ontologyPaths) {
        const content = fs.readFileSync(ontologyPath, 'utf-8');
        const ontology = jsoncParse(content);
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
    return dictionary;
}

const getValue = (node, property) => node?.[property]?.[0]?.['@value'];

/**
 * The main Adapter function. It learns from the ontology and transforms the expanded graph.
 * @param {object} productDoc - The raw DPP JSON document.
 * @param {Function} documentLoader - The JSON-LD document loader.
 * @returns {Array} An array of schema.org certification objects.
 */
export async function EPDAdapter(productDoc, ontologyPaths, documentLoader) {
    const dictionary = await buildDictionary(ontologyPaths, documentLoader);

    const expanded = await jsonld.expand(productDoc, { documentLoader });
    
    const productNode = expanded.find(n => n['https://dpp-keystone.org/spec/v1/terms#DPPID']);
    if (!productNode) throw new Error("Could not find the main Product node in the expanded graph.");

    const epdsNode = productNode['https://dpp-keystone.org/spec/v1/terms#epds'][0];
    if (!epdsNode) throw new Error("No EPDs node found in the product!");

    const manufacturerNode = productNode['https://dpp-keystone.org/spec/v1/terms#manufacturer'][0];
    const manufacturerName = getValue(manufacturerNode, 'https://dpp-keystone.org/spec/v1/terms#organizationName') || 'Unknown';

    const certifications = [];

    for (const [indicatorUri, stagesIdList] of Object.entries(epdsNode)) {
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
