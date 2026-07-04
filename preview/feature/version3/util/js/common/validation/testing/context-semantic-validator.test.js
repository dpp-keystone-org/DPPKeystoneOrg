import { validateContextAwarePayload } from '../context-semantic-validator.js?v=1783197266074';
import { KEYSTONE_VERSION } from '../../../../../lib/keystone-version.js?v=1783197266074';

describe('Context Semantic Validator (JSON-LD Native Isolations)', () => {

    /**
     * Natively dependencies injection for the semantic JSON-LD expander. 
     * Allows fully offline, perfectly controlled evaluation suites avoiding global Fetch intercepts.
     */
    const mockDocumentLoader = async (url) => {
        if (url === `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`) {
            return {
                contextUrl: null,
                documentUrl: url,
                document: {
                    "@context": {
                        "xsd": "http://www.w3.org/2001/XMLSchema#",
                        "manufacturingDate": { "@id": `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#manufacturingDate`, "@type": "xsd:date" },
                        "batteryMass": { "@id": `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#batteryMass`, "@type": "xsd:decimal" },
                        "addressCountry": { "@id": `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#addressCountry` }
                    }
                }
            };
        }
        throw new Error(`Isolated Unit Test Network Security Block: Unexpected external fetch intercepted to ${url}`);
    };

    it('should natively compute invalid property values dynamically derived entirely from implicit contextual typing assertions', async () => {
        const payload = {
            "@context": `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`,
            "manufacturingDate": "bad-date-format",   // Automatically binds to xsd:date!
            "batteryMass": 45.5,
            "addressCountry": "Germany"               // Fails non-ISO-code strict mapping boundary!
        };

        const result = await validateContextAwarePayload(payload, mockDocumentLoader);

        expect(result.valid).toBe(false);
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    message: expect.stringContaining('manufacturingDate must be a valid date'),
                    instancePath: '/manufacturingDate'
                }),
                expect.objectContaining({
                    message: expect.stringContaining('addressCountry must be a valid country code'),
                    instancePath: '/addressCountry'
                })
            ])
        );
    });

    it('should successfully and cleanly parse flawlessly strictly formatted contextual datasets completely offline', async () => {
        const payload = {
            "@context": `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`,
            "manufacturingDate": "2026-05-12",
            "batteryMass": 155.22,
            "addressCountry": "DE"
        };

        const result = await validateContextAwarePayload(payload, mockDocumentLoader);

        expect(result.valid).toBe(true);
        expect(result.errors.length).toBe(0);
    });

});
