/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { loadOntology } from '../../src/wizard/ontology-loader.js';

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
        expect(fetch).toHaveBeenCalledWith('../ontology/v1/sectors/Test.jsonld');

        // Verify the returned map
        expect(ontologyMap).toBeInstanceOf(Map);
        expect(ontologyMap.size).toBe(2);

        // Check for a specific property
        const testProperty = ontologyMap.get('TestProperty');
        expect(testProperty).toBeDefined();
        expect(testProperty.label).toBe('Test Property');
        expect(testProperty.comment).toBe('A property for testing.');
        
        // Check for a property with only a label
        const anotherProperty = ontologyMap.get('AnotherProperty');
        expect(anotherProperty).toBeDefined();
        expect(anotherProperty.label).toBe('Another Property');
        expect(anotherProperty.comment).toBe(''); // Should default to empty string

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
        expect(fetch).toHaveBeenCalledWith('../ontology/v1/sectors/Nonexistent.jsonld');

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
        expect(prop.label).toBe('English Name');
        expect(prop.comment).toBe('A property with multiple languages.');
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
        expect(prop.label).toBe('Simple Label');
        expect(prop.comment).toBe('Simple Comment');
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
        expect(fetch).toHaveBeenCalledWith('../ontology/v1/sectors/Main.jsonld');
        expect(fetch).toHaveBeenCalledWith('https://dpp-keystone.org/ontology/v1/core/Imported.jsonld');

        // Assert that the map contains terms from both files
        expect(ontologyMap.size).toBe(2);
        expect(ontologyMap.has('mainProp')).toBe(true);
        expect(ontologyMap.has('importedProp')).toBe(true);
        expect(ontologyMap.get('importedProp').label).toBe('Imported Prop Label');
    });
});
