/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { loadOntology } from '../../../src/lib/ontology-loader.js';

global.fetch = jest.fn();

describe('Ontology Loader - Enhanced Metadata', () => {
    beforeEach(() => {
        fetch.mockClear();
    });

    it('should extract definedIn and type metadata', async () => {
        const mockOntology = {
            "@graph": [
                {
                    "@id": "dppk:TestTerm",
                    "@type": "rdfs:Class",
                    "rdfs:label": "Test Label"
                }
            ]
        };

        // Mock response for '.../sectors/Test.jsonld'
        // This URL structure allows extraction of type='sectors', name='Test'
        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockOntology
        });

        // Calling loadOntology('test') triggers a fetch to '../spec/ontology/v1/sectors/Test.jsonld'
        const ontologyMap = await loadOntology('test');
        const term = ontologyMap.get('TestTerm');

        expect(term).toBeDefined();
        expect(term.type).toBe('rdfs:Class');
        expect(term.definedIn).toEqual({
            type: 'sectors',
            name: 'Test'
        });
    });

    it('should handle terms with multiple types (array)', async () => {
        const mockOntology = {
            "@graph": [
                {
                    "@id": "dppk:MultiTypeTerm",
                    "@type": ["rdfs:Class", "owl:NamedIndividual"],
                    "rdfs:label": "Multi Label"
                }
            ]
        };

        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockOntology
        });

        const ontologyMap = await loadOntology('test');
        const term = ontologyMap.get('MultiTypeTerm');

        expect(term.type).toEqual(["rdfs:Class", "owl:NamedIndividual"]);
    });

    it('should handle URL parsing failure gracefully', async () => {
        const mockOntology = {
            "@graph": [
                {
                    "@id": "dppk:MysteryTerm",
                    "rdfs:label": "Mystery"
                }
            ]
        };

        // This URL does NOT match the regex (missing /v1/ etc)
        // Note: loadOntology constructs a specific URL, so we can't easily force a bad URL 
        // through the public API without modifying the implementation's URL construction logic.
        // However, we can mock the fetch call URL if we were mocking the implementation, but we are testing the result.
        // Actually, loadOntology ALWAYS uses the standard path. 
        // We can test 'dpp' sector which maps to 'dpp-ontology.jsonld' which might fail the regex.
        
        fetch.mockResolvedValue({
            ok: true,
            json: async () => mockOntology
        });

        // 'dpp' -> '../spec/ontology/v1/dpp-ontology.jsonld'
        // Regex: /ontology\/v1\/(.+?)\/(.+?)\.jsonld/
        // This regex expects TWO segments after v1. 'dpp-ontology.jsonld' is only one segment (filename).
        // So definedIn should be null.
        const ontologyMap = await loadOntology('dpp');
        const term = ontologyMap.get('MysteryTerm');

        expect(term.definedIn).toBeNull();
    });
});
