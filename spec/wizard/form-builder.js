// src/wizard/form-builder.js

/**
 * Recursively generates form rows for a given set of schema properties.
 * @param {DocumentFragment} fragment - The fragment to append generated rows to.
 * @param {object} properties - The JSON schema properties object.
 * @param {Map<string, {label: string, comment: string}>} ontologyMap - A map of ontology terms.
 * @param {string} [parentPath=''] - The prefix for field names, used for nesting.
 */
function generateRows(fragment, properties, ontologyMap, parentPath = '') {
    console.log(`[FormBuilder] generateRows called for path: '${parentPath}'`);
    for (const [key, prop] of Object.entries(properties)) {
        console.log(`[FormBuilder]   Processing key: '${key}'`);
        // If the property is a placeholder for a circular ref, skip it.
        if (prop && prop.circular) {
            continue;
        }

        // Exclude fields that should not be rendered
        if (key === 'contentSpecificationIds') {
            continue;
        }

        const currentPath = parentPath ? `${parentPath}.${key}` : key;

        // If the property is a nested object with its own properties, recurse
        if (prop.type === 'object' && prop.properties) {
            generateRows(fragment, prop.properties, ontologyMap, currentPath);
        } else {
            // Otherwise, generate a row for this simple property
            const row = document.createElement('div');
            row.className = 'grid-row';
            
            // --- 1. Field Path Cell ---
            const pathCell = document.createElement('div');
            pathCell.className = 'grid-cell';
            pathCell.textContent = currentPath;
            row.appendChild(pathCell);

            // --- 2. Value Input Cell ---
            const valueCell = document.createElement('div');
            valueCell.className = 'grid-cell';
            let input;

            if (prop.enum) {
                input = document.createElement('select');
                prop.enum.forEach(enumValue => {
                    const option = document.createElement('option');
                    option.value = enumValue;
                    option.textContent = enumValue;
                    input.appendChild(option);
                });
                valueCell.appendChild(input);
            } else {
                switch (prop.type) {
                    case 'string':
                        input = document.createElement('input');
                        input.type = 'text';
                        valueCell.appendChild(input);
                        break;
                    case 'number':
                    case 'integer':
                        input = document.createElement('input');
                        input.type = 'number';
                        valueCell.appendChild(input);
                        break;
                    case 'boolean':
                        input = document.createElement('input');
                        input.type = 'checkbox';
                        valueCell.appendChild(input);
                        break;
                    case 'array':
                        const itemContainer = document.createElement('div');
                        const addButton = document.createElement('button');
                        addButton.type = 'button';
                        addButton.textContent = 'Add Item';
                        addButton.className = 'add-array-item-btn';
                        
                        addButton.addEventListener('click', () => {
                            const itemRow = document.createElement('div');
                            itemRow.className = 'array-item-row';
                            const itemInput = document.createElement('input');
                            // Simple case: array of strings
                            itemInput.type = 'text'; 
                            
                            const removeButton = document.createElement('button');
                            removeButton.type = 'button';
                            removeButton.textContent = 'Remove';
                            removeButton.className = 'remove-array-item-btn';
                            removeButton.addEventListener('click', () => itemRow.remove());

                            itemRow.appendChild(itemInput);
                            itemRow.appendChild(removeButton);
                            itemContainer.appendChild(itemRow);
                        });

                        valueCell.appendChild(itemContainer);
                        valueCell.appendChild(addButton);
                        // No `input` to set id/name for the array itself
                        input = itemContainer; // Set input to container for id purposes
                        break;
                    default:
                        input = document.createElement('span');
                        input.textContent = `[${prop.type}]`; // Placeholder for other types
                        valueCell.appendChild(input);
                }
            }

            if (input) {
                input.id = currentPath;
                input.name = currentPath;
            }
            
            row.appendChild(valueCell);

            // --- 3. Ontology Cell ---
            const ontologyCell = document.createElement('div');
            ontologyCell.className = 'grid-cell';
            const ontologyInfo = ontologyMap.get(key);
            ontologyCell.textContent = ontologyInfo?.comment || prop.description || '';
            row.appendChild(ontologyCell);

            fragment.appendChild(row);
        }
    }
}


/**
 * Generates an HTML form from a JSON schema using a 3-column grid layout.
 * @param {object} schema - The JSON schema object.
 * @param {Map<string, {label: string, comment: string}>} [ontologyMap=new Map()] - A map of ontology terms.
 * @returns {DocumentFragment} A document fragment containing the generated form elements.
 */
export function buildForm(schema, ontologyMap = new Map()) {
    console.log('[FormBuilder] buildForm received schema:', JSON.stringify(schema, null, 2));
    const fragment = document.createDocumentFragment();
    let properties = null;

    if (schema?.properties) {
        properties = schema.properties;
    } else if (schema?.then?.properties) {
        properties = schema.then.properties;
    }

    console.log('[FormBuilder] Extracted properties:', JSON.stringify(properties, null, 2));

    if (properties) {
        const grid = document.createElement('div');
        grid.className = 'sector-form-grid';

        // Add headers
        grid.innerHTML = `
            <div class="grid-header">Field Path</div>
            <div class="grid-header">Value</div>
            <div class="grid-header">Ontology</div>
        `;
        
        // Create a temporary fragment for rows to be appended to the grid
        const rowsFragment = document.createDocumentFragment();
        generateRows(rowsFragment, properties, ontologyMap);
        grid.appendChild(rowsFragment);

        fragment.appendChild(grid);
    } else {
        // Fallback for schemas without properties
        const p = document.createElement('p');
        p.textContent = 'This schema has no properties to display.';
        fragment.appendChild(p);
    }

    return fragment;
}

