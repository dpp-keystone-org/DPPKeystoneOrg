// src/util/js/common/dpp-data-utils.js

/**
 * Sets a nested property on an object based on a dot-notation path.
 * Handles the creation of nested objects and arrays as needed.
 * @param {object} obj The object to modify.
 * @param {string} path The dot-notation path (e.g., 'a.b.0.c').
 * @param {*} value The value to set at the nested path.
 */
export function setProperty(obj, path, value) {
    // Omit properties for empty strings or null values (from empty number fields)
    if (value === '' || value === null) {
        return;
    }

    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        const nextKey = keys[i + 1];

        // Determine if the next level should be an array or an object
        const isNextLevelArray = /^\d+$/.test(nextKey);

        if (current[key] === undefined) {
            current[key] = isNextLevelArray ? [] : {};
        }
        current = current[key];
    }

    const lastKey = keys[keys.length - 1];
    const lastKeyAsIndex = parseInt(lastKey, 10);

    // Set the final value, converting array-like keys to numbers for indexing
    if (Array.isArray(current) && !isNaN(lastKeyAsIndex)) {
        current[lastKeyAsIndex] = value;
    } else {
        current[lastKey] = value;
    }
}
