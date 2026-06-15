import { validateAgainstOntology, validateTermTranslations } from '../ontology-validator.js?v=1781526840057';

describe('Ontology Validator', () => {
    // 1. Basic Primitive Checks
    describe('Primitive Validation', () => {
        test('should allow properly formatted xsd:date', () => {
            const data = { releaseDate: '2023-12-01' };
            const ontologyMap = new Map([
                ['releaseDate', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject invalid xsd:date', () => {
            const data = { releaseDate: '01/12/2023' };
            const ontologyMap = new Map([
                ['releaseDate', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].instancePath).toBe('/releaseDate');
            expect(result.errors[0].message).toContain('YYYY-MM-DD');
        });

        test('should allow properly formatted xsd:dateTime', () => {
            const data = { timestamp: '2023-12-01T12:00:00Z' };
            const ontologyMap = new Map([
                ['timestamp', { range: 'dateTime' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should reject invalid xsd:dateTime', () => {
            const data = { timestamp: '2023-12-01 12:00:00' };
            const ontologyMap = new Map([
                ['timestamp', { range: 'dateTime' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors[0].instancePath).toBe('/timestamp');
        });

        test('should allow valid decimal numbers', () => {
            const data = { weight: 1.5 };
            const ontologyMap = new Map([
                ['weight', { range: 'decimal' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should reject non-number decimal types', () => {
            const data = { weight: 'heavy' };
            const ontologyMap = new Map([
                ['weight', { range: 'decimal' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('number');
        });

        test('should allow valid integer numbers', () => {
            const data = { count: 42 };
            const ontologyMap = new Map([
                ['count', { range: 'integer' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should reject floating point for integer range', () => {
            const data = { count: 42.5 };
            const ontologyMap = new Map([
                ['count', { range: 'integer' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('whole number');
        });

        test('should allow valid country codes', () => {
            const data = { addressCountry: 'US' };
            const ontologyMap = new Map([
                ['addressCountry', { range: 'string' }] // Bound to field name conventions typically
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should reject invalid country codes', () => {
            const data = { addressCountry: 'USA1' };
            const ontologyMap = new Map([
                ['addressCountry', { range: 'string' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('country code');
        });

        test('should reject control characters in plain text', () => {
            const data = { description: 'Hello\x00World' };
            const ontologyMap = new Map([
                ['description', { range: 'string' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors[0].message).toContain('Invalid characters');
        });
    });

    // 2. Nested Object Evaluation
    describe('Nested Validation', () => {
        test('should properly validate properties within nested objects', () => {
            const data = {
                organization: {
                    details: {
                        foundedDate: '1990-01-01'
                    }
                }
            };
            const ontologyMap = new Map([
                ['foundedDate', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should reject invalid properties deeply nested', () => {
            const data = {
                organization: {
                    details: {
                        foundedDate: 'long-ago'
                    }
                }
            };
            const ontologyMap = new Map([
                ['foundedDate', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors[0].instancePath).toBe('/organization/details/foundedDate');
        });
    });

    // 3. Array Aggregation
    describe('Array Validation', () => {
        test('should validate every element inside an array', () => {
            const data = { maintenanceDates: ['2023-01-01', '2023-06-01'] };
            const ontologyMap = new Map([
                ['maintenanceDates', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should reject if any primitive element inside an array is invalid', () => {
            const data = { maintenanceDates: ['2023-01-01', 'invalid-date'] };
            const ontologyMap = new Map([
                ['maintenanceDates', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].instancePath).toBe('/maintenanceDates[1]');
        });

        test('should aggressively validate arrays of complex nested objects', () => {
            const data = {
                components: [
                    { manufactureDate: '2022-01-01', weight: 10 },
                    { manufactureDate: 'bad-date', weight: 'heavy' }
                ]
            };
            const ontologyMap = new Map([
                ['manufactureDate', { range: 'date' }],
                ['weight', { range: 'decimal' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(false);
            // Expect 2 errors: bad date and bad weight, both in array element [1]
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
            expect(result.errors.some(e => e.instancePath === '/components[1]/manufactureDate')).toBe(true);
            expect(result.errors.some(e => e.instancePath === '/components[1]/weight')).toBe(true);
        });
    });

    // 4. Missing inputs 
    describe('Edge Cases', () => {
        test('should return valid if no ontologyMap is provided', () => {
            const data = { someValue: 'asdf' };
            const result = validateAgainstOntology(data, null);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should ignore keys missing from the ontology map', () => {
            const data = { unknownField: '2023-fail' };
            const ontologyMap = new Map([
                ['someOtherField', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should succeed natively on completely empty objects', () => {
            const data = {};
            const ontologyMap = new Map([
                ['dateOfIssue', { range: 'date' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should ignore boolean valid properties safely', () => {
            const data = { isRecyclable: true };
            const ontologyMap = new Map([
                ['isRecyclable', { range: 'boolean' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
        });

        test('should allow various valid URNs and standard protocols', () => {
            const data = {
                identifier1: 'urn:uuid:1234-5678',
                identifier2: 'mailto:admin@example.com',
                identifier3: 'https://dpp-keystone.org',
                identifier4: 'ftp://server.org/data'
            };
            const ontologyMap = new Map([
                ['identifier1', { range: 'anyURI' }],
                ['identifier2', { range: 'anyURI' }],
                ['identifier3', { range: 'anyURI' }],
                ['identifier4', { range: 'anyURI' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should allow relative file paths as valid URIs', () => {
            const data = { image: '/spec/examples/images/construction.png' };
            const ontologyMap = new Map([
                ['image', { range: 'anyURI' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should allow scheme-less domains as valid URIs', () => {
            const data = { website: 'www.example.com' };
            const ontologyMap = new Map([
                ['website', { range: 'anyURI' }]
            ]);
            const result = validateAgainstOntology(data, ontologyMap);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject invalid generic URIs', () => {
            const data1 = { website: 'not-a-link' }; // No slashes, colons, or dots
            const data2 = { website: 'not a link' }; // Contains spaces

            const ontologyMap = new Map([
                ['website', { range: 'anyURI' }]
            ]);

            expect(validateAgainstOntology(data1, ontologyMap).valid).toBe(false);
            expect(validateAgainstOntology(data2, ontologyMap).valid).toBe(false);
        });
    });

    describe('Term Translations Validation', () => {
        test('should reject plain string labels', () => {
            const term = {
                "@id": "dppk:test",
                "rdfs:label": "Plain String Label"
            };
            const result = validateTermTranslations(term);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain("plain string");
        });

        test('should allow properly translated labels', () => {
            const term = {
                "@id": "dppk:test",
                "rdfs:label": [
                    { "@language": "en", "@value": "English" },
                    { "@language": "bg", "@value": "Bulgarian" },
                    { "@language": "cs", "@value": "Czech" },
                    { "@language": "da", "@value": "Danish" },
                    { "@language": "de", "@value": "German" },
                    { "@language": "el", "@value": "Greek" },
                    { "@language": "es", "@value": "Spanish" },
                    { "@language": "et", "@value": "Estonian" },
                    { "@language": "fi", "@value": "Finnish" },
                    { "@language": "fr", "@value": "French" },
                    { "@language": "hr", "@value": "Croatian" },
                    { "@language": "hu", "@value": "Hungarian" },
                    { "@language": "it", "@value": "Italian" },
                    { "@language": "lt", "@value": "Lithuanian" },
                    { "@language": "lv", "@value": "Latvian" },
                    { "@language": "mt", "@value": "Maltese" },
                    { "@language": "nl", "@value": "Dutch" },
                    { "@language": "pl", "@value": "Polish" },
                    { "@language": "pt", "@value": "Portuguese" },
                    { "@language": "ro", "@value": "Romanian" },
                    { "@language": "sk", "@value": "Slovak" },
                    { "@language": "sl", "@value": "Slovenian" },
                    { "@language": "sv", "@value": "Swedish" },
                    { "@language": "ga", "@value": "Irish" }
                ]
            };
            const result = validateTermTranslations(term);
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        test('should reject missing required languages', () => {
            const term = {
                "@id": "dppk:test",
                "rdfs:label": [
                    { "@language": "en", "@value": "English" },
                    { "@language": "de", "@value": "German" }
                ]
            };
            const result = validateTermTranslations(term);
            expect(result.valid).toBe(false);
            // It should say "missing 22 required languages"
            expect(result.errors[0]).toContain("missing 22 required languages");
        });

        test('should skip translation check if label is entirely omitted', () => {
            const term = {
                "@id": "dppk:test",
                "@type": "owl:Class"
            };
            const result = validateTermTranslations(term);
            expect(result.valid).toBe(true);
        });
    });
});
