// src/wizard/dpp-generator.js

/**
 * Scrapes form data and generates a DPP JSON object.
 * @param {HTMLElement} formContainer - The container for the schema-generated form.
 * @param {HTMLElement} voluntaryFieldsWrapper - The container for voluntary fields.
 * @returns {object} The generated DPP JSON object.
 */
export function generateDpp(formContainer, voluntaryFieldsWrapper) {
    const dpp = {};

    // 1. Scrape data from the schema-generated form
    const inputs = formContainer.querySelectorAll('input, select');
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
                    value = null; // or handle as an error
                }
                break;
            default:
                value = input.value;
                break;
        }
        dpp[key] = value;
    });

    // 2. Scrape data from the voluntary fields
    const voluntaryRows = voluntaryFieldsWrapper.querySelectorAll('.voluntary-field-row');
    voluntaryRows.forEach(row => {
        const nameInput = row.querySelector('.voluntary-name');
        const valueInput = row.querySelector('.voluntary-value');
        if (nameInput && valueInput && nameInput.value) {
            dpp[nameInput.value] = valueInput.value;
        }
    });

    return dpp;
}
