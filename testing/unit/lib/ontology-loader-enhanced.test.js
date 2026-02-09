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
        // Suppress console.error for this specific test case
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Mock a failed fetch response (e.g., network error)
        fetch.mockRejectedValue(new Error('Network error'));

        // Attempt to load an ontology, which should now fail
        const ontologyMap = await loadOntology('bad-sector');

        // Verify that the function gracefully returned null
        expect(ontologyMap).toBeNull();

        // Restore the original console.error to not affect other tests
        consoleErrorSpy.mockRestore();
    });
});
