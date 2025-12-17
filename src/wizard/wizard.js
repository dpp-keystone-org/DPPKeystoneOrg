// src/wizard/wizard.js
import { loadSchema } from './schema-loader.js';
import { loadOntology } from './ontology-loader.js';
import { buildForm, createVoluntaryFieldRow } from './form-builder.js';
import { generateDpp } from './dpp-generator.js';

// --- Module-level state ---
let currentLanguage = 'en';

// Caches for holding loaded schemas and ontologies to avoid re-fetching
let coreSchema = null;
let coreOntologyMap = null;
const sectorDataCache = new Map(); // sector -> { schema, ontologyMap }

const SUPPORTED_CUSTOM_TYPES = [
    { label: 'Organization', schemaName: 'organization' }
];
const STORAGE_KEY = 'dpp_wizard_state_v1';

// --- DOM Element References ---
let coreFormContainer, sectorsFormContainer, addVoluntaryFieldBtn,
    voluntaryFieldsWrapper, generateBtn, showErrorsBtn, errorCountBadge,
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
    const activeSectors = [...sectorsFormContainer.querySelectorAll('.sector-form-container')].map(c => c.id.replace('sector-form-', ''));
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
    for (const sector of activeSectors) {
        const data = sectorDataCache.get(sector);
        if (data) {
            const { schema, ontologyMap } = data;
            const formFragment = buildForm(schema, ontologyMap, currentLanguage);
            
            const sectorContainer = document.createElement('div');
            sectorContainer.id = `sector-form-${sector}`;
            sectorContainer.className = 'sector-form-container';
            const sectorHeader = document.createElement('h2');
            sectorHeader.textContent = `${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
            sectorContainer.appendChild(sectorHeader);
            sectorContainer.appendChild(formFragment);
            sectorsFormContainer.appendChild(sectorContainer);
            
            restoreFormState(sectorContainer, sectorStates.get(sector));
        }
    }
}


export async function initializeWizard() {
    const invalidFields = new Set();

    // --- Get all UI elements ---
    coreFormContainer = document.getElementById('core-form-container');
    sectorsFormContainer = document.getElementById('sectors-form-container');
    addVoluntaryFieldBtn = document.getElementById('add-voluntary-field-btn');
    voluntaryFieldsWrapper = document.getElementById('voluntary-fields-wrapper');
    generateBtn = document.getElementById('generate-dpp-btn');
    showErrorsBtn = document.getElementById('show-errors-btn');
    errorCountBadge = document.getElementById('error-count-badge');
    jsonOutput = document.getElementById('json-output');
    sectorButtons = document.querySelectorAll('.sector-btn');
    languageSelector = document.getElementById('language-selector');

    /**
     * Toggles the visibility of the 'Generate' and 'Show Errors' buttons
     * based on the current validation state.
     */
    function updateButtonState() {
        if (!generateBtn || !showErrorsBtn) return;
        const hasErrors = invalidFields.size > 0;
        generateBtn.hidden = hasErrors;
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
            link.textContent = path;
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

            if (existingContainer) {
                // Clear any invalid fields from this sector before removing it
                existingContainer.querySelectorAll('input, select').forEach(input => {
                    invalidFields.delete(input.name);
                });
                updateButtonState();

                existingContainer.remove();
                button.textContent = `Add ${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
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
                    
                    const sectorHeader = document.createElement('h2');
                    sectorHeader.textContent = `${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
                    sectorContainer.appendChild(sectorHeader);

                    sectorContainer.appendChild(formFragment);
                    sectorsFormContainer.appendChild(sectorContainer);

                    // Trigger validation for the new sector form
                    validateAllFields(sectorContainer);

                    button.textContent = `Remove ${sector.charAt(0).toUpperCase() + sector.slice(1)}`;
                    button.classList.add('remove-btn-active');

                } catch (error) {
                    sectorsFormContainer.innerHTML += `<p class="error">Could not load the form for the ${sector} sector.</p>`;
                    console.error(`Failed to build form for sector ${sector}:`, error);
                }
            }
            saveSession();
        });
    });

    if (addVoluntaryFieldBtn && voluntaryFieldsWrapper) {
        addVoluntaryFieldBtn.addEventListener('click', () => addVoluntaryField());
    }

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const activeSectors = [...sectorsFormContainer.querySelectorAll('.sector-form-container')]
                .map(container => container.id.replace('sector-form-', ''));

            const dppObject = generateDpp(activeSectors, coreFormContainer, sectorsFormContainer, voluntaryFieldsWrapper);
            jsonOutput.textContent = JSON.stringify(dppObject, null, 2);
        });
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

    function addVoluntaryField() {
        const fieldRow = createVoluntaryFieldRow(getConflictingSectors, SUPPORTED_CUSTOM_TYPES, loadSchema, coreOntologyMap);
        voluntaryFieldsWrapper.appendChild(fieldRow);
    }

    /**
     * Saves the current session state (Core + Sectors) to localStorage.
     */
    function saveSession() {
        const coreState = Object.fromEntries(saveFormState(coreFormContainer));
        const activeSectors = [...sectorsFormContainer.querySelectorAll('.sector-form-container')]
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