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
    };

    const manufacturerNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#manufacturer');
    if (manufacturerNode) {
        product.manufacturer = toSchemaOrgOrganization(manufacturerNode);
    }

    const dopcNode = getNode(rootNode, 'https://dpp-keystone.org/spec/v1/terms#dopcDeclarations');
    if (dopcNode) {
        const properties = [];
        for (const [uri, valueList] of Object.entries(dopcNode)) {
            if (uri.startsWith('@')) continue;

            const name = toTitleCase(uri.split('#')[1]);
            const value = valueList[0]['@value'];

            properties.push({
                "@type": "PropertyValue",
                "name": name,
                "value": value,
            });
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
    const manufacturerNode = parentNode['https://dpp-keystone.org/spec/v1/terms#manufacturer'][0];
    const manufacturerName = getValue(manufacturerNode, 'https://dpp-keystone.org/spec/v1/terms#organizationName') || 'Unknown';

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
      },
      {
        source: 'https://dpp-keystone.org/spec/v1/terms#epd',
        // The actual function that converts EPD data to schema.org
        transformer: epdToSchemaOrgCertifications 
      }
    ]
  };