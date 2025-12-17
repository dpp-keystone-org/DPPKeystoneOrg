/**
 * @jest-environment jsdom
 */

import { validateText, validateKey } from '../../src/wizard/validator.js';

describe('Validator - Universal Text Validation', () => {
    it('should accept valid plain text', () => {
        const result = validateText('Hello World');
        expect(result.isValid).toBe(true);
    });

    it('should reject text with control characters', () => {
        // Test various control characters that shouldn't be in user input
        const controlChars = ['\u0000', '\u0007', '\u001F'];
        controlChars.forEach(char => {
            const result = validateText(`Bad${char}Input`);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('Invalid characters');
        });
    });

    it('should accept text with leading/trailing whitespace (sanitization handled by UI)', () => {
        const result = validateText('  Untrimmed  ');
        expect(result.isValid).toBe(true);
    });
});

describe('Validator - Key Validation (Strict CamelCase)', () => {
    it('should accept valid camelCase keys', () => {
        const validKeys = ['myKey', 'camelCase', 'a', 'myKey123', 'nestedObject'];
        validKeys.forEach(key => {
            const result = validateKey(key);
            expect(result.isValid).toBe(true);
        });
    });

    it('should reject PascalCase', () => {
        const result = validateKey('PascalCase');
        expect(result.isValid).toBe(false);
        expect(result.message).toMatch(/camelCase/);
    });

    it('should reject snake_case', () => {
        const result = validateKey('snake_case');
        expect(result.isValid).toBe(false);
        expect(result.message).toMatch(/camelCase/);
    });

    it('should reject kebab-case', () => {
        const result = validateKey('kebab-case');
        expect(result.isValid).toBe(false);
        expect(result.message).toMatch(/camelCase/);
    });

    it('should reject keys with spaces', () => {
        const result = validateKey('key with spaces');
        expect(result.isValid).toBe(false);
        expect(result.message).toMatch(/camelCase/);
    });

    it('should reject keys starting with numbers', () => {
        const result = validateKey('1stKey');
        expect(result.isValid).toBe(false);
        expect(result.message).toMatch(/camelCase/);
    });

    it('should reject keys with special characters', () => {
        const invalidKeys = ['my$Key', 'key!', 'key@', 'key#', 'key%'];
        invalidKeys.forEach(key => {
            const result = validateKey(key);
            expect(result.isValid).toBe(false);
        });
    });

    it('should reject empty keys', () => {
        const result = validateKey('');
        expect(result.isValid).toBe(false);
        expect(result.message).toBe('Key cannot be empty');
    });

    it('should reject keys that are just whitespace', () => {
        const result = validateKey('   ');
        expect(result.isValid).toBe(false);
    });

    it('should reject reserved words (optional but good practice)', () => {
        // Preventing collisions with JS prototype or internal logic
        const reserved = ['__proto__', 'constructor', 'prototype'];
        reserved.forEach(word => {
            const result = validateKey(word);
            expect(result.isValid).toBe(false);
            expect(result.message).toContain('Reserved word');
        });
    });
});