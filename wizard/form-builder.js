// src/wizard/form-builder.js
import { isURI, isCountryCode, isNumber, isInteger, validateText, validateKey } from './validator.js?v=1770749483538';

/**
 * Creates and displays a tooltip modal.
 * @param {string} commentText - The main description text for the modal.
 * @param {string} governedBy - The standard governing the property.
 * @param {object|string} source - The legal source/regulation (e.g. dcterms:source).
 */
function createTooltipModal(commentText, governedBy, source) {
    // Remove any existing modal first
    document.querySelector('.tooltip-modal-overlay')?.remove();
    document.querySelector('.tooltip-modal')?.remove();

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

    if (source) {
        const sourcePara = document.createElement('p');
        
        let label = null;
        let url = null;

        if (typeof source === 'object') {
            // Try to find a label (English preferred or raw string)
            label = source['rdfs:label'] || source.label;
            // Try to find an ID/URL
            url = source['@id'] || source.id || source.url;
            
            // If we have an ID but no label, use the ID as the label
            if (!label && url) label = url;
            // If we have a label but no URL, check if the label itself is a URI
            if (label && !url && isURI(label)) url = label;
        } else if (typeof source === 'string') {
            // If it looks like a URI, treat it as both label and URL
            if (isURI(source)) {
                url = source;
                label = source;
            } else {
                label = source;
            }
        }

        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `Source: ${label}`;
            sourcePara.appendChild(link);
        } else {
            sourcePara.textContent = `Source: ${label}`;
        }
        modalBody.appendChild(sourcePara);
    }

    modal.appendChild(modalBody);

    const closeButton = document.createElement('button');
    closeButton.className = 'modal-close-btn';
    closeButton.innerHTML = '&times;';
    
    const closeModal = () => {
        overlay.remove();
        modal.remove();
    };

    closeButton.addEventListener('click', closeModal);
    overlay.addEventListener('click', closeModal);

    modal.appendChild(closeButton);
    document.body.appendChild(overlay);
    document.body.appendChild(modal);
}

/**
 * Creates a grid cell with a tooltip button if ontology info is available.
 * @param {object} ontologyInfo - The ontology information for the property.
 * @param {string} governedBy - The 'governedBy' standard string.
 * @param {object|string} source - The source regulation.
 * @param {string} lang - The current language code.
 * @returns {HTMLDivElement} The grid cell, possibly containing a tooltip button.
 */
function createTooltipCell(ontologyInfo, governedBy, source, lang) {
    const tooltipCell = document.createElement('div');
    tooltipCell.className = 'grid-cell';

    let commentText = '';
    if (ontologyInfo?.comment) {
        commentText = (typeof ontologyInfo.comment === 'object')
            ? (ontologyInfo.comment[lang] || ontologyInfo.comment.en || '')
            : ontologyInfo.comment;
    }

    if (commentText || governedBy || source) {
        const tooltipButton = document.createElement('button');
        tooltipButton.className = 'tooltip-button';
        tooltipButton.textContent = '?';
        tooltipButton.type = 'button';
        tooltipButton.addEventListener('click', () => createTooltipModal(commentText, governedBy, source));
        tooltipCell.appendChild(tooltipButton);
    }

    return tooltipCell;
}

/**
 * Traverses the property path to find the most specific ontology information.
 * @param {string} currentPath - The full path of the property (e.g., 'root.item.name').
 * @param {Map} ontologyMap - The map of all ontology terms.
 * @returns {{ontologyInfo: object, unit: string, governedBy: string, source: any}} The inherited info.
 */
function getInheritedOntologyInfo(currentPath, ontologyMap) {
    const pathParts = currentPath.split('.');
    let ontologyInfo = null;
    let unit = '';
    let governedBy = '';
    let source = null;

    const checkInfo = (info) => {
        if (!info) return;
        if (!unit && info.unit) unit = info.unit;
        if (!governedBy && info.governedBy) governedBy = info.governedBy;
        if (!source) source = info.source || info['dcterms:source'];
    };

    for (let i = pathParts.length - 1; i >= 0; i--) {
        const info = ontologyMap.get(pathParts[i]);
        if (info) {
            if (!ontologyInfo) ontologyInfo = info;
            
            checkInfo(info);

            // Check domain class for inherited attributes
            if (info.domain) {
                let domainKey = typeof info.domain === 'object' ? info.domain['@id'] : info.domain;
                if (domainKey && typeof domainKey === 'string' && domainKey.includes(':')) {
                    domainKey = domainKey.split(':')[1];
                }
                if (domainKey) {
                    const classInfo = ontologyMap.get(domainKey);
                    checkInfo(classInfo);
                }
            }
        }
        
        if (ontologyInfo && unit && governedBy && source) break;
    }
    return { ontologyInfo, unit, governedBy, source };
}

/**
 * Attaches validation event listeners to an input element.
 * @param {HTMLElement} input - The input element.
 * @param {object} prop - The schema property for this input.
 * @param {boolean} isRequired - Whether the field is required.
 * @param {object} ontologyInfo - The ontology information for the property.
 */
function attachValidationHandlers(input, prop, isRequired, ontologyInfo) {
    if (!input || input.tagName === 'DIV' || input.type === 'checkbox' || input.type === 'button') {
        return;
    }

    const handleValidation = (e) => {
        const { target } = e;
        const { value } = target;

        // Auto-trim text inputs
        if (target.type === 'text' || target.tagName === 'TEXTAREA') {
            target.value = target.value.trim();
        }

        let validationResult = { isValid: true };

        if ((prop.type === 'number' || prop.type === 'integer') && !target.validity.valid && value === '') {
            validationResult = { isValid: false, message: 'Must be a valid number' };
        } else if (value === '') {
            if (isRequired) {
                validationResult = { isValid: false, message: 'This field is required' };
            }
        } else if (prop.type === 'string' && !validateText(value).isValid) {
            validationResult = validateText(value);
        } else if (prop.format === 'uri' && !isURI(value)) {
            validationResult = { isValid: false, message: 'Must be a valid URI (e.g., http://example.com)' };
        } else if ((ontologyInfo?.range === 'decimal' || ontologyInfo?.range === 'double' || ontologyInfo?.range === 'float') && !isNumber(value)) {
            validationResult = { isValid: false, message: 'Must be a valid number.' };
        } else if (ontologyInfo?.range === 'integer' && !isInteger(value)) {
            validationResult = { isValid: false, message: 'Must be a whole number.' };
        } else if (target.name.endsWith('countryOfOrigin') || target.name.endsWith('addressCountry') || target.name.endsWith('productionLocationCountry')) {
            if (!isCountryCode(value)) {
                validationResult = { isValid: false, message: 'Must be a valid 2 or 3-letter country code' };
            }
        } else if (ontologyInfo?.validation) {
            const { min, max } = ontologyInfo.validation;
            const num = parseFloat(value);
            if (isNaN(num) || num < min || num > max) {
                validationResult = { isValid: false, message: `Must be between ${min} and ${max}` };
            }
        } else if (prop.type === 'number' && !isNumber(value)) {
            validationResult = { isValid: false, message: 'Must be a valid number' };
        } else if (prop.type === 'integer' && !isInteger(value)) {
            validationResult = { isValid: false, message: 'Must be a whole number' };
        }

        const errorMsgId = `${target.id.replace(/\./g, '-')}-error`;
        let errorSpan = target.parentElement.querySelector(`#${errorMsgId}`);

        if (validationResult.isValid) {
            target.classList.remove('invalid');
            errorSpan?.remove();
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

        target.dispatchEvent(new CustomEvent('fieldValidityChange', {
            bubbles: true,
            composed: true,
            detail: { path: target.name, isValid: validationResult.isValid },
        }));
    };

    input.addEventListener('blur', handleValidation);
    input.addEventListener('change', handleValidation);
}

/**
 * Creates an input element based on a schema property.
 * @param {object} prop - The schema property.
 * @param {boolean} isRequired - Whether the field is required.
 * @returns {HTMLElement} The generated input or select element.
 */
function createInputForProp(prop, isRequired) {
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
                if (Array.isArray(prop.type)) {
                    // Fallback to text input for multi-type fields (e.g., ["string", "number"])
                    input = document.createElement('input');
                    input.type = 'text';
                } else {
                    input = document.createElement('span');
                    input.textContent = `[${prop.type}]`; // Placeholder for other types
                }
        }
    }
    return input;
}

/**
 * Renders a single grid row for a simple property (string, number, boolean, etc.).
 * @param {DocumentFragment} fragment - The fragment to append the row to.
 * @param {object} context - The rendering context.
 */
function renderSimpleInputProperty(fragment, { prop, currentPath, isRequired, indentationLevel, ontologyMap, lang }) {
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
    const input = createInputForProp(prop, isRequired);
    valueCell.appendChild(input);

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

    const { ontologyInfo, unit, governedBy, source } = getInheritedOntologyInfo(currentPath, ontologyMap);

    attachValidationHandlers(input, prop, isRequired, ontologyInfo);

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
        ontologyCell.textContent = (typeof ontologyInfo.label === 'string')
            ? ontologyInfo.label
            : (ontologyInfo.label[lang] || ontologyInfo.label.en || '');
    }
    row.appendChild(ontologyCell);

    // --- 5. Tooltip Cell ---
    row.appendChild(createTooltipCell(ontologyInfo, governedBy, source, lang));

    fragment.appendChild(row);
}

/**
 * Clears validation state for inputs in the provided rows.
 * @param {NodeList|Array} rows - The rows containing inputs to clear.
 */
/*
function clearValidationForRows(rows) {
    rows.forEach(row => {
        const input = row.querySelector('input:not([type="checkbox"]), select');
        if (input?.name) {
            input.dispatchEvent(new CustomEvent('fieldValidityChange', {
                bubbles: true, composed: true, detail: { path: input.name, isValid: true },
            }));
        }
    });
}
*/

/**
 * Calculates the next available index for an array item.
 * @param {string} arrayName - The full path of the array.
 * @returns {number} The next index.
 */
function getNextArrayItemIndex(arrayName) {
    const existingGroups = document.querySelectorAll(`[data-array-group^="${arrayName}."]`);
    if (existingGroups.length === 0) return 0;
    
    const indices = new Set();
    existingGroups.forEach(el => {
        const group = el.dataset.arrayGroup;
        if (group.startsWith(arrayName + '.')) {
            const suffix = group.slice(arrayName.length + 1);
            const index = parseInt(suffix.split('.')[0], 10);
            if (!isNaN(index)) {
                indices.add(index);
            }
        }
    });
    
    return indices.size > 0 ? Math.max(...indices) + 1 : 0;
}

/**
 * Re-indexes array items after an item is removed.
 * @param {string} arrayName - The full path of the array.
 * @param {number} indexRemoved - The index of the removed item.
 */
function reindexArrayItems(arrayName, indexRemoved) {
    const allRows = document.querySelectorAll(`[data-array-group^="${arrayName}."]`);
    
    allRows.forEach(row => {
        const group = row.dataset.arrayGroup;
        const suffix = group.slice(arrayName.length + 1);
        const parts = suffix.split('.');
        const index = parseInt(parts[0], 10);
        
        if (!isNaN(index) && index > indexRemoved) {
            const newIndex = index - 1;
            const oldPrefix = `${arrayName}.${index}`;
            const newPrefix = `${arrayName}.${newIndex}`;
            
            // Update data-array-group
            row.dataset.arrayGroup = group.replace(oldPrefix, newPrefix);
            
            // Update inputs
            const input = row.querySelector('input, select');
            if (input && input.name.startsWith(oldPrefix)) {
                const oldName = input.name;
                
                // Clear old error from global state
                input.dispatchEvent(new CustomEvent('fieldValidityChange', {
                    bubbles: true, composed: true, detail: { path: oldName, isValid: true },
                }));

                input.name = input.name.replace(oldPrefix, newPrefix);
                input.id = input.name;

                // Re-trigger validation to update global state with new name
                input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            }
            
            // Update path cell text
            const pathCell = row.querySelector('.grid-cell');
            if (pathCell && pathCell.textContent.startsWith(oldPrefix)) {
                pathCell.textContent = pathCell.textContent.replace(oldPrefix, newPrefix);
            }
        }
    });
}

/**
 * Creates a control row with a "Remove" button for an array item.
 * @param {string} arrayName - The name of the array.
 * @param {string} itemPath - The full path of the item (e.g., 'tags.0').
 * @returns {HTMLDivElement} The control row element.
 */
function createArrayItemControlRow(arrayName, itemPath) {
    const controlRow = document.createElement('div');
    controlRow.className = 'grid-row array-item-control-row';
    controlRow.dataset.arrayGroup = itemPath;
    
    controlRow.appendChild(document.createElement('div')).className = 'grid-cell'; // Placeholder for path
    
    const removeCell = document.createElement('div');
    removeCell.className = 'grid-cell';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    
    removeButton.addEventListener('click', () => {
        const groupToRemove = controlRow.dataset.arrayGroup;
        if (!groupToRemove) return;

        const suffix = groupToRemove.slice(arrayName.length + 1);
        const indexToRemove = parseInt(suffix.split('.')[0], 10);

        const rowsToRemove = document.querySelectorAll(`[data-array-group="${groupToRemove}"]`);
        
        // Robustly clear errors for all inputs associated with this group
        // We look for exact match (simple array) or prefix match (object array)
        // And also explicitly check within the rows being removed
        const inputsToClear = new Set();
        
        rowsToRemove.forEach(row => {
            row.querySelectorAll('input, select').forEach(input => inputsToClear.add(input));
        });

        const globalInputs = document.querySelectorAll(`
            input[name="${groupToRemove}"],
            input[name^="${groupToRemove}."],
            select[name="${groupToRemove}"],
            select[name^="${groupToRemove}."]
        `);
        globalInputs.forEach(input => inputsToClear.add(input));

        inputsToClear.forEach(input => {
            if (input.name) {
                input.dispatchEvent(new CustomEvent('fieldValidityChange', {
                    bubbles: true, composed: true, detail: { path: input.name, isValid: true },
                }));
            }
        });

        rowsToRemove.forEach(row => row.remove());        // Re-index remaining items
        reindexArrayItems(arrayName, indexToRemove);
    });
    
    removeCell.appendChild(removeButton);
    controlRow.appendChild(removeCell);

    controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
    controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
    controlRow.appendChild(document.createElement('div')).className = 'grid-cell';

    return controlRow;
}

/**
 * Triggers validation for new inputs in a specific group.
 * @param {HTMLElement} insertionPoint - The element after which new rows were inserted.
 * @param {string} groupPath - The data-array-group path.
 */
function triggerValidationForGroup(insertionPoint, groupPath) {
    const grid = insertionPoint.closest('.sector-form-grid');
    if (!grid) return;
    const newInputs = grid.querySelectorAll(`[data-array-group="${groupPath}"] input:not([type="checkbox"]), [data-array-group="${groupPath}"] select`);
    newInputs.forEach(input => {
        input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
    });
}

/**
 * Renders the UI for an array property, including the "Add Item" button and item handling.
 * @param {DocumentFragment} fragment - The fragment to append the row to.
 * @param {object} context - The rendering context.
 */
function renderArrayProperty(fragment, { prop, currentPath, indentationLevel, ontologyMap, lang }) {
    const row = document.createElement('div');
    row.className = 'grid-row';

    // --- 1. Field Path Cell ---
    const pathCell = document.createElement('div');
    pathCell.className = 'grid-cell';
    pathCell.textContent = currentPath;
    pathCell.style.paddingLeft = `${indentationLevel * 20}px`;
    row.appendChild(pathCell);

    // --- 2. Value Input Cell (with Add button) ---
    const valueCell = document.createElement('div');
    valueCell.className = 'grid-cell';
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = 'Add Item';
    addButton.className = 'add-array-item-btn';
    addButton.dataset.arrayName = currentPath;
    valueCell.appendChild(addButton);
    row.appendChild(valueCell);

    // --- 3, 4, 5. Ontology and Tooltip cells ---
    const { ontologyInfo, unit, governedBy, source } = getInheritedOntologyInfo(currentPath, ontologyMap);

    const unitCell = document.createElement('div');
    unitCell.className = 'grid-cell';
    unitCell.textContent = unit || '';
    row.appendChild(unitCell);

    const ontologyCell = document.createElement('div');
    ontologyCell.className = 'grid-cell';
    if (ontologyInfo?.label) {
        ontologyCell.textContent = (typeof ontologyInfo.label === 'string')
            ? ontologyInfo.label
            : (ontologyInfo.label[lang] || ontologyInfo.label.en || '');
    }
    row.appendChild(ontologyCell);

    row.appendChild(createTooltipCell(ontologyInfo, governedBy, source, lang));

    fragment.appendChild(row);

    if (prop.items?.type === 'object' && prop.items?.properties) {
        // Array of Objects
        addButton.addEventListener('click', () => {
            const arrayName = currentPath;
            const itemIndex = getNextArrayItemIndex(arrayName);
            const newObjectPath = `${arrayName}.${itemIndex}`;
            
            const newObjectFragment = document.createDocumentFragment();
            generateRows(newObjectFragment, prop.items.properties, ontologyMap, prop.items.required || [], newObjectPath, indentationLevel + 1, lang);
            
            [...newObjectFragment.children].forEach(r => { r.dataset.arrayGroup = newObjectPath; });
            
            newObjectFragment.appendChild(createArrayItemControlRow(arrayName, newObjectPath));
            
            const allItemControls = document.querySelectorAll(`.array-item-control-row[data-array-group^="${arrayName}."]`);
            let insertionPoint = addButton.closest('.grid-row');
            if (allItemControls.length > 0) {
                insertionPoint = allItemControls[allItemControls.length - 1];
            }
            insertionPoint.after(newObjectFragment);

            triggerValidationForGroup(insertionPoint, newObjectPath);
        });
    } else {
        // Array of simple types (e.g., strings)
        addButton.addEventListener('click', () => {
            const arrayName = currentPath;
            const itemIndex = getNextArrayItemIndex(arrayName);
            const path = `${arrayName}.${itemIndex}`;

            const itemFragment = document.createDocumentFragment();
            const newRow = document.createElement('div');
            newRow.className = 'grid-row';
            newRow.dataset.arrayGroup = path;
            
            const pathCellSimple = document.createElement('div');
            pathCellSimple.className = 'grid-cell';
            pathCellSimple.textContent = path;
            pathCellSimple.style.paddingLeft = `${(indentationLevel + 1) * 20}px`;
            newRow.appendChild(pathCellSimple);

            const valueCellSimple = document.createElement('div');
            valueCellSimple.className = 'grid-cell';
            const itemInput = document.createElement('input');
            itemInput.type = 'text'; // Assuming string, could be enhanced based on prop.items.type
            itemInput.name = path;
            itemInput.id = path;
            valueCellSimple.appendChild(itemInput);
            newRow.appendChild(valueCellSimple);

            newRow.appendChild(document.createElement('div')).className = 'grid-cell';
            newRow.appendChild(document.createElement('div')).className = 'grid-cell';
            newRow.appendChild(document.createElement('div')).className = 'grid-cell';
            itemFragment.appendChild(newRow);

            itemFragment.appendChild(createArrayItemControlRow(arrayName, path));

            const allItemControls = document.querySelectorAll(`.array-item-control-row[data-array-group^="${arrayName}."]`);
            let insertionPoint = addButton.closest('.grid-row');
            if (allItemControls.length > 0) {
                insertionPoint = allItemControls[allItemControls.length - 1];
            }
            insertionPoint.after(itemFragment);

            triggerValidationForGroup(insertionPoint, path);
        });
    }
}

/**
 * Populates an existing row element with the content of an object header.
 * @param {HTMLDivElement} rowElement - The row element to populate.
 * @param {object} context - The rendering context.
 */
function populateHeaderRow(rowElement, { currentPath, indentationLevel, ontologyMap, lang }) {
    rowElement.innerHTML = ''; // Clear content
    const { ontologyInfo, governedBy, source } = getInheritedOntologyInfo(currentPath, ontologyMap);
    
    const pathCell = document.createElement('div');
    pathCell.className = 'grid-cell';
    pathCell.textContent = currentPath;
    pathCell.style.paddingLeft = `${indentationLevel * 20}px`;
    rowElement.appendChild(pathCell);
    
    rowElement.appendChild(document.createElement('div')).className = 'grid-cell'; // Value
    rowElement.appendChild(document.createElement('div')).className = 'grid-cell'; // Unit

    const ontologyCell = document.createElement('div');
    ontologyCell.className = 'grid-cell';
    if (ontologyInfo?.label) {
        ontologyCell.textContent = (typeof ontologyInfo.label === 'string')
            ? ontologyInfo.label
            : (ontologyInfo.label[lang] || ontologyInfo.label.en || '');
    }
    rowElement.appendChild(ontologyCell);

    rowElement.appendChild(createTooltipCell(ontologyInfo, governedBy, source, lang));
}

/**
 * Creates a header row for a nested object.
 * @param {object} context - The rendering context.
 * @returns {HTMLDivElement} The header row element.
 */
function createObjectHeaderRow({ currentPath, indentationLevel, ontologyMap, lang }) {
    const headerRow = document.createElement('div');
    headerRow.className = 'grid-row grid-row-header';
    populateHeaderRow(headerRow, { currentPath, indentationLevel, ontologyMap, lang });
    return headerRow;
}

/**
 * Renders the UI for a nested object property.
 * @param {DocumentFragment} fragment - The fragment to append the row to.
 * @param {object} context - The rendering context.
 */
function renderObjectProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang }) {
    if (!isRequired) {
        // Optional object: Render a placeholder row with an "Add" button by calling our new helper.
        fragment.appendChild(
            createOptionalObjectPlaceholderRow(key, prop, currentPath, indentationLevel, ontologyMap, lang)
        );
    } else {
        // Required object: Render a header and recurse.
        fragment.appendChild(
            createObjectHeaderRow({ currentPath, indentationLevel, ontologyMap, lang })
        );

        generateRows(fragment, prop.properties, ontologyMap, prop.required || [], currentPath, indentationLevel + 1, lang);
    }
}

/**
 * Recursively generates form rows for a given set of schema properties.
 * @param {DocumentFragment} fragment - The fragment to append generated rows to.
 * @param {object} properties - The JSON schema properties object.
 * @param {Map<string, {label: object, comment: object, unit: string}>} ontologyMap - A map of ontology terms.
 * @param {string[]} requiredFields - A list of required field names for the current level.
 * @param {string} [parentPath=''] - The prefix for field names, used for nesting.
 * @param {number} [indentationLevel=0] - The current level of nesting for UI indentation.
 * @param {string} [lang='en'] - The current language code.
 */
function generateRows(fragment, properties, ontologyMap, requiredFields = [], parentPath = '', indentationLevel = 0, lang = 'en') {
    if (!properties) return; // Prevent crash if properties is undefined

    // This function now acts as a dispatcher, deciding which render function to call.
    for (const [key, prop] of Object.entries(properties)) {
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

        if ((prop.type === 'object' && prop.properties) || prop.oneOf || prop.anyOf) {
            renderObjectProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang });
        } else if (prop.type === 'array') {
            renderArrayProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang });
        } else {
            renderSimpleInputProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang });
        }
    }
}



/**
 * Creates a placeholder row for an optional object, including the "Add" button and its logic.
 * @param {string} key - The property key for the optional object.
 * @param {object} prop - The schema property for the optional object.
 * @param {string} currentPath - The full path to the object.
 * @param {number} indentationLevel - The current UI indentation level.
 * @param {Map} ontologyMap - The map of all ontology terms.
 * @param {string} lang - The current language code.
 * @returns {HTMLDivElement} The placeholder row element.
 */
function createOptionalObjectPlaceholderRow(key, prop, currentPath, indentationLevel, ontologyMap, lang) {
    const placeholderRow = document.createElement('div');
    placeholderRow.className = 'grid-row';
    placeholderRow.dataset.optionalObjectPlaceholder = key;
    placeholderRow.dataset.objectPath = currentPath; // Store path for updates

    const pathCell = document.createElement('div');
    pathCell.className = 'grid-cell';
    pathCell.textContent = currentPath;
    pathCell.style.paddingLeft = `${indentationLevel * 20}px`;
    placeholderRow.appendChild(pathCell);

    const valueCell = document.createElement('div');
    valueCell.className = 'grid-cell';
    const addButton = document.createElement('button');
    addButton.type = 'button';
    addButton.textContent = 'Add';
    addButton.dataset.optionalObject = key;
    valueCell.appendChild(addButton);
    placeholderRow.appendChild(valueCell);

    // Populate the ontology and tooltip cells for the placeholder row.
    const { ontologyInfo, unit, governedBy, source } = getInheritedOntologyInfo(currentPath, ontologyMap);

    const unitCell = document.createElement('div');
    unitCell.className = 'grid-cell';
    unitCell.textContent = unit || '';
    placeholderRow.appendChild(unitCell);

    const ontologyCell = document.createElement('div');
    ontologyCell.className = 'grid-cell';
    if (ontologyInfo?.label) {
        ontologyCell.textContent = (typeof ontologyInfo.label === 'string')
            ? ontologyInfo.label
            : (ontologyInfo.label[lang] || ontologyInfo.label.en || '');
    }
    placeholderRow.appendChild(ontologyCell);

    placeholderRow.appendChild(createTooltipCell(ontologyInfo, governedBy, source, lang));

    // Shared logic to expand the row once a schema is chosen
    const expandRow = (schemaToUse) => {
        const dynamicPath = placeholderRow.dataset.objectPath;
        // Get existing groups from the placeholder row itself.
        const existingGroups = placeholderRow.dataset.optionalObjectGroups || '';

        const newFieldsFragment = document.createDocumentFragment();
        const newGroup = `${existingGroups} ${key}`.trim();

        // 1. Transform the placeholder row into a header row.
        placeholderRow.classList.add('grid-row-header');
        placeholderRow.removeAttribute('data-optional-object-placeholder');
        placeholderRow.dataset.optionalObjectGroups = newGroup;
        populateHeaderRow(placeholderRow, { currentPath: dynamicPath, indentationLevel, ontologyMap, lang });

        // Add Remove Button to the header (replacing the empty value cell content)
        const headerValueCell = placeholderRow.children[1]; // Value cell is at index 1
        headerValueCell.innerHTML = ''; // Clear any existing buttons/selects
        const removeButton = document.createElement('button');
        removeButton.type = 'button';
        removeButton.textContent = 'Remove';
        removeButton.dataset.removeOptionalObject = key;
        
        removeButton.addEventListener('click', () => {
             const grid = removeButton.closest('.sector-form-grid');
             if (!grid) return;

             // The row containing the button is the header row
             const headerRow = removeButton.closest('.grid-row');
             
             // Find all rows belonging to this specific group
             const rowsToRemove = grid.querySelectorAll(`[data-optional-object-groups~="${key}"]`);
             
             // Calculate parent groups
             const allGroups = headerRow.dataset.optionalObjectGroups || '';
             const parentGroups = allGroups.replace(new RegExp(`\\b${key}\\b`), '').trim();

             // Re-create placeholder
             const newPlaceholder = createOptionalObjectPlaceholderRow(key, prop, dynamicPath, indentationLevel, ontologyMap, lang);
             if (parentGroups) {
                 newPlaceholder.dataset.optionalObjectGroups = parentGroups;
             }

             // Insert before and remove old
             headerRow.before(newPlaceholder);
             rowsToRemove.forEach(row => row.remove());
        });
        
        headerValueCell.appendChild(removeButton);

        // Generate and add the child fields.
        // Check if schemaToUse has properties or needs further resolution (oneOf selected schemas are usually objects with properties)
        if (schemaToUse && schemaToUse.properties) {
             generateRows(newFieldsFragment, schemaToUse.properties, ontologyMap, schemaToUse.required || [], dynamicPath, indentationLevel + 1, lang);
        } else {
             // Fallback or error handling if the selected schema doesn't have properties (e.g. empty object)
             console.warn(`[FormBuilder] Expanded schema for ${key} has no properties.`);
        }
        
        // Mark all new rows as belonging to the group.
        [...newFieldsFragment.children].forEach(row => {
            // Add the new group and preserve any existing parent groups.
            row.dataset.optionalObjectGroups = newGroup;
        });

        // Insert the new rows after the transformed header row.
        placeholderRow.after(newFieldsFragment);

        // 5z-h: Now that the new elements are in the DOM, find their inputs and trigger validation.
        const newInputs = placeholderRow.parentElement.querySelectorAll(`[data-optional-object-groups~="${key}"] input:not([type="checkbox"]), [data-optional-object-groups~="${key}"] select`);
        newInputs.forEach(input => {
            // Dispatch a 'blur' event to trigger the existing validation handler.
            input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
        });
    };

    addButton.addEventListener('click', (event) => {
        // Handle OneOf / AnyOf Selection
        if (prop.oneOf && Array.isArray(prop.oneOf)) {
             // Create selector UI in the value cell
             valueCell.innerHTML = ''; // Clear "Add" button

             const select = document.createElement('select');
             select.className = 'type-selector';
             const defaultOpt = document.createElement('option');
             defaultOpt.text = 'Select Type...';
             defaultOpt.value = '';
             select.appendChild(defaultOpt);

             prop.oneOf.forEach((opt, idx) => {
                 const option = document.createElement('option');
                 option.value = idx;
                 option.text = opt.title || `Option ${idx + 1}`;
                 select.appendChild(option);
             });

             valueCell.appendChild(select);
             
             // Handle selection
             select.addEventListener('change', () => {
                 if (select.value === '') return;
                 const selectedSchema = prop.oneOf[parseInt(select.value, 10)];
                 expandRow(selectedSchema); 
             });
             return;
        }

        // Default expansion
        expandRow(prop);
    });

    return placeholderRow;
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
            <div class="grid-header">Field</div>
            <div class="grid-header">Value</div>
            <div class="grid-header">Unit</div>
            <div class="grid-header">Label</div>
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

/**
 * Helper to recursively populate a group container from a JSON schema.
 * @param {HTMLElement} container - The container to append rows to.
 * @param {HTMLElement} insertBeforeElement - The element to insert before (usually the Add button).
 * @param {object} schema - The JSON schema object.
 * @param {Function} collisionChecker - Function to check for name collisions.
 * @param {Array} customTypeRegistry - Registry of custom types.
 * @param {Function} schemaLoader - Function to load schemas.
 * @param {Function} prefixChecker - Function to check defined prefixes.
 */
function populateGroupFromSchema(container, insertBeforeElement, schema, collisionChecker, customTypeRegistry, schemaLoader, prefixChecker = null) {
    if (!schema || !schema.properties) return;

    for (const [key, prop] of Object.entries(schema.properties)) {
        const newRow = createVoluntaryFieldRow(collisionChecker, customTypeRegistry, schemaLoader, new Map(), prefixChecker);

        const nameInput = newRow.querySelector('.voluntary-name');
        nameInput.value = key;

        const typeInput = newRow.querySelector('.voluntary-type');
        let mappedType = 'Text';
        if (prop.type === 'number' || prop.type === 'integer') mappedType = 'Number';
        else if (prop.type === 'boolean') mappedType = 'True/False';
        else if (prop.type === 'object') mappedType = 'Group';

        typeInput.value = mappedType;
        // Trigger change to render the correct input type (and create group container if needed)
        typeInput.dispatchEvent(new Event('change'));

        if (mappedType === 'Group' && prop.properties) {
            const nestedContainer = newRow.querySelector('.voluntary-group-container');
            const nestedAddBtn = nestedContainer.querySelector('.add-voluntary-prop-btn');
            populateGroupFromSchema(nestedContainer, nestedAddBtn, prop, collisionChecker, customTypeRegistry, schemaLoader, prefixChecker);
        }

        container.insertBefore(newRow, insertBeforeElement);
    }
}

/**
 * Updates the path prefixes of nested inputs when the parent key changes.
 * @param {HTMLElement} container - The container containing the nested inputs.
 * @param {string} oldPrefix - The old parent key.
 * @param {string} newPrefix - The new parent key.
 */
function updateNestedPaths(container, oldPrefix, newPrefix) {
    const replacePrefix = (str) => {
        if (oldPrefix) {
            if (str.startsWith(`${oldPrefix}.`)) {
                return newPrefix ? str.replace(`${oldPrefix}.`, `${newPrefix}.`) : str.replace(`${oldPrefix}.`, '');
            }
        } else {
            if (newPrefix) {
                return `${newPrefix}.${str}`;
            }
        }
        return str;
    };

    // 1. Update Inputs and Error Spans
    const inputs = container.querySelectorAll('input, select');
    inputs.forEach(input => {
        const oldName = input.name;
        const newName = replacePrefix(oldName);
        
        if (oldName !== newName) {
            // Clear old error from global state
            input.dispatchEvent(new CustomEvent('fieldValidityChange', {
                bubbles: true, composed: true, detail: { path: oldName, isValid: true },
            }));

            // Update ID and Name
            input.name = newName;
            input.id = newName;

            // Update Error Span ID if it exists so validation can find it later
            const oldErrorId = `${oldName.replace(/\./g, '-')}-error`;
            const newErrorId = `${newName.replace(/\./g, '-')}-error`;
            const errorSpan = document.getElementById(oldErrorId);
            if (errorSpan) {
                errorSpan.id = newErrorId;
            }
            
            // Re-trigger validation to update global state with new name
            input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
        }
    });

    // 2. Update Path Cells
    const pathCells = container.querySelectorAll('.grid-row .grid-cell:first-child');
    pathCells.forEach(cell => {
        cell.textContent = replacePrefix(cell.textContent);
    });

    // 3. Update Data Attributes for Dynamic Rows (Placeholders and Controls)
    const dynamicRows = container.querySelectorAll('[data-object-path]');
    dynamicRows.forEach(row => {
        row.dataset.objectPath = replacePrefix(row.dataset.objectPath);
    });
}

/**
 * Creates a UI row for adding a custom (voluntary) field.
 * Includes inputs for Name, Type, Value, and a Remove button.
 * @returns {HTMLDivElement} The generated row element.
 */
export function createVoluntaryFieldRow(collisionChecker, customTypeRegistry = [], schemaLoader = null, ontologyMap = new Map(), prefixChecker = null) {
    const row = document.createElement('div');
    row.className = 'voluntary-field-row';
    // Generate a unique ID for this row to track validation state
    const rowId = Math.random().toString(36).substr(2, 9);
    let currentKey = '';

    const dispatchValidity = (name, isValid) => {
        row.dispatchEvent(new CustomEvent('fieldValidityChange', {
            bubbles: true,
            composed: true,
            detail: { path: name, isValid },
        }));
    };

    // Helper to attach validation to custom field inputs
    const attachCustomValidator = (input, type) => {
        const handler = async () => {
            let result = { isValid: true };
            const value = input.value.trim();
            
            // Enforce required fields (except for 'unit')
            if (value === '' && type !== 'unit') {
                result = { isValid: false, message: 'This field is required' };
            }
            
            if (result.isValid) {
                if (type === 'key') {
                    input.value = value;
                    result = validateKey(input.value);

                    if (result.isValid) {
                        // Check Prefix Validity
                        if (input.value.includes(':') && prefixChecker) {
                            const prefix = input.value.split(':')[0];
                            const definedPrefixes = prefixChecker();
                            if (!definedPrefixes.has(prefix)) {
                                result = { isValid: false, message: `Undefined prefix '${prefix}'. Add it to External Contexts.` };
                            }
                        }
                    }

                    if (result.isValid && collisionChecker) {
                        const conflicts = await collisionChecker(input.value);
                        if (conflicts && conflicts.length > 0) {
                            result = { isValid: false, message: `Field conflicts with ${conflicts.join(', ')}` };
                        }
                    }
                } else if (type === 'value') {
                    if (input.type === 'text') {
                        input.value = value;
                    }
                    result = validateText(input.value);
                }
            }

            let errorSpan = input.nextElementSibling;
            if (errorSpan && !errorSpan.classList.contains('error-message')) {
                errorSpan = null;
            }

            if (result.isValid) {
                input.classList.remove('invalid');
                if (errorSpan) errorSpan.remove();
            } else {
                input.classList.add('invalid');
                if (!errorSpan) {
                    errorSpan = document.createElement('span');
                    errorSpan.className = 'error-message';
                    input.parentNode.insertBefore(errorSpan, input.nextSibling);
                }
                errorSpan.textContent = result.message;
            }

            // Dispatch event for global tracking
            if (input.name) {
                dispatchValidity(input.name, result.isValid);
            }
        };
        input.addEventListener('blur', handler);
        // Listen for change as well (e.g. for Select inputs)
        input.addEventListener('change', handler);
    };

    const nameContainer = document.createElement('div');
    nameContainer.className = 'voluntary-name-container';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Property Name';
    nameInput.className = 'voluntary-name';
    nameInput.name = `custom-key-${rowId}`;
    attachCustomValidator(nameInput, 'key');
    nameContainer.appendChild(nameInput);
    
    // Listen for key changes to update nested paths for complex types
    nameInput.addEventListener('change', () => {
        const newKey = nameInput.value.trim();
        if (newKey !== currentKey) {
            const groupContainer = row.querySelector('.voluntary-group-container');
            if (groupContainer) updateNestedPaths(groupContainer, currentKey, newKey);
        }
        currentKey = newKey;
    });

    const typeContainer = document.createElement('div');
    typeContainer.className = 'voluntary-type-container';
    const typeSelect = document.createElement('select');
    typeSelect.className = 'voluntary-type';
    ['Text', 'Number', 'True/False', 'Group'].forEach(type => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = type;
        typeSelect.appendChild(option);
    });
    typeContainer.appendChild(typeSelect);
    
    if (customTypeRegistry && customTypeRegistry.length > 0) {
        const separator = document.createElement('option');
        separator.disabled = true;
        separator.textContent = '──────────';
        typeSelect.appendChild(separator);
        customTypeRegistry.forEach(ct => {
            const option = document.createElement('option');
            option.value = ct.label;
            option.textContent = ct.label;
            typeSelect.appendChild(option);
        });
    }

    const valueContainer = document.createElement('div');
    valueContainer.className = 'voluntary-value-container';
    const valueInput = document.createElement('input');
    valueInput.type = 'text';
    valueInput.placeholder = 'Property Value';
    valueInput.className = 'voluntary-value';
    valueInput.name = `custom-value-${rowId}`;
    attachCustomValidator(valueInput, 'value');
    valueContainer.appendChild(valueInput);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.textContent = 'Remove';
    removeBtn.addEventListener('click', () => {
        // Clear errors for all inputs in this row (including nested ones) before removing
        const inputs = row.querySelectorAll('input, select');
        inputs.forEach(input => {
            if (input.name) dispatchValidity(input.name, true);
        });
        row.remove();
    });

    typeSelect.addEventListener('change', async () => {
        const type = typeSelect.value;
        let currentValueInput = row.querySelector('.voluntary-value');
        const existingUnitContainer = row.querySelector('.voluntary-unit-container');
        const existingGroupContainer = row.querySelector('.voluntary-group-container');
        const existingValueContainer = row.querySelector('.voluntary-value-container');
        const customType = customTypeRegistry.find(ct => ct.label === type);

        // 1. Handle Group Type or Custom Complex Types
        if (type === 'Group' || customType) {
            row.classList.add('group-mode');
            if (existingValueContainer) {
                // Clean up validation state before removing
                if (currentValueInput.name) dispatchValidity(currentValueInput.name, true);
                existingValueContainer.remove();
            }
            if (existingUnitContainer) {
                const unitInput = existingUnitContainer.querySelector('input');
                if (unitInput && unitInput.name) dispatchValidity(unitInput.name, true);
                existingUnitContainer.remove();
            }

            let container = existingGroupContainer;
            if (!container) {
                const container = document.createElement('div');
                container.className = 'voluntary-group-container';
                
                const addBtn = document.createElement('button');
                addBtn.type = 'button';
                addBtn.className = 'add-voluntary-prop-btn';
                addBtn.textContent = 'Add Field';
                addBtn.addEventListener('click', () => {
                    const newRow = createVoluntaryFieldRow(collisionChecker, customTypeRegistry, schemaLoader, ontologyMap, prefixChecker);
                    container.insertBefore(newRow, addBtn);
                });

                container.appendChild(addBtn);
                row.insertBefore(container, removeBtn);
            }

            if (customType && schemaLoader) {
                try {
                    // Load the schema for the selected complex type
                    const schema = await schemaLoader(customType.schemaName);
                    
                    if (schema && schema.properties) {
                        const container = row.querySelector('.voluntary-group-container');
                        
                        // Clear validation for existing fields in the container before overwriting
                        const inputs = container.querySelectorAll('input, select');
                        inputs.forEach(input => { if (input.name) dispatchValidity(input.name, true); });

                        // Clear the container (removing the "Add Field" button used for generic groups)
                        container.innerHTML = '';
                        
                        // Create a grid layout for the complex type
                        const grid = document.createElement('div');
                        grid.className = 'sector-form-grid';
                        grid.style.marginTop = '0';
                        grid.style.borderTop = 'none';
                        grid.style.paddingTop = '0';

                        const fragment = document.createDocumentFragment();
                        const parentPath = nameInput.value.trim();
                        currentKey = parentPath;

                        // Generate rows using the standard form generator, passing required fields from the schema
                        generateRows(fragment, schema.properties, ontologyMap, schema.required || [], parentPath, 0, 'en');
                        
                        grid.appendChild(fragment);
                        container.appendChild(grid);

                        // Trigger validation for the new fields so required ones show up immediately
                        const newInputs = grid.querySelectorAll('input:not([type="checkbox"]), select');
                        newInputs.forEach(input => {
                            input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
                        });
                    } else {
                        console.error(`[ERROR] Schema for ${customType.schemaName} is invalid or missing properties:`, schema);
                    }
                } catch (error) {
                    console.error(`[ERROR] Failed to load schema for ${customType.label}:`, error);
                }
            }
            return;
        }

        // 2. Handle Non-Group Types
        row.classList.remove('group-mode');
        if (existingGroupContainer) {
             const inputs = existingGroupContainer.querySelectorAll('input, select');
             inputs.forEach(input => { if (input.name) dispatchValidity(input.name, true); });
             existingGroupContainer.remove();
        }
        
        // Ensure value container exists
        if (!row.querySelector('.voluntary-value-container')) {
            // Re-create value container if it was removed (e.g. coming back from Group)
            // We will populate it below in step 3
            const newValContainer = document.createElement('div');
            newValContainer.className = 'voluntary-value-container';
            row.insertBefore(newValContainer, removeBtn);
        }

        // Remove Unit if not Number
        if (type !== 'Number' && existingUnitContainer) {
            const unitInput = existingUnitContainer.querySelector('input');
            if (unitInput && unitInput.name) dispatchValidity(unitInput.name, true);
            existingUnitContainer.remove();
        }

        // 3. Handle Value Input (Select vs Input)
        // Note: currentValueInput might be null if we just came from Group mode
        currentValueInput = row.querySelector('.voluntary-value');
        const currentContainer = row.querySelector('.voluntary-value-container');

        if (type === 'True/False') {
            if (!currentValueInput || currentValueInput.tagName !== 'SELECT') {
                const select = document.createElement('select');
                select.className = 'voluntary-value';
                select.name = `custom-value-${rowId}`;
                ['True', 'False'].forEach(val => {
                    const opt = document.createElement('option');
                    opt.value = val.toLowerCase();
                    opt.textContent = val;
                    select.appendChild(opt);
                });
                attachCustomValidator(select, 'value');
                
                if (currentValueInput) {
                    // If replacing an invalid input with a valid default select, clear the error
                    if (currentValueInput.name) dispatchValidity(currentValueInput.name, true);
                    currentValueInput.replaceWith(select);
                } else {
                    currentContainer.appendChild(select);
                }
            }
        } else {
            // Ensure it's an input element for Text/Number
            if (!currentValueInput || currentValueInput.tagName !== 'INPUT') {
                const input = document.createElement('input');
                input.className = 'voluntary-value';
                input.placeholder = 'Property Value';
                input.name = `custom-value-${rowId}`;
                attachCustomValidator(input, 'value');
                
                if (currentValueInput) {
                    if (currentValueInput.name) dispatchValidity(currentValueInput.name, true);
                    currentValueInput.replaceWith(input);
                } else {
                    currentContainer.appendChild(input);
                }
            }
            
            currentValueInput = row.querySelector('.voluntary-value');
            currentValueInput.type = (type === 'Number') ? 'number' : 'text';

            // Add Unit for Number
            if (type === 'Number' && !row.querySelector('.voluntary-unit-container')) {
                const unitContainer = document.createElement('div');
                unitContainer.className = 'voluntary-unit-container';
                
                const unitInput = document.createElement('input');
                unitInput.type = 'text';
                unitInput.placeholder = 'Unit';
                unitInput.className = 'voluntary-unit';
                unitInput.name = `custom-unit-${rowId}`;
                attachCustomValidator(unitInput, 'unit');
                unitContainer.appendChild(unitInput);
                row.insertBefore(unitContainer, removeBtn);
            }
        }
    });

    row.appendChild(nameContainer);
    row.appendChild(typeContainer);
    row.appendChild(valueContainer);
    row.appendChild(removeBtn);

    return row;
}
