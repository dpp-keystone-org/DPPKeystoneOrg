/**
 * @jest-environment jsdom
 */

import { buildForm } from '../../src/wizard/form-builder.js';
import { generateDpp } from '../../src/wizard/dpp-generator.js';

// Since we are using the 'jsdom' environment via the docblock,
// 'document' is available globally.

describe('DPP Wizard - Form Builder', () => {
    it('should create form elements from a simple schema', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "productName": {
                    "title": "Product Name",
                    "description": "The official name of the product.",
                    "type": "string"
                },
                "serialNumber": {
                    "title": "Serial Number",
                    "type": "string"
                },
                "warrantyInYears": {
                    "title": "Warranty",
                    "type": "number"
                },
                "isRecyclable": {
                    "title": "Recyclable",
                    "type": "boolean"
                }
            }
        };

        const fragment = buildForm(mockSchema);

        // To inspect the fragment, we need to append it to the document body
        document.body.appendChild(fragment);

        // Check for productName field
        const productNameLabel = document.querySelector('label[for="productName"]');
        const productNameInput = document.querySelector('input#productName');
        expect(productNameLabel).not.toBeNull();
        expect(productNameLabel.textContent).toBe('Product Name');
        expect(productNameInput).not.toBeNull();
        expect(productNameInput.type).toBe('text');

        // Check for serialNumber field (no description)
        const serialNumberLabel = document.querySelector('label[for="serialNumber"]');
        const serialNumberInput = document.querySelector('input#serialNumber');
        expect(serialNumberLabel).not.toBeNull();
        expect(serialNumberInput).not.toBeNull();
        const description = serialNumberLabel.parentElement.querySelector('.description');
        expect(description).toBeNull();


        // Check for warranty field
        const warrantyInput = document.querySelector('input#warrantyInYears');
        expect(warrantyInput).not.toBeNull();
        expect(warrantyInput.type).toBe('number');

        // Check for recyclable field
        const recyclableInput = document.querySelector('input#isRecyclable');
        expect(recyclableInput).not.toBeNull();
        expect(recyclableInput.type).toBe('checkbox');
    });
});

describe('DPP Wizard - DPP Generator', () => {
    let coreFormContainer;
    let formContainer;
    let voluntaryFieldsWrapper;

    beforeEach(() => {
        // Set up the DOM for each test
        document.body.innerHTML = `
            <div>
                <div id="core-form-container"></div>
                <div id="form-container"></div>
                <div id="voluntary-fields-wrapper"></div>
            </div>
        `;
        coreFormContainer = document.getElementById('core-form-container');
        formContainer = document.getElementById('form-container');
        voluntaryFieldsWrapper = document.getElementById('voluntary-fields-wrapper');
    });

    it('should generate a JSON object from form inputs', () => {
        // 1. Populate the virtual DOM with a form
        formContainer.innerHTML = `
            <div class="form-group">
                <label for="productName">Product Name</label>
                <input type="text" id="productName" name="productName" value="Super Drill">
            </div>
            <div class="form-group">
                <label for="itemsInStock">Items in Stock</label>
                <input type="number" id="itemsInStock" name="itemsInStock" value="123">
            </div>
            <div class="form-group">
                <label for="isHeavy">Is Heavy</label>
                <input type="checkbox" id="isHeavy" name="isHeavy" checked>
            </div>
             <div class="form-group">
                <label for="isLight">Is Light</label>
                <input type="checkbox" id="isLight" name="isLight">
            </div>
        `;

        // 2. Populate voluntary fields
        voluntaryFieldsWrapper.innerHTML = `
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="customColor">
                <input class="voluntary-value" value="blue">
            </div>
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="customMaterial">
                <input class="voluntary-value" value="titanium">
            </div>
        `;

        // 3. Call the generator function
        const dpp = generateDpp(coreFormContainer, formContainer, voluntaryFieldsWrapper);

        // 4. Assert the output
        expect(dpp).toEqual({
            productName: 'Super Drill',
            itemsInStock: 123,
            isHeavy: true,
            isLight: false,
            customColor: 'blue',
            customMaterial: 'titanium'
        });
    });
});
