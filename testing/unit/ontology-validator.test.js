import {
    validateTermTranslations,
    validateTermStructure
} from '../../src/util/js/common/validation/ontology-validator.js';

describe('ontology-validator', () => {

    describe('validateTermStructure', () => {
        it('should pass if the term is a valid owl:ObjectProperty', () => {
            const term = {
                '@id': 'dppk:mockProp',
                '@type': 'owl:ObjectProperty'
            };
            const result = validateTermStructure(term);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should pass if the term is a valid owl:DatatypeProperty', () => {
            const term = {
                '@id': 'dppk:mockProp',
                '@type': ['owl:DatatypeProperty', 'rdfs:Property']
            };
            const result = validateTermStructure(term);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should flag an rdfs:Property that lacks an owl property type', () => {
            const term = {
                '@id': 'dppk:mockProp',
                '@type': 'rdfs:Property'
            };
            const result = validateTermStructure(term);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('invalid property type');
            expect(result.errors[0]).toContain('must be defined as \'owl:ObjectProperty\' or \'owl:DatatypeProperty\'');
        });

        it('should flag a plain Property that lacks an owl property type', () => {
            const term = {
                '@id': 'dppk:mockProp',
                '@type': 'Property'
            };
            const result = validateTermStructure(term);
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('invalid property type');
        });

        it('should ignore terms that are not properties', () => {
            const term = {
                '@id': 'dppk:MockClass',
                '@type': 'rdfs:Class'
            };
            const result = validateTermStructure(term);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });
    });

});
