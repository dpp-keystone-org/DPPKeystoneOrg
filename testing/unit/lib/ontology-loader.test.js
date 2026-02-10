/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { loadOntology } from '../../../src/lib/ontology-loader.js';

// Mock the global fetch function
global.fetch = jest.fn();

describe('DPP Wizard - Ontology Loader', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('should fetch, parse, and map an ontology file', async () => {
        const mockOntology = {
            "@context": {
                "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
                "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
                "dpp": "https://w3id.org/dpp/pico#"
            },
            "@graph": [
                {
                    "@id": "dpp:TestProperty",
                    "@type": "rdf:Property",
                    "rdfs:label": { "@language": "en", "@value": "Test Property" },
                    "rdfs:comment": { "@language": "en", "@value": "A property for testing." }
                },
                {
                    "@id": "dpp:AnotherProperty",
                    "@type": "rdf:Property",
                    "rdfs:label": { "@language": "en", "@value": "Another Property" }
                },
                {
                    "@id": "dpp:OrphanProperty"
                },
                {
                    "@type": "owl:Ontology"
                }
            ]
        };

        // Mock the successful fetch response
        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOntology,
        });

        const ontologyMap = await loadOntology('test');

        // Verify fetch was called correctly
        expect(fetch).toHaveBeenCalledWith('../spec/ontology/v1/sectors/Test.jsonld');

        // Verify the returned map
        expect(ontologyMap).toBeInstanceOf(Map);
        expect(ontologyMap.size).toBe(2);

        // Check for a specific property
        const testProperty = ontologyMap.get('TestProperty');
        expect(testProperty).toBeDefined();
        expect(testProperty.label.en).toBe('Test Property');
        expect(testProperty.comment).toEqual({ en: 'A property for testing.' });
        
        // Check for a property with only a label
        const anotherProperty = ontologyMap.get('AnotherProperty');
        expect(anotherProperty).toBeDefined();
        expect(anotherProperty.label.en).toBe('Another Property');
        expect(anotherProperty.comment).toEqual({}); // Should default to empty object

        // Check that a property with no label/comment is not included
        expect(ontologyMap.has('OrphanProperty')).toBe(false);
    });

    it('should return null if the fetch fails', async () => {
        // Suppress console.error for this specific test case
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock a failed fetch response
        fetch.mockResolvedValueOnce({
            ok: false,
            status: 404,
        });

        const ontologyMap = await loadOntology('nonexistent');

        // Verify fetch was called
        expect(fetch).toHaveBeenCalledWith('../spec/ontology/v1/sectors/Nonexistent.jsonld');

        // Verify it returns null
        expect(ontologyMap).toBeNull();

        // Restore the original console.error
        consoleErrorSpy.mockRestore();
    });

    it('should return an empty map for an ontology with no graph', async () => {
        const mockOntology = {
            "@context": {},
            "rdfs:comment": "This ontology has no graph."
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOntology,
        });

        const ontologyMap = await loadOntology('empty');
        expect(ontologyMap).toBeInstanceOf(Map);
        expect(ontologyMap.size).toBe(0);
    });

    it('should correctly parse language-tagged arrays for labels', async () => {
        const mockOntology = {
            "@graph": [
                {
                    "@id": "dpp:multiLangProp",
                    "rdfs:label": [
                        { "@language": "de", "@value": "Deutscher Name" },
                        { "@language": "en", "@value": "English Name" }
                    ],
                    "rdfs:comment": "A property with multiple languages."
                }
            ]
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOntology,
        });

        const ontologyMap = await loadOntology('multilang');
        const prop = ontologyMap.get('multiLangProp');

        expect(prop).toBeDefined();
        expect(prop.label.en).toBe('English Name');
        expect(prop.label.de).toBe('Deutscher Name');
        expect(prop.comment).toEqual({ en: 'A property with multiple languages.' });
    });

    it('should correctly parse a simple string label', async () => {
        const mockOntology = {
            "@graph": [
                {
                    "@id": "dpp:simpleProp",
                    "rdfs:label": "Simple Label",
                    "rdfs:comment": "Simple Comment"
                }
            ]
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOntology,
        });

        const ontologyMap = await loadOntology('simple');
        const prop = ontologyMap.get('simpleProp');

        expect(prop).toBeDefined();
        expect(prop.label).toEqual({ en: 'Simple Label' });
        expect(prop.comment).toEqual({ en: 'Simple Comment' });
    });

    it('should parse multi-language labels into a language-keyed object', async () => {
        const mockOntology = {
            "@graph": [{
                "@id": "dpp:multiLangProp",
                "rdfs:label": [
                    { "@language": "de", "@value": "Deutscher Name" },
                    { "@language": "en", "@value": "English Name" }
                ],
                "rdfs:comment": "A comment."
            }]
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockOntology,
        });

        const ontologyMap = await loadOntology('multilang-object');
        const prop = ontologyMap.get('multiLangProp');

        expect(prop).toBeDefined();
        expect(prop.label).toEqual({
            de: 'Deutscher Name',
            en: 'English Name'
        });
        expect(prop.comment).toEqual({ en: 'A comment.' });
    });

    it('should recursively load imported ontologies and merge their terms', async () => {
        const importedOntology = {
            "@id": "https://dpp-keystone.org/ontology/v1/core/Imported.jsonld",
            "@graph": [{
                "@id": "dppk:importedProp",
                "rdfs:label": "Imported Prop Label"
            }]
        };

        const mainOntology = {
            "@id": "https://dpp-keystone.org/ontology/v1/sectors/Main.jsonld",
            "owl:imports": ["https://dpp-keystone.org/ontology/v1/core/Imported.jsonld"],
            "@graph": [{
                "@id": "dppk:mainProp",
                "rdfs:label": "Main Prop Label"
            }]
        };

        // Mock fetch to respond based on the URL
        fetch.mockImplementation(url => {
            if (url.endsWith('Main.jsonld')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mainOntology,
                });
            }
            if (url.endsWith('Imported.jsonld')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => importedOntology,
                });
            }
            return Promise.reject(new Error(`Unexpected fetch call to ${url}`));
        });

        const ontologyMap = await loadOntology('main');

        // Assert that fetch was called for both ontologies
        expect(fetch).toHaveBeenCalledWith('../spec/ontology/v1/sectors/Main.jsonld');
        expect(fetch).toHaveBeenCalledWith('https://dpp-keystone.org/ontology/v1/core/Imported.jsonld');

        // Assert that the map contains terms from both files
        expect(ontologyMap.size).toBe(2);
        expect(ontologyMap.has('mainProp')).toBe(true);
        expect(ontologyMap.has('importedProp')).toBe(true);
        expect(ontologyMap.get('importedProp').label.en).toBe('Imported Prop Label');
    });

    test('should preserve dcterms:source object with @id', async () => {
        const mockOntology = {
            '@context': 'https://www.w3.org/ns/odrl.jsonld',
            '@graph': [
                {
                    '@id': 'dppk:batteryChemistry',
                    '@type': 'owl:DatatypeProperty',
                    'dcterms:source': { '@id': 'https://www.dinmedia.de/en/technical-rule/din-dke-spec-99100/385692321' },
                    'rdfs:label': [{ '@language': 'en', '@value': 'Battery chemistry' }],
                },
            ],
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockOntology),
        });

        const ontologyMap = await loadOntology('battery');
        
        expect(ontologyMap).not.toBeNull();
        const batteryChemistryInfo = ontologyMap.get('batteryChemistry');
        
        expect(batteryChemistryInfo).toBeDefined();
        expect(batteryChemistryInfo.source).toBeDefined();
        expect(typeof batteryChemistryInfo.source).toBe('object');
        expect(batteryChemistryInfo.source['@id']).toBe('https://www.dinmedia.de/en/technical-rule/din-dke-spec-99100/385692321');
    });

    test('should handle dcterms:source as a simple string', async () => {
        const mockOntology = {
            '@graph': [
                {
                    '@id': 'dppk:someProperty',
                    'dcterms:source': 'A simple string source.',
                },
            ],
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockOntology),
        });

        const ontologyMap = await loadOntology('battery');
        const somePropertyInfo = ontologyMap.get('someProperty');
        
        expect(somePropertyInfo).toBeDefined();
        expect(somePropertyInfo.source).toBe('A simple string source.');
    });

    test('should merge properties for the same term from different files', async () => {
        const mockCoreOntology = {
            'owl:imports': ['../spec/ontology/v1/sectors/mock-sector.jsonld'],
            '@graph': [
                { '@id': 'dppk:sharedProperty', 'rdfs:label': [{ '@language': 'en', '@value': 'Shared Label' }] }
            ]
        };
        const mockSectorOntology = {
            '@graph': [
                { '@id': 'dppk:sharedProperty', 'rdfs:comment': [{ '@language': 'en', '@value': 'Shared Comment' }] }
            ]
        };

        // First fetch is for the main ontology (which imports the other)
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockCoreOntology),
        });
        // Second fetch is for the imported sector ontology
        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockSectorOntology),
        });

        const ontologyMap = await loadOntology('dpp'); // Use a sector that triggers the mock
        const sharedPropertyInfo = ontologyMap.get('sharedProperty');

        expect(fetch).toHaveBeenCalledTimes(2);
        expect(sharedPropertyInfo).toBeDefined();
        expect(sharedPropertyInfo.label.en).toBe('Shared Label');
        expect(sharedPropertyInfo.comment.en).toBe('Shared Comment');
    });

    test('should correctly parse rdfs:range when it is an object with @id', async () => {
        const mockOntology = {
            '@graph': [
                {
                    '@id': 'dppk:someProperty',
                    'rdfs:range': { '@id': 'xsd:decimal' },
                },
            ],
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockOntology),
        });

        const ontologyMap = await loadOntology('battery');
        const somePropertyInfo = ontologyMap.get('someProperty');
        
        expect(somePropertyInfo).toBeDefined();
        expect(somePropertyInfo.range).toBe('decimal');
    });

    test('should correctly parse owl:oneOf into an enum array', async () => {
        const mockOntology = {
            '@graph': [
                {
                    '@id': 'dppk:someClass',
                    'owl:oneOf': [
                        { '@id': 'dppk:OptionA' },
                        { '@id': 'dppk:OptionB' }
                    ]
                },
            ],
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockOntology),
        });

        const ontologyMap = await loadOntology('battery');
        const someClassInfo = ontologyMap.get('someClass');

        expect(someClassInfo).toBeDefined();
        expect(someClassInfo.enum).toBeDefined();
        expect(Array.isArray(someClassInfo.enum)).toBe(true);
        expect(someClassInfo.enum).toEqual(['OptionA', 'OptionB']);
    });
});
