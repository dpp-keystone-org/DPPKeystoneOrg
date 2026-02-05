
import { flattenSchema } from '../../src/lib/schema-loader.js';

describe('Schema Loader (Unit)', () => {

    test('flattenSchema handles simple properties', () => {
        const schema = {
            type: 'object',
            properties: {
                name: { type: 'string' },
                age: { type: 'integer' }
            }
        };

        const result = flattenSchema(schema, '', false, true);
        expect(result).toHaveLength(2);
        
        const nameField = result.find(f => f.path === 'name');
        expect(nameField).toBeDefined();
        expect(nameField.type).toBe('string');
        expect(nameField.isArray).toBe(false);

        const ageField = result.find(f => f.path === 'age');
        expect(ageField).toBeDefined();
        expect(ageField.type).toBe('integer');
    });

    test('flattenSchema handles nested objects', () => {
        const schema = {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                }
            }
        };

        const result = flattenSchema(schema, '', false, true);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('user.name');
        expect(result[0].type).toBe('string');
    });

    test('flattenSchema handles arrays of objects', () => {
        const schema = {
            type: 'object',
            properties: {
                tags: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            label: { type: 'string' }
                        }
                    }
                }
            }
        };

        const result = flattenSchema(schema, '', false, true);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('tags.label');
        expect(result[0].isArray).toBe(true);
    });

    test('flattenSchema handles array types (nullable)', () => {
        const schema = {
            type: 'object',
            properties: {
                description: { type: ['string', 'null'] }
            }
        };

        const result = flattenSchema(schema, '', false, true);
        expect(result).toHaveLength(1);
        expect(result[0].path).toBe('description');
        expect(result[0].type).toBe('string');
    });

    test('flattenSchema captures format and enum', () => {
        const schema = {
            type: 'object',
            properties: {
                category: { 
                    type: 'string', 
                    enum: ['A', 'B'] 
                },
                created: {
                    type: 'string',
                    format: 'date-time'
                }
            }
        };

        const result = flattenSchema(schema, '', false, true);
        
        const cat = result.find(f => f.path === 'category');
        expect(cat.enum).toEqual(['A', 'B']);

        const date = result.find(f => f.path === 'created');
        expect(date.format).toBe('date-time');
    });

    test('flattenSchema handles allOf', () => {
        const schema = {
            type: 'object',
            allOf: [
                {
                    properties: {
                        id: { type: 'string' }
                    }
                },
                {
                    properties: {
                        rev: { type: 'string' }
                    }
                }
            ]
        };

        const result = flattenSchema(schema, '', false, true);
        expect(result).toHaveLength(2);
        expect(result.find(f => f.path === 'id')).toBeDefined();
        expect(result.find(f => f.path === 'rev')).toBeDefined();
    });

});
