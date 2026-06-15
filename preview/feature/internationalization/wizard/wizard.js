// src/wizard/wizard.js
import { loadHeader } from '../branding/header.js?v=1781526816419';
loadHeader('dpp-header-container', '..');
import { loadSchema } from '../lib/schema-loader.js?v=1781526816419';
import { loadOntology } from '../lib/ontology-loader.js?v=1781526816419';
import { buildForm, createVoluntaryFieldRow } from './form-builder.js?v=1781526816419';
import { generateDpp } from './dpp-generator.js?v=1781526816419';
import { generateHTML } from '../lib/html-generator.js?v=1781526816419';
import { transformDpp } from '../util/js/client/dpp-schema-adapter.js?v=1781526816419';
import * as jsonld from 'jsonld';
import { KEYSTONE_VERSION } from '../lib/keystone-version.js?v=1781526816419';
import { LanguageManager } from '../lib/language-manager.js?v=1781526816419';

// --- Module-level state ---
let currentLanguage = LanguageManager.getPreferredLanguage();

function triggerLocalization() {
    document.dispatchEvent(new CustomEvent('languageChanged', { detail: { language: LanguageManager.getPreferredLanguage() } }));
}

// Caches for holding loaded schemas and ontologies to avoid re-fetching
let coreSchema = null;
let coreOntologyMap = null;
const sectorDataCache = new Map(); // sector -> { schema, ontologyMap }

const SUPPORTED_CUSTOM_TYPES = [
    { label: 'Organization', schemaName: 'organization' },
    { label: 'Product Characteristic', schemaName: 'product-characteristic' }, // Maps to product-characteristic.schema.json (virtual or real)
    { label: 'Related Resource', schemaName: 'related-resource' }
];
const STORAGE_KEY = `dpp_wizard_state_${KEYSTONE_VERSION}`;

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

    // Save structurally expanded arrays and optional objects
    const arrayItemControls = container.querySelectorAll('.array-item-control-row');
    const arrayIndexes = {};
    arrayItemControls.forEach(row => {
        const group = row.dataset.arrayGroup;
        if (!group) return;
        const lastDot = group.lastIndexOf('.');
        const arrayName = group.substring(0, lastDot);
        const index = parseInt(group.substring(lastDot + 1), 10);
        
        if (!arrayIndexes[arrayName]) {
            arrayIndexes[arrayName] = { indexes: [], depth: (arrayName.match(/\./g) || []).length };
        }
        arrayIndexes[arrayName].indexes.push(index);
    });

    const expandedElements = container.querySelectorAll('[data-remove-optional-object], [data-pending-optional-object]');
    const optionalObjects = [];
    expandedElements.forEach(el => {
        const key = el.dataset.removeOptionalObject || el.dataset.pendingOptionalObject;
        const row = el.closest('.grid-row');
        if (!row || !row.dataset.objectPath) return;

        let oneOfSelection = undefined;
        if (row.hasAttribute('data-oneof-selection')) {
            oneOfSelection = row.dataset.oneofSelection;
        } else if (el.hasAttribute('data-oneof-selection')) {
            oneOfSelection = el.dataset.oneofSelection;
        }

        optionalObjects.push({
            path: row.dataset.objectPath,
            key: key,
            oneOfSelection: oneOfSelection,
            depth: (row.dataset.objectPath.match(/\./g) || []).length
        });
    });

    if (Object.keys(arrayIndexes).length > 0) state.set('__EXPANDED_ARRAYS__', arrayIndexes);
    if (optionalObjects.length > 0) state.set('__EXPANDED_OPTIONAL_OBJECTS__', optionalObjects);

    return state;
}

/**
 * Restores the values of all inputs, selects, and textareas in a container.
 * @param {HTMLElement} container - The container element to search within.
 * @param {Map<string, string|boolean>} state - The map of state to restore.
 */
function restoreFormState(container, state) {
    if (!container || !state) return;

    // 1. Restore structural expansions (arrays and optional objects) interleaved by depth
    const tasks = [];
    
    if (state.has('__EXPANDED_ARRAYS__')) {
        const arrayIndexes = state.get('__EXPANDED_ARRAYS__');
        Object.entries(arrayIndexes).forEach(([arrayName, data]) => {
            tasks.push({
                type: 'array',
                name: arrayName,
                indexes: data.indexes,
                depth: data.depth
            });
        });
    }

    if (state.has('__EXPANDED_OPTIONAL_OBJECTS__')) {
        const optionalObjects = state.get('__EXPANDED_OPTIONAL_OBJECTS__');
        optionalObjects.forEach(obj => tasks.push({ type: 'optional', ...obj }));
    }

    tasks.sort((a, b) => a.depth - b.depth);

    tasks.forEach(task => {
        if (task.type === 'array') {
            const addBtn = container.querySelector(`button.add-array-item-btn[data-array-name="${task.name}"]`);
            if (addBtn) {
                const maxIndex = Math.max(...task.indexes);
                // Create all indexes up to maxIndex
                for (let i = 0; i <= maxIndex; i++) {
                    addBtn.click();
                }
                // Remove the ones that were deleted by the user
                for (let i = 0; i <= maxIndex; i++) {
                    if (!task.indexes.includes(i)) {
                        const removeBtn = container.querySelector(`.array-item-control-row[data-array-group="${task.name}.${i}"] button`);
                        if (removeBtn) removeBtn.click();
                    }
                }
            }
        } else if (task.type === 'optional') {
            // Find the specific row for this optional object
            const row = container.querySelector(`.grid-row[data-object-path="${task.path}"]`);
            if (row) {
                // Find the specific add button within that row
                const addBtn = row.querySelector(`button[data-optional-object="${task.key}"]`);
                if (addBtn) {
                    addBtn.click();
                    if (task.oneOfSelection !== undefined) {
                        const select = row.querySelector(`select[data-pending-optional-object="${task.key}"]`);
                        if (select) {
                            select.value = task.oneOfSelection;
                            select.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
            }
        }
    });

    // 2. Restore all standard data inputs
    state.forEach((value, name) => {
        if (name === '__EXPANDED_OPTIONAL_OBJECTS__' || name === '__EXPANDED_ARRAY_INDEXES__') return;
        
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
    const langWrapper = document.getElementById('language-widget-wrapper');

    const previewSchemaBtn = document.getElementById('preview-schema-btn');
    const previewNoSchemaBtn = document.getElementById('preview-no-schema-btn');
    const schemaBtn = document.getElementById('schema-btn');

    /**
     * Toggles the visibility of the 'Generate' and 'Show Errors' buttons
     * based on the current validation state.
     */
    function updateButtonState() {
        if (!generateBtn || !showErrorsBtn) return;
        const hasErrors = invalidFields.size > 0;

        generateBtn.hidden = hasErrors;
        if (previewSchemaBtn) previewSchemaBtn.hidden = hasErrors;
        if (previewNoSchemaBtn) previewNoSchemaBtn.hidden = hasErrors;
        if (schemaBtn) schemaBtn.hidden = hasErrors;

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
            if (!coreSchema) coreSchema = await loadSchema('dpp', 'header');
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
        if (previewSchemaBtn) previewSchemaBtn.hidden = hasErrors;
        if (previewNoSchemaBtn) previewNoSchemaBtn.hidden = hasErrors;
        if (schemaBtn) schemaBtn.hidden = hasErrors;

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


    sectorButtons.forEach(button => {
        button.addEventListener('click', async () => {
            const sector = button.dataset.sector;
            const sectorContainerId = `sector-form-${sector}`;
            const existingContainer = document.getElementById(sectorContainerId);

            const sectorDisplayNames = {
                'general-product': 'General Product Information',
                'textile': 'Textile',
                'iron-steel': 'Iron or Steel'
            };
            const displayName = sectorDisplayNames[sector] || (sector.charAt(0).toUpperCase() + sector.slice(1));

            const schemaType = button.dataset.schemaType || 'sector';

            if (existingContainer) {
                // The MutationObserver will handle clearing validation errors when the container is removed.
                existingContainer.remove();
                button.setAttribute('data-i18n-key', button.getAttribute('data-i18n-key').replace('remove-', 'add-'));
                button.classList.remove('remove-btn-active');
                triggerLocalization();
            } else {
                // Add Sector
                try {
                    let data = sectorDataCache.get(sector);
                    if (!data) {
                        const schema = await loadSchema(sector, schemaType);
                        const ontologyMap = await loadOntology(sector);
                        data = { schema, ontologyMap };
                        sectorDataCache.set(sector, data);
                    }

                    const { schema, ontologyMap } = data;
                    const formFragment = buildForm(schema, ontologyMap, currentLanguage);

                    const sectorContainer = document.createElement('div');
                    sectorContainer.id = sectorContainerId;
                    sectorContainer.className = 'sector-form-container';
                    sectorContainer.dataset.schemaType = schemaType;

                    const sectorHeader = document.createElement('h3');
                    sectorHeader.textContent = displayName;
                    sectorContainer.appendChild(sectorHeader);

                    sectorContainer.appendChild(formFragment);

                    if (schemaType === 'shared') {
                        voluntaryModulesContainer.appendChild(sectorContainer);
                    } else {
                        sectorsFormContainer.appendChild(sectorContainer);
                    }

                    // Trigger validation for the new sector form
                    validateAllFields(sectorContainer);

                    button.setAttribute('data-i18n-key', button.getAttribute('data-i18n-key').replace('add-', 'remove-'));
                    button.classList.add('remove-btn-active');
                    triggerLocalization();

                } catch (error) {
                    const targetContainer = (schemaType === 'shared') ? voluntaryModulesContainer : sectorsFormContainer;
                    targetContainer.innerHTML += `<p class="error">Could not load the form for the ${sector} sector.</p>`;
                    console.error(`Failed to build form for sector ${sector}:`, error);
                }
            }
            saveSession();

            // Re-evaluate all voluntary fields now that the active sectors have changed.
            // This prevents the validation state from being one cycle behind the DOM updates.
            document.querySelectorAll('.voluntary-name').forEach(input => {
                input.dispatchEvent(new Event('blur', { bubbles: true, cancelable: true }));
            });
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

        const activeContainers = document.querySelectorAll('.sector-form-container');

        for (const container of activeContainers) {
            const sector = container.id.replace('sector-form-', '');
            const schemaType = container.dataset.schemaType || 'sector';
            let data = sectorDataCache.get(sector);
            if (!data) {
                try {
                    const schema = await loadSchema(sector, schemaType);
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
        triggerLocalization();
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
        removeBtn.setAttribute('data-i18n-key', 'remove');
        removeBtn.addEventListener('click', () => row.remove());

        row.appendChild(prefixInput);
        row.appendChild(uriInput);
        row.appendChild(removeBtn);

        externalContextsWrapper.appendChild(row);
        triggerLocalization();
    }

    if (addExternalContextBtn && externalContextsWrapper) {
        addExternalContextBtn.addEventListener('click', addExternalContext);
    }

    // Helper to gather data and handle previews
    const getDppData = () => {
        const activeSectors = [...document.querySelectorAll('.sector-form-container')]
            .map(container => container.id.replace('sector-form-', ''));
        return generateDpp(activeSectors, coreFormContainer, sectorsFormContainer, voluntaryFieldsWrapper, voluntaryModulesContainer, externalContextsWrapper, sectorDataCache);
    };

    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const dppObject = getDppData();
            jsonOutput.textContent = JSON.stringify(dppObject, null, 2);
        });
    }

    const handleHtmlPreview = async (includeSchema, btn) => {
        try {
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Generating...';

            const dppObject = getDppData();
            const customCssUrl = document.getElementById('custom-css-url')?.value?.trim();
            const htmlContent = await generateHTML(dppObject, { customCssUrl, includeSchema, language: currentLanguage });

            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');
        } catch (e) {
            console.error(e);
            alert("Failed to generate HTML preview: " + e.message);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = btn.id === 'preview-schema-btn' ? 'Preview HTML With Schema.org' : 'Preview HTML Without Schema';
            }
        }
    };

    if (previewSchemaBtn) {
        previewSchemaBtn.addEventListener('click', () => handleHtmlPreview(true, previewSchemaBtn));
    }

    if (previewNoSchemaBtn) {
        previewNoSchemaBtn.addEventListener('click', () => handleHtmlPreview(false, previewNoSchemaBtn));
    }

    if (schemaBtn) {
        schemaBtn.addEventListener('click', async () => {
            try {
                const originalText = schemaBtn.textContent;
                schemaBtn.disabled = true;
                schemaBtn.textContent = 'Transforming...';

                const dppData = getDppData();

                // Configure document loader to resolve specific URLs locally
                const documentLoader = async (url, options) => {
                    // Intercept spec URLs and redirect to local files if possible
                    if (url.startsWith('https://dpp-keystone.org/spec/')) {
                        const relativePath = url.replace('https://dpp-keystone.org/spec/', '../spec/');

                        // Try to fetch locally
                        try {
                            const res = await fetch(relativePath);
                            if (res.ok) {
                                const document = await res.json();
                                return {
                                    contextUrl: null,
                                    document,
                                    documentUrl: url
                                };
                            }
                        } catch (e) {
                            console.warn(`Failed to fetch local spec for ${url}, falling back to network/default.`);
                        }
                    }
                    return (jsonld.documentLoaders ? jsonld.documentLoaders.xhr() : (u) => fetch(u).then(r => r.json()).then(d => ({ document: d, documentUrl: u })))(url);
                };

                const options = {
                    profile: 'schema.org',
                    ontologyPaths: [`../spec/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`],
                    documentLoader,
                    version: KEYSTONE_VERSION
                };

                const transformed = await transformDpp(dppData, options);

                const jsonStr = JSON.stringify(transformed, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/ld+json' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');

            } catch (e) {
                console.error(e);
                alert('Failed to generate Schema.org JSON-LD: ' + e.message);
            } finally {
                schemaBtn.disabled = false;
                schemaBtn.textContent = 'Preview Schema.org';
            }
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

    if (langWrapper) {
        langWrapper.innerHTML = '';
        
        // Initialize Language Manager with both files
        await LanguageManager.init(['index.i18n.json', '../lib/validation-errors.i18n.json']);

        document.addEventListener('languageChanged', async (e) => {
            if (e.detail.language !== currentLanguage) {
                currentLanguage = e.detail.language;
                await rerenderAllForms();
                
                // Re-validate everything because rerender wiped DOM and MutationObserver cleared errors
                validateAllFields(coreFormContainer);
                validateAllFields(sectorsFormContainer);
                validateAllFields(voluntaryModulesContainer);
                validateAllFields(voluntaryFieldsWrapper);
                validateAllFields(externalContextsWrapper);
            }
        });
    }

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