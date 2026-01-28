// src/wizard/wizard.js
import { loadSchema } from '../lib/schema-loader.js?v=1769601990225';
import { loadOntology } from '../lib/ontology-loader.js?v=1769601990225';
import { buildForm, createVoluntaryFieldRow } from './form-builder.js?v=1769601990225';
import { generateDpp } from './dpp-generator.js?v=1769601990225';
import { generateHTML } from '../lib/html-generator.js?v=1769601990225';

// --- Module-level state ---
let currentLanguage = 'en';

// Caches for holding loaded schemas and ontologies to avoid re-fetching
let coreSchema = null;
let coreOntologyMap = null;
const sectorDataCache = new Map(); // sector -> { schema, ontologyMap }

const SUPPORTED_CUSTOM_TYPES = [
    { label: 'Organization', schemaName: 'organization' },
    { label: 'Product Characteristic', schemaName: 'product-characteristic' }, // Maps to product-characteristic.schema.json (virtual or real)
    { label: 'Related Resource', schemaName: 'related-resource' }
];
const STORAGE_KEY = 'dpp_wizard_state_v1';

// --- DOM Element References ---
let coreFormContainer, sectorsFormContainer, voluntaryModulesContainer, addVoluntaryFieldBtn,
    voluntaryFieldsWrapper, externalContextsWrapper, addExternalContextBtn, generateBtn, showErrorsBtn, errorCountBadge,
    jsonOutput, sectorButtons, languageSelector;

/**
 * Saves the current values of all inputs, selects, and textareas in a container.
 * @param {HTMLElement} container - The container element to search within.
 * @returns {Map<string, string|boolean>} A map of input names to their values/states.
 */
function saveFormState(container) {
    const state = new Map();
    if (!container) return state;

    const inputs = container.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
        if (input.type === 'checkbox') {
            state.set(input.name, input.checked);
        } else {
            state.set(input.name, input.value);
        }
    });
    return state;
}

/**
 * Restores the values of all inputs, selects, and textareas in a container.
 * @param {HTMLElement} container - The container element to search within.
 * @param {Map<string, string|boolean>} state - The map of state to restore.
 */
function restoreFormState(container, state) {
    if (!container || !state) return;

    state.forEach((value, name) => {
        const input = container.querySelector(`[name="${name}"]`);
        if (input) {
            if (input.type === 'checkbox') {
                input.checked = value;
            } else {
                input.value = value;
            }
        }
    });
}

/**
 * Re-renders all active forms with the current language.
 */
async function rerenderAllForms() {
    const coreState = saveFormState(coreFormContainer);
    // Select from document to capture sectors in both containers
    const activeSectors = [...document.querySelectorAll('.sector-form-container')].map(c => c.id.replace('sector-form-', ''));
    const sectorStates = new Map();
    activeSectors.forEach(sector => {
        const container = document.getElementById(`sector-form-${sector}`);
        sectorStates.set(sector, saveFormState(container));
    });

    // Re-render core form
    coreFormContainer.innerHTML = '';
    const coreFormFragment = buildForm(coreSchema, coreOntologyMap, currentLanguage);
    coreFormContainer.appendChild(coreFormFragment);
    restoreFormState(coreFormContainer, coreState);
    
    // Re-render sector forms
    sectorsFormContainer.innerHTML = '';
    voluntaryModulesContainer.innerHTML = ''; // Clear voluntary modules too

    for (const sector of activeSectors) {
        const data = sectorDataCache.get(sector);
        if (data) {
            const { schema, ontologyMap } = data;
            const formFragment = buildForm(schema, ontologyMap, currentLanguage);
            
            const sectorContainer = document.createElement('div');
            sectorContainer.id = `sector-form-${sector}`;
            sectorContainer.className = 'sector-form-container';
            const sectorHeader = document.createElement('h3');
            sectorHeader.textContent = `${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
            sectorContainer.appendChild(sectorHeader);
            sectorContainer.appendChild(formFragment);
            
            if (sector === 'general-product' || sector === 'packaging') {
                voluntaryModulesContainer.appendChild(sectorContainer);
            } else {
                sectorsFormContainer.appendChild(sectorContainer);
            }
            
            restoreFormState(sectorContainer, sectorStates.get(sector));
        }
    }
}


export async function initializeWizard() {
    const invalidFields = new Set();

    // --- Get all UI elements ---
    coreFormContainer = document.getElementById('core-form-container');
    sectorsFormContainer = document.getElementById('sectors-form-container');
    voluntaryModulesContainer = document.getElementById('voluntary-modules-container');
    addVoluntaryFieldBtn = document.getElementById('add-voluntary-field-btn');
    voluntaryFieldsWrapper = document.getElementById('voluntary-fields-wrapper');
    externalContextsWrapper = document.getElementById('external-contexts-wrapper');
    addExternalContextBtn = document.getElementById('add-external-context-btn');
    generateBtn = document.getElementById('generate-dpp-btn');
    showErrorsBtn = document.getElementById('show-errors-btn');
    errorCountBadge = document.getElementById('error-count-badge');
    jsonOutput = document.getElementById('json-output');
    sectorButtons = document.querySelectorAll('.sector-btn');
    languageSelector = document.getElementById('language-selector');

    const previewBtn = document.getElementById('preview-html-btn');

    /**
     * Toggles the visibility of the 'Generate' and 'Show Errors' buttons
     * based on the current validation state.
     */
    function updateButtonState() {
        if (!generateBtn || !showErrorsBtn) return;
        const hasErrors = invalidFields.size > 0;
        
        generateBtn.hidden = hasErrors;
        if (previewBtn) previewBtn.hidden = hasErrors;
        
        showErrorsBtn.hidden = !hasErrors;
        errorCountBadge.textContent = invalidFields.size;
    }

    /**
     * Triggers validation for all visible, validatable fields within a container.
     * @param {HTMLElement} container The container to validate fields in.
     */
    function validateAllFields(container) {
        // We only validate text/date/number/uri inputs and selects. Checkboxes are valid by definition,
        // and we don't want to trigger array validation buttons.
        const fieldsToValidate = container.querySelectorAll('input:not([type="checkbox"]), select');
        fieldsToValidate.forEach(field => {
            // Dispatch a new 'blur' event to trigger the validation handler in form-builder.js
            field.dispatchEvent(new Event('blur', {
                bubbles: true,
                cancelable: true
            }));
        });
    }

    /**
     * Initializes the core DPP form on page load.
     */
    async function initializeCoreForm() {
        try {
            // Load from network or use cache
            if (!coreSchema) coreSchema = await loadSchema('dpp');
            if (!coreOntologyMap) coreOntologyMap = await loadOntology('dpp');
            
            const formFragment = buildForm(coreSchema, coreOntologyMap, currentLanguage);
            coreFormContainer.innerHTML = ''; // Clear previous content
            coreFormContainer.appendChild(formFragment);

            // Trigger initial validation to check for empty required fields
            validateAllFields(coreFormContainer);
        } catch (error) {
            coreFormContainer.innerHTML = '<p class="error">Could not load the core DPP form. Please check the console for details.</p>';
            console.error('Failed to build core DPP form:', error);
        }
    }

    // --- Mutation Observer for validation cleanup ---
    const validationObserver = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        mutations.forEach((mutation) => {
            if (mutation.removedNodes.length > 0) {
                mutation.removedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Check if the node itself is a tracked input
                        if ((node.matches('input, select, textarea')) && node.name && invalidFields.has(node.name)) {
                            // Only remove if no other input with this name exists (handling re-indexing collisions)
                            if (!document.querySelector(`[name="${node.name}"]`)) {
                                invalidFields.delete(node.name);
                                shouldUpdate = true;
                            }
                        }
                        // Check for descendant inputs
                        const inputs = node.querySelectorAll('input, select, textarea');
                        inputs.forEach(input => {
                            if (input.name && invalidFields.has(input.name)) {
                                if (!document.querySelector(`[name="${input.name}"]`)) {
                                    invalidFields.delete(input.name);
                                    shouldUpdate = true;
                                }
                            }
                        });
                    }
                });
            }
        });
        if (shouldUpdate) updateButtonState();
    });

    const wizardContainer = document.getElementById('wizard-container');
    if (wizardContainer) {
        validationObserver.observe(wizardContainer, { childList: true, subtree: true });
    }

    // --- Event listeners ---

    document.addEventListener('fieldValidityChange', (e) => {
        const { path, isValid } = e.detail;
        if (isValid) {
            invalidFields.delete(path);
        } else {
            invalidFields.add(path);
        }
        updateButtonState();
    });

    /**
     * Toggles the visibility of the 'Generate' and 'Show Errors' buttons
     * based on the current validation state.
     */
    function updateButtonState() {
        if (!generateBtn || !showErrorsBtn) return;
        const hasErrors = invalidFields.size > 0;
        
        generateBtn.hidden = hasErrors;
        if (previewBtn) previewBtn.hidden = hasErrors;
        
        showErrorsBtn.hidden = !hasErrors;
        errorCountBadge.textContent = invalidFields.size;
    }

    showErrorsBtn.addEventListener('click', () => {
        // Remove any existing modal first
        const existingModal = document.querySelector('.error-summary-modal-overlay');
        if (existingModal) existingModal.remove();

        const overlay = document.createElement('div');
        overlay.className = 'error-summary-modal-overlay';

        const modal = document.createElement('div');
        modal.className = 'error-summary-modal';

        const h3 = document.createElement('h3');
        h3.textContent = 'Validation Errors';
        modal.appendChild(h3);

        const list = document.createElement('ul');
        invalidFields.forEach(path => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#';
            
            let label = path;
            const input = document.querySelector(`[name="${path}"]`);
            
            if (input) {
                if (input.classList.contains('voluntary-name')) {
                    label = input.value || '(Empty Custom Field Name)';
                } else if (input.classList.contains('voluntary-value')) {
                    const row = input.closest('.voluntary-field-row');
                    const keyInput = row?.querySelector('.voluntary-name');
                    const keyName = keyInput?.value || 'Unknown Field';
                    label = `Value for '${keyName}'`;
                }
            }
            
            link.textContent = label;
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelector(`[name="${path}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                closeModal();
            });
            listItem.appendChild(link);
            list.appendChild(listItem);
        });
        modal.appendChild(list);
        
        const closeButton = document.createElement('button');
        closeButton.className = 'modal-close-btn';
        closeButton.innerHTML = '&times;';
        
        const closeModal = () => {
            overlay.remove();
        };

        closeButton.addEventListener('click', closeModal);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal();
            }
        });

        modal.appendChild(closeButton);
        overlay.appendChild(modal)
        document.body.appendChild(overlay);
    });

    // Synchronize fields with the same name across different forms
    document.addEventListener('input', (e) => {
        if (e.target.matches('input, select, textarea') && e.target.name) {
            const matchingInputs = document.querySelectorAll(`[name="${e.target.name}"]`);
            matchingInputs.forEach(input => {
                if (input !== e.target) {
                    if (input.type === 'checkbox' && e.target.type === 'checkbox') {
                        input.checked = e.target.checked;
                    } else {
                        input.value = e.target.value;
                    }
                }
            });
        }
        saveSession();
    });

    languageSelector.addEventListener('change', async (event) => {
        currentLanguage = event.target.value;
        await rerenderAllForms();
    });

    sectorButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const sector = button.dataset.sector;
            const sectorContainerId = `sector-form-${sector}`;
            const existingContainer = document.getElementById(sectorContainerId);

            const sectorDisplayNames = {
                'general-product': 'General Product Information',
                // Add other specific mappings if needed, otherwise fallback to capitalization
            };
            const displayName = sectorDisplayNames[sector] || (sector.charAt(0).toUpperCase() + sector.slice(1));

            if (existingContainer) {
                // The MutationObserver will handle clearing validation errors when the container is removed.
                existingContainer.remove();
                button.textContent = `Add ${displayName}`;
                button.classList.remove('remove-btn-active');
            } else {
                // Add Sector
                try {
                    let data = sectorDataCache.get(sector);
                    if (!data) {
                        const schema = await loadSchema(sector);
                        const ontologyMap = await loadOntology(sector);
                        data = { schema, ontologyMap };
                        sectorDataCache.set(sector, data);
                    }
                    
                    const { schema, ontologyMap } = data;
                    const formFragment = buildForm(schema, ontologyMap, currentLanguage);

                    const sectorContainer = document.createElement('div');
                    sectorContainer.id = sectorContainerId;
                    sectorContainer.className = 'sector-form-container';
                    
                    const sectorHeader = document.createElement('h3');
                    sectorHeader.textContent = displayName;
                    sectorContainer.appendChild(sectorHeader);

                    sectorContainer.appendChild(formFragment);
                    
                    if (sector === 'general-product' || sector === 'packaging') {
                        voluntaryModulesContainer.appendChild(sectorContainer);
                    } else {
                        sectorsFormContainer.appendChild(sectorContainer);
                    }

                    // Trigger validation for the new sector form
                    validateAllFields(sectorContainer);

                    button.textContent = `Remove ${displayName}`;
                    button.classList.add('remove-btn-active');

                } catch (error) {
                    const targetContainer = (sector === 'general-product' || sector === 'packaging') ? voluntaryModulesContainer : sectorsFormContainer;
                    targetContainer.innerHTML += `<p class="error">Could not load the form for the ${sector} sector.</p>`;
                    console.error(`Failed to build form for sector ${sector}:`, error);
                }
            }
            saveSession();
        });
    });

    if (addVoluntaryFieldBtn && voluntaryFieldsWrapper) {
        addVoluntaryFieldBtn.addEventListener('click', () => addVoluntaryField());
    }



    /**
     * Checks if a key conflicts with existing fields in Core or any available Sector.
     * @param {string} key - The key to check.
     * @returns {Promise<string[]>} - Array of sector names (including 'Core') where the key exists.
     */
    async function getConflictingSectors(key) {
        const conflicts = [];
        
        const hasProperty = (schema, prop) => {
            if (!schema) return false;
            if (schema.properties && schema.properties[prop]) return true;
            if (schema.then && schema.then.properties && schema.then.properties[prop]) return true;
            return false;
        };

        if (hasProperty(coreSchema, key)) {
            conflicts.push('Core');
        }

        const allSectors = [...sectorButtons].map(btn => btn.dataset.sector);
        
        for (const sector of allSectors) {
            let data = sectorDataCache.get(sector);
            if (!data) {
                try {
                    const schema = await loadSchema(sector);
                    const ontologyMap = await loadOntology(sector);
                    data = { schema, ontologyMap };
                    sectorDataCache.set(sector, data);
                } catch (error) {
                    console.warn(`Failed to load schema for sector ${sector} during collision check`, error);
                    continue;
                }
            }

            if (data && hasProperty(data.schema, key)) {
                conflicts.push(sector.charAt(0).toUpperCase() + sector.slice(1));
            }
        }

        return conflicts;
    }

    /**
     * Retrieves the set of currently defined external context prefixes.
     * @returns {Set<string>} A set of defined prefixes.
     */
    function getDefinedPrefixes() {
        const prefixes = new Set();
        if (externalContextsWrapper) {
            const inputs = externalContextsWrapper.querySelectorAll('.context-prefix');
            inputs.forEach(input => {
                const val = input.value.trim();
                if (val) prefixes.add(val);
            });
        }
        return prefixes;
    }

    function addVoluntaryField() {
        const fieldRow = createVoluntaryFieldRow(getConflictingSectors, SUPPORTED_CUSTOM_TYPES, loadSchema, coreOntologyMap, getDefinedPrefixes);
        voluntaryFieldsWrapper.appendChild(fieldRow);
    }

    function addExternalContext() {
        const row = document.createElement('div');
        row.className = 'voluntary-field-row external-context-row';
        
        // Reuse similar styling as voluntary fields
        const prefixInput = document.createElement('input');
        prefixInput.type = 'text';
        prefixInput.className = 'context-prefix voluntary-name'; // reuse class for styling
        prefixInput.placeholder = 'Prefix (opt)';
        prefixInput.style.maxWidth = '150px';

        const uriInput = document.createElement('input');
        uriInput.type = 'text';
        uriInput.className = 'context-uri voluntary-value'; // reuse class for styling
        uriInput.placeholder = 'Context URI (e.g. https://schema.org)';
        
        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => row.remove());

        row.appendChild(prefixInput);
        row.appendChild(uriInput);
        row.appendChild(removeBtn);
        
        externalContextsWrapper.appendChild(row);
    }

    if (addExternalContextBtn && externalContextsWrapper) {
        addExternalContextBtn.addEventListener('click', addExternalContext);
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const activeSectors = [...document.querySelectorAll('.sector-form-container')]
                .map(container => container.id.replace('sector-form-', ''));

            const dppObject = generateDpp(activeSectors, coreFormContainer, sectorsFormContainer, voluntaryFieldsWrapper, voluntaryModulesContainer, externalContextsWrapper, sectorDataCache);
            jsonOutput.textContent = JSON.stringify(dppObject, null, 2);
        });
    }

    if (previewBtn) {
        previewBtn.addEventListener('click', async () => {
            const activeSectors = [...document.querySelectorAll('.sector-form-container')]
                .map(container => container.id.replace('sector-form-', ''));

            const dppObject = generateDpp(activeSectors, coreFormContainer, sectorsFormContainer, voluntaryFieldsWrapper, voluntaryModulesContainer, externalContextsWrapper, sectorDataCache);
            
            // Generate the HTML Blob
            const customCssUrl = document.getElementById('custom-css-url')?.value?.trim();
            const htmlContent = await generateHTML(dppObject, customCssUrl);
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            // Open in new tab
            window.open(url, '_blank');
        });
    }
    /**
     * Saves the current session state (Core + Sectors) to localStorage.
     */
    function saveSession() {
        const coreState = Object.fromEntries(saveFormState(coreFormContainer));
        // Capture from both main sectors container and voluntary modules container
        const activeSectors = [...document.querySelectorAll('.sector-form-container')]
            .map(c => c.id.replace('sector-form-', ''));
        
        const sectorStates = {};
        activeSectors.forEach(sector => {
            const container = document.getElementById(`sector-form-${sector}`);
            sectorStates[sector] = Object.fromEntries(saveFormState(container));
        });

        const session = {
            core: coreState,
            sectors: activeSectors,
            sectorData: sectorStates,
            timestamp: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    }

    /**
     * Restores the session state from localStorage.
     */
    async function restoreSession() {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;

        try {
            const session = JSON.parse(raw);
            
            // 1. Restore Core Form
            if (session.core) {
                restoreFormState(coreFormContainer, new Map(Object.entries(session.core)));
                validateAllFields(coreFormContainer);
            }

            // 2. Restore Sectors
            if (session.sectors && Array.isArray(session.sectors)) {
                for (const sector of session.sectors) {
                    // Trigger the add button click to load the sector form
                    const btn = document.querySelector(`button[data-sector="${sector}"]`);
                    if (btn && !btn.classList.contains('remove-btn-active')) {
                        await btn.click(); // This is async because it fetches schemas
                        
                        // Restore data for this sector
                        if (session.sectorData && session.sectorData[sector]) {
                            const container = document.getElementById(`sector-form-${sector}`);
                            restoreFormState(container, new Map(Object.entries(session.sectorData[sector])));
                            validateAllFields(container);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to restore session:', e);
        }
    }
    
    // Initial setup
    await initializeCoreForm();
    await restoreSession();

    // Expose schemas for the testing environment
    window.testing = {
        getCoreSchema: () => coreSchema,
        getSectorData: () => sectorDataCache,
    };
}

// Auto-initialize for browser environment
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializeWizard);
}