// src/wizard/form-builder.js
import { isURI, isCountryCodeAlpha3, isNumber, isInteger } from './validator.js';

/**
 * Recursively generates form rows for a given set of schema properties.
 * @param {DocumentFragment} fragment - The fragment to append generated rows to.
 * @param {object} properties - The JSON schema properties object.
 * @param {Map<string, {label: object, comment: object, unit: string}>} ontologyMap - A map of ontology terms.
 * @param {string} [parentPath=''] - The prefix for field names, used for nesting.
 * @param {number} [indentationLevel=0] - The current level of nesting for UI indentation.
 * @param {string} [lang='en'] - The current language code.
 */
function generateRows(fragment, properties, ontologyMap, requiredFields = [], parentPath = '', indentationLevel = 0, lang = 'en') {
    // console.log(`[FormBuilder] generateRows called for path: '${parentPath}', level: ${indentationLevel}`);
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
        const isRequired = requiredFields.includes(key);

        // If the property is a nested object with its own properties, create a header and recurse
        if (prop.type === 'object' && prop.properties) {
            const ontologyInfo = ontologyMap.get(key); // Simple lookup for headers
            const headerRow = document.createElement('div');
            headerRow.className = 'grid-row grid-row-header';
            
            // --- 1. Field Path Cell (for header) ---
            const pathCell = document.createElement('div');
            pathCell.className = 'grid-cell';
            pathCell.textContent = currentPath;
            pathCell.style.paddingLeft = `${indentationLevel * 20}px`;
            headerRow.appendChild(pathCell);
            
            // --- 2. Value Input Cell (empty for header) ---
            headerRow.appendChild(document.createElement('div')).className = 'grid-cell';

            // --- 3. Unit Cell (empty for header) ---
            headerRow.appendChild(document.createElement('div')).className = 'grid-cell';

            // --- 4. Ontology Cell (for header) ---
            const ontologyCell = document.createElement('div');
            ontologyCell.className = 'grid-cell';
            if (ontologyInfo?.label) {
                if (typeof ontologyInfo.label === 'string') {
                    ontologyCell.textContent = ontologyInfo.label;
                } else {
                    ontologyCell.textContent = ontologyInfo.label[lang] || ontologyInfo.label.en || '';
                }
            }
            headerRow.appendChild(ontologyCell);

            // --- 5. Tooltip Cell (for header) ---
            const tooltipCell = document.createElement('div');
            tooltipCell.className = 'grid-cell';
            
            let commentText = '';
            if (ontologyInfo?.comment) {
                if (typeof ontologyInfo.comment === 'object') {
                    commentText = ontologyInfo.comment[lang] || ontologyInfo.comment.en || '';
                } else {
                    commentText = ontologyInfo.comment;
                }
            }

            if (commentText || ontologyInfo?.governedBy) {
                const tooltipButton = document.createElement('button');
                tooltipButton.className = 'tooltip-button';
                tooltipButton.textContent = '?';
                tooltipButton.type = 'button';
                tooltipButton.addEventListener('click', () => {
                    // Function to remove any existing modal
                    const removeExistingModal = () => {
                        const existingOverlay = document.querySelector('.tooltip-modal-overlay');
                        const existingModal = document.querySelector('.tooltip-modal');
                        if (existingOverlay) existingOverlay.remove();
                        if (existingModal) existingModal.remove();
                    };
                    removeExistingModal(); // Clear any previous modal

                    const overlay = document.createElement('div');
                    overlay.className = 'tooltip-modal-overlay';

                    const modal = document.createElement('div');
                    modal.className = 'tooltip-modal';
                    
                    const modalBody = document.createElement('div');

                    if (commentText) {
                        const descriptionPara = document.createElement('p');
                        descriptionPara.textContent = commentText;
                        modalBody.appendChild(descriptionPara);
                    }

                    if (ontologyInfo?.governedBy) {
                        const standardPara = document.createElement('p');
                        standardPara.textContent = `Standard: ${ontologyInfo.governedBy}`;
                        modalBody.appendChild(standardPara);
                    }

                    modal.appendChild(modalBody);

                    const closeButton = document.createElement('button');
                    closeButton.className = 'modal-close-btn';
                    closeButton.innerHTML = '&times;'; // HTML entity for 'close'
                    
                    const closeModal = () => {
                        overlay.remove();
                        modal.remove();
                    };

                    closeButton.addEventListener('click', closeModal);
                    overlay.addEventListener('click', closeModal);

                    modal.appendChild(closeButton);
                    document.body.appendChild(overlay);
                    document.body.appendChild(modal);
                });
                tooltipCell.appendChild(tooltipButton);
            }
            headerRow.appendChild(tooltipCell);

            fragment.appendChild(headerRow);

            // Recurse for the nested properties with increased indentation
            generateRows(fragment, prop.properties, ontologyMap, prop.required || [], currentPath, indentationLevel + 1, lang);
        } else {
            // Otherwise, generate a regular row for this simple property
            const row = document.createElement('div');
            row.className = 'grid-row';
            
            // --- 1. Field Path Cell ---
            const pathCell = document.createElement('div');
            pathCell.className = 'grid-cell';
            pathCell.textContent = currentPath;
            pathCell.style.paddingLeft = `${indentationLevel * 20}px`;
            row.appendChild(pathCell);

            // --- 2. Value Input Cell ---
            const valueCell = document.createElement('div');
            valueCell.className = 'grid-cell';
            let input;

            if (prop.enum) {
                input = document.createElement('select');
                if (isRequired) {
                    const placeholder = document.createElement('option');
                    placeholder.value = '';
                    placeholder.textContent = 'Select...';
                    placeholder.selected = true;
                    placeholder.disabled = true;
                    input.appendChild(placeholder);
                }
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
                        if (prop.format === 'date') {
                            input.type = 'date';
                        } else if (prop.format === 'date-time') {
                            input.type = 'datetime-local';
                        } else {
                            input.type = 'text';
                        }
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
                                // Start array item indentation one level deeper
                                generateRows(newObjectFragment, prop.items.properties, ontologyMap, prop.items.required || [], newObjectPath, indentationLevel + 1, lang);
                                
                                const newItemRows = [...newObjectFragment.children];

                                // Add a data-attribute to group all rows of this object item
                                newItemRows.forEach(r => r.dataset.arrayGroup = newObjectPath);
                                
                                const controlRow = document.createElement('div');
                                controlRow.className = 'grid-row array-item-control-row';
                                controlRow.dataset.arrayGroup = newObjectPath;
                                
                                const firstCell = document.createElement('div');
                                firstCell.className = 'grid-cell';
                                firstCell.style.paddingLeft = `${indentationLevel * 20}px`;
                                controlRow.appendChild(firstCell);
                                
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
                                pathCell.style.paddingLeft = `${(indentationLevel + 1) * 20}px`;
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
                                newRow.appendChild(document.createElement('div')).className = 'grid-cell';
                                itemFragment.appendChild(newRow);

                                const controlRow = document.createElement('div');
                                controlRow.className = 'grid-row array-item-control-row';
                                const firstCell = document.createElement('div');
                                firstCell.className = 'grid-cell';
                                firstCell.style.paddingLeft = `${(indentationLevel + 1) * 20}px`;
                                controlRow.appendChild(firstCell);
                                
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

                // Handle the 'default' keyword for pre-populating fields.
                if (prop.default !== undefined) {
                    if (prop.type === 'boolean') {
                        input.checked = prop.default;
                    } else {
                        input.value = prop.default;
                    }
                }
            }
            
            // --- New logic to find ontology info with inheritance ---
            const pathParts = currentPath.split('.');
            let ontologyInfo = null;
            let unit = '';
            let governedBy = '';

            // Find the leaf-most info object for label/comment.
            for (let i = pathParts.length - 1; i >= 0; i--) {
                const info = ontologyMap.get(pathParts[i]);
                if (info) {
                    ontologyInfo = info;
                    break;
                }
            }

            // Find the leaf-most unit (inheritance/override).
            for (let i = pathParts.length - 1; i >= 0; i--) {
                const info = ontologyMap.get(pathParts[i]);
                if (info && info.unit) {
                    unit = info.unit;
                    break;
                }
            }

            // Find the leaf-most governedBy (inheritance/override).
            for (let i = pathParts.length - 1; i >= 0; i--) {
                const info = ontologyMap.get(pathParts[i]);
                if (info && info.governedBy) {
                    governedBy = info.governedBy;
                    break;
                }
            }

            // --- Attach Validation Logic ---
            if (input && input.type !== 'checkbox' && input.type !== 'button') {
                const handleValidation = (e) => {
                    const { target } = e;
                    const value = target.value;
                    let validationResult = { isValid: true };

                    // First, check for browser-level invalidity, which is the most reliable way to catch
                    // cases where a user enters text into a number field, which the browser then blanks.
                    if ((prop.type === 'number' || prop.type === 'integer') && !target.validity.valid && value === '') {
                        validationResult = { isValid: false, message: 'Must be a valid number' };
                    } else if (value === '') {
                        if (isRequired) {
                            validationResult = { isValid: false, message: 'This field is required' };
                        }
                    } else {
                        // --- Determine which validation to run for non-empty fields ---
                        if (prop.format === 'uri') {
                            if (!isURI(value)) {
                                validationResult = { isValid: false, message: 'Must be a valid URI (e.g., http://example.com)' };
                            }
                        } else if (target.name.endsWith('countryOfOrigin') || target.name.endsWith('addressCountry') || target.name.endsWith('productionLocationCountry')) {
                            if (!isCountryCodeAlpha3(value)) {
                                validationResult = { isValid: false, message: 'Must be a valid 3-letter country code (ISO 3166-1 alpha-3)' };
                            }
                        } else if (ontologyInfo?.validation) {
                            const { min, max } = ontologyInfo.validation;
                            const num = parseFloat(value);
                            if (isNaN(num) || num < min || num > max) {
                                validationResult = { isValid: false, message: `Must be between ${min} and ${max}` };
                            }
                        } else {
                            // Fallback to basic type validation
                            if (prop.type === 'number' && !isNumber(value)) {
                                validationResult = { isValid: false, message: 'Must be a valid number' };
                            } else if (prop.type === 'integer' && !isInteger(value)) {
                                validationResult = { isValid: false, message: 'Must be a whole number' };
                            }
                        }
                    }

                    // --- Update UI based on validation result ---
                    const errorMsgId = `${target.id}-error`;
                    let errorSpan = target.parentElement.querySelector(`#${errorMsgId}`);

                    if (validationResult.isValid) {
                        target.classList.remove('invalid');
                        if (errorSpan) {
                            errorSpan.remove();
                        }
                    } else {
                        target.classList.add('invalid');
                        if (!errorSpan) {
                            errorSpan = document.createElement('span');
                            errorSpan.id = errorMsgId;
                            errorSpan.className = 'error-message';
                            target.parentElement.appendChild(errorSpan);
                        }
                        errorSpan.textContent = validationResult.message;
                    }

                    // Dispatch an event so the main wizard logic can track global validity
                    const validityEvent = new CustomEvent('fieldValidityChange', {
                        bubbles: true,
                        composed: true,
                        detail: {
                            path: target.name,
                            isValid: validationResult.isValid
                        }
                    });
                    target.dispatchEvent(validityEvent);
                };
                input.addEventListener('input', handleValidation);
            }
            
            row.appendChild(valueCell);

            // --- 3. Unit Cell ---
            const unitCell = document.createElement('div');
            unitCell.className = 'grid-cell';
            unitCell.textContent = unit || '';
            row.appendChild(unitCell);

            // --- 4. Ontology Cell (Label) ---
            const ontologyCell = document.createElement('div');
            ontologyCell.className = 'grid-cell';
            if (ontologyInfo?.label) {
                if (typeof ontologyInfo.label === 'string') {
                    ontologyCell.textContent = ontologyInfo.label;
                } else {
                    ontologyCell.textContent = ontologyInfo.label[lang] || ontologyInfo.label.en || '';
                }
            }
            row.appendChild(ontologyCell);

            // --- 5. Tooltip Cell ---
            const tooltipCell = document.createElement('div');
            tooltipCell.className = 'grid-cell';

            let commentText = '';
            if (ontologyInfo?.comment) {
                if (typeof ontologyInfo.comment === 'object') {
                    commentText = ontologyInfo.comment[lang] || ontologyInfo.comment.en || '';
                } else {
                    commentText = ontologyInfo.comment;
                }
            }
            
            if (commentText || governedBy) {
                const tooltipButton = document.createElement('button');
                tooltipButton.className = 'tooltip-button';
                tooltipButton.textContent = '?';
                tooltipButton.type = 'button'; // Prevent form submission
                tooltipButton.addEventListener('click', () => {
                    // Function to remove any existing modal
                    const removeExistingModal = () => {
                        const existingOverlay = document.querySelector('.tooltip-modal-overlay');
                        const existingModal = document.querySelector('.tooltip-modal');
                        if (existingOverlay) existingOverlay.remove();
                        if (existingModal) existingModal.remove();
                    };
                    removeExistingModal(); // Clear any previous modal

                    const overlay = document.createElement('div');
                    overlay.className = 'tooltip-modal-overlay';

                    const modal = document.createElement('div');
                    modal.className = 'tooltip-modal';
                    
                    const modalBody = document.createElement('div');

                    if (commentText) {
                        const descriptionPara = document.createElement('p');
                        descriptionPara.textContent = commentText;
                        modalBody.appendChild(descriptionPara);
                    }

                    if (governedBy) {
                        const standardPara = document.createElement('p');
                        standardPara.textContent = `Standard: ${governedBy}`;
                        modalBody.appendChild(standardPara);
                    }

                    modal.appendChild(modalBody);

                    const closeButton = document.createElement('button');
                    closeButton.className = 'modal-close-btn';
                    closeButton.innerHTML = '&times;'; // HTML entity for 'close'
                    
                    const closeModal = () => {
                        overlay.remove();
                        modal.remove();
                    };

                    closeButton.addEventListener('click', closeModal);
                    overlay.addEventListener('click', closeModal);

                    modal.appendChild(closeButton);
                    document.body.appendChild(overlay);
                    document.body.appendChild(modal);
                });
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
 * @param {string} [lang='en'] - The current language code.
 * @returns {DocumentFragment} A document fragment containing the generated form elements.
 */
export function buildForm(schema, ontologyMap = new Map(), lang = 'en') {
    // console.log('[FormBuilder] buildForm received schema:', JSON.stringify(schema, null, 2));
    const fragment = document.createDocumentFragment();
    let properties = null;
    let requiredFields = [];

    if (schema?.properties) {
        properties = schema.properties;
        requiredFields = schema.required || [];
    } else if (schema?.then?.properties) {
        properties = schema.then.properties;
        requiredFields = schema.then.required || [];
    }

    // console.log('[FormBuilder] Extracted properties:', JSON.stringify(properties, null, 2));

    if (properties) {
        const grid = document.createElement('div');
        grid.className = 'sector-form-grid';

        // Add headers
        grid.innerHTML = `
            <div class="grid-header">Field Path</div>
            <div class="grid-header">Value</div>
            <div class="grid-header">Unit</div>
            <div class="grid-header">Ontology</div>
            <div class="grid-header"></div>
        `;
        
        // Create a temporary fragment for rows to be appended to the grid
        const rowsFragment = document.createDocumentFragment();
        generateRows(rowsFragment, properties, ontologyMap, requiredFields, '', 0, lang);
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

