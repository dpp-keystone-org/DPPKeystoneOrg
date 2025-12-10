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
        const testProperty = ontologyMap.get('dpp:TestProperty');
        expect(testProperty).toBeDefined();
        expect(testProperty.label).toBe('Test Property');
        expect(testProperty.comment).toBe('A property for testing.');
        
        // Check for a property with only a label
        const anotherProperty = ontologyMap.get('dpp:AnotherProperty');
        expect(anotherProperty).toBeDefined();
        expect(anotherProperty.label).toBe('Another Property');
        expect(anotherProperty.comment).toBe(''); // Should default to empty string

        // Check that a property with no label/comment is not included
        expect(ontologyMap.has('dpp:OrphanProperty')).toBe(false);
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
});
