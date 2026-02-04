// Cache-busting comment to force re-evaluation.
// src/wizard/dpp-generator.js

import { setProperty } from '../lib/dpp-data-utils.js?v=1770217775596';

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
 * @param {HTMLElement} [voluntaryModulesContainer] - Optional container for voluntary modules.
 * @param {HTMLElement} [externalContextsWrapper] - Optional container for external contexts.
 * @param {Map} [sectorDataCache] - Cache containing loaded schema objects for active sectors.
 * @returns {object} The generated DPP JSON object.
 */
export function generateDpp(sectors, coreFormContainer, formContainer, voluntaryFieldsWrapper, voluntaryModulesContainer = null, externalContextsWrapper = null, sectorDataCache = null) {
    const dpp = {};
    
    // Add @context
    let contexts = [];
    const baseUrl = 'https://dpp-keystone.org/spec/contexts/v1/';

    if (sectors && sectors.length > 0) {
        contexts = sectors.map(sector => `${baseUrl}dpp-${sector}.context.jsonld`);
    } else {
        contexts.push(`${baseUrl}dpp-core.context.jsonld`);
    }

    // Scrape external contexts
    if (externalContextsWrapper) {
        const rows = externalContextsWrapper.querySelectorAll('.external-context-row');
        const prefixMap = {};
        
        rows.forEach(row => {
            const prefix = row.querySelector('.context-prefix')?.value.trim();
            const uri = row.querySelector('.context-uri')?.value.trim();
            
            if (uri) {
                if (prefix) {
                    prefixMap[prefix] = uri;
                } else {
                    contexts.push(uri);
                }
            }
        });

        if (Object.keys(prefixMap).length > 0) {
            contexts.push(prefixMap);
        }
    }

    dpp['@context'] = contexts.length === 1 ? contexts[0] : contexts;

    const containers = [coreFormContainer, formContainer];
    if (voluntaryModulesContainer) {
        containers.push(voluntaryModulesContainer);
    }

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
        dpp.contentSpecificationIds = sectors.map(sector => {
            // Attempt to fetch from schema if available
            if (sectorDataCache && sectorDataCache.has(sector)) {
                const data = sectorDataCache.get(sector);
                if (data.schema && 
                    data.schema.if && 
                    data.schema.if.properties && 
                    data.schema.if.properties.contentSpecificationIds &&
                    data.schema.if.properties.contentSpecificationIds.contains &&
                    data.schema.if.properties.contentSpecificationIds.contains.const) {
                    
                    return data.schema.if.properties.contentSpecificationIds.contains.const;
                }
            }
            return `${sector}-product-dpp-v1`;
        });
    }

    return dpp;
}