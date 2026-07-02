/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { getDisplayLabel, renderProductPage } from '../../common/rendering/dpp-html-renderer.js?v=1783018380601';

describe('DPP HTML Renderer - Pure Localization', () => {
    const mockOntologyMap = new Map([
        ['productName', {
            label: { en: 'Product Name', de: 'Produktname', fr: 'Nom du Produit' }
        }],
        ['dppStatus', {
            label: { en: 'Passport Status', de: 'Pass-Status', fr: 'Statut du Passeport' }
        }],
        ['batteryCapacity', {
            label: { en: 'Battery Capacity', de: 'Batteriekapazität' },
            unit: 'Ah'
        }]
    ]);

    describe('getDisplayLabel pure rules', () => {
        it('Case 1: should return key exactly when no label is set in ontologyMap', () => {
            expect(getDisplayLabel('a1', mockOntologyMap, 'de')).toBe('a1');
            expect(getDisplayLabel('gwp', mockOntologyMap, 'fr')).toBe('gwp');
        });

        it('Case 2: should default to English label when target language is missing', () => {
            expect(getDisplayLabel('batteryCapacity', mockOntologyMap, 'fr')).toBe('Battery Capacity');
        });

        it('Case 3: should use label in target language when available', () => {
            expect(getDisplayLabel('productName', mockOntologyMap, 'de')).toBe('Produktname');
            expect(getDisplayLabel('productName', mockOntologyMap, 'fr')).toBe('Nom du Produit');
        });
    });

    describe('renderProductPage pure localization', () => {
        const mockDpp = {
            digitalProductPassportId: 'urn:uuid:123',
            dppStatus: 'Active',
            productName: 'Test Phone',
            batteryCapacity: 4500
        };

        it('should render translated labels across metadata and attributes without modifying unmapped shorthand keys', () => {
            const html = renderProductPage({
                dppData: mockDpp,
                ontologyMap: mockOntologyMap,
                language: 'de'
            });

            expect(html).toContain('Pass-Status');
            expect(html).toContain('Batteriekapazität');
            expect(html).not.toContain('Passport Status');
        });
    });
});
