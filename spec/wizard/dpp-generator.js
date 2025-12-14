// Cache-busting comment to force re-evaluation.
// src/wizard/dpp-generator.js

/**
 * Sets a nested property on an object based on a dot-notation path.
 * Handles the creation of nested objects and arrays as needed.
 * @param {object} obj The object to modify.
 * @param {string} path The dot-notation path (e.g., 'a.b.0.c').
 * @param {*} value The value to set at the nested path.
 */
function setProperty(obj, path, value) {
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


/**
 * Scrapes form data and generates a DPP JSON object.
 * @param {string} sector - The selected sector (e.g., 'construction').
 * @param {HTMLElement} coreFormContainer - The container for the core DPP form.
 * @param {HTMLElement} formContainer - The container for the schema-generated sector form.
 * @param {HTMLElement} voluntaryFieldsWrapper - The container for voluntary fields.
 * @returns {object} The generated DPP JSON object.
 */
export function generateDpp(sector, coreFormContainer, formContainer, voluntaryFieldsWrapper) {
    const dpp = {};
    const containers = [coreFormContainer, formContainer];

    // 1. Scrape data from the core and sector-specific forms
    containers.forEach(container => {
        if (!container) return;
        const inputs = container.querySelectorAll('input, select');
        inputs.forEach(input => {
            const key = input.name;
            if (!key) return;

            let value;
            switch (input.type) {
                case 'checkbox':
                    value = input.checked;
                    break;
                case 'number':
                    value = input.valueAsNumber;
                    if (isNaN(value)) {
                        value = null; // Will be omitted by setProperty
                    }
                    break;
                default:
                    value = input.value;
                    break;
            }
            
            setProperty(dpp, key, value);
        });
    });

    // 2. Scrape data from the voluntary fields, also handling nesting
    const voluntaryRows = voluntaryFieldsWrapper.querySelectorAll('.voluntary-field-row');
    voluntaryRows.forEach(row => {
        const nameInput = row.querySelector('.voluntary-name');
        const valueInput = row.querySelector('.voluntary-value');
        if (nameInput && valueInput && nameInput.value) {
            // Attempt to parse value as a number if it looks like one
            const rawValue = valueInput.value;
            let finalValue = rawValue;
            if (rawValue !== '' && !isNaN(Number(rawValue))) {
                finalValue = Number(rawValue);
            }
            setProperty(dpp, nameInput.value, finalValue);
        }
    });

    // 3. Automatically add contentSpecificationId and contentSpecificationIds based on sector
    if (sector) {
        // This logic assumes a consistent naming convention.
        // E.g., the 'construction' sector maps to 'construction-product-dpp-v1'.
        const specId = `${sector}-product-dpp-v1`;
        dpp.contentSpecificationId = specId;
        dpp.contentSpecificationIds = [specId];
    }

    return dpp;
}