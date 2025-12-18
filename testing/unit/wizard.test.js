/**
 * @jest-environment jsdom
 */

import { buildForm, createVoluntaryFieldRow } from '../../src/wizard/form-builder.js';
import { generateDpp } from '../../src/wizard/dpp-generator.js';

// Since we are using the 'jsdom' environment via the docblock,
// 'document' is available globally.

describe('DPP Wizard - Form Builder', () => {
    it('should create a 5-column grid and populate the unit and tooltip columns', () => {
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
            ['productName', { label: { en: 'Product Official Name' }, comment: { en: 'The official name of the product.' } }],
            ['warrantyInYears', { label: { en: 'Warranty Period' }, comment: { en: 'The warranty period in years.' }, unit: 'years' }]
            // No entries for other properties to test fallback
        ]);

        const fragment = buildForm(mockSchema, mockOntologyMap, 'en');
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const gridContainer = document.querySelector('.sector-form-grid');
        expect(gridContainer).not.toBeNull();

        // Check for headers
        const headers = gridContainer.querySelectorAll('.grid-header');
        expect(headers.length).toBe(5);

        const cells = gridContainer.querySelectorAll('.grid-cell');
        // 4 properties = 4 rows * 5 cells/row = 20 cells
        expect(cells.length).toBe(20);

        // Check productName row (cells 0, 1, 2, 3, 4) - should have empty unit cell
        expect(cells[0].textContent).toBe('productName'); // Path
        expect(cells[1].querySelector('input[name="productName"]')).not.toBeNull(); // Value
        expect(cells[2].textContent).toBe(''); // Unit
        expect(cells[3].textContent).toBe('Product Official Name'); // Ontology Label
        const tooltipButton1 = cells[4].querySelector('button.tooltip-button');
        expect(tooltipButton1).not.toBeNull();
        expect(tooltipButton1.textContent).toBe('?');
        
        // Check warranty row (cells 5, 6, 7, 8, 9) - should have unit and ontology info
        expect(cells[5].textContent).toBe('warrantyInYears'); // Path
        expect(cells[6].querySelector('input[type="number"]')).not.toBeNull(); // Value
        expect(cells[7].textContent).toBe('years'); // Unit
        expect(cells[8].textContent).toBe('Warranty Period'); // Ontology Label
        const tooltipButton2 = cells[9].querySelector('button.tooltip-button');
        expect(tooltipButton2).not.toBeNull();

        // Check recyclable row (cells 10, 11, 12, 13, 14)
        expect(cells[10].textContent).toBe('isRecyclable');
        expect(cells[11].querySelector('input[type="checkbox"]')).not.toBeNull();

        // Check granularity row (cells 15, 16, 17, 18, 19)
        expect(cells[15].textContent).toBe('granularity');
        const selectInput = cells[16].querySelector('select[name="granularity"]');
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
            "required": ["nestedObject"],
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
        expect(cells.length).toBe(5);
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

        expect(controlRowCells.length).toBe(5);
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
        expect(newItemCells.length).toBe(5);
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
            "required": ["parentObject"],
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
            ['parentObject', { label: { en: 'The Parent Label' }, comment: { en: 'A comment for the parent.' } }]
            // Note: No label for 'childProperty' is provided.
        ]);

        const fragment = buildForm(nestedSchema, mockOntologyMap, 'en');
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

    it('should use the "default" keyword to set an input value', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "dppId": {
                    "type": "string",
                    "format": "uri",
                    "default": "http://eu.example.com/dpp/12345"
                }
            }
        };

        const fragment = buildForm(mockSchema);
        document.body.innerHTML = '';
        document.body.appendChild(fragment);

        const input = document.querySelector('input[name="dppId"]');
        expect(input).not.toBeNull();
        expect(input.value).toBe('http://eu.example.com/dpp/12345');
    });

    it('should display a custom popup modal with governedBy info', () => {
        const mockSchema = { "properties": { "productName": { "type": "string" } } };
        const mockOntologyMap = new Map([['productName', {
            label: { en: 'Name' },
            comment: { en: 'The product name.' },
            governedBy: 'ISO-TEST-42'
        }]]);
        
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema, mockOntologyMap, 'en'));

        // 1. Find and click the tooltip button
        const tooltipButton = document.querySelector('button.tooltip-button');
        expect(tooltipButton).not.toBeNull();
        tooltipButton.click();

        // 2. Assert that the modal and overlay are created and contain correct text
        const overlay = document.querySelector('.tooltip-modal-overlay');
        const modal = document.querySelector('.tooltip-modal');
        expect(overlay).not.toBeNull();
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('The product name.');
        expect(modal.textContent).toContain('Standard: ISO-TEST-42'); // This will fail

        // 3. Assert that a close button exists
        const closeButton = modal.querySelector('.modal-close-btn');
        expect(closeButton).not.toBeNull();

        // 4. Click the close button and assert the modal is removed
        closeButton.click();
        expect(document.querySelector('.tooltip-modal-overlay')).toBeNull();
        expect(document.querySelector('.tooltip-modal')).toBeNull();
    });

    it('should display translated tooltip text from a multi-language comment', () => {
        const mockSchema = { "properties": { "testProp": { "type": "string" } } };
        const mockOntologyMap = new Map([
            ['testProp', {
                label: { en: 'Test' },
                comment: { en: 'English Comment', de: 'Deutscher Kommentar' }
            }]
        ]);
        
        // 1. Build the form with 'de' as the language
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema, mockOntologyMap, 'de'));

        // 2. Find and click the tooltip button
        const tooltipButton = document.querySelector('button.tooltip-button');
        expect(tooltipButton).not.toBeNull();
        tooltipButton.click();

        // 3. Assert that the modal appears with the German text
        const modal = document.querySelector('.tooltip-modal');
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('Deutscher Kommentar');
        expect(modal.textContent).not.toContain('English Comment');
    });

    it('should inherit governedBy from a parent property', () => {
        const schema = {
            "type": "object",
            "required": ["parent"],
            "properties": { "parent": { "type": "object", "properties": { "child": { "type": "number" } } } }
        };
        const ontologyMap = new Map([
            ['parent', { governedBy: 'PARENT-STD' }],
            ['child', { comment: { en: 'Child comment' } }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));

        // Find the specific row for the child property
        const childRow = document.querySelector('input[name="parent.child"]').closest('.grid-row');
        const tooltipButton = childRow.querySelector('button.tooltip-button');

        expect(tooltipButton).not.toBeNull();
        tooltipButton.click();

        const modal = document.querySelector('.tooltip-modal');
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('Standard: PARENT-STD');
    });

    it('should use its own governedBy over a parent property', () => {
        const schema = {
            "type": "object",
            "required": ["parent"],
            "properties": { "parent": { "type": "object", "properties": { "child": { "type": "number" } } } }
        };
        const ontologyMap = new Map([
            ['parent', { governedBy: 'PARENT-STD' }],
            ['child', { governedBy: 'CHILD-STD' }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));
        
        // Find the specific row for the child property
        const childRow = document.querySelector('input[name="parent.child"]').closest('.grid-row');
        const tooltipButton = childRow.querySelector('button.tooltip-button');

        expect(tooltipButton).not.toBeNull();
        tooltipButton.click();
        
        const modal = document.querySelector('.tooltip-modal');
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('Standard: CHILD-STD');
        expect(modal.textContent).not.toContain('Standard: PARENT-STD');
    });

    it('should use its own unit over a parent property', () => {
        const schema = {
            "type": "object",
            "required": ["parent"],
            "properties": { "parent": { "type": "object", "properties": { "child": { "type": "number" } } } }
        };
        const ontologyMap = new Map([
            ['parent', { unit: 'kg' }],
            ['child', { unit: 'g' }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));
        
        const childRow = document.querySelector('input[name="parent.child"]').closest('.grid-row');
        const unitCell = childRow.querySelector('.grid-cell:nth-child(3)');
        expect(unitCell.textContent).toBe('g');
    });

    it('should show an error for an invalid URI format', () => {
        const schema = {
            "properties": { "website": { "type": "string", "format": "uri" } }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));

        const input = document.querySelector('input[name="website"]');
        input.value = 'not a valid url';
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(input.classList.contains('invalid')).toBe(true);
        const error = input.parentElement.querySelector('.error-message');
        expect(error).not.toBeNull();
        expect(error.textContent).toBe('Must be a valid URI (e.g., http://example.com)');
    });

    it('should create a native date input for date format', () => {
        const schema = {
            "properties": { "releaseDate": { "type": "string", "format": "date" } }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));

        const input = document.querySelector('input[name="releaseDate"]');
        expect(input).not.toBeNull();
        expect(input.type).toBe('date');
    });

    it('should show an error for a number outside of min/max from ontology', () => {
        const schema = {
            "properties": { "percentage": { "type": "number" } }
        };
        // Simulate the structure we expect from the ontology loader in the future
        const ontologyMap = new Map([
            ['percentage', { 
                label: { en: 'Percentage' },
                validation: { min: 0, max: 100, type: 'integer' }
            }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap));
        
        const input = document.querySelector('input[name="percentage"]');
        expect(input).not.toBeNull();

        // Test value greater than max
        input.value = '101';
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        expect(input.classList.contains('invalid')).toBe(true);
        let error = input.parentElement.querySelector('.error-message');
        expect(error).not.toBeNull();
        expect(error.textContent).toBe('Must be between 0 and 100');

        // Test value less than min
        input.value = '-1';
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        expect(input.classList.contains('invalid')).toBe(true);

        // Test valid value
        input.value = '50';
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        expect(input.classList.contains('invalid')).toBe(false);
        error = input.parentElement.querySelector('.error-message');
        expect(error).toBeNull();
    });

    it('should not crash when a validatable field is followed by an array', () => {
        const schema = {
            "properties": {
                "website": { "type": "string", "format": "uri" },
                "tags": { "type": "array", "items": { "type": "string" } }
            }
        };
        // This test proves the hypothesis for the Playwright failure.
        // The previous code would throw a TypeError because the `input` for the array
        // is a div container, which doesn't have a `.type` property.
        // The test simply needs to not crash and render the form.
        document.body.innerHTML = '';
        expect(() => {
            document.body.appendChild(buildForm(schema));
        }).not.toThrow();

        // And as a sanity check, ensure an input was actually rendered.
        const input = document.querySelector('input[name="website"]');
        expect(input).not.toBeNull();
    });

    it('should show an error for an invalid country code format', () => {
        const schema = {
            "properties": { "countryOfOrigin": { "type": "string" } }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));

        const input = document.querySelector('input[name="countryOfOrigin"]');
        expect(input).not.toBeNull();

        // Test valid 2-letter code
        input.value = 'US';
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        expect(input.classList.contains('invalid')).toBe(false);

        // Test valid 3-letter code
        input.value = 'USA';
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        expect(input.classList.contains('invalid')).toBe(false);

        // Test invalid code
        input.value = 'U';
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(input.classList.contains('invalid')).toBe(true);
        const error = input.parentElement.querySelector('.error-message');
        expect(error).not.toBeNull();
        expect(error.textContent).toBe('Must be a valid 2 or 3-letter country code');
    });

    it('should show an error for an empty required field', () => {
        const schema = {
            "required": ["productName"],
            "properties": { "productName": { "type": "string" } }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));
        const input = document.querySelector('input[name="productName"]');

        // Simulate user typing and then deleting
        input.value = 'a';
        input.dispatchEvent(new Event('blur', { bubbles: true }));
        input.value = '';
        input.dispatchEvent(new Event('blur', { bubbles: true }));

        expect(input.classList.contains('invalid')).toBe(true);
        const error = input.parentElement.querySelector('.error-message');
        expect(error).not.toBeNull();
        expect(error.textContent).toBe('This field is required');
    });

    it('should not render fields for optional objects, showing an "Add" button instead', () => {
        const mockSchema = {
            "type": "object",
            "required": ["someOtherField"], // 'epd' is intentionally omitted
            "properties": {
                "someOtherField": { "type": "string" },
                "epd": {
                    "type": "object",
                    "properties": {
                        "gwp": { "type": "number" }
                    }
                }
            }
        };

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema));

        expect(document.querySelector('input[name="epd.gwp"]')).toBeNull();
        const addButton = document.querySelector('button[data-optional-object="epd"]');
        expect(addButton).not.toBeNull();
        expect(addButton.textContent).toBe('Add');
    });

    it('should render fields for an optional object when its "Add" button is clicked', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "epd": {
                    "type": "object",
                    "properties": {
                        "gwp": { "type": "number" }
                    }
                }
            }
        };

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema));

        // 1. Initial state: field is not there, "Add" button is.
        expect(document.querySelector('input[name="epd.gwp"]')).toBeNull();
        const addButton = document.querySelector('button[data-optional-object="epd"]');
        expect(addButton).not.toBeNull();

        // 2. Click the "Add" button.
        addButton.click();

        // 3. Assert that the field is now rendered. This will fail.
        expect(document.querySelector('input[name="epd.gwp"]')).not.toBeNull();

        // 4. Assert that the "Add" button is gone and replaced by a "Remove" button. This will also fail.
        expect(document.querySelector('button[data-optional-object="epd"]')).toBeNull();
        const removeButton = document.querySelector('button[data-remove-optional-object="epd"]');
        expect(removeButton).not.toBeNull();
        expect(removeButton.textContent).toBe('Remove');
    });

    it('should remove an optional object when its "Remove" button is clicked', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "epd": {
                    "type": "object",
                    "properties": {
                        "gwp": { "type": "number" }
                    }
                }
            }
        };

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema));

        // 1. Add the optional object first.
        const addButton = document.querySelector('button[data-optional-object="epd"]');
        expect(addButton).not.toBeNull();
        addButton.click();

        // 2. Verify it was added and find the "Remove" button.
        const removeButton = document.querySelector('button[data-remove-optional-object="epd"]');
        expect(removeButton).not.toBeNull();

        // 3. Click the "Remove" button. This will fail as the listener is not implemented.
        removeButton.click();

        // 4. Assert that the fields are gone and the "Add" button has returned.
        expect(document.querySelector('input[name="epd.gwp"]')).toBeNull();
        expect(document.querySelector('button[data-remove-optional-object="epd"]')).toBeNull();
        expect(document.querySelector('button[data-optional-object="epd"]')).not.toBeNull();
    });

    it('should preserve the root row of an optional object after it is added', () => {
        const mockSchema = {
            "type": "object",
            "properties": {
                "epd": {
                    "type": "object",
                    "properties": {
                        "gwp": { "type": "number" }
                    }
                }
            }
        };

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema));

        // 1. Find the placeholder row that contains the "Add" button.
        const placeholderRow = document.querySelector('div[data-optional-object-placeholder="epd"]');
        expect(placeholderRow).not.toBeNull();

        // 2. Click the "Add" button inside it.
        placeholderRow.querySelector('button[data-optional-object="epd"]').click();

        // 3. Assert that the original placeholder row element is still part of the document.
        // This is expected to fail because the current implementation uses `replaceWith`.
        expect(document.body.contains(placeholderRow)).toBe(true);
    });

    it('should display the ontology label for an optional object on its placeholder row', () => {
        const mockSchema = {
            "properties": {
                "epd": {
                    "type": "object",
                    "properties": { "gwp": { "type": "number" } }
                }
            }
        };
        const mockOntologyMap = new Map([
            ['epd', { label: { en: 'Environmental Product Declaration' } }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema, mockOntologyMap, 'en'));

        // 1. Find the placeholder row.
        const placeholderRow = document.querySelector('div[data-optional-object-placeholder="epd"]');
        expect(placeholderRow).not.toBeNull();

        // 2. Find the ontology cell (4th cell).
        const ontologyCell = placeholderRow.querySelector('.grid-cell:nth-child(4)');

        // 3. Assert that it contains the label. This will fail.
        expect(ontologyCell.textContent).toBe('Environmental Product Declaration');
    });

    it('should display the ontology label for an array property', () => {
        const arraySchema = {
            "properties": {
                "tags": {
                    "type": "array",
                    "items": { "type": "string" }
                }
            }
        };
        const mockOntologyMap = new Map([
            ['tags', { label: { en: 'Tags' } }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(arraySchema, mockOntologyMap, 'en'));

        // 1. Find the main row for the array property (the one with the "Add Item" button).
        const arrayRow = document.querySelector('button[data-array-name="tags"]').closest('.grid-row');
        expect(arrayRow).not.toBeNull();

        // 2. Find the ontology cell (4th cell).
        const ontologyCell = arrayRow.querySelector('.grid-cell:nth-child(4)');

        // 3. Assert that it contains the label. This will fail.
        expect(ontologyCell.textContent).toBe('Tags');
    });

    it('should display a generic "Add" label for optional object buttons', () => {
        const mockSchema = {
            "properties": {
                "notifiedBody": { "type": "object", "properties": { "id": { "type": "string" } } }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema));
        const addButton = document.querySelector('button[data-optional-object="notifiedBody"]');
        expect(addButton).not.toBeNull();
        // This will fail because the current text is "Add NOTIFIEDBODY"
        expect(addButton.textContent).toBe('Add');
    });

    it('should display a generic "Remove" label for optional object buttons', () => {
        const mockSchema = {
            "properties": {
                "notifiedBody": { "type": "object", "properties": { "id": { "type": "string" } } }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(mockSchema));
        
        // Add the object first
        document.querySelector('button[data-optional-object="notifiedBody"]').click();

        const removeButton = document.querySelector('button[data-remove-optional-object="notifiedBody"]');
        expect(removeButton).not.toBeNull();
        // This will fail because the current text is "Remove NOTIFIEDBODY"
        expect(removeButton.textContent).toBe('Remove');
    });
});

describe('DPP Wizard - Form Builder - Optional Object Edge Cases', () => {
    it('should handle nested optional objects correctly', () => {
        const nestedOptionalSchema = {
            "type": "object",
            "properties": {
                "parent": {
                    "type": "object",
                    "properties": {
                        "child": {
                            "type": "object",
                            "properties": {
                                "grandchild": { "type": "string" }
                            }
                        }
                    }
                }
            }
        };

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(nestedOptionalSchema));

        // --- Initial State ---
        expect(document.querySelector('button[data-optional-object="parent"]')).not.toBeNull();
        expect(document.querySelector('button[data-optional-object="child"]')).toBeNull();
        expect(document.querySelector('input[name="parent.child.grandchild"]')).toBeNull();

        // --- Expand Parent ---
        document.querySelector('button[data-optional-object="parent"]').click();
        expect(document.querySelector('button[data-optional-object="parent"]')).toBeNull();
        expect(document.querySelector('button[data-remove-optional-object="parent"]')).not.toBeNull();
        expect(document.querySelector('button[data-optional-object="child"]')).not.toBeNull(); // Child's "Add" button appears
        expect(document.querySelector('input[name="parent.child.grandchild"]')).toBeNull(); // Grandchild field still hidden

        // --- Expand Child ---
        document.querySelector('button[data-optional-object="child"]').click();
        expect(document.querySelector('button[data-optional-object="child"]')).toBeNull();
        expect(document.querySelector('button[data-remove-optional-object="child"]')).not.toBeNull();
        expect(document.querySelector('input[name="parent.child.grandchild"]')).not.toBeNull(); // Grandchild field now visible

        // --- Collapse Child ---
        document.querySelector('button[data-remove-optional-object="child"]').click();
        expect(document.querySelector('button[data-optional-object="child"]')).not.toBeNull(); // Child "Add" button returns
        expect(document.querySelector('button[data-remove-optional-object="child"]')).toBeNull();
        expect(document.querySelector('input[name="parent.child.grandchild"]')).toBeNull(); // Grandchild field is gone
        expect(document.querySelector('button[data-remove-optional-object="parent"]')).not.toBeNull(); // Parent is still expanded

        // --- Collapse Parent ---
        document.querySelector('button[data-remove-optional-object="parent"]').click();
        expect(document.querySelector('button[data-optional-object="parent"]')).not.toBeNull(); // Parent "Add" button returns
        expect(document.querySelector('button[data-remove-optional-object="parent"]')).toBeNull();
        expect(document.querySelector('button[data-optional-object="child"]')).toBeNull(); // Child "Add" button is gone
    });

    it('should ensure data is cleared when an object is removed and re-added', () => {
        const schema = {
            "properties": {
                "epd": {
                    "type": "object",
                    "properties": { "gwp": { "type": "number" } }
                }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));

        // 1. Add, populate, and get value
        document.querySelector('button[data-optional-object="epd"]').click();
        const input = document.querySelector('input[name="epd.gwp"]');
        input.value = '123.45';
        expect(input.value).toBe('123.45');

        // 2. Remove the object
        document.querySelector('button[data-remove-optional-object="epd"]').click();
        expect(document.querySelector('input[name="epd.gwp"]')).toBeNull();

        // 3. Re-add the object
        document.querySelector('button[data-optional-object="epd"]').click();
        const newInput = document.querySelector('input[name="epd.gwp"]');
        expect(newInput).not.toBeNull();

        // 4. Assert the value is the default empty state, not the old value
        expect(newInput.value).toBe('');
    });

    it('should handle sibling optional objects independently', () => {
        const schema = {
            "properties": {
                "epd": { "type": "object", "properties": { "gwp": { "type": "number" } } },
                "notifiedBody": { "type": "object", "properties": { "id": { "type": "string" } } }
            }
        };
        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema));

        // 1. Add both objects
        document.querySelector('button[data-optional-object="epd"]').click();
        document.querySelector('button[data-optional-object="notifiedBody"]').click();
        expect(document.querySelector('input[name="epd.gwp"]')).not.toBeNull();
        expect(document.querySelector('input[name="notifiedBody.id"]')).not.toBeNull();

        // 2. Remove the first object (epd)
        document.querySelector('button[data-remove-optional-object="epd"]').click();

        // 3. Assert the first object's fields are gone, but the second remains
        expect(document.querySelector('input[name="epd.gwp"]')).toBeNull();
        expect(document.querySelector('button[data-optional-object="epd"]')).not.toBeNull(); // Add button for epd returns
        expect(document.querySelector('input[name="notifiedBody.id"]')).not.toBeNull(); // notifiedBody field is still there
        expect(document.querySelector('button[data-remove-optional-object="notifiedBody"]')).not.toBeNull(); // remove button for notifiedBody is still there
    });

    it('should correctly inherit ontology for fields inside an added optional object', () => {
        const schema = {
            "type": "object",
            "properties": {
                "optionalWrapper": {
                    "type": "object",
                    "properties": {
                        "parent": {
                            "type": "object",
                            "required": ["child"],
                            "properties": {
                                "child": { "type": "string" }
                            }
                        }
                    }
                }
            }
        };
        const ontologyMap = new Map([
            ['parent', { governedBy: 'PARENT-STD-IN-OPTIONAL' }],
            ['child', { comment: { en: 'Child comment' } }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));

        document.querySelector('button[data-optional-object="optionalWrapper"]').click();
        document.querySelector('button[data-optional-object="parent"]').click();
        const childRow = document.querySelector('input[name="optionalWrapper.parent.child"]').closest('.grid-row');
        const tooltipButton = childRow.querySelector('button.tooltip-button');
        expect(tooltipButton).not.toBeNull();
        tooltipButton.click();
        const modal = document.querySelector('.tooltip-modal');
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('Standard: PARENT-STD-IN-OPTIONAL');
    });
});

describe('DPP Wizard - Custom Fields', () => {
    it('should create a custom field row with a Type selector', () => {
        const row = createVoluntaryFieldRow();
        
        expect(row.className).toBe('voluntary-field-row');
        
        const typeSelect = row.querySelector('select.voluntary-type');
        expect(typeSelect).not.toBeNull();
        
        const options = Array.from(typeSelect.options).map(o => o.value);
        expect(options).toContain('Text');
        expect(options).toContain('Number');
        expect(options).toContain('True/False');
        expect(options).toContain('Group');
    });

    it('should render a numeric input and unit field when "Number" is selected', () => {
        const row = createVoluntaryFieldRow();
        const typeSelect = row.querySelector('select.voluntary-type');
        
        // Change type to Number
        typeSelect.value = 'Number';
        typeSelect.dispatchEvent(new Event('change'));

        // Check value input type
        const valueInput = row.querySelector('.voluntary-value');
        expect(valueInput.type).toBe('number');

        // Check for unit input
        const unitInput = row.querySelector('.voluntary-unit');
        expect(unitInput).not.toBeNull();
        expect(unitInput.placeholder).toBe('Unit');
    });

    it('should render a True/False dropdown when "True/False" is selected', () => {
        const row = createVoluntaryFieldRow();
        const typeSelect = row.querySelector('select.voluntary-type');
        
        // Change type to True/False
        typeSelect.value = 'True/False';
        typeSelect.dispatchEvent(new Event('change'));

        // Check value input is now a select
        const valueInput = row.querySelector('.voluntary-value');
        expect(valueInput.tagName).toBe('SELECT');
        
        const options = Array.from(valueInput.options).map(o => o.text);
        expect(options).toContain('True');
        expect(options).toContain('False');
    });

    it('should render a Group container with an Add Property button when "Group" is selected', () => {
        const row = createVoluntaryFieldRow();
        const typeSelect = row.querySelector('select.voluntary-type');
        
        // Change type to Group
        typeSelect.value = 'Group';
        typeSelect.dispatchEvent(new Event('change'));

        // Check value input is removed
        const valueInput = row.querySelector('.voluntary-value');
        expect(valueInput).toBeNull();

        // Check for group container
        const groupContainer = row.querySelector('.voluntary-group-container');
        expect(groupContainer).not.toBeNull();

        // Check for Add Property button
        const addPropBtn = groupContainer.querySelector('button.add-voluntary-prop-btn');
        expect(addPropBtn).not.toBeNull();
        expect(addPropBtn.textContent).toBe('Add Field');
    });

    it('should include complex types from the registry in the Type selector', () => {
        const mockRegistry = [
            { label: 'Organization', schemaName: 'organization' }
        ];
        // Pass null for collisionChecker, and mockRegistry for the new argument
        const row = createVoluntaryFieldRow(null, mockRegistry);
        
        const typeSelect = row.querySelector('select.voluntary-type');
        const options = Array.from(typeSelect.options).map(o => o.value);
        
        expect(options).toContain('Organization');
    });

    it('should auto-populate fields when a complex type is selected', async () => {
        const mockRegistry = [
            { label: 'MockComplex', schemaName: 'mock-complex' }
        ];
        const mockSchema = {
            properties: {
                field1: { type: 'string' },
                field2: { type: 'number' }
            }
        };
        // Simple mock loader that returns the schema
        const mockLoader = () => Promise.resolve(mockSchema);

        const row = createVoluntaryFieldRow(null, mockRegistry, mockLoader);
        const typeSelect = row.querySelector('select.voluntary-type');
        
        typeSelect.value = 'MockComplex';
        typeSelect.dispatchEvent(new Event('change'));

        // Wait for the async handler to complete (microtask queue)
        await new Promise(resolve => setTimeout(resolve, 0));

        const groupContainer = row.querySelector('.voluntary-group-container');
        expect(groupContainer).not.toBeNull();

        // Check if fields are populated using the grid layout (not voluntary-field-row)
        const gridRows = groupContainer.querySelectorAll('.grid-row');
        expect(gridRows.length).toBe(2);

        // Check first field (field1)
        const field1Path = gridRows[0].querySelector('.grid-cell:first-child').textContent;
        expect(field1Path).toContain('field1');
        expect(gridRows[0].querySelector('input[type="text"]')).not.toBeNull();

        // Check second field (field2)
        const field2Path = gridRows[1].querySelector('.grid-cell:first-child').textContent;
        expect(field2Path).toContain('field2');
        expect(gridRows[1].querySelector('input[type="number"]')).not.toBeNull();
    });

    it('should enforce required fields defined in the complex type schema', async () => {
        const mockRegistry = [
            { label: 'MockOrg', schemaName: 'mock-org' }
        ];
        const mockSchema = {
            type: 'object',
            required: ['orgName'],
            properties: {
                orgName: { type: 'string' }
            }
        };
        const mockLoader = () => Promise.resolve(mockSchema);

        const row = createVoluntaryFieldRow(null, mockRegistry, mockLoader);
        
        // Set a key name so we have a predictable path
        const nameInput = row.querySelector('.voluntary-name');
        nameInput.value = 'myOrg';

        const typeSelect = row.querySelector('select.voluntary-type');
        typeSelect.value = 'MockOrg';
        typeSelect.dispatchEvent(new Event('change'));

        // Wait for async schema loading and DOM updates
        await new Promise(resolve => setTimeout(resolve, 0));

        const groupContainer = row.querySelector('.voluntary-group-container');
        const orgNameInput = groupContainer.querySelector('input[name="myOrg.orgName"]');
        expect(orgNameInput).not.toBeNull();

        // Assert that validation was triggered and the field is invalid (required but empty)
        expect(orgNameInput.classList.contains('invalid')).toBe(true);
        const errorMsg = orgNameInput.parentElement.querySelector('.error-message');
        expect(errorMsg).not.toBeNull();
        expect(errorMsg.textContent).toBe('This field is required');
    });

    it('should update paths for nested objects when the parent key is renamed (before adding)', async () => {
        const mockRegistry = [
            { label: 'MockOrg', schemaName: 'mock-org' }
        ];
        const mockSchema = {
            type: 'object',
            properties: {
                nested: {
                    type: 'object',
                    properties: {
                        field: { type: 'string' }
                    }
                }
            }
        };
        const mockLoader = () => Promise.resolve(mockSchema);

        const row = createVoluntaryFieldRow(null, mockRegistry, mockLoader);
        
        // 1. Select type without naming the field first
        const typeSelect = row.querySelector('select.voluntary-type');
        typeSelect.value = 'MockOrg';
        typeSelect.dispatchEvent(new Event('change'));

        await new Promise(resolve => setTimeout(resolve, 0));

        const groupContainer = row.querySelector('.voluntary-group-container');
        
        // Check initial paths (should not have 'voluntary' prefix)
        // Since 'nested' is optional, it renders as a placeholder row first
        const placeholderRow = groupContainer.querySelector('.grid-row[data-optional-object-placeholder="nested"]');
        expect(placeholderRow).not.toBeNull();
        const pathCell = placeholderRow.querySelector('.grid-cell:first-child');
        expect(pathCell.textContent).toBe('nested');

        // 2. Rename the field
        const nameInput = row.querySelector('.voluntary-name');
        nameInput.value = 'myOrg';
        nameInput.dispatchEvent(new Event('change'));

        // Check updated paths
        expect(pathCell.textContent).toBe('myOrg.nested');
    });

    it('should update paths for nested objects when the parent key is renamed (after adding)', async () => {
        const mockRegistry = [
            { label: 'MockOrg', schemaName: 'mock-org' }
        ];
        const mockSchema = {
            type: 'object',
            properties: {
                nested: {
                    type: 'object',
                    properties: { field: { type: 'string' } }
                }
            }
        };
        const mockLoader = () => Promise.resolve(mockSchema);

        const row = createVoluntaryFieldRow(null, mockRegistry, mockLoader);
        const typeSelect = row.querySelector('select.voluntary-type');
        typeSelect.value = 'MockOrg';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0));

        const groupContainer = row.querySelector('.voluntary-group-container');
        const addButton = groupContainer.querySelector('button[data-optional-object="nested"]');
        addButton.click();

        // Rename parent
        const nameInput = row.querySelector('.voluntary-name');
        nameInput.value = 'myOrg';
        nameInput.dispatchEvent(new Event('change'));

        // Check input path
        const input = groupContainer.querySelector('input[type="text"]');
        expect(input.name).toBe('myOrg.nested.field');
    });

    it('should update paths for nested objects when the parent key is renamed (after removing)', async () => {
        const mockRegistry = [
            { label: 'MockOrg', schemaName: 'mock-org' }
        ];
        const mockSchema = {
            type: 'object',
            properties: {
                nested: {
                    type: 'object',
                    properties: { field: { type: 'string' } }
                }
            }
        };
        const mockLoader = () => Promise.resolve(mockSchema);

        const row = createVoluntaryFieldRow(null, mockRegistry, mockLoader);
        const typeSelect = row.querySelector('select.voluntary-type');
        typeSelect.value = 'MockOrg';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0));

        const groupContainer = row.querySelector('.voluntary-group-container');
        
        // Add then Remove
        groupContainer.querySelector('button[data-optional-object="nested"]').click();
        groupContainer.querySelector('button[data-remove-optional-object="nested"]').click();

        // Rename parent
        const nameInput = row.querySelector('.voluntary-name');
        nameInput.value = 'myOrg';
        nameInput.dispatchEvent(new Event('change'));

        // Check placeholder path
        const placeholderRow = groupContainer.querySelector('.grid-row[data-optional-object-placeholder="nested"]');
        const pathCell = placeholderRow.querySelector('.grid-cell:first-child');
        expect(pathCell.textContent).toBe('myOrg.nested');
    });

    it('should clear "required" error when field is populated in a complex type after rename', async () => {
        const mockRegistry = [{ label: 'MockOrg', schemaName: 'mock-org' }];
        const mockSchema = { type: 'object', required: ['name'], properties: { name: { type: 'string' } } };
        const mockLoader = () => Promise.resolve(mockSchema);

        const row = createVoluntaryFieldRow(null, mockRegistry, mockLoader);
        const typeSelect = row.querySelector('select.voluntary-type');
        typeSelect.value = 'MockOrg';
        typeSelect.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0));

        // Rename parent
        const nameInput = row.querySelector('.voluntary-name');
        nameInput.value = 'myOrg';
        nameInput.dispatchEvent(new Event('change'));

        const input = row.querySelector('input[name="myOrg.name"]');
        // It should be invalid initially (required)
        expect(input.classList.contains('invalid')).toBe(true);

        input.value = 'Valid Name';
        input.dispatchEvent(new Event('blur'));
        expect(input.classList.contains('invalid')).toBe(false);
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
        const dpp = generateDpp(['construction'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        // 4. Assert the output
        expect(dpp).toEqual({
            '@context': 'https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld',
            productName: 'Super Drill',
            itemsInStock: 123,
            isHeavy: true,
            isLight: false,
            customColor: 'blue',
            customMaterial: 'titanium',
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
        const dpp = generateDpp(['test-sector'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

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
        const dpp = generateDpp(['test-sector'], coreFormContainer, formContainer, voluntaryFieldsWrapper);
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
        const dpp = generateDpp(['test-sector'], coreFormContainer, formContainer, voluntaryFieldsWrapper);
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
        const dpp = generateDpp(['test-sector'], coreFormContainer, formContainer, voluntaryFieldsWrapper);
        expect(dpp.productName).toBe('Super Drill');
        expect(dpp).not.toHaveProperty('emptyString');
        expect(dpp).not.toHaveProperty('emptyNumber');
    });
});

describe('DPP Wizard - Ontology Inheritance', () => {
    it('should display the source annotation in the tooltip', () => {
        const schema = {
            "properties": { "uniqueProductIdentifier": { "type": "string" } }
        };
        const ontologyMap = new Map([
            ['uniqueProductIdentifier', {
                label: { en: 'UPI' },
                'dcterms:source': {
                    '@id': 'http://example.com/law',
                    'rdfs:label': 'The Law'
                }
            }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));

        const row = document.querySelector('input[name="uniqueProductIdentifier"]').closest('.grid-row');
        const tooltipButton = row.querySelector('button.tooltip-button');
        expect(tooltipButton).not.toBeNull();
        tooltipButton.click();

        const modal = document.querySelector('.tooltip-modal');
        expect(modal).not.toBeNull();
        expect(modal.textContent).toContain('Source: The Law');
        const link = modal.querySelector('a');
        expect(link).not.toBeNull();
        expect(link.href).toBe('http://example.com/law');
    });

    it('should inherit source from the property domain class', () => {
        const schema = {
            "properties": { "batteryCategory": { "type": "string" } }
        };
        const ontologyMap = new Map([
            ['batteryCategory', {
                label: { en: 'Category' },
                domain: 'Battery'
            }],
            ['Battery', {
                'dcterms:source': {
                    '@id': 'http://example.com/battery-reg',
                    'rdfs:label': 'Battery Regulation'
                }
            }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));

        const row = document.querySelector('input[name="batteryCategory"]').closest('.grid-row');
        const tooltipButton = row.querySelector('button.tooltip-button');
        tooltipButton.click();
        const modal = document.querySelector('.tooltip-modal');
        expect(modal.textContent).toContain('Source: Battery Regulation');
    });

    it('should render a clickable link when source is a simple string URI', () => {
        const schema = { "properties": { "testField": { "type": "string" } } };
        const ontologyMap = new Map([
            ['testField', {
                label: { en: 'Test Field' },
                'dcterms:source': 'http://example.com/simple-uri'
            }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));

        const row = document.querySelector('input[name="testField"]').closest('.grid-row');
        row.querySelector('button.tooltip-button').click();

        const modal = document.querySelector('.tooltip-modal');
        const link = modal.querySelector('a');
        expect(link).not.toBeNull();
        expect(link.href).toBe('http://example.com/simple-uri');
        expect(link.textContent).toBe('Source: http://example.com/simple-uri');
    });

    it('should render a clickable link when source is an object with only an @id', () => {
        const schema = { "properties": { "testField": { "type": "string" } } };
        const ontologyMap = new Map([
            ['testField', {
                label: { en: 'Test Field' },
                'dcterms:source': {
                    '@id': 'http://example.com/id-only'
                }
            }]
        ]);

        document.body.innerHTML = '';
        document.body.appendChild(buildForm(schema, ontologyMap, 'en'));

        const row = document.querySelector('input[name="testField"]').closest('.grid-row');
        row.querySelector('button.tooltip-button').click();

        const modal = document.querySelector('.tooltip-modal');
        const link = modal.querySelector('a');
        expect(link).not.toBeNull();
        expect(link.href).toBe('http://example.com/id-only');
        expect(link.textContent).toBe('Source: http://example.com/id-only');
    });
});

describe('DPP Wizard - Ontology Inheritance Precedence', () => {
    const schema = {
        "required": ["parent"],
        "properties": {
            "parent": {
                "type": "object",
                "properties": {
                    "child": { "type": "string" }
                }
            }
        }
    };

    const getTooltipText = (fragment) => {
        document.body.innerHTML = '';
        document.body.appendChild(fragment);
        const row = document.querySelector('input[name="parent.child"]').closest('.grid-row');
        const tooltipButton = row.querySelector('button.tooltip-button');
        if (!tooltipButton) return null;
        tooltipButton.click();
        const modal = document.querySelector('.tooltip-modal');
        return modal ? modal.textContent : null;
    };

    it('should prioritize property annotation over its domain class annotation (1 & 4)', () => {
        const ontologyMap = new Map([
            ['child', { 'dcterms:source': 'Child Property Source', domain: 'ChildClass' }],
            ['ChildClass', { 'dcterms:source': 'Child Class Source' }],
            ['parent', { 'dcterms:source': 'Parent Property Source' }]
        ]);

        const fragment = buildForm(schema, ontologyMap, 'en');
        const text = getTooltipText(fragment);
        expect(text).toContain('Source: Child Property Source');
        expect(text).not.toContain('Child Class Source');
    });

    it('should prioritize child property annotation over parent property annotation (2)', () => {
        const ontologyMap = new Map([
            ['child', { 'dcterms:source': 'Child Property Source' }],
            ['parent', { 'dcterms:source': 'Parent Property Source' }]
        ]);

        const fragment = buildForm(schema, ontologyMap, 'en');
        const text = getTooltipText(fragment);
        expect(text).toContain('Source: Child Property Source');
        expect(text).not.toContain('Parent Property Source');
    });

    it('should prioritize child domain class annotation over parent property annotation (3)', () => {
        // This confirms that the "Class" of the specific field is more relevant than the "Property" of the parent.
        const ontologyMap = new Map([
            ['child', { domain: 'ChildClass' }], // No source on property itself
            ['ChildClass', { 'dcterms:source': 'Child Class Source' }],
            ['parent', { 'dcterms:source': 'Parent Property Source' }]
        ]);

        const fragment = buildForm(schema, ontologyMap, 'en');
        const text = getTooltipText(fragment);
        expect(text).toContain('Source: Child Class Source');
        expect(text).not.toContain('Parent Property Source');
    });

    it('should follow the full precedence chain: Child Prop > Child Class > Parent Prop > Parent Class', () => {
        // Setup the full chain
        const fullMap = new Map([
            ['child', { 'dcterms:source': 'Child Property Source', domain: 'ChildClass' }],
            ['ChildClass', { 'dcterms:source': 'Child Class Source' }],
            ['parent', { 'dcterms:source': 'Parent Property Source', domain: 'ParentClass' }],
            ['ParentClass', { 'dcterms:source': 'Parent Class Source' }]
        ]);

        // 1. Child Property wins
        expect(getTooltipText(buildForm(schema, fullMap, 'en'))).toContain('Source: Child Property Source');

        // 2. Remove Child Property Source -> Child Class wins
        fullMap.get('child')['dcterms:source'] = null;
        expect(getTooltipText(buildForm(schema, fullMap, 'en'))).toContain('Source: Child Class Source');

        // 3. Remove Child Class Source -> Parent Property wins
        fullMap.get('ChildClass')['dcterms:source'] = null;
        expect(getTooltipText(buildForm(schema, fullMap, 'en'))).toContain('Source: Parent Property Source');
    });
});
