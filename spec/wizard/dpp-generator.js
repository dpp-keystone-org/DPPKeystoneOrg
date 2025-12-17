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
 * Recursively scrapes voluntary fields from a container, handling Groups and Types.
 * @param {HTMLElement} container - The container element (wrapper or group container).
 * @returns {object} The scraped data object.
 */
function scrapeVoluntaryContainer(container) {
    const result = {};
    // Iterate over direct children that are rows to preserve hierarchy
    const rows = Array.from(container.children).filter(el => el.classList.contains('voluntary-field-row'));

    rows.forEach(row => {
        const nameInput = row.querySelector('.voluntary-name');
        if (!nameInput || !nameInput.value) return;
        const key = nameInput.value;

        const typeSelect = row.querySelector('.voluntary-type');
        const type = typeSelect ? typeSelect.value : 'Text';

        if (type === 'Group') {
            const groupContainer = row.querySelector('.voluntary-group-container');
            if (groupContainer) {
                const groupData = scrapeVoluntaryContainer(groupContainer);
                // Only add if not empty? Or always add? 
                // For now, we add it to allow empty groups if created explicitly.
                result[key] = groupData;
            }
        } else if (row.querySelector('.voluntary-group-container .sector-form-grid')) {
            // Handle complex custom types (rendered as a grid)
            const groupContainer = row.querySelector('.voluntary-group-container');
            const inputs = groupContainer.querySelectorAll('input, select');
            inputs.forEach(input => {
                if (!input.name) return;
                let value;
                if (input.type === 'checkbox') {
                    value = input.checked;
                } else if (input.type === 'number') {
                    value = input.valueAsNumber;
                    if (isNaN(value)) value = null;
                } else {
                    value = input.value;
                }
                setProperty(result, input.name, value);
            });
        } else {
            const valueInput = row.querySelector('.voluntary-value');
            // If value input is missing (e.g. UI glitch), skip
            if (!valueInput) return;

            let rawVal = valueInput.value;
            let finalVal = rawVal;

            if (type === 'Number') {
                if (rawVal === '' || rawVal === null) return; // Skip empty numbers
                finalVal = Number(rawVal);

                const unitInput = row.querySelector('.voluntary-unit');
                if (unitInput && unitInput.value) {
                    finalVal = { value: finalVal, unit: unitInput.value };
                }
            } else if (type === 'True/False') {
                finalVal = (rawVal === 'true');
            } else {
                // Text
                if (rawVal === '' || rawVal === null) return; // Skip empty text
            }
            result[key] = finalVal;
        }
    });
    return result;
}

/**
 * Scrapes form data and generates a DPP JSON object.
 * @param {string[]} sectors - An array of selected sectors (e.g., ['construction', 'battery']).
 * @param {HTMLElement} coreFormContainer - The container for the core DPP form.
 * @param {HTMLElement} formContainer - The container for the schema-generated sector form.
 * @param {HTMLElement} voluntaryFieldsWrapper - The container for voluntary fields.
 * @returns {object} The generated DPP JSON object.
 */
export function generateDpp(sectors, coreFormContainer, formContainer, voluntaryFieldsWrapper) {
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

    // 2. Scrape data from the voluntary fields using recursive logic
    const voluntaryData = scrapeVoluntaryContainer(voluntaryFieldsWrapper);
    Object.assign(dpp, voluntaryData);

    // 3. Automatically add contentSpecificationId(s) based on the array of sectors
    if (sectors && sectors.length > 0) {
        dpp.contentSpecificationIds = sectors.map(sector => `${sector}-product-dpp-v1`);
    }

    return dpp;
}