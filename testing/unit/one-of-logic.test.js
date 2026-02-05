import { flattenSchema } from '../../src/lib/schema-loader.js';

describe('Schema Flattening - OneOf Logic', () => {
    test('should tag fields with oneOf metadata', () => {
        const schema = {
            type: 'object',
            properties: {
                common: { type: 'string' }
            },
            oneOf: [
                {
                    properties: {
                        optionAOnly: { type: 'string' }
                    }
                },
                {
                    properties: {
                        optionBOnly: { type: 'string' }
                    }
                }
            ]
        };

        const fields = flattenSchema(schema, '', false, true);
        const fieldMap = new Map(fields.map(f => [f.path, f]));

        // We expect optionAOnly to know it belongs to Option 0
        expect(fieldMap.get('optionAOnly').oneOf).toBeDefined();
        expect(fieldMap.get('optionAOnly').oneOf[0].index).toBe(0);

        // We expect optionBOnly to know it belongs to Option 1
        expect(fieldMap.get('optionBOnly').oneOf).toBeDefined();
        expect(fieldMap.get('optionBOnly').oneOf[0].index).toBe(1);
        
        // Common field might not have oneOf tag if it was at root properties
        // But if it was inside oneOf branches, it would.
    });
    
    test('should handle fields present in multiple oneOf options', () => {
         const schema = {
            oneOf: [
                { properties: { shared: { type: 'string' } } },
                { properties: { shared: { type: 'string' } } },
                { properties: { other: { type: 'string' } } }
            ]
        };
        
        const fields = flattenSchema(schema, '', false, true);
        const fieldMap = new Map(fields.map(f => [f.path, f]));
        
        const shared = fieldMap.get('shared');
        expect(shared.oneOf).toBeDefined();
        // Should belong to options 0 and 1
        const indices = shared.oneOf.map(o => o.index).sort();
        expect(indices).toEqual([0, 1]);
    });
});
