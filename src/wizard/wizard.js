// src/wizard/wizard.js
import { loadSchema } from './schema-loader.js';
import { buildForm } from './form-builder.js';
import { generateDpp } from './dpp-generator.js';

export async function initializeWizard() {
    console.log("DPP Wizard script loaded.");

    // Get all UI elements
    const coreFormContainer = document.getElementById('core-form-container');
    const sectorSelect = document.getElementById('sector-select');
    const formContainer = document.getElementById('form-container');
    const addVoluntaryFieldBtn = document.getElementById('add-voluntary-field-btn');
    const voluntaryFieldsWrapper = document.getElementById('voluntary-fields-wrapper');
    const generateBtn = document.getElementById('generate-dpp-btn');
    const jsonOutput = document.getElementById('json-output');

    /**
     * Initializes the core DPP form on page load.
     */
    async function initializeCoreForm() {
        console.log('Initializing core DPP form...');
        try {
            const schema = await loadSchema('dpp');
            const formFragment = buildForm(schema);
            coreFormContainer.appendChild(formFragment);
            console.log('Core DPP form initialized successfully.');
        } catch (error) {
            coreFormContainer.innerHTML = '<p class="error">Could not load the core DPP form. Please check the console for details.</p>';
            console.error('Failed to build core DPP form:', error);
        }
    }

    // Event listener for sector selection
    if (sectorSelect && formContainer) {
        sectorSelect.addEventListener('change', async (event) => {
            const selectedSector = event.target.value;
            formContainer.innerHTML = ''; // Clear previous form
            jsonOutput.textContent = ''; // Clear previous output

            if (selectedSector) {
                console.log(`Sector selected: ${selectedSector}`);
                try {
                    const schema = await loadSchema(selectedSector);
                    const formFragment = buildForm(schema);
                    formContainer.appendChild(formFragment);
                } catch (error) {
                    formContainer.innerHTML = '<p class="error">Could not load the form for the selected sector. Please check the console for details.</p>';
                    console.error(`Failed to build form for sector ${selectedSector}:`, error);
                }
            }
        });
    }

    // Event listener for adding voluntary fields
    if (addVoluntaryFieldBtn && voluntaryFieldsWrapper) {
        addVoluntaryFieldBtn.addEventListener('click', () => {
            addVoluntaryField();
        });
    }

    // Event listener for generating the DPP
    if (generateBtn && coreFormContainer && formContainer && voluntaryFieldsWrapper && jsonOutput) {
        generateBtn.addEventListener('click', () => {
            const selectedSector = sectorSelect.value;
            const dppObject = generateDpp(selectedSector, coreFormContainer, formContainer, voluntaryFieldsWrapper);
            jsonOutput.textContent = JSON.stringify(dppObject, null, 2);
        });
    }

    function addVoluntaryField() {
        const fieldRow = document.createElement('div');
        fieldRow.className = 'voluntary-field-row';

        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.placeholder = 'Property Name';
        nameInput.className = 'voluntary-name';

        const valueInput = document.createElement('input');
        valueInput.type = 'text';
        valueInput.placeholder = 'Property Value';
        valueInput.className = 'voluntary-value';

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.textContent = 'Remove';
        removeBtn.addEventListener('click', () => {
            fieldRow.remove();
        });

        fieldRow.appendChild(nameInput);
        fieldRow.appendChild(valueInput);
        fieldRow.appendChild(removeBtn);
        voluntaryFieldsWrapper.appendChild(fieldRow);
    }
    
    // Initial setup
    await initializeCoreForm();
}

// Auto-initialize for browser environment
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', initializeWizard);
}