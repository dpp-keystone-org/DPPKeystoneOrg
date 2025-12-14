/**
 * @jest-environment jsdom
 */

import { buildForm } from '../../src/wizard/form-builder.js';
import { generateDpp } from '../../src/wizard/dpp-generator.js';

// Since we are using the 'jsdom' environment via the docblock,
// 'document' is available globally.

describe('DPP Wizard - Form Builder', () => {
    it('should create a 4-column grid and populate the fourth column with a tooltip', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "productName": { "type": "string" },
                "warrantyInYears": { "type": "number" },
                "isRecyclable": { "type": "boolean" },
                "granularity": { "type": "string", "enum": ["Batch", "Item", "Lot"] }
            }
        };

        const mockOntologyMap = new Map([
            ['productName', { label: 'Product Official Name', comment: 'The official name of the product.' }]
            // No entries for other properties to test fallback
        ]);

        const fragment = buildForm(mockSchema, mockOntologyMap);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        expect(gridContainer).not.toBeNull();

        // Check for headers
        const headers = gridContainer.querySelectorAll('.grid-header');
        expect(headers.length).toBe(4);

        const cells = gridContainer.querySelectorAll('.grid-cell');
        // 4 properties = 4 rows * 4 cells/row = 16 cells
        expect(cells.length).toBe(16);

        // Check productName row (cells 0, 1, 2, 3)
        expect(cells[0].textContent).toBe('productName');
        expect(cells[1].querySelector('input[name="productName"]')).not.toBeNull();
        
        // Assert the new structure: label in 3rd col, tooltip button in 4th
        expect(cells[2].textContent).toBe('Product Official Name'); 
        const tooltipButton = cells[3].querySelector('button.tooltip-button');
        expect(tooltipButton).not.toBeNull();
        expect(tooltipButton.textContent).toBe('?');
        expect(tooltipButton.title).toBe('The official name of the product.');
        
        // Check warranty row (cells 4, 5, 6, 7) - should have empty 3rd and 4th cells
        expect(cells[4].textContent).toBe('warrantyInYears');
        expect(cells[5].querySelector('input[type="number"]')).not.toBeNull();
        expect(cells[6].textContent).toBe('');
        expect(cells[7].innerHTML).toBe('');

        // Check recyclable row (cells 8, 9, 10, 11)
        expect(cells[8].textContent).toBe('isRecyclable');
        expect(cells[9].querySelector('input[type="checkbox"]')).not.toBeNull();

        // Check granularity row (cells 12, 13, 14, 15)
        expect(cells[12].textContent).toBe('granularity');
        const selectInput = cells[13].querySelector('select[name="granularity"]');
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

    it('should add items to a string array', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');
        
        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(0);

        addButton.click();
        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(1);
        expect(gridContainer.querySelector('input[name="tags.0"]')).not.toBeNull();

        addButton.click();
        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(2);
        expect(gridContainer.querySelector('input[name="tags.1"]')).not.toBeNull();
    });

    it('should create the correct column layout for new array items', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');
        
        addButton.click();
        
        const newRow = gridContainer.querySelector('input[name="tags.0"]').closest('.grid-row');
        expect(newRow).not.toBeNull();
        const cells = newRow.querySelectorAll('.grid-cell');
        expect(cells.length).toBe(4);
        expect(cells[0].textContent).toBe('tags.0');
        expect(cells[1].querySelector('input[name="tags.0"]')).not.toBeNull();
    });

    it('should create the correct column layout for the remove button', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');
        
        addButton.click();
        
        const newRow = gridContainer.querySelector('input[name="tags.0"]').closest('.grid-row');
        const controlRow = newRow.nextElementSibling;
        expect(controlRow).not.toBeNull();
        expect(controlRow.classList.contains('array-item-control-row')).toBe(true);

        const removeButton = controlRow.querySelector('button');
        const removeButtonCell = removeButton.closest('.grid-cell');
        const controlRowCells = controlRow.querySelectorAll('.grid-cell');

        expect(controlRowCells.length).toBe(4);
        expect(controlRowCells[1].contains(removeButton)).toBe(true);
    });

    it('should remove an item from a string array', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');

        addButton.click(); // Add tags.0
        addButton.click(); // Add tags.1
        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(2);

        const firstItemRow = gridContainer.querySelector('input[name="tags.0"]').closest('.grid-row');
        const controlRow = firstItemRow.nextElementSibling;
        const removeButton = controlRow.querySelector('button');
        removeButton.click();

        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(1);
        expect(gridContainer.querySelector('input[name="tags.1"]')).toBeNull(); // The old tags.1 is now gone
        expect(gridContainer.querySelector('input[name="tags.0"]')).not.toBeNull(); // The re-indexed item exists
    });

    it('should re-index array items after deletion', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');

        addButton.click(); // Add tags.0
        addButton.click(); // Add tags.1

        const firstItemRow = gridContainer.querySelector('input[name="tags.0"]').closest('.grid-row');
        const controlRow = firstItemRow.nextElementSibling;
        const removeButton = controlRow.querySelector('button');
        removeButton.click();

        const remainingInput = gridContainer.querySelector('input[name^="tags."]');
        expect(remainingInput.name).toBe('tags.0'); // Formerly tags.1, should be re-indexed
    });

    it('should allow adding items after the last item is removed', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');

        // 1. Add two items
        addButton.click(); // tags.0
        addButton.click(); // tags.1
        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(2);

        // 2. Find and remove the LAST item (tags.1)
        const lastItemRow = gridContainer.querySelector('input[name="tags.1"]').closest('.grid-row');
        const controlRow = lastItemRow.nextElementSibling;
        const removeButton = controlRow.querySelector('button');
        removeButton.click();

        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(1);

        // 3. Try to add another item
        addButton.click();

        // 4. Assert that a new item was added
        expect(gridContainer.querySelectorAll('input[name^="tags."]').length).toBe(2);
        expect(gridContainer.querySelector('input[name="tags.1"]')).not.toBeNull();
    });

    it('should handle array of objects with nested fields', () => {
        const arraySchema = {
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string" },
                            "material": { "type": "string" }
                        }
                    }
                }
            }
        };

        const fragment = buildForm(arraySchema);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const addButton = document.querySelector('button[data-array-name="components"]');
        expect(addButton).not.toBeNull();

        // Click to add a new object to the array
        addButton.click();

        // Check that inputs for the object's properties are created
        const nameInput = document.querySelector('input[name="components.0.name"]');
        const materialInput = document.querySelector('input[name="components.0.material"]');

        expect(nameInput).not.toBeNull();
        expect(materialInput).not.toBeNull();
    });

    it('should re-index object array items after deletion', () => {
        const arraySchema = {
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": { "type": "string" },
                            "material": { "type": "string" }
                        }
                    }
                }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="components"]');

        // 1. Add two items
        addButton.click(); // components.0
        addButton.click(); // components.1

        // 2. Find and remove the FIRST item (components.0)
        const firstItemNameInput = gridContainer.querySelector('input[name="components.0.name"]');
        const firstItemGroupRows = [
            firstItemNameInput.closest('.grid-row'),
            gridContainer.querySelector('input[name="components.0.material"]').closest('.grid-row')
        ];
        const controlRow = firstItemGroupRows[1].nextElementSibling;
        const removeButton = controlRow.querySelector('button');
        removeButton.click();

        // 3. Assert that the second item has been re-indexed to the first position
        const remainingNameInput = gridContainer.querySelector('input[name$=".name"]');
        const remainingMaterialInput = gridContainer.querySelector('input[name$=".material"]');

        expect(remainingNameInput.name).toBe('components.0.name');
        expect(remainingMaterialInput.name).toBe('components.0.material');
    });

    it('should increment index when adding multiple object array items', () => {
        const arraySchema = {
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": { "name": { "type": "string" } }
                    }
                }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="components"]');
    
        // Add first item
        addButton.click();
        expect(gridContainer.querySelector('input[name="components.0.name"]')).not.toBeNull();
    
        // Add second item
        addButton.click();
        expect(gridContainer.querySelector('input[name="components.1.name"]')).not.toBeNull();
    });

    it('should allow adding object array items after the last item is removed', () => {
        const arraySchema = {
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": { "name": { "type": "string" } }
                    }
                }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="components"]');

        // 1. Add an item
        addButton.click(); // components.0
        expect(gridContainer.querySelector('input[name="components.0.name"]')).not.toBeNull();

        // 2. Find and remove the item
        const itemRow = gridContainer.querySelector('input[name="components.0.name"]').closest('.grid-row');
        const controlRow = itemRow.nextElementSibling;
        const removeButton = controlRow.querySelector('button');
        removeButton.click();
        expect(gridContainer.querySelector('input[name="components.0.name"]')).toBeNull();


        // 3. Try to add another item
        addButton.click();

        // 4. Assert that a new item was added
        expect(gridContainer.querySelectorAll('input[name^="components."]').length).toBe(1);
        expect(gridContainer.querySelector('input[name="components.0.name"]')).not.toBeNull();
    });

    it('should maintain correct layout when adding to an object array', () => {
        const schema = {
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": { "name": { "type": "string" } }
                    }
                },
                "anotherField": { "type": "string" }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="components"]');
    
        // 1. Add an object item
        addButton.click();
    
        // 2. Check the layout of the new item's row
        const newItemRow = gridContainer.querySelector('input[name="components.0.name"]').closest('.grid-row');
        const newItemCells = newItemRow.querySelectorAll('.grid-cell');
        expect(newItemCells.length).toBe(4);
        expect(newItemCells[0].textContent).toBe('components.0.name');
        expect(newItemCells[1].querySelector('input[name="components.0.name"]')).not.toBeNull();
    
        // 3. Check that the subsequent field has not shifted
        const anotherFieldRow = gridContainer.querySelector('input[name="anotherField"]').closest('.grid-row');
        const anotherFieldCells = anotherFieldRow.querySelectorAll('.grid-cell');
        expect(anotherFieldCells[0].textContent).toBe('anotherField');
    });

    it('should allow removing the last item after a non-last item was removed', () => {
        const arraySchema = {
            "properties": {
                "components": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": { "name": { "type": "string" } }
                    }
                }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="components"]');

        // 1. Add three items
        addButton.click(); // components.0
        addButton.click(); // components.1
        addButton.click(); // components.2
        expect(gridContainer.querySelectorAll('input[name^="components."]').length).toBe(3);

        // 2. Find and remove the MIDDLE item (components.1)
        // Its control row is after the input row
        const middleItemRow = gridContainer.querySelector('input[name="components.1.name"]').closest('.grid-row');
        const middleControlRow = middleItemRow.nextElementSibling;
        const middleRemoveButton = middleControlRow.querySelector('button');
        middleRemoveButton.click();
        
        // 3. Assert that re-indexing worked and we have two items left
        expect(gridContainer.querySelectorAll('input[name^="components."]').length).toBe(2);
        expect(gridContainer.querySelector('input[name="components.0.name"]')).not.toBeNull();
        expect(gridContainer.querySelector('input[name="components.1.name"]')).not.toBeNull(); // This was components.2

        // 4. Find and remove the NEW LAST item (the one that was originally components.2)
        const lastItemRow = gridContainer.querySelector('input[name="components.1.name"]').closest('.grid-row');
        const lastControlRow = lastItemRow.nextElementSibling;
        const lastRemoveButton = lastControlRow.querySelector('button');
        lastRemoveButton.click();

        // 5. Assert that the item was actually removed. This is expected to fail.
        expect(gridContainer.querySelectorAll('input[name^="components."]').length).toBe(1);
    });

    it('should add new array item rows as direct children of the grid', () => {
        const arraySchema = { "properties": { "tags": { "type": "array", "items": { "type": "string" } } } };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');
    
        addButton.click();
    
        const newItemRow = gridContainer.querySelector('input[name="tags.0"]').closest('.grid-row');
        expect(newItemRow.parentElement).toBe(gridContainer);
    });

    it('should handle deeply nested arrays (array in object in array)', () => {
        const nestedArraySchema = {
            "properties": {
                "componentList": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "componentName": { "type": "string" },
                            "subComponents": {
                                "type": "array",
                                "items": { "type": "string" }
                            }
                        }
                    }
                }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(nestedArraySchema));
        const gridContainer = document.querySelector('.sector-form-grid');
        const addComponentButton = gridContainer.querySelector('button[data-array-name="componentList"]');
    
        // 1. Add a parent object
        addComponentButton.click();
        expect(gridContainer.querySelector('input[name="componentList.0.componentName"]')).not.toBeNull();
    
        // 2. Find the "Add Item" button for the NESTED array
        const addSubComponentButton = gridContainer.querySelector('button[data-array-name="componentList.0.subComponents"]');
        expect(addSubComponentButton).not.toBeNull();
    
        // 3. Add an item to the nested array and check its layout
        addSubComponentButton.click();
        const subComponentInput = gridContainer.querySelector('input[name="componentList.0.subComponents.0"]');
        expect(subComponentInput).not.toBeNull();
        const subComponentRow = subComponentInput.closest('.grid-row');
        expect(subComponentRow.parentElement).toBe(gridContainer);
    
        // 4. Add a second item to the nested array to check indexing
        addSubComponentButton.click();
        const subComponentInput2 = gridContainer.querySelector('input[name="componentList.0.subComponents.1"]');
        expect(subComponentInput2).not.toBeNull();

        // 5. Find and remove the FIRST sub-component
        const firstSubItemRow = gridContainer.querySelector('input[name="componentList.0.subComponents.0"]').closest('.grid-row');
        const controlRow = firstSubItemRow.nextElementSibling;
        const removeButton = controlRow.querySelector('button');
        expect(removeButton).not.toBeNull();
        removeButton.click();

        // 6. Assert that the second sub-component is re-indexed
        const remainingSubInput = gridContainer.querySelector('input[name^="componentList.0.subComponents"]');
        expect(remainingSubInput.name).toBe('componentList.0.subComponents.0');

        // 7. Assert that we can add another item correctly
        addSubComponentButton.click();
        const newSubComponent = gridContainer.querySelector('input[name="componentList.0.subComponents.1"]');
        expect(newSubComponent).not.toBeNull();
    });

    it('should not shift columns of subsequent fields when adding to an array', () => {
        const schema = {
            "properties": {
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                },
                "anotherField": {
                    "type": "string"
                }
            }
        };

        const fragment = buildForm(schema);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        const addButton = gridContainer.querySelector('button[data-array-name="tags"]');

        // 1. Check position of 'anotherField' before adding to array
        let anotherFieldRow = gridContainer.querySelector('input[name="anotherField"]').closest('.grid-row');
        let anotherFieldCells = anotherFieldRow.querySelectorAll('.grid-cell');
        expect(anotherFieldCells[0].textContent).toBe('anotherField');

        // 2. Add an item to the array
        addButton.click();

        // 3. Re-check position of 'anotherField'
        anotherFieldRow = gridContainer.querySelector('input[name="anotherField"]').closest('.grid-row');
        anotherFieldCells = anotherFieldRow.querySelectorAll('.grid-cell');
        expect(anotherFieldCells[0].textContent).toBe('anotherField'); // This should fail if columns shift
    });

    it('should NOT display the parent ontology label for a nested property', () => {
        const nestedSchema = {
            "type": "object",
            "properties": {
                "parentObject": {
                    "type": "object",
                    "properties": {
                        "childProperty": {
                            "type": "string"
                        }
                    }
                }
            }
        };

        const mockOntologyMap = new Map([
            ['parentObject', { label: 'The Parent Label', comment: 'A comment for the parent.' }]
            // Note: No label for 'childProperty' is provided.
        ]);

        const fragment = buildForm(nestedSchema, mockOntologyMap);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        expect(gridContainer).not.toBeNull();

        // Find the row for the nested property
        const childRow = gridContainer.querySelector('input[name="parentObject.childProperty"]').closest('.grid-row');
        expect(childRow).not.toBeNull();
        
        const cells = childRow.querySelectorAll('.grid-cell');
        
        // Assert the path is correct (Cell 0)
        expect(cells[0].textContent).toBe('parentObject.childProperty');

        // Assert the ontology label (Cell 2) should be EMPTY, not the parent's.
        // This is the assertion that will fail with the current logic.
        expect(cells[2].textContent).toBe('');
        
        // Assert the tooltip (Cell 3) is also empty
        const tooltipButton = cells[3].querySelector('button.tooltip-button');
        expect(tooltipButton).toBeNull();
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

    it('should correctly nest properties with dot notation in their names', () => {
        // 1. Populate the virtual DOM with a form containing dot-notation names
        formContainer.innerHTML = `
            <input name="productName" value="Super Drill">
            <input name="address.street" value="123 Main St">
            <input name="address.city" value="Anytown">
            <input name="address.location.lat" value="40.7128">
        `;

        // 2. Call the generator function
        const dpp = generateDpp('test-sector', coreFormContainer, formContainer, voluntaryFieldsWrapper);

        // 3. Assert the output has the correct nested structure
        expect(dpp.productName).toBe('Super Drill');
        expect(dpp.address).toBeInstanceOf(Object);
        expect(dpp.address.street).toBe('123 Main St');
        expect(dpp.address.city).toBe('Anytown');
        expect(dpp.address.location.lat).toBe("40.7128"); // The generator currently only produces strings for text inputs

        // 4. Assert that the incorrect flat properties do not exist
        expect(dpp.hasOwnProperty('address.street')).toBe(false);
        expect(dpp.hasOwnProperty('address.city')).toBe(false);
    });

    it('should correctly reconstruct primitive arrays from dot notation', () => {
        formContainer.innerHTML = `
            <input name="tags.0" value="eco-friendly">
            <input name="tags.1" value="recycled">
        `;
        const dpp = generateDpp('test-sector', coreFormContainer, formContainer, voluntaryFieldsWrapper);
        expect(dpp.tags).toEqual(['eco-friendly', 'recycled']);
        expect(dpp.hasOwnProperty('tags.0')).toBe(false);
    });

    it('should correctly reconstruct arrays of objects', () => {
        formContainer.innerHTML = `
            <input name="documents.0.resourceTitle" value="Safety Sheet">
            <input name="documents.0.url" value="http://example.com/safety">
            <input name="documents.1.resourceTitle" value="EPD">
            <input name="documents.1.url" value="http://example.com/epd">
        `;
        const dpp = generateDpp('test-sector', coreFormContainer, formContainer, voluntaryFieldsWrapper);
        expect(dpp.documents).toEqual([
            { resourceTitle: 'Safety Sheet', url: 'http://example.com/safety' },
            { resourceTitle: 'EPD', url: 'http://example.com/epd' }
        ]);
        expect(dpp.hasOwnProperty('documents.0.resourceTitle')).toBe(false);
    });

    it('should omit properties for empty text and number inputs', () => {
        formContainer.innerHTML = `
            <input name="productName" value="Super Drill">
            <input name="emptyString" value="">
            <input type="number" name="emptyNumber" value="">
        `;
        const dpp = generateDpp('test-sector', coreFormContainer, formContainer, voluntaryFieldsWrapper);
        expect(dpp.productName).toBe('Super Drill');
        expect(dpp).not.toHaveProperty('emptyString');
        expect(dpp).not.toHaveProperty('emptyNumber');
    });
});
