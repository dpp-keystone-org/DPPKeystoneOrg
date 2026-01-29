
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
                    "DigitalProductPassport": "dppk:DigitalProductPassport",
                    "digitalProductPassportId": { "@id": "dppk:digitalProductPassportId", "@type": "@id" },
                    "uniqueProductIdentifier": { "@id": "dppk:uniqueProductIdentifier", "@type": "@id" },
                    "epd": { "@id": "dppk:epd", "@type": "@id" }, // Ensure EPD is mapped
                    "manufacturer": { "@id": "dppk:manufacturer", "@type": "@id" },
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
                    "unitCode": "dppk:unitCode"
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

});
