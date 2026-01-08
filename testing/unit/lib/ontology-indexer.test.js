/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';

// Define the mock factory
const mockLoadOntology = jest.fn();

// Mock the dependency using unstable_mockModule for ESM support
jest.unstable_mockModule('../../../src/lib/ontology-loader.js', () => ({
    loadOntology: mockLoadOntology
}));

// Dynamic import to ensure the mock is applied before the module is loaded
const { buildIndex } = await import('../../../src/lib/ontology-indexer.js');

describe('Ontology Indexer', () => {
    beforeEach(() => {
        mockLoadOntology.mockClear();
    });

    it('should build an index with context labels and doc URLs', async () => {
        const mockMap = new Map();
        mockMap.set('TestClass', {
            label: { en: 'Test Class' },
            type: 'rdfs:Class',
            definedIn: { type: 'core', name: 'Product' }
        });
        mockMap.set('testProp', {
            label: { en: 'Test Property' },
            type: 'rdf:Property',
            definedIn: { type: 'sectors', name: 'Battery' }
        });

        mockLoadOntology.mockResolvedValue(mockMap);

        const index = await buildIndex();

        expect(index).toHaveLength(2);

        const classItem = index.find(i => i.id === 'TestClass');
        expect(classItem).toBeDefined();
        expect(classItem.contextLabel).toBe('Core / Product');
        expect(classItem.contextDocUrl).toBe('../spec/ontology/v1/core/Product/index.html');
        expect(classItem.docUrl).toBe('../spec/ontology/v1/core/Product/TestClass.html');

        const propItem = index.find(i => i.id === 'testProp');
        expect(propItem).toBeDefined();
        expect(propItem.contextLabel).toBe('Sectors / Battery');
        expect(propItem.contextDocUrl).toBe('../spec/ontology/v1/sectors/Battery/index.html');
        expect(propItem.docUrl).toBe('../spec/ontology/v1/sectors/Battery/index.html#testProp');
    });

    it('should resolve domain documentation URLs', async () => {
        const mockMap = new Map();
        // Define the Domain Class
        mockMap.set('ConstructionProduct', {
            label: { en: 'Construction Product' },
            type: 'rdfs:Class',
            definedIn: { type: 'sectors', name: 'Construction' }
        });
        // Define a Property using that Domain
        mockMap.set('hasCement', {
            label: { en: 'Has Cement' },
            type: 'rdf:Property',
            definedIn: { type: 'sectors', name: 'Construction' },
            domain: { '@id': 'dppk:ConstructionProduct' }
        });

        mockLoadOntology.mockResolvedValue(mockMap);

        const index = await buildIndex();
        const propItem = index.find(i => i.id === 'hasCement');

        expect(propItem.domain).toBe('dppk:ConstructionProduct');
        expect(propItem.domainDocUrl).toBe('../spec/ontology/v1/sectors/Construction/ConstructionProduct.html');
    });

    it('should handle terms without defined source context', async () => {
        const mockMap = new Map();
        mockMap.set('OrphanTerm', {
            label: { en: 'Orphan' },
            type: 'rdfs:Class',
            definedIn: null
        });

        mockLoadOntology.mockResolvedValue(mockMap);

        const index = await buildIndex();
        const item = index[0];

        expect(item.id).toBe('OrphanTerm');
        expect(item.contextLabel).toBe('');
        expect(item.docUrl).toBeNull();
    });

    it('should handle multiple types (array) for Class detection', async () => {
        const mockMap = new Map();
        mockMap.set('ComplexClass', {
            label: { en: 'Complex' },
            type: ['owl:Class', 'rdfs:Class'],
            definedIn: { type: 'core', name: 'Core' }
        });

        mockLoadOntology.mockResolvedValue(mockMap);

        const index = await buildIndex();
        const item = index[0];

        // Should be treated as a class
        expect(item.docUrl).toBe('../spec/ontology/v1/core/Core/ComplexClass.html');
    });
});
