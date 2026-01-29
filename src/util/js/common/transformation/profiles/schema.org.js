const getValue = (node, property) => node?.[property]?.[0]?.['@value'];
const getValues = (node, property) => node?.[property]?.map(p => p['@value']) ?? [];
const getNode = (node, property) => node?.[property]?.[0];
const getId = (node, property) => node?.[property]?.[0]?.['@id'];

/**
 * Transforms a DPP manufacturer node into a schema.org Organization.
 * @param {object} manufacturerNode - The expanded JSON-LD node for the manufacturer.
 * @returns {object} A schema.org Organization object.
 */
function toSchemaOrgOrganization(manufacturerNode) {
    if (!manufacturerNode) return null;
    
    const addressNode = getNode(manufacturerNode, 'https://dpp-keystone.org/spec/v1/terms#address');
    const address = addressNode ? {
        "@type": "PostalAddress",
        "streetAddress": getValue(addressNode, 'https://dpp-keystone.org/spec/v1/terms#streetAddress'),
        "postalCode": getValue(addressNode, 'https://dpp-keystone.org/spec/v1/terms#postalCode'),
        "addressLocality": getValue(addressNode, 'https://dpp-keystone.org/spec/v1/terms#addressLocality'),
        "addressCountry": getValue(addressNode, 'https://dpp-keystone.org/spec/v1/terms#addressCountry'),
    } : null;

    return {
        "@type": "Organization",
        "name": getValue(manufacturerNode, 'https://dpp-keystone.org/spec/v1/terms#organizationName'),
        "url": getValue(manufacturerNode, 'https://schema.org/url'),
        "email": getValue(manufacturerNode, 'https://schema.org/email'),
        "telephone": getValue(manufacturerNode, 'https://schema.org/telephone'),
        ...(address && { address }),
    };
}

/**
 * Transforms a DPP document link node into a schema.org DigitalDocument.
 * @param {object} docNode - The expanded JSON-LD node for the document link.
 * @returns {object} A schema.org DigitalDocument object.
 */
function toSchemaOrgDigitalDocument(docNode) {
    if (!docNode) return null;

    return {
        "@type": "DigitalDocument",
        "name": getValue(docNode, 'https://dpp-keystone.org/spec/v1/terms#resourceTitle'),
        // The context maps the DPP 'url' property to 'dppk:url', which is equivalent to 'schema:url'
        "url": getValue(docNode, 'https://dpp-keystone.org/spec/v1/terms#url'),
        "encodingFormat": getValue(docNode, 'https://dpp-keystone.org/spec/v1/terms#contentType'),
        "inLanguage": getValue(docNode, 'https://dpp-keystone.org/spec/v1/terms#language'),
    };
}

/**
 * Transforms a DPP QuantitativeValue node into a schema.org QuantitativeValue.
 * @param {object} node - The expanded JSON-LD node.
 * @returns {object} A schema.org QuantitativeValue object.
 */
function toSchemaQuantitativeValue(node) {
    if (!node) return undefined;
    const value = getValue(node, 'https://dpp-keystone.org/spec/v1/terms#value');
    const unitCode = getValue(node, 'https://dpp-keystone.org/spec/v1/terms#unitCode');
    
    if (value !== undefined) {
        return {
            "@type": "QuantitativeValue",
            "value": Number(value),
            ...(unitCode && { "unitCode": unitCode })
        };
    }
    return undefined;
}

function flattenImage(rootNode) {
    const images = rootNode['https://dpp-keystone.org/spec/v1/terms#image'];
    if (!images) return undefined;
    
    // images is an array of objects (RelatedResource nodes)
    return images.map(imgNode => {
        return getValue(imgNode, 'https://dpp-keystone.org/spec/v1/terms#url');
    }).filter(url => url);
}


/**
 * Transforms the root DPP node into a schema.org Product object.
 * @param {*} sourceData - The data from the source property (ignored).
 * @param {*} dictionary - The dictionary of indicator metadata (ignored).
 * @param {object} rootNode - The root product node from the expanded graph.
 * @returns {Array} An array containing the schema.org Product object.
 */
function dppToSchemaOrgProduct(sourceData, dictionary, rootNode) {
    const toTitleCase = (str) => {
        return str.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    };

    const product = {
        "@context": "http://schema.org",
        "@type": "Product",
        "@id": getId(rootNode, 'https://dpp-keystone.org/spec/v1/terms#uniqueProductIdentifier'),
        "name": getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#productName'),
        "description": getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#description'),
        "model": getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#model'),
        "brand": getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#brand'),
        "gtin": getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#gtin'),
        "sku": getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#sku'),
        "image": flattenImage(rootNode),
        "weight": toSchemaQuantitativeValue(getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#netWeight')),
        "width": toSchemaQuantitativeValue(getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#width')),
        "height": toSchemaQuantitativeValue(getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#height')),
        "depth": toSchemaQuantitativeValue(getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#depth')),
    };

    const manufacturerNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#manufacturer');
    if (manufacturerNode) {
        product.manufacturer = toSchemaOrgOrganization(manufacturerNode);
    }

    const dopcNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#dopc');

    if (dopcNode) {
        const properties = [];
        
        const flattenProperties = (node, parentName) => {
            for (const [uri, valueList] of Object.entries(node)) {
                if (uri.startsWith('@')) continue;
                
                // Get metadata from dictionary if available
                const meta = dictionary[uri] || {};
                const definedLabel = meta.label; // e.g. "Bond Strength (28 Days)"
                const unitText = meta.unit;      // e.g. "MPa"

                // If we have a defined label from the ontology, use it directly.
                // Otherwise, construct a name from the JSON key structure.
                // Note: If we are deep in recursion, we might want to combine parentName, 
                // BUT if the property URI itself is specific (e.g. bondStrengthAt28Days), the label is full.
                // If the property URI is generic (e.g. 'value'), we rely on parentName.
                
                const localName = uri.split('#')[1] || uri;
                let displayName;
                
                if (definedLabel && definedLabel !== localName) {
                    // Use the official label if it seems meaningful
                    displayName = definedLabel;
                } else {
                    // Fallback to title casing the URI fragment
                    const localDisplay = toTitleCase(localName);
                    displayName = parentName ? `${parentName} - ${localDisplay}` : localDisplay;
                }

                const valueItem = valueList[0];
                
                if (valueItem && valueItem['@value'] !== undefined) {
                    // It's a literal value
                    const propertyObj = {
                        "@type": "PropertyValue",
                        "name": displayName,
                        "value": valueItem['@value'],
                    };
                    
                    if (unitText) {
                        propertyObj.unitText = unitText;
                    }
                    
                    properties.push(propertyObj);
                } else if (valueItem && typeof valueItem === 'object') {
                    // It's a nested node. Recurse.
                    // If this node corresponds to a specific property (e.g. bondStrength), 
                    // we pass its label as the parent name for children IF children are generic.
                    // But in the new structure, children are often specific (e.g. bondStrengthAt28Days).
                    // If children are specific, they will ignore the parentName in the 'if(definedLabel)' block above.
                    
                    // We pass the fallback name just in case.
                    const localDisplay = toTitleCase(localName);
                    const nextParentName = parentName ? `${parentName} - ${localDisplay}` : localDisplay;
                    
                    flattenProperties(valueItem, nextParentName);
                }
            }
        };

        // Check for 'essentialCharacteristics' array (intermediate structure)
        const characteristics = dopcNode['https://dpp-keystone.org/spec/v1/terms#essentialCharacteristics'];
        if (characteristics && Array.isArray(characteristics)) {
             // Handle the "List of Characteristics" style (Intermediate)
             for (const charNode of characteristics) {
                const name = getValue(charNode, 'https://dpp-keystone.org/spec/v1/terms#characteristicName');
                const value = getValue(charNode, 'https://dpp-keystone.org/spec/v1/terms#characteristicValue');
                if (name && value) {
                    properties.push({
                        "@type": "PropertyValue",
                        "name": name,
                        "value": value,
                    });
                }
            }
        } else {
             // Handle Recursive Structure (New & Legacy)
             flattenProperties(dopcNode, '');
        }

        if (properties.length > 0) {
            product.additionalProperty = properties;
        }
    }

    const instructionsNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#instructionsForUse');
    if (instructionsNode) {
        product.instructionsForUse = toSchemaOrgDigitalDocument(instructionsNode);
    }

    const safetySheetNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#safetyDataSheet');
    if (safetySheetNode) {
        product.safetyDataSheet = toSchemaOrgDigitalDocument(safetySheetNode);
    }
    
    // Nest EPD Certifications
    const epdNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#epd');
    if (epdNode) {
        const certifications = epdToSchemaOrgCertifications(epdNode, dictionary, rootNode);
        if (certifications && certifications.length > 0) {
            product.hasCertification = certifications;
        }
    }

    return [product];
}


/**
 * Transforms the EPD part of a DPP into a single schema.org Certification object
 * with all indicators listed as `hasMeasurement` properties.
 * @param {object} epdData - The expanded JSON-LD node for the EPD.
 * @param {object} dictionary - The dictionary of indicator metadata.
 * @param {object} parentNode - The root product node from the expanded graph.
 * @returns {Array} An array containing the single schema.org certification object.
 */
function epdToSchemaOrgCertifications(epdData, dictionary, parentNode) {
    const manufacturerList = parentNode['https://dpp-keystone.org/spec/v1/terms#manufacturer'];
    const manufacturerNode = manufacturerList ? manufacturerList[0] : null;
    const manufacturerName = manufacturerNode 
        ? (getValue(manufacturerNode, 'https://dpp-keystone.org/spec/v1/terms#organizationName') || 'Unknown') 
        : 'Unknown';

    const measurements = [];

    for (const [indicatorUri, stagesIdList] of Object.entries(epdData)) {
        if (indicatorUri.startsWith('@')) continue;

        const definition = dictionary[indicatorUri] || { unit: "Unknown", label: indicatorUri.split('#')[1] };
        
        const stagesNode = stagesIdList[0];
        if (!stagesNode) continue;

        for (const [stageUri, valueList] of Object.entries(stagesNode)) {
            if (stageUri.startsWith('@')) continue;
            
            const stageKey = stageUri.split('#')[1];
            const value = valueList[0]['@value'];

            measurements.push({
                "@type": "PropertyValue",
                "name": `${definition.label} (${stageKey})`,
                "value": Number(value),
                "unitText": definition.unit,
                "propertyID": indicatorUri.split('#')[1] + '-' + stageKey
            });
        }
    }
    
    // Only return a certification if there were measurements to add
    if (measurements.length === 0) {
        return [];
    }

    const certification = {
        "@context": "http://schema.org",
        "@type": "Certification",
        "name": "Environmental Product Declaration",
        "certificationStatus": "certificationActive",
        "issuedBy": { "@type": "Organization", "name": manufacturerName },
        "hasMeasurement": measurements
    };

    return [certification];
}


export const profile = {
    // Defines which transformations to run
    transformations: [
      {
        source: 'https://dpp-keystone.org/spec/v1/terms#digitalProductPassportId',
        transformer: dppToSchemaOrgProduct
      }
    ]
  };