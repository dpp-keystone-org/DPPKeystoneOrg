/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { loadSchema, clearSchemaCache } from '../../src/wizard/schema-loader.js';

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
        expect(fetch).toHaveBeenCalledWith('../validation/v1/json-schema/simple.schema.json');
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
});
