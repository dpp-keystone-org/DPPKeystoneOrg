/**
 * Lightweight, dependency-free validation functions for the DPP Wizard.
 */

/**
 * Checks if a string is a valid, absolute URI.
 * A simple check for a scheme is sufficient for user guidance.
 * @param {string} value The string to validate.
 * @returns {boolean} True if the string is a valid URI.
 */
export function isURI(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }
    // We are checking for a common scheme followed by ://
    // This covers http, https, ftp, etc. and is good enough for user input validation.
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

/**
 * Checks if a string is a valid 2 or 3-letter country code.
 * @param {string} value The string to validate.
 * @returns {boolean} True if the string is a valid code.
 */
export function isCountryCode(value) {
    if (typeof value !== 'string') return false;
    return /^[A-Z]{2,3}$/.test(value.toUpperCase());
}

/**
 * Checks if a value is a valid number.
 * @param {string} value The value to validate.
 * @returns {boolean} True if the value is a number.
 */
export function isNumber(value) {
    if (value === null || String(value).trim() === '') {
        return false;
    }
    // The unary plus operator is a concise way to convert a value to a number.
    // We then check if the result is a finite number.
    return !isNaN(+value) && isFinite(+value);
}

/**
 * Checks if a value is a valid integer.
 * @param {string} value The value to validate.
 * @returns {boolean} True if the value is an integer.
 */
export function isInteger(value) {
    if (!isNumber(value)) return false;
    return parseFloat(value) % 1 === 0;
}

/**
 * Validates text input for control characters.
 * @param {string} value The text to validate.
 * @returns {{isValid: boolean, message?: string}} The validation result.
 */
export function validateText(value) {
    if (typeof value !== 'string') return { isValid: true };
    
    // Check for control characters (excluding standard whitespace like space, tab, newline)
    // eslint-disable-next-line no-control-regex
    const controlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    if (controlChars.test(value)) {
        return { isValid: false, message: 'Invalid characters detected' };
    }
    
    return { isValid: true };
}

/**
 * Validates a custom field key (strict camelCase).
 * @param {string} value The key to validate.
 * @returns {{isValid: boolean, message?: string}} The validation result.
 */
export function validateKey(value) {
    if (!value || !value.trim()) return { isValid: false, message: 'Key cannot be empty' };
    
    const reserved = ['__proto__', 'constructor', 'prototype'];
    if (reserved.includes(value)) return { isValid: false, message: 'Reserved word not allowed' };

    const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;
    if (!camelCaseRegex.test(value)) {
        return { isValid: false, message: 'Name must be camelCase (e.g., myProperty)' };
    }

    return { isValid: true };
}
