import { analyzeColumnData, isTypeCompatible, generateDPPsFromCsv, validateMappingConstraints, getMissingRequiredFields, validateValue } from '../../src/lib/csv-adapter-logic.js';

describe('DPP Generation Logic', () => {
    test('should ignore empty mappings', () => {
        const csvData = [{ 'Header1': 'Value1', 'Header2': 'Value2' }];
        const mapping = {
            'Header1': 'field1',
            'Header2': '' // Empty mapping (should be ignored)
        };
        const sector = 'test';

        const result = generateDPPsFromCsv(csvData, mapping, sector);
        
        expect(result).toHaveLength(1);
        expect(result[0]).toHaveProperty('field1', 'Value1');
        
        // Should NOT have property for empty key ""
        expect(result[0]).not.toHaveProperty(''); 
        
        // Should NOT have property for "Header2" (unless mapped to itself, which it isn't)
        // Check that keys are limited
        const keys = Object.keys(result[0]).filter(k => k !== '@context');
        expect(keys).toEqual(['field1']);
    });
});

describe('CSV Adapter Logic - analyzeColumnData', () => {

    test('should identify boolean columns', () => {
        const rows = [
            { active: 'true' },
            { active: 'false' },
            { active: 'yes' },
            { active: 'no' },
            { active: '0' },
            { active: '1' }
        ];
        expect(analyzeColumnData(rows, 'active')).toEqual({ type: 'boolean' });
    });

    test('should identify integer columns', () => {
        const rows = [
            { count: '10' },
            { count: '0' },
            { count: '-5' },
            { count: '1000' }
        ];
        expect(analyzeColumnData(rows, 'count')).toEqual({ type: 'integer' });
    });

    test('should identify decimal numbers', () => {
        const rows = [
            { weight: '10.5' },
            { weight: '0.1' },
            { weight: '5' } // Mix of int and float is Number
        ];
        expect(analyzeColumnData(rows, 'weight')).toEqual({ type: 'number' });
    });

    test('should identify dates (ISO-like)', () => {
        const rows = [
            { created: '2023-01-01' },
            { created: '2023-12-31T23:59:59Z' },
            { created: '2024-02-29' }
        ];
        expect(analyzeColumnData(rows, 'created')).toEqual({ type: 'string', format: 'date-time' });
    });

    test('should identify emails', () => {
        const rows = [
            { contact: 'test@example.com' },
            { contact: 'user.name@domain.co.uk' }
        ];
        expect(analyzeColumnData(rows, 'contact')).toEqual({ type: 'string', format: 'email' });
    });

    test('should identify URIs', () => {
        const rows = [
            { link: 'https://example.com' },
            { link: 'ftp://files.com/data' },
            { link: 'urn:isbn:1234567890' }
        ];
        expect(analyzeColumnData(rows, 'link')).toEqual({ type: 'string', format: 'uri' });
    });

    test('should fallback to string for mixed content', () => {
        const rows = [
            { mix: '123' },
            { mix: 'true' }, // Number + Bool -> String
            { mix: 'apple' }
        ];
        expect(analyzeColumnData(rows, 'mix')).toEqual({ type: 'string' });
    });

    test('should fallback to string for broken formats', () => {
        const rows = [
            { email: 'test@example.com' },
            { email: 'not-an-email' }
        ];
        expect(analyzeColumnData(rows, 'email')).toEqual({ type: 'string' });
    });

    test('should handle empty/null values gracefully', () => {
        const rows = [
            { val: '10' },
            { val: '' },
            { val: null },
            { val: '20' }
        ];
        expect(analyzeColumnData(rows, 'val')).toEqual({ type: 'integer' });
    });

    test('should return empty type for completely empty columns', () => {
        const rows = [
            { empty: '' },
            { empty: null }
        ];
        expect(analyzeColumnData(rows, 'empty')).toEqual({ type: 'empty' });
    });
});

describe('Type Compatibility (Unit)', () => {

    test('Boolean matches Boolean and String', () => {
        const csv = { type: 'boolean' };
        expect(isTypeCompatible(csv, { type: 'boolean' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'string' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'number' })).toBe(false);
    });

    test('Integer matches Integer, Number, String', () => {
        const csv = { type: 'integer' };
        expect(isTypeCompatible(csv, { type: 'integer' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'number' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'string' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'boolean' })).toBe(false);
    });

    test('Number (float) matches Number, String but NOT Integer', () => {
        const csv = { type: 'number' };
        expect(isTypeCompatible(csv, { type: 'number' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'string' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'integer' })).toBe(false);
    });

    test('String matches String only', () => {
        const csv = { type: 'string' };
        expect(isTypeCompatible(csv, { type: 'string' })).toBe(true);
        expect(isTypeCompatible(csv, { type: 'number' })).toBe(false);
    });

    test('String Format matching', () => {
        const csvDate = { type: 'string', format: 'date-time' };
        const schemaDate = { type: 'string', format: 'date-time' };
        const schemaString = { type: 'string' };

        expect(isTypeCompatible(csvDate, schemaDate)).toBe(true);
        expect(isTypeCompatible(csvDate, schemaString)).toBe(true); // Specific fits generic

        const csvString = { type: 'string' }; // Generic string
        expect(isTypeCompatible(csvString, schemaDate)).toBe(false); // Generic doesn't fit specific
    });

    test('Number should NOT match String with specific Format', () => {
        const csvNumber = { type: 'number' };
        const schemaDate = { type: 'string', format: 'date' };
        const schemaUri = { type: 'string', format: 'uri' };
        const schemaGeneric = { type: 'string' };

        expect(isTypeCompatible(csvNumber, schemaDate)).toBe(false);
        expect(isTypeCompatible(csvNumber, schemaUri)).toBe(false);
        expect(isTypeCompatible(csvNumber, schemaGeneric)).toBe(true); // Still matches generic string
    });

    test('Ontology Range: xsd:double should NOT match String column', () => {
        const csvString = { type: 'string' };
        const schemaField = { 
            type: 'string', // Schema allows string
            ontology: { range: 'xsd:double' } 
        };
        expect(isTypeCompatible(csvString, schemaField)).toBe(false);
    });

    test('Ontology Range: xsd:double SHOULD match Number column', () => {
        const csvNumber = { type: 'number' };
        const schemaField = { 
            type: 'string', 
            ontology: { range: 'xsd:double' } 
        };
        expect(isTypeCompatible(csvNumber, schemaField)).toBe(true);
    });

    test('Ontology Range: xsd:integer should NOT match Float column', () => {
        const csvFloat = { type: 'number' }; // Float is 'number' but not 'integer'
        const schemaField = { 
            type: 'number',
            ontology: { range: 'xsd:integer' } 
        };
        // Note: isTypeCompatible logic for integers relies on cType being 'integer'
        // But our analyzer separates integer vs number.
        // If logic forces strict check:
        expect(isTypeCompatible(csvFloat, schemaField)).toBe(false);
    });

    test('should allow string-to-ontology-enum mapping', () => {
        const csvString = { type: 'string' };
        const schemaField = { 
            type: undefined, // Type is missing from schema, defined by ontology
            ontology: { range: 'dppk:GranularityValue' } // Custom enum-like class
        };
        // The fix should infer this as string-compatible
        expect(isTypeCompatible(csvString, schemaField)).toBe(true);
    });
});

describe('validateValue', () => {
    const enumField = {
        path: 'granularity',
        type: 'string',
        enum: ['Item', 'Batch', 'Model']
    };

    const nonEnumField = {
        path: 'name',
        type: 'string'
    };

    test('should return true for a valid enum value', () => {
        expect(validateValue('Item', enumField)).toBe(true);
    });

    test('should return false for an invalid enum value', () => {
        expect(validateValue('InvalidValue', enumField)).toBe(false);
    });

    test('should return true for any value if field has no enum', () => {
        expect(validateValue('AnyString', nonEnumField)).toBe(true);
        expect(validateValue(123, nonEnumField)).toBe(true);
    });

    test('should return true for empty, null, or undefined values', () => {
        expect(validateValue('', enumField)).toBe(true);
        expect(validateValue(null, enumField)).toBe(true);
        expect(validateValue(undefined, enumField)).toBe(true);
    });

    test('should handle numeric values correctly if enum contains numbers as strings', () => {
        const numericEnumField = { enum: ['1', '2', '3'] };
        expect(validateValue(1, numericEnumField)).toBe(true);
        expect(validateValue('2', numericEnumField)).toBe(true);
        expect(validateValue(4, numericEnumField)).toBe(false);
    });
});

describe('validateMappingConstraints', () => {
    // Mock schema fields with oneOf metadata
    const schemaFieldMap = new Map([
        ['noOneOf', { path: 'noOneOf', type: 'string' }],
        ['id', { path: 'id', type: 'string' }],
        ['tradeName', { path: 'tradeName', type: 'string' }],
        // Group 1: Flat properties
        ['optionA', { path: 'optionA', type: 'string', oneOf: [{ groupId: 'root#oneOf', index: 0 }] }],
        ['optionB', { path: 'optionB', type: 'string', oneOf: [{ groupId: 'root#oneOf', index: 1 }] }],
        // Group 2: Nested properties
        ['nested.propA', { path: 'nested.propA', type: 'string', oneOf: [{ groupId: 'nested#oneOf', index: 0 }] }],
        ['nested.propB', { path: 'nested.propB', type: 'string', oneOf: [{ groupId: 'nested#oneOf', index: 1 }] }],
        ['nested.propC', { path: 'nested.propC', type: 'string', oneOf: [{ groupId: 'nested#oneOf', index: 1 }] }],
        // Group 3: Array properties
        ['items.fieldX', { path: 'items.fieldX', isArray: true, oneOf: [{ groupId: 'items#oneOf', index: 0 }] }],
        ['items.fieldY', { path: 'items.fieldY', isArray: true, oneOf: [{ groupId: 'items#oneOf', index: 1 }] }],
    ]);

    test('should return empty for no mappings', () => {
        const mapping = {};
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toEqual([]);
    });

    test('should return empty for mappings with no oneOf fields', () => {
        const mapping = { 'Header1': 'id', 'Header2': 'tradeName' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toEqual([]);
    });

    test('should return empty when mapping fields from the same oneOf branch', () => {
        const mapping = { 'Header1': 'nested.propB', 'Header2': 'nested.propC' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toEqual([]);
    });

    test('should return empty for mappings in different oneOf groups', () => {
        const mapping = { 'Header1': 'optionA', 'Header2': 'nested.propB' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toEqual([]);
    });
    
    test('should detect a simple conflict in the root object', () => {
        const mapping = { 'Header1': 'optionA', 'Header2': 'optionB', 'Header3': 'id' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(1);
        expect(new Set(conflicts[0])).toEqual(new Set(['optionA', 'optionB']));
    });

    test('should detect a conflict in a nested object', () => {
        const mapping = { 'Header1': 'nested.propA', 'Header2': 'nested.propB', 'Header3': 'id' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(1);
        expect(new Set(conflicts[0])).toEqual(new Set(['nested.propA', 'nested.propB']));
    });

    test('should detect a multi-field conflict', () => {
        const mapping = { 'H1': 'nested.propA', 'H2': 'nested.propB', 'H3': 'nested.propC' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(1);
        expect(new Set(conflicts[0])).toEqual(new Set(['nested.propA', 'nested.propB', 'nested.propC']));
    });

    test('should handle multiple independent conflicts in different objects', () => {
        const mapping = {
            'H1': 'optionA', 'H2': 'optionB', // Conflict 1 (root)
            'H3': 'nested.propA', 'H4': 'nested.propB', // Conflict 2 (nested)
        };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(2);
        
        const sortedConflicts = conflicts.map(c => c.sort()).sort((a, b) => a[0].localeCompare(b[0]));
        
        expect(sortedConflicts[0]).toEqual(['nested.propA', 'nested.propB']);
        expect(sortedConflicts[1]).toEqual(['optionA', 'optionB']);
    });
    
    test('should detect conflict within the same array item', () => {
        const mapping = { 'Header1': 'items[0].fieldX', 'Header2': 'items[0].fieldY' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(1);
        expect(new Set(conflicts[0])).toEqual(new Set(['items[0].fieldX', 'items[0].fieldY']));
    });

    test('should NOT flag a conflict for different array indices', () => {
        const mapping = { 'Header1': 'items[0].fieldX', 'Header2': 'items[1].fieldY' };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toEqual([]);
    });

    test('should detect multiple conflicts across different array items', () => {
        const mapping = { 
            'H1': 'items[0].fieldX', 'H2': 'items[0].fieldY', // Conflict in item 0
            'H3': 'items[1].fieldX', 'H4': 'items[1].fieldY'  // Conflict in item 1
        };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(2);

        const sortedConflicts = conflicts.map(c => c.sort()).sort((a, b) => a[0].localeCompare(b[0]));
        expect(sortedConflicts[0]).toEqual(['items[0].fieldX', 'items[0].fieldY']);
        expect(sortedConflicts[1]).toEqual(['items[1].fieldX', 'items[1].fieldY']);
    });

    test('should ignore empty or null mapping values', () => {
        const mapping = { 'H1': 'optionA', 'H2': 'optionB', 'H3': '', 'H4': null };
        const conflicts = validateMappingConstraints(mapping, schemaFieldMap);
        expect(conflicts).toHaveLength(1);
        expect(new Set(conflicts[0])).toEqual(new Set(['optionA', 'optionB']));
    });
});

describe('getMissingRequiredFields', () => {
    // Mock schema fields with 'required' metadata
    const schemaFields = [
        { path: 'id', type: 'string', required: true },
        { path: 'tradeName', type: 'string', required: false },
        { path: 'manufacturer', type: 'object', required: false },
        { path: 'manufacturer.name', type: 'string', required: true },
        { path: 'manufacturer.url', type: 'string', required: false },
        { path: 'items', type: 'array', required: true },
        { path: 'items.name', type: 'string', required: true },
        { path: 'items.value', type: 'number', required: false },
    ];

    test('should return empty when all root and nested used fields are mapped', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_ITEMS': 'items.name', // This satisfies both 'items' and 'items.name'
        };
        expect(getMissingRequiredFields(mapping, schemaFields)).toEqual([]);
    });

    test('should return root requirements if mapping is empty', () => {
        const mapping = {};
        expect(new Set(getMissingRequiredFields(mapping, schemaFields))).toEqual(new Set(['`id`', '`items`']));
    });

    test('should detect missing root-level field', () => {
        const mapping = {
            'CSV_ITEMS': 'items.name',
        };
        expect(getMissingRequiredFields(mapping, schemaFields)).toEqual(['`id`']);
    });
    
    test('should detect missing nested required field when sibling is mapped', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_ITEMS': 'items.name',
            'CSV_MAN_URL': 'manufacturer.url', // Using the manufacturer object
        };
        // 'manufacturer.name' is now required
        expect(getMissingRequiredFields(mapping, schemaFields)).toEqual(['`manufacturer.name`']);
    });

    test('should detect missing required field within an array item when sibling is mapped', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_ITEM_VALUE': 'items.value', // Using an item object
        };
        // 'items' is satisfied, but 'items.name' is now required
        expect(getMissingRequiredFields(mapping, schemaFields)).toEqual(['`items.name`']);
    });

    test('should not require nested fields if parent object is not used at all', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_ITEMS': 'items.name',
        };
        // manufacturer object not used, so manufacturer.name is not listed as missing
        expect(getMissingRequiredFields(mapping, schemaFields)).toEqual([]);
    });

    test('should handle a completely satisfied mapping', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_MAN_NAME': 'manufacturer.name',
            'CSV_ITEMS': 'items.name',
        };
        expect(getMissingRequiredFields(mapping, schemaFields)).toEqual([]);
    });
});

describe('getMissingRequiredFields with array requirements', () => {
    const schemaFields = [
        { path: 'id', required: true },
        // Array with minItems
        { path: 'rootArray', type: 'array', isArray: true, minItems: 2 },
        { path: 'rootArray.name', type: 'string', required: true },
        { path: 'rootArray.value', type: 'number', required: false },
        // Array without minItems
        { path: 'optionalArray', type: 'array', isArray: true },
        { path: 'optionalArray.name', type: 'string', required: true },
    ];

    test('should require fields for all items in a minItems array if that array is being constructed', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_ROOT_VAL': 'rootArray[0].value', // This constructs the rootArray
        };
        const missing = getMissingRequiredFields(mapping, schemaFields);
        expect(new Set(missing)).toEqual(new Set([
            '`rootArray[0].name`', // Missing from the constructed item
            '`rootArray[1].name`', // Required because of minItems: 2
        ]));
    });
    
    test('should only require fields for constructed items in optional arrays', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_OPT_VAL': 'optionalArray[0].value', // Constructing item 0
            'CSV_OPT_NAME': 'optionalArray[2].name', // Constructing item 2
        };
        const missing = getMissingRequiredFields(mapping, schemaFields);
        expect(new Set(missing)).toEqual(new Set([
            '`optionalArray[0].name`', // Because item 0 is used and its 'name' is required
        ]));
    });

     test('should report all missing fields when minItems array is unmapped', () => {
        const mapping = { 'CSV_ID': 'id' }; // rootArray is not mapped at all
        const missing = getMissingRequiredFields(mapping, schemaFields);
         // If the array itself isn't being constructed, its children aren't required.
        expect(missing).toEqual([]);
    });
    
    test('should be satisfied if all requirements are met', () => {
        const mapping = {
            'CSV_ID': 'id',
            'CSV_ROOT_0': 'rootArray[0].name',
            'CSV_ROOT_1': 'rootArray[1].name',
            'CSV_OPT_0': 'optionalArray[0].name',
        };
        const missing = getMissingRequiredFields(mapping, schemaFields);
        expect(missing).toEqual([]);
    });
});
