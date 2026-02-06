import { validateDpp } from '../schema-validator.js?v=1770413198757';

describe('validateDpp', () => {
    // Mock Schemas
    const baseSchema = {
        $id: 'http://example.com/base',
        type: 'object',
        properties: {
            id: { type: 'string' },
            contentSpecificationIds: { 
                type: 'array',
                items: { type: 'string' }
            }
        },
        required: ['id']
    };

    const sectorASchema = {
        $id: 'http://example.com/sectorA',
        type: 'object',
        properties: {
            sectorAProp: { type: 'string' }
        },
        required: ['sectorAProp']
    };

    const commonSchema = {
        $id: 'http://example.com/common',
        type: 'object',
        properties: {
            commonProp: { type: 'number' }
        }
    };

    const sectorSchemas = {
        'spec-id-a': sectorASchema
    };

    const commonSchemas = [commonSchema];

    test('should validate valid data against base schema', () => {
        const data = { id: '123' };
        const result = validateDpp(data, { baseSchema });
        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
    });

    test('should fail validation if base schema requirements are not met', () => {
        const data = { other: '123' }; // Missing 'id'
        const result = validateDpp(data, { baseSchema });
        expect(result.valid).toBe(false);
        expect(result.errors[0].keyword).toBe('required');
        expect(result.errors[0].params.missingProperty).toBe('id');
    });

    test('should apply sector schema when contentSpecificationId matches', () => {
        const data = {
            id: '123',
            contentSpecificationIds: ['spec-id-a'],
            sectorAProp: 'valid'
        };
        const result = validateDpp(data, { baseSchema, sectorSchemas });
        expect(result.valid).toBe(true);
    });

    test('should fail if sector schema requirements are not met', () => {
        const data = {
            id: '123',
            contentSpecificationIds: ['spec-id-a']
            // Missing 'sectorAProp'
        };
        const result = validateDpp(data, { baseSchema, sectorSchemas });
        expect(result.valid).toBe(false);
        
        // Error might be nested in 'allOf', so we check if any error refers to the missing property
        const hasMissingPropError = result.errors.some(
            err => err.params.missingProperty === 'sectorAProp'
        );
        expect(hasMissingPropError).toBe(true);
    });

    test('should ignore unknown contentSpecificationIds', () => {
        const data = {
            id: '123',
            contentSpecificationIds: ['unknown-spec-id']
        };
        const result = validateDpp(data, { baseSchema, sectorSchemas });
        expect(result.valid).toBe(true);
    });

    test('should handle common schemas correctly', () => {
        // Create a base schema that refs the common schema
        const baseWithRef = {
            ...baseSchema,
            properties: {
                ...baseSchema.properties,
                commonThing: { $ref: 'http://example.com/common' }
            }
        };

        const data = {
            id: '123',
            commonThing: { commonProp: 42 }
        };

        const result = validateDpp(data, { 
            baseSchema: baseWithRef, 
            commonSchemas 
        });
        expect(result.valid).toBe(true);
    });
});
