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
 * Recursively flattens a nested DPP node into an array of schema.org PropertyValues.
 * @param {object} node - The node to flatten.
 * @param {string} parentName - The accumulated name prefix.
 * @param {object} dictionary - The dictionary of indicator metadata.
 * @returns {Array} An array of PropertyValue objects.
 */
function flattenToAdditionalProperties(node, parentName, dictionary) {
    const properties = [];
    const toTitleCase = (str) => {
        return str.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    };

    const recurse = (currentNode, currentParentName) => {
        for (const [uri, valueList] of Object.entries(currentNode)) {
             if (uri.startsWith('@')) continue;

             const meta = dictionary[uri] || {};
             const definedLabel = meta.label;
             const unitText = meta.unit;
             
             const localName = uri.split('#')[1] || uri;
             let displayName;
             
             // Logic to decide display name: Use explicit label if available and distinct, 
             // otherwise build path.
             if (definedLabel && definedLabel !== localName) {
                 displayName = definedLabel;
             } else {
                 const localDisplay = toTitleCase(localName);
                 displayName = currentParentName ? `${currentParentName} - ${localDisplay}` : localDisplay;
             }
             
             const valueItem = valueList[0];
             if (valueItem && valueItem['@value'] !== undefined) {
                  const propertyObj = {
                        "@type": "PropertyValue",
                        "name": displayName,
                        "value": valueItem['@value'],
                    };
                    if (unitText) propertyObj.unitText = unitText;
                    properties.push(propertyObj);
             } else if (valueItem && typeof valueItem === 'object') {
                  // For recursion, we always append the path segment to ensure uniqueness 
                  // and context, unless the child logic overrides it (which it won't here easily).
                  const localDisplay = toTitleCase(localName);
                  const nextParentName = currentParentName ? `${currentParentName} - ${localDisplay}` : localDisplay;
                  recurse(valueItem, nextParentName);
             }
        }
    };

    recurse(node, parentName);
    return properties;
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
        let properties = [];
        
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
             properties = flattenToAdditionalProperties(dopcNode, '', dictionary);
        }

        if (properties.length > 0) {
            product.additionalProperty = properties;
        }
    }

    // --- Core Parity Additions (v1.1) ---

    // 1. HS Code
    const hsCode = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#hsCode');
    if (hsCode) {
        const hsObj = {
            "@type": "PropertyValue",
            "propertyID": "HS Code",
            "value": hsCode
        };
        // Normalize identifier to array if needed, or append
        if (Array.isArray(product.identifier)) {
            product.identifier.push(hsObj);
        } else if (product.identifier) {
            product.identifier = [product.identifier, hsObj];
        } else {
            product.identifier = hsObj;
        }
    }

    // 2. Recycled Content
    const recycledPct = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#recycledContentPercentage');
    if (recycledPct !== undefined) {
         if (!product.additionalProperty) product.additionalProperty = [];
         product.additionalProperty.push({
             "@type": "PropertyValue",
             "name": "Recycled Content",
             "value": Number(recycledPct),
             "unitText": "%"
         });
    }

    // 3. Root Product Characteristics (List)
    const rootCharacteristics = rootNode['https://dpp-keystone.org/spec/v1/terms#productCharacteristics'];
    if (rootCharacteristics && Array.isArray(rootCharacteristics)) {
         if (!product.additionalProperty) product.additionalProperty = [];
         for (const charNode of rootCharacteristics) {
             const name = getValue(charNode, 'https://dpp-keystone.org/spec/v1/terms#characteristicName');
             const value = getValue(charNode, 'https://dpp-keystone.org/spec/v1/terms#characteristicValue');
             if (name && value) {
                 product.additionalProperty.push({
                     "@type": "PropertyValue",
                     "name": name,
                     "value": value,
                 });
             }
         }
    }

    // 4. Components -> hasPart
    const components = rootNode['https://dpp-keystone.org/spec/v1/terms#component'];
    if (components && Array.isArray(components)) {
        product.hasPart = components.map(c => ({
             "@type": "Product", 
             "name": getValue(c, 'https://dpp-keystone.org/spec/v1/terms#componentName')
        }));
    }

    // --- Battery Parity Additions (v1.1) ---
    
    // Manufacturing Date -> productionDate
    const mfgDate = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#manufacturingDate');
    if (mfgDate) {
        product.productionDate = mfgDate;
    }

    // Warranty -> warranty
    const warranty = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#warrantyPeriod');
    if (warranty) {
        product.warranty = warranty;
    }

    // Battery Mass -> weight (if not already set)
    if (!product.weight) {
        const batteryMass = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#batteryMass');
        if (batteryMass) {
            product.weight = {
                "@type": "QuantitativeValue",
                "value": Number(batteryMass),
                "unitCode": "KGM" // Assuming kg, ideally strictly checked or from context
            };
        }
    }

    // Performance (Nested)
    const performanceNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#performance');
    if (performanceNode) {
        const perfProps = flattenToAdditionalProperties(performanceNode, 'Performance', dictionary);
        if (perfProps.length > 0) {
             if (!product.additionalProperty) product.additionalProperty = [];
             product.additionalProperty.push(...perfProps);
        }
    }

    // --- Construction Parity Additions (v1.1) ---

    // 1. DoP Identifier
    const dopId = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#dopIdentifier');
    if (dopId) {
        const dopObj = {
            "@type": "PropertyValue",
            "propertyID": "DoP ID",
            "value": dopId
        };
        if (Array.isArray(product.identifier)) {
            product.identifier.push(dopObj);
        } else if (product.identifier) {
            product.identifier = [product.identifier, dopObj];
        } else {
            product.identifier = dopObj;
        }
    }

    // 2. Harmonised Standard Reference
    const hStd = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#harmonisedStandardReference');
    if (hStd) {
        if (!product.additionalProperty) product.additionalProperty = [];
        product.additionalProperty.push({
            "@type": "PropertyValue",
            "name": "Harmonised Standard Reference",
            "value": hStd
        });
    }

    // 3. Notified Body
    const notifiedBodyNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#notifiedBody');
    if (notifiedBodyNode) {
        const nbName = getValue(notifiedBodyNode, 'https://dpp-keystone.org/spec/v1/terms#organizationName');
        if (nbName) {
            if (!product.additionalProperty) product.additionalProperty = [];
            product.additionalProperty.push({
                "@type": "PropertyValue",
                "name": "Notified Body",
                "value": nbName
            });
        }
    }

    // ------------------------------------

    const instructionsNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#instructionsForUse');
    if (instructionsNode) {
        product.instructionsForUse = toSchemaOrgDigitalDocument(instructionsNode);
    }

    // --- Electronics Parity Additions (v1.1) ---
    const electronicsProps = [
        { term: 'ipRating', label: 'IP Rating' },
        { term: 'energyEfficiencyClass', label: 'Energy Efficiency Class' },
        { term: 'sparePartsAvailable', label: 'Spare Parts Available' },
        { term: 'voltage', label: 'Voltage' }, // If simple value
        { term: 'torque', label: 'Torque' },
        { term: 'ratedPower', label: 'Rated Power' },
        { term: 'maximumRatedSpeed', label: 'Maximum Rated Speed' }
    ];

    electronicsProps.forEach(prop => {
        const val = getValue(rootNode, `https://dpp-keystone.org/spec/v1/terms#${prop.term}`);
        if (val !== undefined) {
            if (!product.additionalProperty) product.additionalProperty = [];
            product.additionalProperty.push({
                "@type": "PropertyValue",
                "name": prop.label,
                "value": val
            });
        }
    });

    // --- General Product Parity Additions (v1.1) ---

    // 1. Color
    const color = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#color');
    if (color) {
        product.color = color;
    }

    // 2. Country of Origin
    const country = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#countryOfOrigin');
    if (country) {
        product.countryOfOrigin = {
            "@type": "Country",
            "name": country
        };
    }

    // 3. Length -> depth (if not already set by depth)
    if (!product.depth) {
        const lenVal = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#length');
        if (lenVal !== undefined) {
             product.depth = {
                "@type": "QuantitativeValue",
                "value": Number(lenVal),
                "unitCode": "MTR" // Defaulting to meters as per context hint
            };
        } else {
            // Fallback for complex object if needed
            const lengthNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#length');
            if (lengthNode) {
                product.depth = toSchemaQuantitativeValue(lengthNode);
            }
        }
    }

    // 4. Gross Weight
    const grossWeight = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#grossWeight');
    // Note: grossWeight in context is simple literal or QV? Context said "@type": "KgWeightLiteral", which resolves to value/unit.
    // Wait, context said "KgWeightLiteral" is a datatype? No, it's a class in context?
    // "netWeight": { "@id": "dppk:netWeight", "@type": "KgWeightLiteral" } 
    // And "KgWeightLiteral": "dppk:KgWeightLiteral".
    // Usually that means it's a type like xsd:double but custom. 
    // If json-ld expansion keeps it as value object with type, `getValue` works if it's `@value`.
    // If it expands to a node, we need `toSchemaQuantitativeValue`.
    // Let's assume it behaves like netWeight/weight which uses `toSchemaQuantitativeValue` in the code I read.
    // Wait, `weight` code uses `toSchemaQuantitativeValue`.
    // Let's check `toSchemaQuantitativeValue`: it looks for `dppk:value` inside. 
    // If `grossWeight` is just a number in JSON but context types it, the expansion depends on the loader.
    // In the test mock, I defined it as `"@type": "xsd:double"`. So it will be a literal value.
    // `toSchemaQuantitativeValue` expects an object with `value`.
    // If it's a literal, `getValue` works.
    // Let's handle both or check test. Test uses `grossWeight: 5.0`.
    // If it's xsd:double, it expands to `[{ "@value": 5.0 }]`.
    // `toSchemaQuantitativeValue` checks `dppk:value` property. It won't work on a literal.
    // So for Gross Weight (which might be simple literal in some contexts or complex), let's try simple first.
    const gwVal = getValue(rootNode, 'https://dpp-keystone.org/spec/v1/terms#grossWeight');
    if (gwVal !== undefined) {
        if (!product.additionalProperty) product.additionalProperty = [];
        product.additionalProperty.push({
            "@type": "PropertyValue",
            "name": "Gross Weight",
            "value": Number(gwVal),
            "unitText": "kg" // Defaulting since implicit in context often
        });
    }

    // 5. Components (Plural) -> hasPart
    // Merge with existing components (Singular)
    let componentsPlural = rootNode['https://dpp-keystone.org/spec/v1/terms#components'];
    
    // Check for @list wrapper (Standard JSON-LD expansion for @list container)
    if (componentsPlural && componentsPlural.length > 0 && componentsPlural[0]['@list']) {
        componentsPlural = componentsPlural[0]['@list'];
    }

    if (componentsPlural && Array.isArray(componentsPlural)) {
        const newParts = componentsPlural.map(c => {
             // If c is just a node (from @list), getting name might be direct
             // Context maps "components": { "@container": "@list" }
             // List items are nodes.
             return {
                 "@type": "Product",
                 "name": getValue(c, 'https://dpp-keystone.org/spec/v1/terms#componentName') || getValue(c, 'https://dpp-keystone.org/spec/v1/terms#name')
             };
        });
        
        if (product.hasPart) {
            product.hasPart = product.hasPart.concat(newParts);
        } else {
            product.hasPart = newParts;
        }
    }

    // 6. Additional Certifications -> hasCertification
    const addCerts = rootNode['https://dpp-keystone.org/spec/v1/terms#additionalCertifications'];
    if (addCerts && Array.isArray(addCerts)) {
        const newCerts = addCerts.map(c => ({
            "@type": "Certification",
            "name": getValue(c, 'https://dpp-keystone.org/spec/v1/terms#certificationBodyName') || "Unknown Certification",
            "startDate": getValue(c, 'https://dpp-keystone.org/spec/v1/terms#certificationStartDate')
        }));

        if (product.hasCertification) {
             // Ensure array
             if (!Array.isArray(product.hasCertification)) product.hasCertification = [product.hasCertification];
             product.hasCertification = product.hasCertification.concat(newCerts);
        } else {
            product.hasCertification = newCerts;
        }
    }

    // --- Packaging Parity Additions (v1.1) ---

    // Packaging -> hasPart
    const packaging = rootNode['https://dpp-keystone.org/spec/v1/terms#packaging'];
    if (packaging && Array.isArray(packaging)) {
        const packParts = packaging.map(p => {
            const material = getValue(p, 'https://dpp-keystone.org/spec/v1/terms#packagingMaterialType') || 'Unknown Material';
            const part = {
                "@type": "Product", // Treated as a sub-product/part
                "name": `Packaging - ${material}`,
                "additionalProperty": []
            };

            // Recycled Content
            const rec = getValue(p, 'https://dpp-keystone.org/spec/v1/terms#packagingRecycledContent');
            if (rec !== undefined) {
                part.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": "Recycled Content",
                    "value": Number(rec),
                    "unitText": "%"
                });
            }

            // Process Type
            const proc = getValue(p, 'https://dpp-keystone.org/spec/v1/terms#packagingRecyclingProcessType');
            if (proc) {
                 part.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": "Recycling Process",
                    "value": proc
                });
            }

            // Quantity -> weight
            // Check for literal first (as per test) or object
            const qtyVal = getValue(p, 'https://dpp-keystone.org/spec/v1/terms#packagingMaterialCompositionQuantity');
            if (qtyVal !== undefined) {
                part.weight = {
                    "@type": "QuantitativeValue",
                    "value": Number(qtyVal),
                    "unitCode": "KGM" // Assumption
                };
            }

            if (part.additionalProperty.length === 0) delete part.additionalProperty;
            return part;
        });

        if (product.hasPart) {
             product.hasPart = product.hasPart.concat(packParts);
        } else {
            product.hasPart = packParts;
        }
    }

    // ------------------------------------

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