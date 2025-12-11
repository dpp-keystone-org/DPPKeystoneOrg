/**
 * @jest-environment jsdom
 */

import { buildForm } from '../../src/wizard/form-builder.js';
import { generateDpp } from '../../src/wizard/dpp-generator.js';

// Since we are using the 'jsdom' environment via the docblock,
// 'document' is available globally.

describe('DPP Wizard - Form Builder', () => {
    it('should create a 3-column grid for a simple schema', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "productName": {
                    "title": "Product Name",
                    "description": "The official name of the product.",
                    "type": "string"
                },
                "warrantyInYears": {
                    "title": "Warranty",
                    "type": "number"
                },
                "isRecyclable": {
                    "title": "Recyclable",
                    "type": "boolean"
                },
                "granularity": {
                    "title": "Granularity",
                    "type": "string",
                    "enum": ["Batch", "Item", "Lot"]
                }
            }
        };

        const fragment = buildForm(mockSchema);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        expect(gridContainer).not.toBeNull();

        // Check for headers
        const headers = gridContainer.querySelectorAll('.grid-header');
        expect(headers.length).toBe(3);

        const cells = gridContainer.querySelectorAll('.grid-cell');
        // 4 properties = 4 rows * 3 cells/row = 12 cells
        expect(cells.length).toBe(12);

        // Check productName row (cells 0, 1, 2)
        expect(cells[0].textContent).toBe('productName');
        expect(cells[1].querySelector('input[name="productName"]')).not.toBeNull();
        expect(cells[2].textContent).toBe('The official name of the product.');
        
        // Check warranty row (cells 3, 4, 5)
        expect(cells[3].textContent).toBe('warrantyInYears');
        expect(cells[4].querySelector('input[type="number"]')).not.toBeNull();

        // Check recyclable row (cells 6, 7, 8)
        expect(cells[6].textContent).toBe('isRecyclable');
        expect(cells[7].querySelector('input[type="checkbox"]')).not.toBeNull();

        // Check granularity row (cells 9, 10, 11)
        expect(cells[9].textContent).toBe('granularity');
        const selectInput = cells[10].querySelector('select[name="granularity"]');
        expect(selectInput).not.toBeNull();
        expect(selectInput.options.length).toBe(3);
    });

    it('should not render the contentSpecificationIds field', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "productName": { "title": "Product Name", "type": "string" },
                "contentSpecificationIds": { "title": "Content IDs", "type": "array" }
            }
        };

        const fragment = buildForm(mockSchema);
        document.body.appendChild(fragment);

        const skippedInput = document.querySelector('[name="contentSpecificationIds"]');
        expect(skippedInput).toBeNull();

        // Also ensure the other field is still rendered
        const productNameInput = document.querySelector('[name="productName"]');
        expect(productNameInput).not.toBeNull();
    });

    it('should handle nested objects and generate correct field paths', () => {
        const nestedSchema = {
            "title": "Nested Schema Test",
            "type": "object",
            "properties": {
                "topLevelField": {
                    "title": "Top Level",
                    "type": "string"
                },
                "nestedObject": {
                    "title": "A Nested Object",
                    "type": "object",
                    "properties": {
                        "innerField": {
                            "title": "Inner Field",
                            "type": "string"
                        }
                    }
                }
            }
        };

        const fragment = buildForm(nestedSchema);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        // This will fail initially because the non-construction schema uses the old form-group layout
        expect(gridContainer).not.toBeNull(); 

        const allText = gridContainer.textContent;
        // Check that the nested field path is correctly rendered
        expect(allText).toContain('topLevelField');
        expect(allText).toContain('nestedObject.innerField');
    });

    it('should handle array of strings with add/remove buttons', () => {
        const arraySchema = {
            "properties": {
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                }
            }
        };

        const fragment = buildForm(arraySchema);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        const cells = gridContainer.querySelectorAll('.grid-cell');
        
        // Find the cell containing the array controls
        const valueCell = cells[1];
        const addButton = valueCell.querySelector('button.add-array-item-btn');
        expect(addButton).not.toBeNull();
        expect(addButton.textContent).toBe('Add Item');
        
        // Click once, expect one input
        addButton.click();
        let itemInputs = valueCell.querySelectorAll('.array-item-row input');
        expect(itemInputs.length).toBe(1);
        
        // Click again, expect two inputs
        addButton.click();
        itemInputs = valueCell.querySelectorAll('.array-item-row input');
        expect(itemInputs.length).toBe(2);

        // Remove the first item
        const firstRemoveButton = valueCell.querySelector('.remove-array-item-btn');
        firstRemoveButton.click();
        
        // Expect only one input to remain
        itemInputs = valueCell.querySelectorAll('.array-item-row input');
        expect(itemInputs.length).toBe(1);
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
        const dpp = generateDpp('construction', coreFormContainer, formContainer, voluntaryFieldsWrapper);

        // 4. Assert the output
        expect(dpp).toEqual({
            productName: 'Super Drill',
            itemsInStock: 123,
            isHeavy: true,
            isLight: false,
            customColor: 'blue',
            customMaterial: 'titanium',
            contentSpecificationId: 'construction-product-dpp-v1',
            contentSpecificationIds: ['construction-product-dpp-v1'],
        });
    });
});
