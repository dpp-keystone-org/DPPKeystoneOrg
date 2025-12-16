// src/wizard/form-builder.js
import { isURI, isCountryCodeAlpha3, isNumber, isInteger } from './validator.js';

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
        // Handle object (with @id/label) or simple string
        let label = (typeof source === 'object') 
            ? (source['rdfs:label'] || source.label || source['@id'] || source.id) 
            : source;
        const url = (typeof source === 'object') ? (source['@id'] || source.id || source.url) : null;

        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = `Source: ${label}`;
            link.style.color = 'inherit';
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
        let validationResult = { isValid: true };

        if ((prop.type === 'number' || prop.type === 'integer') && !target.validity.valid && value === '') {
            validationResult = { isValid: false, message: 'Must be a valid number' };
        } else if (value === '') {
            if (isRequired) {
                validationResult = { isValid: false, message: 'This field is required' };
            }
        } else if (prop.format === 'uri' && !isURI(value)) {
            validationResult = { isValid: false, message: 'Must be a valid URI (e.g., http://example.com)' };
        } else if ((ontologyInfo?.range === 'decimal' || ontologyInfo?.range === 'double' || ontologyInfo?.range === 'float') && !isNumber(value)) {
            validationResult = { isValid: false, message: 'Must be a valid number.' };
        } else if (ontologyInfo?.range === 'integer' && !isInteger(value)) {
            validationResult = { isValid: false, message: 'Must be a whole number.' };
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
                input = document.createElement('span');
                input.textContent = `[${prop.type}]`; // Placeholder for other types
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
                input.name = input.name.replace(oldPrefix, newPrefix);
                input.id = input.name;
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
        clearValidationForRows(rowsToRemove);
        rowsToRemove.forEach(r => r.remove());

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

        if (prop.type === 'object' && prop.properties) {
            renderObjectProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang });
        } else if (prop.type === 'array') {
            renderArrayProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang });
        } else {
            renderSimpleInputProperty(fragment, { key, prop, currentPath, isRequired, indentationLevel, ontologyMap, lang });
        }
    }
}

/**
 * Creates a control row with a "Remove" button for an optional object.
 * @param {string} objectKey - The key of the optional object (e.g., 'epd').
 * @param {string} objectPath - The full path of the optional object (e.g., 'root.epd').
 * @param {number} indentationLevel - The current level of nesting for UI indentation.
 * @param {string} [lang='en'] - The current language code.
 * @returns {HTMLDivElement} The control row element.
 */
function createOptionalObjectControlRow(objectKey, objectPath, indentationLevel, lang = 'en', prop, ontologyMap) {
    const controlRow = document.createElement('div');
    controlRow.className = 'grid-row array-item-control-row'; // Reusing array-item-control-row class for now
    controlRow.dataset.optionalObjectControl = objectKey; // Mark this as the control row for the optional object

    const firstCell = document.createElement('div');
    firstCell.className = 'grid-cell';
    firstCell.style.paddingLeft = `${indentationLevel * 20}px`;
    controlRow.appendChild(firstCell);

    const removeButtonCell = document.createElement('div');
    removeButtonCell.className = 'grid-cell';
    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.textContent = 'Remove';
    removeButton.dataset.removeOptionalObject = objectKey;

    // 5z-f: Implement the "Remove" functionality.
    removeButton.addEventListener('click', () => {
        const grid = removeButton.closest('.sector-form-grid');
        if (!grid) return;

        const controlRowElement = removeButton.closest('[data-optional-object-groups]');
        if (!controlRowElement) return;

        // Find the first row of the group to know where to re-insert the placeholder
        const firstRowOfGroup = grid.querySelector(`[data-optional-object-groups~="${objectKey}"]`);
        if (!firstRowOfGroup) return;

        // Find all rows belonging to this specific group to remove them
        const rowsToRemove = grid.querySelectorAll(`[data-optional-object-groups~="${objectKey}"]`);
        
        // 5z-j: Before removing, find all inputs and dispatch an event to clear their validation state.
        clearValidationForRows(rowsToRemove);

        // Determine the parent groups by removing the current group from the list
        const allGroups = controlRowElement.dataset.optionalObjectGroups || '';
        const parentGroups = allGroups.replace(new RegExp(`\\b${objectKey}\\b`), '').trim();

        // Re-create and insert the placeholder row before removing the old rows
        const newPlaceholder = createOptionalObjectPlaceholderRow(objectKey, prop, objectPath, indentationLevel, ontologyMap, lang);
        
        // Assign the parent groups to the new placeholder
        if (parentGroups) {
            newPlaceholder.dataset.optionalObjectGroups = parentGroups;
        }

        firstRowOfGroup.before(newPlaceholder);
        
        rowsToRemove.forEach(row => row.remove());
    });

    removeButtonCell.appendChild(removeButton);
    controlRow.appendChild(removeButtonCell);

    // Add empty cells for alignment
    controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
    controlRow.appendChild(document.createElement('div')).className = 'grid-cell';
    controlRow.appendChild(document.createElement('div')).className = 'grid-cell';

    return controlRow;
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

    addButton.addEventListener('click', (event) => {
        const parentRow = event.currentTarget.closest('.grid-row[data-optional-object-placeholder]');
        if (!parentRow) return;

        // Get existing groups from the placeholder row itself.
        const existingGroups = parentRow.dataset.optionalObjectGroups || '';

        const newFieldsFragment = document.createDocumentFragment();
        const newGroup = `${existingGroups} ${key}`.trim();

        // 1. Transform the placeholder row into a header row.
        parentRow.classList.add('grid-row-header');
        parentRow.removeAttribute('data-optional-object-placeholder');
        parentRow.dataset.optionalObjectGroups = newGroup;
        populateHeaderRow(parentRow, { currentPath, indentationLevel, ontologyMap, lang });

        // Generate and add the child fields.
        generateRows(newFieldsFragment, prop.properties, ontologyMap, prop.required || [], currentPath, indentationLevel + 1, lang);
        newFieldsFragment.appendChild(createOptionalObjectControlRow(key, currentPath, indentationLevel, lang, prop, ontologyMap));
        
        // Mark all new rows as belonging to the group.
        [...newFieldsFragment.children].forEach(row => {
            // Add the new group and preserve any existing parent groups.
            row.dataset.optionalObjectGroups = newGroup;
        });

        // Insert the new rows after the transformed header row.
        parentRow.after(newFieldsFragment);

        // 5z-h: Now that the new elements are in the DOM, find their inputs and trigger validation.
        const newInputs = parentRow.parentElement.querySelectorAll(`[data-optional-object-groups~="${key}"] input:not([type="checkbox"]), [data-optional-object-groups~="${key}"] select`);
        newInputs.forEach(input => {
            // Dispatch a 'blur' event to trigger the existing validation handler.
            input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
        });
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
