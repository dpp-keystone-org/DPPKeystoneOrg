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

    // Convert bracket notation to dot notation (e.g. "prop[0]" -> "prop.0")
    const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1');

    const keys = normalizedPath.split('.');
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

/**
 * Recursively traverses an object and compacts any arrays that have holes (sparse arrays).
 * Also filters out null/undefined items if desired (currently just compacts holes).
 * @param {object} obj 
 * @returns {object} The modified object (in-place).
 */
export function compactArrays(obj) {
    if (Array.isArray(obj)) {
        // Compact the array itself (remove holes)
        // .filter(Boolean) would remove false/0/null/undefined. 
        // We only want to remove *holes* (sparse) and maybe explicit nulls/undefineds from mapping?
        // JS .filter(item => true) automatically removes holes from sparse arrays.
        // We also likely want to remove explicit 'undefined' if it somehow got there, 
        // but keep 0 or false.
        const compacted = obj.filter(item => item !== undefined && item !== null);
        
        // Recurse into children
        return compacted.map(item => compactArrays(item));
    } else if (obj !== null && typeof obj === 'object') {
        for (const key in obj) {
            obj[key] = compactArrays(obj[key]);
        }
    }
    return obj;
}
