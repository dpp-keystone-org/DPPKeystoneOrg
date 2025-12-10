// src/wizard/form-builder.js

/**
 * Generates an HTML form from a JSON schema.
 * @param {object} schema - The JSON schema object.
 * @returns {DocumentFragment} A document fragment containing the generated form elements.
 */
export function buildForm(schema) {
    const fragment = document.createDocumentFragment();

    if (schema && schema.properties) {
        for (const [key, prop] of Object.entries(schema.properties)) {
            // Exclude 'contentSpecificationIds' from the generated form
            if (key === 'contentSpecificationIds') {
                continue;
            }

            const formGroup = document.createElement('div');
            formGroup.className = 'form-group';

            const label = document.createElement('label');
            label.setAttribute('for', key);
            label.textContent = prop.title || key;
            formGroup.appendChild(label);

            let input;

            // Handle enums by creating a select dropdown
            if (prop.enum) {
                input = document.createElement('select');
                prop.enum.forEach(enumValue => {
                    const option = document.createElement('option');
                    option.value = enumValue;
                    option.textContent = enumValue;
                    input.appendChild(option);
                });
            } else {
                switch (prop.type) {
                    case 'string':
                        input = document.createElement('input');
                        input.type = 'text';
                        break;
                    case 'number':
                    case 'integer':
                        input = document.createElement('input');
                        input.type = 'number';
                        break;
                    case 'boolean':
                        input = document.createElement('input');
                        input.type = 'checkbox';
                        break;
                    default:
                        // For complex types (object, array), just show a placeholder for now
                        input = document.createElement('p');
                        input.textContent = `[Complex field for ${key} of type ${prop.type}]`;
                }
            }

            if (input.tagName !== 'P') {
                input.id = key;
                input.name = key;
                if (prop.description) {
                    const description = document.createElement('p');
                    description.className = 'description';
                    description.textContent = prop.description;
                    formGroup.appendChild(description);
                }
            }
            
            formGroup.appendChild(input);
            fragment.appendChild(formGroup);
        }
    }

    return fragment;
}
