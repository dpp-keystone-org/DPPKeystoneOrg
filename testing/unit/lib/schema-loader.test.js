/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { loadSchema, clearSchemaCache, flattenSchema } from '../../../src/lib/schema-loader.js';

// Mock the global fetch function
global.fetch = jest.fn();

describe('DPP Wizard - Schema Loader', () => {
    beforeEach(() => {
        fetch.mockClear();
        clearSchemaCache();
    });

    it('should load a simple schema without refs', async () => {
        const mockSchema = {
            "title": "Simple Schema",
            "type": "object",
            "properties": {
                "name": { "type": "string" }
            }
        };

        fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => mockSchema,
        });

        const schema = await loadSchema('simple');
        expect(fetch).toHaveBeenCalledWith('../spec/validation/v1/json-schema/simple.schema.json');
        expect(schema).toEqual(mockSchema);
    });

    it('should resolve a local $ref', async () => {
        const mainSchema = {
            "title": "Main Schema",
            "type": "object",
            "properties": {
                "address": { "$ref": "address.schema.json" }
            }
        };

        const addressSchema = {
            "title": "Address",
            "type": "object",
            "properties": {
                "street": { "type": "string" },
                "city": { "type": "string" }
            }
        };

        fetch.mockImplementation(url => {
            if (url.endsWith('main.schema.json')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => mainSchema,
                });
            }
            if (url.endsWith('address.schema.json')) {
                return Promise.resolve({
                    ok: true,
                    json: async () => addressSchema,
                });
            }
            return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
        });

        const schema = await loadSchema('main');

        expect(schema.properties.address).toEqual(addressSchema);
    });

    it('should resolve nested $refs recursively', async () => {
        const rootSchema = {
            "title": "Root",
            "properties": { "level1": { "$ref": "level1.schema.json" } }
        };
        const level1Schema = {
            "title": "Level 1",
            "properties": { "level2": { "$ref": "level2.schema.json" } }
        };
        const level2Schema = {
            "title": "Level 2",
            "properties": { "message": { "type": "string" } }
        };

        fetch.mockImplementation(url => {
            if (url.endsWith('root.schema.json')) return Promise.resolve({ ok: true, json: async () => rootSchema });
            if (url.endsWith('level1.schema.json')) return Promise.resolve({ ok: true, json: async () => level1Schema });
            if (url.endsWith('level2.schema.json')) return Promise.resolve({ ok: true, json: async () => level2Schema });
            return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
        });

        const schema = await loadSchema('root');

        expect(schema.properties.level1.properties.level2).toEqual(level2Schema);
    });

    it('should resolve an allOf by merging properties', async () => {
        const rootSchema = {
            "title": "Root",
            "allOf": [
                { "$ref": "base.schema.json" },
                {
                    "type": "object",
                    "properties": {
                        "rootProp": { "type": "string" }
                    }
                }
            ]
        };
        const baseSchema = {
            "title": "Base",
            "type": "object",
            "properties": {
                "baseProp": { "type": "string" }
            }
        };

        fetch.mockImplementation(url => {
            if (url.endsWith('root.schema.json')) return Promise.resolve({ ok: true, json: async () => rootSchema });
            if (url.endsWith('base.schema.json')) return Promise.resolve({ ok: true, json: async () => baseSchema });
            return Promise.reject(new Error(`Unexpected fetch url: ${url}`));
        });

        const schema = await loadSchema('root');

        // The resolved schema should have properties from both parts of the allOf
        expect(schema.properties).toBeDefined();
        expect(schema.properties).toHaveProperty('baseProp');
        expect(schema.properties).toHaveProperty('rootProp');

        // The allOf should be gone, as it has been processed
        expect(schema.allOf).toBeUndefined();
    });

    describe('Schema Flattening Logic', () => {
        test('should flatten basic properties', () => {
            const schema = {
                type: "object",
                properties: {
                    name: { type: "string" },
                    age: { type: "integer" }
                }
            };
            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'name', isArray: false },
                { path: 'age', isArray: false }
            ]));
            expect(result).toHaveLength(2);
        });

        test('should flatten nested objects using dot notation', () => {
            const schema = {
                type: "object",
                properties: {
                    manufacturer: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            address: {
                                type: "object",
                                properties: {
                                    city: { type: "string" }
                                }
                            }
                        }
                    }
                }
            };
            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'manufacturer.name', isArray: false },
                { path: 'manufacturer.address.city', isArray: false }
            ]));
        });

        test('should merge fields from allOf', () => {
            const schema = {
                allOf: [
                    {
                        properties: {
                            baseField: { type: "string" }
                        }
                    },
                    {
                        properties: {
                            extendedField: { type: "number" }
                        }
                    }
                ]
            };
            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'baseField', isArray: false },
                { path: 'extendedField', isArray: false }
            ]));
        });

        test('should collect union of fields from oneOf', () => {
            const schema = {
                oneOf: [
                    {
                        properties: {
                            variantA: { type: "string" }
                        }
                    },
                    {
                        properties: {
                            variantB: { type: "number" }
                        }
                    }
                ]
            };
            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'variantA', isArray: false },
                { path: 'variantB', isArray: false }
            ]));
        });

        test('should collect fields from if/then/else conditionals', () => {
            const schema = {
                properties: {
                    type: { type: "string" }
                },
                if: {
                    properties: { type: { const: "special" } }
                },
                then: {
                    properties: {
                        specialAttr: { type: "string" }
                    }
                },
                else: {
                    properties: {
                        standardAttr: { type: "string" }
                    }
                }
            };
            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'type', isArray: false },
                { path: 'specialAttr', isArray: false },
                { path: 'standardAttr', isArray: false }
            ]));
        });

        test('should handle complex nested combinations (oneOf inside properties)', () => {
            const schema = {
                properties: {
                    productData: {
                        oneOf: [
                            {
                                properties: { color: { type: "string" } }
                            },
                            {
                                properties: { size: { type: "number" } }
                            }
                        ]
                    }
                }
            };
            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'productData.color', isArray: false },
                { path: 'productData.size', isArray: false }
            ]));
        });
    });

    describe('flattenSchema (New Metadata)', () => {
        test('should return list of dot-notation paths with isArray flag', () => {
            const schema = {
                type: "object",
                properties: {
                    id: { type: "string" },
                    product: {
                        type: "object",
                        properties: {
                            name: { type: "string" },
                            tags: { 
                                type: "array",
                                items: { type: "string" }
                            }
                        }
                    }
                }
            };

            const result = flattenSchema(schema);
            expect(result).toEqual(expect.arrayContaining([
                { path: 'id', isArray: false },
                { path: 'product.name', isArray: false },
                { path: 'product.tags', isArray: true }
            ]));
        });

        test('should handle nested arrays', () => {
            const schema = {
                type: "object",
                properties: {
                    components: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string" },
                                materials: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            }
                        }
                    }
                }
            };

            const result = flattenSchema(schema);
            // components.id is inside an array (components)
            expect(result).toEqual(expect.arrayContaining([
                { path: 'components.id', isArray: true },
                { path: 'components.materials', isArray: true }
            ]));
        });
    });
});
