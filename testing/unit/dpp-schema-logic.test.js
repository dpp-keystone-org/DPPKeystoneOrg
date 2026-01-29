
import { transform, buildDictionary } from '../../src/util/js/common/transformation/dpp-schema-logic.js';
import * as jsonld from 'jsonld';

// Mock the document loader for jsonld to avoid network requests during tests
const customDocumentLoader = async (url) => {
    // Return minimal contexts for expansion
    if (url.includes('dpp-core.context.jsonld')) {
        return {
            contextUrl: null,
            document: {
                "@context": {
                    "dppk": "https://dpp-keystone.org/spec/v1/terms#",
                    "xsd": "http://www.w3.org/2001/XMLSchema#",
                    "name": "dppk:name",
                    "DigitalProductPassport": "dppk:DigitalProductPassport",
                    "digitalProductPassportId": { "@id": "dppk:digitalProductPassportId", "@type": "@id" },
                    "uniqueProductIdentifier": { "@id": "dppk:uniqueProductIdentifier", "@type": "@id" },
                    "epd": { "@id": "dppk:epd", "@type": "@id" }, // Ensure EPD is mapped
                    "manufacturer": { "@id": "dppk:manufacturer", "@type": "@id" },
                    "organizationName": "dppk:organizationName",
                    "image": { "@id": "dppk:image", "@type": "@id" },
                    "RelatedResource": "dppk:RelatedResource",
                    "url": { "@id": "dppk:url", "@type": "xsd:anyURI" },
                    "productName": "dppk:productName",
                    "description": "dppk:description",
                    "gtin": "dppk:gtin",
                    "brand": "dppk:brand",
                    "model": "dppk:model",
                    "weight": "dppk:netWeight",
                    "dopc": "dppk:dopc",
                    "value": "dppk:value",
                    "unitCode": "dppk:unitCode",
                    // New Core Terms
                    "hsCode": "dppk:hsCode",
                    "recycledContentPercentage": { "@id": "dppk:recycledContentPercentage", "@type": "xsd:double" },
                    "productCharacteristics": { "@id": "dppk:productCharacteristics", "@container": "@set" },
                    "characteristicName": "dppk:characteristicName",
                    "characteristicValue": "dppk:characteristicValue",
                    "component": {
                      "@id": "dppk:component",
                      "@context": {
                        "name": "dppk:componentName",
                        "percentage": { "@id": "dppk:percentage", "@type": "xsd:double" }
                      }
                    },
                    // Battery Terms
                    "BatteryProduct": "dppk:BatteryProduct",
                    "manufacturingDate": { "@id": "dppk:manufacturingDate", "@type": "xsd:date" },
                    "warrantyPeriod": "dppk:warrantyPeriod",
                    "batteryMass": { "@id": "dppk:batteryMass", "@type": "xsd:double" },
                    "performance": {
                        "@id": "dppk:performance",
                        "@context": {
                            "capacity": {
                                "@id": "dppk:capacity",
                                "@context": {
                                    "rated": "dppk:ratedCapacity"
                                }
                            }
                        }
                    },
                    // Construction Terms
                    "ConstructionProduct": "dppk:ConstructionProduct",
                    "notifiedBody": { "@id": "dppk:notifiedBody", "@type": "@id" },
                    "dopIdentifier": "dppk:dopIdentifier",
                    "harmonisedStandardReference": "dppk:harmonisedStandardReference",
                    // Electronics Terms
                    "ElectronicDevice": "dppk:ElectronicDevice",
                    "ipRating": "dppk:ipRating",
                    "voltage": "dppk:voltage",
                    // General Product Terms
                    "color": "dppk:color",
                    "countryOfOrigin": "dppk:countryOfOrigin",
                    "grossWeight": { "@id": "dppk:grossWeight", "@type": "xsd:double" },
                    "length": { "@id": "dppk:length", "@type": "xsd:double" },
                    "components": { "@id": "dppk:components", "@container": "@list" },
                    "additionalCertifications": { "@id": "dppk:additionalCertifications", "@container": "@set" },
                    "certificationBodyName": "dppk:certificationBodyName"
                }
            },
            documentUrl: url
        };
    }
    if (url.includes('dpp-textile.context.jsonld')) {
         return {
            contextUrl: null,
            document: {
                "@context": {
                    "dppk": "https://dpp-keystone.org/spec/v1/terms#",
                    "fibreComposition": "dppk:fibreComposition",
                    "fibreType": "dppk:fibreType",
                    "fibrePercentage": "dppk:fibrePercentage",
                    "tearStrength": "dppk:tearStrength"
                }
            },
            documentUrl: url
        };
    }

    if (url.startsWith('http')) {
        return {
            contextUrl: null,
            document: {}, 
            documentUrl: url
        };
    }
    return jsonld.documentLoaders.node()(url);
};


// --- Step 1.b: Define mockLoader ---
const mockOntologyStore = {
    'http://mock/ontology/product': {
        "@context": { 
            "dppk": "https://dpp-keystone.org/spec/v1/terms#", 
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#" 
        },
        "@graph": [
            {
                "@id": "https://dpp-keystone.org/spec/v1/terms#tearStrength",
                "dppk:unit": [{ "@value": "N" }],
                "rdfs:label": [{ "@value": "Tear Strength", "@language": "en" }]
            }
        ]
    }
};

const mockLoader = async (path) => {
    if (mockOntologyStore[path]) {
        return mockOntologyStore[path];
    }
    throw new Error(`Mock ontology not found: ${path}`);
};

// --- Step 1.c: Define dpp-full-example fixture ---
const fullExampleDpp = {
  "@context": [
      "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
      "https://dpp-keystone.org/spec/contexts/v1/dpp-textile.context.jsonld"
  ],
  "@type": "DigitalProductPassport",
  "digitalProductPassportId": "urn:uuid:1234-5678-90ab-cdef",
  "uniqueProductIdentifier": "https://example.com/product/123",
  "productName": { "en": "Eco-Friendly T-Shirt" },
  "description": "A sustainable t-shirt made from recycled cotton.",
  "gtin": "01234567890123",
  "brand": "EcoWear",
  "model": "T-100",
  "manufacturer": {
      "organizationName": "EcoWear Inc.",
      "address": {
          "streetAddress": "123 Green Way",
          "addressCountry": "US"
      }
  },
  // Images (RelatedResource)
  "image": [
      {
          "@type": "RelatedResource",
          "url": "https://example.com/t-shirt-front.jpg",
          "contentType": "image/jpeg",
          "resourceTitle": "Front View"
      }
  ],
  // Dimensions
  "weight": { "value": 0.2, "unitCode": "KGM" },
  
  // EPD Data
  "epd": {
      "https://dpp-keystone.org/spec/v1/terms#gwp": {
          "https://dpp-keystone.org/spec/v1/terms#a1-a3": 5.5
      }
  },

  // Textile Specific
  "fibreComposition": [
      {
          "fibreType": "Cotton",
          "fibrePercentage": 100
      }
  ],
  
  // Generic / DOPC
  "dopc": {
      "https://dpp-keystone.org/spec/v1/terms#tearStrength": 50
  }
};


describe('DPP Schema Logic (Unit)', () => {

    // --- Step 1.d: Smoke Test ---
    test('buildDictionary populates metadata from mock ontology', async () => {
        const dictionary = {};
        await buildDictionary(['http://mock/ontology/product'], mockLoader, customDocumentLoader, dictionary);

        expect(dictionary['https://dpp-keystone.org/spec/v1/terms#tearStrength']).toBeDefined();
        expect(dictionary['https://dpp-keystone.org/spec/v1/terms#tearStrength'].unit).toBe('N');
    });

    test('transform returns transformed objects (Basic Smoke Test)', async () => {
        const dictionary = {}; 
        const result = await transform(fullExampleDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThan(0);
    });

    // --- Step 2: Enforce Single Root (Failing Test) ---
    test('transform returns a single unified root object', async () => {
        const dictionary = {}; 
        const result = await transform(fullExampleDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        // Expectation: A single Product graph, not disjoint objects
        expect(result.length).toBe(1);
        expect(result[0]['@type']).toBe('Product');
    });

    // --- Step 4: Nest EPD (Failing Test) ---
    test('Product has nested EPD certification', async () => {
        const dictionary = {}; 
        const result = await transform(fullExampleDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];
        // Expectation: EPD is now nested inside the product
        expect(product.hasCertification).toBeDefined();
        expect(Array.isArray(product.hasCertification)).toBe(true);
        expect(product.hasCertification[0]['@type']).toBe('Certification');
        expect(product.hasCertification[0].name).toBe('Environmental Product Declaration');
    });

    // --- Step 6: Core Fields & Dimensions (Failing Test) ---
    test('Product has core fields and dimensions', async () => {
        const dictionary = {}; 
        const result = await transform(fullExampleDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];
        // Core fields
        expect(product.brand).toBe('EcoWear');
        expect(product.gtin).toBe('01234567890123');
        // Dimensions (QuantitativeValue)
        expect(product.weight).toBeDefined();
        expect(product.weight['@type']).toBe('QuantitativeValue');
        expect(product.weight.value).toBe(0.2);
        expect(product.weight.unitCode).toBe('KGM');
    });

    // --- Step 8: Image Handling (Failing Test) ---
    test('Product has image property from RelatedResource', async () => {
        const dictionary = {}; 
        const result = await transform(fullExampleDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];
        // Image handling
        expect(product.image).toBeDefined();
        expect(Array.isArray(product.image)).toBe(true);
        expect(product.image[0]).toBe('https://example.com/t-shirt-front.jpg');
    });

    // --- Step 10: Generic Mapping Helper (Design/Test) ---
    test('Product maps generic generic/DOPC properties using dictionary', async () => {
        const dictionary = {};
        // Pre-load dictionary as the adapter wrapper normally handles this
        await buildDictionary(['http://mock/ontology/product'], mockLoader, customDocumentLoader, dictionary);

        const result = await transform(fullExampleDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];
        
        // Expectation: tearStrength should be in additionalProperty
        expect(product.additionalProperty).toBeDefined();
        const tearStrength = product.additionalProperty.find(p => p.name === 'Tear Strength');
        expect(tearStrength).toBeDefined();
        expect(tearStrength.value).toBe(50);
        expect(tearStrength.unitText).toBe('N');
    });

    // --- Step 12: Core Parity (Design 019-b) ---
    test('Product maps extended Core fields (Components, Characteristics, Recycled, HSCode)', async () => {
        const coreDpp = {
            "@context": "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
            "@type": "DigitalProductPassport",
            "digitalProductPassportId": "urn:uuid:core-test",
            "uniqueProductIdentifier": "urn:gtin:core-test",
            "hsCode": "8507.60",
            "recycledContentPercentage": 45.5,
            "productCharacteristics": [
                { "characteristicName": "Color", "characteristicValue": "Matte Black" }
            ],
            "component": [
                { "name": "Casing", "percentage": 15.0 }
            ]
        };

        const dictionary = {}; 
        const result = await transform(coreDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];

        // 1. HS Code -> identifier
        const hsCode = Array.isArray(product.identifier) 
            ? product.identifier.find(i => i.propertyID === 'HS Code')
            : (product.identifier?.propertyID === 'HS Code' ? product.identifier : null);
        
        // Note: Implementation might vary (array vs single object), assuming we push to identifier array or create one.
        // For now, let's expect the adapter to create an identifier object or simple property. 
        // Based on analysis, we want schema:identifier with propertyID.
        expect(hsCode).toBeDefined();
        expect(hsCode.value).toBe('8507.60');

        // 2. Recycled Content -> additionalProperty
        const recycled = product.additionalProperty?.find(p => p.name === 'Recycled Content');
        expect(recycled).toBeDefined();
        expect(recycled.value).toBe(45.5);
        expect(recycled.unitText).toBe('%');

        // 3. Product Characteristics -> additionalProperty
        const color = product.additionalProperty?.find(p => p.name === 'Color');
        expect(color).toBeDefined();
        expect(color.value).toBe('Matte Black');

        // 4. Components -> hasPart
        expect(product.hasPart).toBeDefined();
        expect(product.hasPart[0].name).toBe('Casing');
        // Check if percentage is preserved? Schema.org doesn't have a standard "percentage of parent" on Product.
        // Maybe in description or additionalProperty of the part.
        // For now, just checking presence.
    });

    // --- Step 2.3: Battery Parity ---
    test('Product maps Battery specific fields (Mass, Performance, Dates)', async () => {
        const batteryDpp = {
            "@context": "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
            "@type": ["DigitalProductPassport", "BatteryProduct"],
            "digitalProductPassportId": "urn:uuid:battery-test",
            "uniqueProductIdentifier": "urn:gtin:battery-test",
            "manufacturingDate": "2023-01-15",
            "warrantyPeriod": "5 Years",
            "batteryMass": 450.5,
            "performance": {
                "capacity": {
                    "rated": 100
                }
            }
        };

        const dictionary = {}; 
        const result = await transform(batteryDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];

        // 1. Manufacturing Date -> productionDate
        expect(product.productionDate).toBe('2023-01-15');

        // 2. Warranty -> warranty
        // schema:warranty is usually a Thing (WarrantyPromise). 
        // If we map string to string, verify behavior. 
        // Some processors accept string. Schema.org says "WarrantyPromise".
        // Let's assume we map it to additionalProperty or try mapping to warranty object if easy.
        // Design doc said: "dppk:warrantyPeriod" -> "schema:warranty".
        // Let's expect it as a property for now.
        expect(product.warranty).toBe('5 Years');

        // 3. Battery Mass -> weight
        expect(product.weight).toBeDefined();
        expect(product.weight.value).toBe(450.5);

        // 4. Performance -> additionalProperty (Recursive)
        // Should be "Capacity - Rated" or similar
        const capacity = product.additionalProperty?.find(p => p.name.includes('Rated'));
        expect(capacity).toBeDefined();
        expect(capacity.value).toBe(100);
    });

    // --- Step 3.3: Construction Parity ---
    test('Product maps Construction specific fields (Notified Body, DoP ID)', async () => {
        const constructionDpp = {
            "@context": "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
            "@type": ["DigitalProductPassport", "ConstructionProduct"],
            "digitalProductPassportId": "urn:uuid:const-test",
            "uniqueProductIdentifier": "urn:gtin:const-test",
            "dopIdentifier": "DOP-1234",
            "harmonisedStandardReference": "EN 12345:2020",
            "notifiedBody": {
                "organizationName": "Safety Corp"
            }
        };

        const dictionary = {}; 
        const result = await transform(constructionDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];

        // 1. DoP Identifier -> identifier
        const dopId = Array.isArray(product.identifier)
            ? product.identifier.find(i => i.propertyID === 'DoP ID')
            : (product.identifier?.propertyID === 'DoP ID' ? product.identifier : null);
        
        expect(dopId).toBeDefined();
        expect(dopId.value).toBe('DOP-1234');

        // 2. Harmonised Standard -> additionalProperty
        const standard = product.additionalProperty?.find(p => p.name === 'Harmonised Standard Reference');
        expect(standard).toBeDefined();
        expect(standard.value).toBe('EN 12345:2020');

        // 3. Notified Body -> additionalProperty
        const notifiedBody = product.additionalProperty?.find(p => p.name === 'Notified Body');
        expect(notifiedBody).toBeDefined();
        expect(notifiedBody.value).toBe('Safety Corp');
    });

    // --- Step 5.3: Electronics Parity ---
    test('Product maps Electronics specific fields (IP Rating, Voltage)', async () => {
        const electronicsDpp = {
            "@context": "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
            "@type": ["DigitalProductPassport", "ElectronicDevice"],
            "digitalProductPassportId": "urn:uuid:elec-test",
            "uniqueProductIdentifier": "urn:gtin:elec-test",
            "ipRating": "IP67",
            "voltage": "220V"
        };

        const dictionary = {}; 
        const result = await transform(electronicsDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];

        // 1. IP Rating
        const ip = product.additionalProperty?.find(p => p.name === 'IP Rating');
        expect(ip).toBeDefined();
        expect(ip.value).toBe('IP67');

        // 2. Voltage
        const voltage = product.additionalProperty?.find(p => p.name === 'Voltage');
        expect(voltage).toBeDefined();
        expect(voltage.value).toBe('220V');
    });

    // --- Step 7.3: General Product Parity ---
    test('Product maps General Product specific fields (Color, Country, Length, Certs)', async () => {
        const generalDpp = {
            "@context": "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
            "@type": "DigitalProductPassport",
            "digitalProductPassportId": "urn:uuid:gen-test",
            "uniqueProductIdentifier": "urn:gtin:gen-test",
            "color": "Red",
            "countryOfOrigin": "Germany",
            "length": 1.5,
            "grossWeight": 5.0,
            "components": [
                { "name": "Wheel" },
                { "name": "Axle" }
            ],
            "additionalCertifications": [
                { "certificationBodyName": "TUV" }
            ]
        };

        const dictionary = {}; 
        const result = await transform(generalDpp, { 
            profile: 'schema.org',
            documentLoader: customDocumentLoader
        }, dictionary);

        const product = result[0];

        // 1. Color -> color
        expect(product.color).toBe('Red');

        // 2. Country of Origin -> countryOfOrigin
        expect(product.countryOfOrigin).toBeDefined();
        // It might be an object or string depending on implementation. 
        // Schema.org prefers Country object, but string is allowed.
        // We'll verify the value is present.
        if (typeof product.countryOfOrigin === 'string') {
            expect(product.countryOfOrigin).toBe('Germany');
        } else {
            expect(product.countryOfOrigin.name).toBe('Germany');
        }

        // 3. Length -> depth
        expect(product.depth).toBeDefined();
        expect(product.depth.value).toBe(1.5);

        // 4. Gross Weight -> additionalProperty
        const gross = product.additionalProperty?.find(p => p.name === 'Gross Weight');
        expect(gross).toBeDefined();
        expect(gross.value).toBe(5.0);

        // 5. Components -> hasPart (merged check if logic merges, but here just check presence)
        expect(product.hasPart).toBeDefined();
        // Should find Wheel and Axle
        const names = product.hasPart.map(p => p.name);
        expect(names).toContain('Wheel');
        expect(names).toContain('Axle');

        // 6. Additional Certifications -> hasCertification
        // Core parity already had EPD certs, this adds to the list or creates it.
        expect(product.hasCertification).toBeDefined();
        const tuv = product.hasCertification.find(c => c.issuedBy?.name === 'TUV' || c.name === 'TUV'); // Check how we map it
        // Mapping plan says: "Name: Body Name".
        // Let's verify we have a certification entry.
        expect(product.hasCertification.length).toBeGreaterThan(0);
    });

});
