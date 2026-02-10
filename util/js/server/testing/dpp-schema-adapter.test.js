import { jest } from '@jest/globals';
import { transformDpp } from '../dpp-schema-adapter.js?v=1770749483538';

describe('Server Adapter Loader Integration', () => {
    
    it('should correctly pass the custom document loader to the expansion logic', async () => {
        // Arrange
        const mockLoader = jest.fn().mockImplementation(async (url) => {
            return {
                contextUrl: null,
                document: {
                    "@context": {
                        "dppk": "https://dpp-keystone.org/spec/v1/terms#",
                        "productName": "dppk:productName"
                    }
                },
                documentUrl: url
            };
        });

        const input = {
            "@context": "https://example.com/my-context.jsonld",
            "@type": "DigitalProductPassport",
            "digitalProductPassportId": "urn:uuid:123",
            "productName": "Test Product"
        };

        const options = {
            profile: 'schema.org',
            documentLoader: mockLoader,
            ontologyPaths: [] // No ontology loading needed for this basic test
        };

        // Act
        await transformDpp(input, options);

        // Assert
        // The loader should have been called for the context URL
        const calledWithContext = mockLoader.mock.calls.some(args => args[0].includes('https://example.com/my-context.jsonld'));
        expect(calledWithContext).toBe(true);
    });
});