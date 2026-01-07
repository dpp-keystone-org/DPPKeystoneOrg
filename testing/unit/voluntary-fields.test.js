
// Mock HTMLElement and related interfaces if not present (JSDOM handles most, but we might need specific mocks)
// In JSDOM, custom events and basic DOM manipulation work fine.

/**
 * @jest-environment jsdom
 */

import { createVoluntaryFieldRow } from '../../src/wizard/form-builder.js';
import { validateKey } from '../../src/wizard/validator.js';
import { jest } from '@jest/globals';

describe('Voluntary Field Row - Prefix Validation', () => {
    let mockCollisionChecker;
    let mockPrefixChecker;

    beforeEach(() => {
        mockCollisionChecker = jest.fn().mockResolvedValue([]); // No collisions
        // Default: No prefixes defined
        mockPrefixChecker = jest.fn().mockReturnValue(new Set());
    });

    // Helper to create a row and get the key input
    const createRowAndGetKeyInput = () => {
        const row = createVoluntaryFieldRow(mockCollisionChecker, [], null, new Map(), mockPrefixChecker);
        const input = row.querySelector('.voluntary-name');
        return { row, input };
    };

    it('should validate simple camelCase keys without needing a prefix', async () => {
        const { input } = createRowAndGetKeyInput();
        
        input.value = 'myKey';
        input.dispatchEvent(new Event('blur'));

        // Wait for async validation
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(input.classList.contains('invalid')).toBe(false);
        const errorSpan = input.nextElementSibling;
        expect(errorSpan).toBeNull(); // No error message
    });

    it('should reject prefixed key if prefix is NOT defined', async () => {
        const { input } = createRowAndGetKeyInput();
        
        input.value = 'schema:name'; // 'schema' is not in the mock Set
        input.dispatchEvent(new Event('blur'));

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(input.classList.contains('invalid')).toBe(true);
        const errorSpan = input.nextElementSibling;
        expect(errorSpan).not.toBeNull();
        expect(errorSpan.textContent).toContain("Undefined prefix 'schema'");
    });

    it('should accept prefixed key if prefix IS defined', async () => {
        // Mock that 'schema' is defined
        mockPrefixChecker.mockReturnValue(new Set(['schema']));
        const { input } = createRowAndGetKeyInput();
        
        input.value = 'schema:name';
        input.dispatchEvent(new Event('blur'));

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(input.classList.contains('invalid')).toBe(false);
        const errorSpan = input.nextElementSibling;
        expect(errorSpan).toBeNull();
    });

    it('should handle multiple defined prefixes', async () => {
        mockPrefixChecker.mockReturnValue(new Set(['schema', 'ex', 'myvocab']));
        const { input } = createRowAndGetKeyInput();
        
        // Test 'ex'
        input.value = 'ex:customField';
        input.dispatchEvent(new Event('blur'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(input.classList.contains('invalid')).toBe(false);

        // Test 'myvocab'
        input.value = 'myvocab:test';
        input.dispatchEvent(new Event('blur'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(input.classList.contains('invalid')).toBe(false);

        // Test undefined 'other'
        input.value = 'other:field';
        input.dispatchEvent(new Event('blur'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(input.classList.contains('invalid')).toBe(true);
    });

    it('should re-validate when input changes', async () => {
        const { input } = createRowAndGetKeyInput();
        
        // 1. Fail first
        input.value = 'schema:name';
        input.dispatchEvent(new Event('blur'));
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(input.classList.contains('invalid')).toBe(true);

        // 2. Mock adding the prefix (simulating user adding it to the list)
        mockPrefixChecker.mockReturnValue(new Set(['schema']));

        // 3. Trigger validation again (user focuses out)
        input.dispatchEvent(new Event('blur'));
        await new Promise(resolve => setTimeout(resolve, 0));
        
        expect(input.classList.contains('invalid')).toBe(false);
    });
});
