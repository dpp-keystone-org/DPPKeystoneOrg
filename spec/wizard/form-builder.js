// src/wizard/form-builder.js

/**
 * Recursively generates form rows for a given set of schema properties.
 * @param {DocumentFragment} fragment - The fragment to append generated rows to.
 * @param {object} properties - The JSON schema properties object.
 * @param {Map<string, {label: string, comment: string}>} ontologyMap - A map of ontology terms.
 * @param {string} [parentPath=''] - The prefix for field names, used for nesting.
 */
function generateRows(fragment, properties, ontologyMap, parentPath = '') {
    // console.log(`[FormBuilder] generateRows called for path: '${parentPath}'`);
    for (const [key, prop] of Object.entries(properties)) {
        // console.log(`[FormBuilder]   Processing key: '${key}'`);
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
                    case 'array': {
                        const itemContainer = document.createElement('div'); // This just holds the button now.
                        const addButton = document.createElement('button');
                        addButton.type = 'button';
                        addButton.textContent = 'Add Item';
                        addButton.className = 'add-array-item-btn';
                        addButton.dataset.arrayName = currentPath;

                        let lastElement = row;

                        if (prop.items?.type === 'object' && prop.items?.properties) {
                            // Array of Objects
                            addButton.addEventListener('click', () => {
                                const arrayName = currentPath;
                                // Find all direct child rows of the grid to count how many items already exist.
                                // This is more robust than counting inputs.
                                const itemIndex = document.querySelectorAll(`[data-array-group^="${arrayName}."]`).length > 0
                                    ? Math.max(...[...document.querySelectorAll(`[data-array-group^="${arrayName}."]`)]
                                        .map(el => parseInt(el.dataset.arrayGroup.split('.').pop(), 10))) + 1
                                    : 0;

                                const newObjectPath = `${arrayName}.${itemIndex}`;

                                const newObjectFragment = document.createDocumentFragment();
                                generateRows(newObjectFragment, prop.items.properties, ontologyMap, newObjectPath);
                                
                                const newItemRows = [...newObjectFragment.children];

                                // Add a data-attribute to group all rows of this object item
                                newItemRows.forEach(r => r.dataset.arrayGroup = newObjectPath);
                                
                                const controlRow = document.createElement('div');
                                controlRow.className = 'grid-row array-item-control-row';
                                controlRow.dataset.arrayGroup = newObjectPath;
                                
                                controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                
                                const removeCell = document.createElement('div');
                                removeCell.className = 'grid-cell';
                                const removeButton = document.createElement('button');
                                removeButton.type = 'button';
                                removeButton.textContent = 'Remove';
                                removeButton.addEventListener('click', (event) => {
                                    const clickedButton = event.currentTarget;
                                    const controlRow = clickedButton.closest('.array-item-control-row');
                                    const groupToRemove = controlRow.dataset.arrayGroup;
                                    if (!groupToRemove) return;

                                    const pathParts = groupToRemove.split('.');
                                    const arrayName = pathParts.slice(0, -1).join('.');
                                    const indexToRemove = parseInt(pathParts.pop(), 10);

                                    const rowsToRemove = document.querySelectorAll(`[data-array-group="${groupToRemove}"]`);

                                    // Check if the current lastElement is among those being removed.
                                    let isLastElementBeingRemoved = false;
                                    rowsToRemove.forEach(r => {
                                        if (r === lastElement) {
                                            isLastElementBeingRemoved = true;
                                        }
                                    });

                                    // Remove all visual elements for this item
                                    rowsToRemove.forEach(r => r.remove());

                                    if (isLastElementBeingRemoved) {
                                        // Find the new last element, which would be the control row of the new last item,
                                        // or the original row with the "Add" button if no items are left.
                                        const allItemGroups = document.querySelectorAll(`[data-array-group^="${arrayName}."].array-item-control-row`);
                                        if (allItemGroups.length > 0) {
                                            lastElement = allItemGroups[allItemGroups.length - 1];
                                        } else {
                                            lastElement = row; // Reset to the "Add" button's row.
                                        }
                                    }

                                    // After removal, find all subsequent item groups and re-index them
                                    const allGroupNames = [...new Set([...document.querySelectorAll(`[data-array-group^="${arrayName}."]`)]
                                        .map(el => el.dataset.arrayGroup))];

                                    allGroupNames.forEach(groupName => {
                                        const currentPathParts = groupName.split('.');
                                        const currentIndex = parseInt(currentPathParts.pop(), 10);

                                        if (currentIndex > indexToRemove) {
                                            const newIndex = currentIndex - 1;
                                            const oldGroupPrefix = `${arrayName}.${currentIndex}`;
                                            const newGroupPrefix = `${arrayName}.${newIndex}`;
                                            
                                            const groupRows = document.querySelectorAll(`[data-array-group="${oldGroupPrefix}"]`);
                                            groupRows.forEach(rowToUpdate => {
                                                rowToUpdate.dataset.arrayGroup = newGroupPrefix;

                                                const input = rowToUpdate.querySelector('input, select');
                                                if(input) {
                                                    const oldName = input.name;
                                                    const fieldName = oldName.split('.').pop();
                                                    const newName = `${newGroupPrefix}.${fieldName}`;
                                                    input.name = newName;
                                                    input.id = newName;
                                                    
                                                    const pathCell = rowToUpdate.querySelector('.grid-cell');
                                                    if(pathCell && pathCell.textContent.startsWith(oldGroupPrefix)) {
                                                        pathCell.textContent = newName;
                                                    }
                                                }
                                            });
                                        }
                                    });
                                });
                                removeCell.appendChild(removeButton);
                                controlRow.appendChild(removeCell);

                                controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                controlRow.appendChild(document.createElement('div')).className = 'grid-cell';

                                newObjectFragment.appendChild(controlRow);
                                
                                lastElement.after(newObjectFragment);
                                lastElement = controlRow;
                            });
                        } else {
                            // Array of simple types (e.g., strings)
                            addButton.addEventListener('click', () => {
                                const arrayName = currentPath;
                                const itemIndex = document.querySelectorAll(`input[name^="${arrayName}."`).length;
                                const path = `${arrayName}.${itemIndex}`;

                                const itemFragment = document.createDocumentFragment();
                                const newRow = document.createElement('div');
                                newRow.className = 'grid-row';
                                
                                const pathCell = document.createElement('div');
                                pathCell.className = 'grid-cell';
                                pathCell.textContent = path;
                                newRow.appendChild(pathCell);

                                const valueCell = document.createElement('div');
                                valueCell.className = 'grid-cell';
                                const itemInput = document.createElement('input');
                                itemInput.type = 'text';
                                itemInput.name = path;
                                itemInput.id = path;
                                valueCell.appendChild(itemInput);
                                newRow.appendChild(valueCell);

                                newRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                newRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                itemFragment.appendChild(newRow);

                                const controlRow = document.createElement('div');
                                controlRow.className = 'grid-row array-item-control-row';
                                controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                
                                const removeCell = document.createElement('div');
                                removeCell.className = 'grid-cell';
                                const removeButton = document.createElement('button');
                                removeButton.type = 'button';
                                removeButton.textContent = 'Remove';
                                removeButton.addEventListener('click', () => {
                                    if (lastElement === controlRow) {
                                        lastElement = newRow.previousElementSibling;
                                    }

                                    const indexToRemove = parseInt(itemInput.name.split('.').pop(), 10);
                                    
                                    newRow.remove();
                                    controlRow.remove();

                                    const allItemInputs = document.querySelectorAll(`input[name^="${arrayName}."`);
                                    allItemInputs.forEach(inputToUpdate => {
                                        const currentIndex = parseInt(inputToUpdate.name.split('.').pop(), 10);
                                        if (currentIndex > indexToRemove) {
                                            const newIndex = currentIndex - 1;
                                            const newPath = `${arrayName}.${newIndex}`;
                                            
                                            inputToUpdate.name = newPath;
                                            inputToUpdate.id = newPath;
                                            
                                            const itemRow = inputToUpdate.closest('.grid-row');
                                            if (itemRow) {
                                                itemRow.querySelector('.grid-cell').textContent = newPath;
                                            }
                                        }
                                    });
                                });
                                removeCell.appendChild(removeButton);
                                controlRow.appendChild(removeCell);

                                controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                itemFragment.appendChild(controlRow);

                                lastElement.after(itemFragment);
                                lastElement = controlRow;
                            });
                        }

                        valueCell.appendChild(itemContainer);
                        valueCell.appendChild(addButton);
                        input = itemContainer;
                        break;
                    }
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

            // --- 3. Ontology Cell (Label) ---
            const ontologyCell = document.createElement('div');
            ontologyCell.className = 'grid-cell';
            const ontologyInfo = ontologyMap.get(key);
            ontologyCell.textContent = ontologyInfo?.label || '';
            row.appendChild(ontologyCell);

            // --- 4. Tooltip Cell ---
            const tooltipCell = document.createElement('div');
            tooltipCell.className = 'grid-cell';
            if (ontologyInfo?.comment) {
                const tooltipButton = document.createElement('button');
                tooltipButton.className = 'tooltip-button';
                tooltipButton.textContent = '?';
                tooltipButton.title = ontologyInfo.comment;
                tooltipButton.type = 'button'; // Prevent form submission
                tooltipCell.appendChild(tooltipButton);
            }
            row.appendChild(tooltipCell);

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
    // console.log('[FormBuilder] buildForm received schema:', JSON.stringify(schema, null, 2));
    const fragment = document.createDocumentFragment();
    let properties = null;

    if (schema?.properties) {
        properties = schema.properties;
    } else if (schema?.then?.properties) {
        properties = schema.then.properties;
    }

    // console.log('[FormBuilder] Extracted properties:', JSON.stringify(properties, null, 2));

    if (properties) {
        const grid = document.createElement('div');
        grid.className = 'sector-form-grid';

        // Add headers
        grid.innerHTML = `
            <div class="grid-header">Field Path</div>
            <div class="grid-header">Value</div>
            <div class="grid-header">Ontology</div>
            <div class="grid-header"></div>
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

