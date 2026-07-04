const getValue = (node, property) => node?.[property]?.[0]?.['@value'];
const getValues = (node, property) => node?.[property]?.map(p => p['@value']) ?? [];
const getNode = (node, property) => node?.[property]?.[0];
const getId = (node, property) => node?.[property]?.[0]?.['@id'];

/**
 * Transforms a DPP manufacturer node into a schema.org Organization.
 * @param {object} manufacturerNode - The expanded JSON-LD node for the manufacturer.
 * @returns {object} A schema.org Organization object.
 */
function toSchemaOrgOrganization(manufacturerNode, termsBase) {
    if (!manufacturerNode) return null;
    
    const addressNode = getNode(manufacturerNode, `${termsBase}address`);
    const address = addressNode ? {
        "@type": "PostalAddress",
        "streetAddress": getValue(addressNode, `${termsBase}streetAddress`),
        "postalCode": getValue(addressNode, `${termsBase}postalCode`),
        "addressLocality": getValue(addressNode, `${termsBase}addressLocality`),
        "addressCountry": getValue(addressNode, `${termsBase}addressCountry`),
    } : null;

    const org = {
        "@type": "Organization",
        "name": getValue(manufacturerNode, `${termsBase}organizationName`),
        "alternateName": getValue(manufacturerNode, `${termsBase}tradingName`),
        "url": getValue(manufacturerNode, `${termsBase}website`) || getValue(manufacturerNode, 'https://schema.org/url'),
        "email": getValue(manufacturerNode, `${termsBase}email`) || getValue(manufacturerNode, 'https://schema.org/email'),
        "telephone": getValue(manufacturerNode, `${termsBase}telephone`) || getValue(manufacturerNode, 'https://schema.org/telephone'),
        "globalLocationNumber": getValue(manufacturerNode, `${termsBase}gln`),
        "leiCode": getValue(manufacturerNode, `${termsBase}leiCode`),
        ...(address && { address }),
    };

    const addOrgId = getValue(manufacturerNode, `${termsBase}additionalOrganizationId`);
    if (addOrgId) {
        org.identifier = {
            "@type": "PropertyValue",
            "propertyID": getValue(manufacturerNode, `${termsBase}additionalOrganizationIdType`) || "Additional ID",
            "value": addOrgId
        };
    }

    Object.keys(org).forEach(key => org[key] === undefined && delete org[key]);
    return org;
}

/**
 * Transforms a DPP document link node into a schema.org DigitalDocument.
 * @param {object} docNode - The expanded JSON-LD node for the document link.
 * @returns {object} A schema.org DigitalDocument object.
 */
function toSchemaOrgDigitalDocument(docNode, termsBase) {
    if (!docNode) return null;

    return {
        "@type": "DigitalDocument",
        "name": getValue(docNode, `${termsBase}resourceTitle`),
        // The context maps the DPP 'url' property to 'dppk:url', which is equivalent to 'schema:url'
        "url": getValue(docNode, `${termsBase}url`),
        "encodingFormat": getValue(docNode, `${termsBase}contentType`),
        "inLanguage": getValue(docNode, `${termsBase}language`),
    };
}

/**
 * Transforms a DPP QuantitativeValue node into a schema.org QuantitativeValue.
 * @param {object} node - The expanded JSON-LD node.
 * @returns {object} A schema.org QuantitativeValue object.
 */
function toSchemaQuantitativeValue(node, termsBase) {
    if (!node) return undefined;
    const value = getValue(node, `${termsBase}value`);
    const unitCode = getValue(node, `${termsBase}unitCode`);
    
    if (value !== undefined) {
        return {
            "@type": "QuantitativeValue",
            "value": Number(value),
            ...(unitCode && { "unitCode": unitCode })
        };
    }
    return undefined;
}

function flattenImage(rootNode, termsBase) {
    const images = rootNode[`${termsBase}image`];
    if (!images) return undefined;
    
    // images is an array of objects (RelatedResource nodes)
    return images.map(imgNode => {
        return getValue(imgNode, `${termsBase}url`);
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
function dppToSchemaOrgProduct(sourceData, dictionary, rootNode, version) {
    const termsBase = `https://dpp-keystone.org/spec/${version}/terms#`;
    
    const toTitleCase = (str) => {
        return str.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
    };

    const product = {
        "@context": "http://schema.org",
        "@type": "Product",
        "@id": getId(rootNode, `${termsBase}uniqueProductIdentifier`),
        "name": getValue(rootNode, `${termsBase}productName`),
        "description": getValue(rootNode, `${termsBase}description`),
        "model": getValue(rootNode, `${termsBase}model`),
        "brand": getValue(rootNode, `${termsBase}brand`),
        "gtin": getValue(rootNode, `${termsBase}gtin`),
        "sku": getValue(rootNode, `${termsBase}sku`),
        "image": flattenImage(rootNode, termsBase),
        "weight": toSchemaQuantitativeValue(getNode(rootNode, `${termsBase}netWeight`), termsBase),
        "width": toSchemaQuantitativeValue(getNode(rootNode, `${termsBase}width`), termsBase),
        "height": toSchemaQuantitativeValue(getNode(rootNode, `${termsBase}height`), termsBase),
        "depth": toSchemaQuantitativeValue(getNode(rootNode, `${termsBase}depth`), termsBase),
    };

    // Generic dppk:identifier
    const genericId = getValue(rootNode, `${termsBase}identifier`);
    if (genericId) {
        if (!product.identifier) product.identifier = [];
        else if (!Array.isArray(product.identifier)) product.identifier = [product.identifier];
        product.identifier.push({ "@type": "PropertyValue", "propertyID": "Identifier", "value": genericId });
    }

    // --- Core DPP Header Metadata ---
    const headerProps = [
        { term: 'digitalProductPassportId', label: 'DPP ID', isIdentifier: true },
        { term: 'economicOperatorId', label: 'Economic Operator ID', isIdentifier: true },
        { term: 'facilityId', label: 'Facility ID', isIdentifier: true },
        { term: 'granularity', label: 'DPP Granularity' },
        { term: 'dppStatus', label: 'DPP Status' },
        { term: 'lastUpdate', label: 'DPP Last Update' },
        { term: 'versionNumber', label: 'DPP Version' },
        { term: 'versionDate', label: 'DPP Version Date' },
        { term: 'dppSchemaVersion', label: 'DPP Schema Version' }
    ];

    headerProps.forEach(prop => {
        const val = getValue(rootNode, `${termsBase}${prop.term}`);
        if (val !== undefined) {
            if (prop.isIdentifier) {
                const idObj = { "@type": "PropertyValue", "propertyID": prop.label, "value": val };
                if (Array.isArray(product.identifier)) product.identifier.push(idObj);
                else if (product.identifier) product.identifier = [product.identifier, idObj];
                else product.identifier = [idObj];
            } else {
                if (!product.additionalProperty) product.additionalProperty = [];
                product.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": prop.label,
                    "value": val
                });
            }
        }
    });

    const specIds = rootNode[`${termsBase}contentSpecificationIds`];
    if (specIds && Array.isArray(specIds)) {
        specIds.forEach(spec => {
            const val = spec['@value'] || spec['@id'];
            if (val !== undefined) {
                if (!product.additionalProperty) product.additionalProperty = [];
                product.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": "DPP Content Specifications",
                    "value": val
                });
            }
        });
    }

    const manufacturerNode = getNode(rootNode, `${termsBase}manufacturer`);
    if (manufacturerNode) {
        product.manufacturer = toSchemaOrgOrganization(manufacturerNode, termsBase);
    }

    const dopcTermsBase = `https://dpp-keystone.org/spec/${version}/terms/dopc#`;
    const dopcNode = getNode(rootNode, `${termsBase}dopc`);

    if (dopcNode) {
        // 1. DoP Identifier
        const dopId = getValue(dopcNode, `${dopcTermsBase}declarationCode`);
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

        let properties = [];
        
        // Check for 'essentialCharacteristics' array (intermediate structure)
        const characteristics = dopcNode[`${dopcTermsBase}essentialCharacteristics`];
        if (characteristics && Array.isArray(characteristics)) {
             // Handle the "List of Characteristics" style (Intermediate)
             for (const charNode of characteristics) {
                const name = getValue(charNode, `${termsBase}characteristicName`);
                const value = getValue(charNode, `${termsBase}characteristicValue`);
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
            // Filter out declarationCode if flattenToAdditionalProperties included it
            properties = properties.filter(p => !p.name.match(/declaration\s*code/i));
            if (properties.length > 0) {
                if (!product.additionalProperty) product.additionalProperty = [];
                product.additionalProperty.push(...properties);
            }
        }
    }

    // --- Core Parity Additions (v1.1) ---

    // 1. HS Code
    const hsCode = getValue(rootNode, `${termsBase}hsCode`);
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
    const recycledPct = getValue(rootNode, `${termsBase}recycledContentPercentage`);
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
    const rootCharacteristics = rootNode[`${termsBase}productCharacteristics`];
    if (rootCharacteristics && Array.isArray(rootCharacteristics)) {
         if (!product.additionalProperty) product.additionalProperty = [];
         for (const charNode of rootCharacteristics) {
             const name = getValue(charNode, `${termsBase}characteristicName`);
             const value = getValue(charNode, `${termsBase}characteristicValue`);
             if (name && value) {
                 product.additionalProperty.push({
                     "@type": "PropertyValue",
                     "name": name,
                     "value": value,
                 });
             }
         }
    }

    // 4. Components -> hasPart (handled in General Product Parity section)

    // --- Battery Parity Additions (v1.1) ---
    
    // Manufacturing Date -> productionDate
    const mfgDate = getValue(rootNode, `${termsBase}manufacturingDate`);
    if (mfgDate) {
        product.productionDate = mfgDate;
    }

    // Warranty -> warranty
    const warranty = getValue(rootNode, `${termsBase}warrantyPeriod`);
    if (warranty) {
        product.warranty = warranty;
    }

    // Battery Mass -> weight (if not already set)
    if (!product.weight) {
        const batteryMass = getValue(rootNode, `${termsBase}batteryMass`);
        if (batteryMass) {
            product.weight = {
                "@type": "QuantitativeValue",
                "value": Number(batteryMass),
                "unitCode": "KGM" // Assuming kg, ideally strictly checked or from context
            };
        }
    }

    // Performance (Nested)
    const performanceNode = getNode(rootNode, `${termsBase}performance`);
    if (performanceNode) {
        const perfProps = flattenToAdditionalProperties(performanceNode, 'Performance', dictionary);
        if (perfProps.length > 0) {
             if (!product.additionalProperty) product.additionalProperty = [];
             product.additionalProperty.push(...perfProps);
        }
    }

    // --- Construction Parity Additions (v1.1) ---

    // 1. Harmonised Standard Reference
    const hStd = getValue(rootNode, `${termsBase}harmonisedStandardReference`);
    if (hStd) {
        if (!product.additionalProperty) product.additionalProperty = [];
        product.additionalProperty.push({
            "@type": "PropertyValue",
            "name": "Harmonised Standard Reference",
            "value": hStd
        });
    }

    // 3. Notified Body
    const notifiedBodyNode = getNode(rootNode, `${termsBase}notifiedBody`);
    if (notifiedBodyNode) {
        const nbName = getValue(notifiedBodyNode, `${termsBase}organizationName`);
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

    const instructionsNode = getNode(rootNode, `${termsBase}instructionsForUse`);
    if (instructionsNode) {
        product.instructionsForUse = toSchemaOrgDigitalDocument(instructionsNode, termsBase);
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
        const val = getValue(rootNode, `${termsBase}${prop.term}`);
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
    const color = getValue(rootNode, `${termsBase}color`);
    if (color) {
        product.color = color;
    }

    // 2. Country of Origin
    const country = getValue(rootNode, `${termsBase}countryOfOrigin`);
    if (country) {
        product.countryOfOrigin = {
            "@type": "Country",
            "name": country
        };
    }

    // 3. Length -> depth (if not already set by depth)
    if (!product.depth) {
        const lenVal = getValue(rootNode, `${termsBase}length`);
        if (lenVal !== undefined) {
             product.depth = {
                "@type": "QuantitativeValue",
                "value": Number(lenVal),
                "unitCode": "MTR" // Defaulting to meters as per context hint
            };
        } else {
            // Fallback for complex object if needed
            const lengthNode = getNode(rootNode, `${termsBase}length`);
            if (lengthNode) {
                product.depth = toSchemaQuantitativeValue(lengthNode, termsBase);
            }
        }
    }

    // 4. Gross Weight
    const grossWeight = getNode(rootNode, `${termsBase}grossWeight`);
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
    const gwVal = getValue(rootNode, `${termsBase}grossWeight`);
    if (gwVal !== undefined) {
        if (!product.additionalProperty) product.additionalProperty = [];
        product.additionalProperty.push({
            "@type": "PropertyValue",
            "name": "Gross Weight",
            "value": Number(gwVal),
            "unitText": "kg" // Defaulting since implicit in context often
        });
    }

    // 5. Components -> hasPart
    let components = rootNode[`${termsBase}components`];
    
    // Check for @list wrapper (Standard JSON-LD expansion for @list container)
    if (components && components.length > 0 && components[0]['@list']) {
        components = components[0]['@list'];
    }

    if (components && Array.isArray(components)) {
        const newParts = components.map(c => {
             return {
                 "@type": "Product",
                 "name": getValue(c, `${termsBase}componentName`)
             };
        });
        
        if (product.hasPart) {
            product.hasPart = product.hasPart.concat(newParts);
        } else {
            product.hasPart = newParts;
        }
    }

    // 6. Additional Certifications -> hasCertification
    const addCerts = rootNode[`${termsBase}additionalCertification`];
    if (addCerts && Array.isArray(addCerts)) {
        const newCerts = addCerts.map(c => ({
            "@type": "Certification",
            "name": getValue(c, `${termsBase}certificationBodyName`) || "Unknown Certification",
            "startDate": getValue(c, `${termsBase}certificationStartDate`)
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
    const packaging = rootNode[`${termsBase}packaging`];
    if (packaging && Array.isArray(packaging)) {
        const packParts = packaging.map(p => {
            const material = getValue(p, `${termsBase}packagingMaterialType`) || 'Unknown Material';
            const part = {
                "@type": "Product", // Treated as a sub-product/part
                "name": `Packaging - ${material}`,
                "additionalProperty": []
            };

            // Recycled Content
            const rec = getValue(p, `${termsBase}packagingRecycledContent`);
            if (rec !== undefined) {
                part.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": "Recycled Content",
                    "value": Number(rec),
                    "unitText": "%"
                });
            }

            // Process Type
            const proc = getValue(p, `${termsBase}packagingRecyclingProcessType`);
            if (proc) {
                 part.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": "Recycling Process",
                    "value": proc
                });
            }

            // Quantity -> weight
            // Check for literal first (as per test) or object
            const qtyVal = getValue(p, `${termsBase}packagingMaterialCompositionQuantity`);
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

    // --- Textile Parity Additions (v1.1) ---

    // 1. Fibre Composition -> material
    const fibres = rootNode[`${termsBase}fibreComposition`];
    if (fibres && Array.isArray(fibres)) {
        const materialParts = fibres.map(f => {
            const type = getValue(f, `${termsBase}componentName`);
            const pct = getValue(f, `${termsBase}componentPercentage`);
            if (type && pct !== undefined) {
                return `${pct}% ${type}`;
            }
            return null;
        }).filter(p => p);
        
        if (materialParts.length > 0) {
            product.material = materialParts.join(', ');
        }
    }

    // 2. Apparel Size -> size
    const size = getValue(rootNode, `${termsBase}apparelSize`);
    const system = getValue(rootNode, `${termsBase}apparelSizeSystem`);
    if (size) {
        product.size = system ? `${size} (${system})` : size;
    }

    // 3. Generic Textile Properties
    const textileProps = [
        { term: 'animalOriginNonTextile', label: 'Contains Non-Textile Parts of Animal Origin' }
    ];

    textileProps.forEach(prop => {
        // Check for simple value
        let val = getValue(rootNode, `${termsBase}${prop.term}`);
        
        // Handle Boolean specifically
        if (prop.term === 'animalOriginNonTextile' && val === undefined) {
             // Boolean might be literal "true"/"false" or boolean type. getValue handles @value.
             // If missing, skip.
        }

        if (val !== undefined) {
            if (!product.additionalProperty) product.additionalProperty = [];
            product.additionalProperty.push({
                "@type": "PropertyValue",
                "name": prop.label,
                "value": val
            });
        }
    });

    // --- Textile ESPR Parity Additions ---

    // 1. EU Apparel Size -> size & additionalProperty
    const euSizeNode = getNode(rootNode, `${termsBase}euApparelSize`);
    if (euSizeNode) {
        const sizeDesig = getValue(euSizeNode, `${termsBase}sizeDesignation`);
        const primDim = getValue(euSizeNode, `${termsBase}primaryDimension`);
        const primDimVal = getValue(euSizeNode, `${termsBase}primaryDimensionValue`);
        
        let sizeStr = sizeDesig || '';
        if (primDim && primDimVal) {
            sizeStr += sizeStr ? ` (${primDim}: ${primDimVal})` : `${primDim}: ${primDimVal}`;
        }
        if (sizeStr) product.size = sizeStr;

        // Extract secondary dimensions
        const secDims = euSizeNode[`${termsBase}secondaryDimensions`];
        if (secDims && Array.isArray(secDims)) {
             secDims.forEach(dim => {
                  const dName = getValue(dim, `${termsBase}dimension`);
                  const dVal = getValue(dim, `${termsBase}value`);
                  if (dName && dVal) {
                      if (!product.additionalProperty) product.additionalProperty = [];
                      product.additionalProperty.push({
                          "@type": "PropertyValue",
                          "name": dName,
                          "value": dVal
                      });
                  }
             });
        }
    }

    // 2. Production Steps -> additionalProperty
    const prodSteps = rootNode[`${termsBase}productionSteps`];
    if (prodSteps && Array.isArray(prodSteps)) {
        prodSteps.forEach(step => {
            const stepName = getValue(step, `${termsBase}productionStepType`);
            const country = getValue(step, `${termsBase}productionLocationCountry`);
            if (stepName) {
                if (!product.additionalProperty) product.additionalProperty = [];
                product.additionalProperty.push({
                    "@type": "PropertyValue",
                    "name": `Production Step - ${country || 'Unknown Location'}`,
                    "value": stepName
                });
            }
        });
    }

    // 3. Instructions (Care and Repair) -> subjectOf
    const addInstructionsToSubjectOf = (term) => {
        const nodes = rootNode[`${termsBase}${term}`];
        if (nodes && Array.isArray(nodes)) {
            const docs = nodes.map(node => toSchemaOrgDigitalDocument(node, termsBase)).filter(d => d);
            if (docs.length > 0) {
                if (!product.subjectOf) product.subjectOf = [];
                else if (!Array.isArray(product.subjectOf)) product.subjectOf = [product.subjectOf];
                product.subjectOf.push(...docs);
            }
        }
    };
    addInstructionsToSubjectOf('careInstructions');
    addInstructionsToSubjectOf('repairInstructions');
    addInstructionsToSubjectOf('textileCareInstructions');
    addInstructionsToSubjectOf('textileRepairInstructions');

    // 4. Warranty Duration -> warranty
    const warrantyDuration = getValue(rootNode, `${termsBase}warrantyDuration`);
    if (warrantyDuration && !product.warranty) {
        product.warranty = warrantyDuration;
    }

    // 5. ESPR Scores & Metrics -> additionalProperty
    const esprProps = [
        { term: 'robustnessScore', label: 'Robustness Score' },
        { term: 'recyclabilityScore', label: 'Recyclability Score' },
        { term: 'carbonFootprint', label: 'Carbon Footprint' },
        { term: 'spirality', label: 'Spirality' },
        { term: 'dimensionalChange', label: 'Dimensional Change' },
        { term: 'visualInspection', label: 'Visual Inspection' }
    ];

    esprProps.forEach(prop => {
        const val = getValue(rootNode, `${termsBase}${prop.term}`);
        if (val !== undefined) {
            if (!product.additionalProperty) product.additionalProperty = [];
            product.additionalProperty.push({
                "@type": "PropertyValue",
                "name": prop.label,
                "value": val
            });
        }
    });

    // --- Iron and Steel Parity Additions (v1.1) ---
    
    // 1. Core Identifiers & Equivalencies
    const heatNumber = getValue(rootNode, `${termsBase}heatNumber`);
    if (heatNumber) {
        if (!product.sku) {
            product.sku = heatNumber;
        } else {
            const hnObj = { "@type": "PropertyValue", "propertyID": "Heat Number", "value": heatNumber };
            if (Array.isArray(product.identifier)) product.identifier.push(hnObj);
            else if (product.identifier) product.identifier = [product.identifier, hnObj];
            else product.identifier = hnObj;
        }
    }

    const prodNumber = getValue(rootNode, `${termsBase}productNumber`);
    if (prodNumber && !product.productID) {
        product.productID = prodNumber;
    }

    const pOrder = getValue(rootNode, `${termsBase}purchaserOrder`);
    if (pOrder) {
        const poObj = { "@type": "PropertyValue", "propertyID": "schema:orderNumber", "name": "Purchaser Order", "value": pOrder };
        if (Array.isArray(product.identifier)) product.identifier.push(poObj);
        else if (product.identifier) product.identifier = [product.identifier, poObj];
        else product.identifier = poObj;
    }

    const meltCountry = getValue(rootNode, `${termsBase}meltAndPourCountry`);
    if (meltCountry) {
        const mcObj = { "@type": "Country", "name": meltCountry, "description": "Melt and Pour Country" };
        if (product.countryOfOrigin) {
             if (Array.isArray(product.countryOfOrigin)) product.countryOfOrigin.push(mcObj);
             else product.countryOfOrigin = [product.countryOfOrigin, mcObj];
        } else {
             product.countryOfOrigin = mcObj;
        }
    }

    // 2. Specific Sector Properties
    const ironSteelProps = [
        { term: 'castNumber', label: 'Cast Number' },
        { term: 'lotNumber', label: 'Lot Number' },
        { term: 'steelGradeClassification', label: 'Steel Grade Classification' },
        { term: 'steelDesignation', label: 'Steel Designation' },
        { term: 'technologyRoute', label: 'Technology Route' },
        { term: 'yieldStrength', label: 'Yield Strength' },
        { term: 'yieldStrengthRatio', label: 'Yield Strength Ratio' },
        { term: 'elongation', label: 'Elongation' },
        { term: 'relativeRibArea', label: 'Relative Rib Area' },
        { term: 'carbonContent', label: 'Carbon Content' },
        { term: 'phosphorusContent', label: 'Phosphorus Content' },
        { term: 'sulfurContent', label: 'Sulfur Content' },
        { term: 'copperContent', label: 'Copper Content' },
        { term: 'nitrogenContent', label: 'Nitrogen Content' },
        { term: 'carbonEquivalent', label: 'Carbon Equivalent' },
        { term: 'steelProcess', label: 'Steel Process' },
        { term: 'finishing', label: 'Finishing' },
        { term: 'radiometricControl', label: 'Radiometric Control' }
    ];

    ironSteelProps.forEach(prop => {
        const val = getValue(rootNode, `${termsBase}${prop.term}`);
        if (val !== undefined) {
            if (!product.additionalProperty) product.additionalProperty = [];
            product.additionalProperty.push({
                "@type": "PropertyValue",
                "name": prop.label,
                "value": val
            });
        }
    });

    // ------------------------------------

    const safetySheetNode = getNode(rootNode, `${termsBase}safetyDataSheet`);
    if (safetySheetNode) {
        product.safetyDataSheet = toSchemaOrgDigitalDocument(safetySheetNode, termsBase);
    }
    
    // Nest EPD Certifications
    const epdTermsBase = `https://dpp-keystone.org/spec/${version}/terms/epd#`;
    const epdNode = getNode(rootNode, `${termsBase}epd`);
    if (epdNode) {
        const certifications = epdToSchemaOrgCertifications(epdNode, dictionary, rootNode, termsBase);
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
 * @param {string} termsBase - The version chun for terms, for example "v2".
 * @returns {Array} An array containing the single schema.org certification object.
 */
function epdToSchemaOrgCertifications(epdData, dictionary, parentNode, termsBase) {
    const manufacturerList = parentNode[`${termsBase}manufacturer`];
    const manufacturerNode = manufacturerList ? manufacturerList[0] : null;
    const manufacturerName = manufacturerNode 
        ? (getValue(manufacturerNode, `${termsBase}organizationName`) || 'Unknown') 
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
        source: 'digitalProductPassportId',
        transformer: dppToSchemaOrgProduct
      }
    ]
  };