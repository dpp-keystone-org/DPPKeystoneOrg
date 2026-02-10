import { jest } from '@jest/globals';
import { transformDpp } from '../dpp-schema-adapter.js?v=1770752725720';

describe('Client Adapter Loader Integration', () => {
    
    beforeAll(() => {
        global.fetch = jest.fn();
    });

    it('should correctly pass the fetch-based loader to the buildDictionary logic', async () => {
        // Arrange
        const mockOntology = {
            "@context": { "dppk": "https://dpp-keystone.org/spec/v1/terms#" },
            "@graph": []
        };
        
        global.fetch.mockResolvedValue({
            json: async () => mockOntology
        });

        // Mock document loader for expansion
        const mockDocLoader = jest.fn().mockImplementation(async (url) => {
            return {
                contextUrl: null,
                document: {},
                documentUrl: url
            };
        });

        const input = {
            "@context": "https://example.com/context.jsonld",
            "@type": "DigitalProductPassport",
            "digitalProductPassportId": "uuid:123"
        };

        const options = {
            profile: 'schema.org',
            documentLoader: mockDocLoader,
            ontologyPaths: ['https://example.com/ontology.jsonld']
        };

        // Act
        await transformDpp(input, options);

        // Assert
        // The global fetch should have been called to load the ontology
        expect(global.fetch).toHaveBeenCalledWith('https://example.com/ontology.jsonld');
    });
});
