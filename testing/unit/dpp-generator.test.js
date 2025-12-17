/**
 * @jest-environment jsdom
 */

import { generateDpp } from '../../src/wizard/dpp-generator.js';

describe('DPP Generator', () => {
    let coreFormContainer;
    let formContainer;
    let voluntaryFieldsWrapper;

    beforeEach(() => {
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

    // =========================================================================
    // 5s-1. Baseline Regression & Basic Types
    // =========================================================================

    it('should generate a flat JSON object from simple form inputs', () => {
        formContainer.innerHTML = `
            <input name="productName" value="Super Drill">
            <input type="number" name="itemsInStock" value="123">
            <input type="checkbox" name="isHeavy" checked>
            <input type="checkbox" name="isLight">
        `;

        const dpp = generateDpp(['construction'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp).toEqual(expect.objectContaining({
            productName: 'Super Drill',
            itemsInStock: 123,
            isHeavy: true,
            isLight: false
        }));
    });

    it('should correctly nest properties with dot notation', () => {
        formContainer.innerHTML = `
            <input name="address.street" value="123 Main St">
            <input name="address.city" value="Anytown">
            <input name="address.location.lat" value="40.7128">
        `;

        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp.address).toEqual({
            street: '123 Main St',
            city: 'Anytown',
            location: { lat: "40.7128" }
        });
    });

    it('should reconstruct primitive arrays', () => {
        formContainer.innerHTML = `
            <input name="tags.0" value="A">
            <input name="tags.1" value="B">
        `;
        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);
        expect(dpp.tags).toEqual(['A', 'B']);
    });

    it('should reconstruct arrays of objects', () => {
        formContainer.innerHTML = `
            <input name="docs.0.title" value="Doc 1">
            <input name="docs.1.title" value="Doc 2">
        `;
        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);
        expect(dpp.docs).toEqual([
            { title: 'Doc 1' },
            { title: 'Doc 2' }
        ]);
    });

    // =========================================================================
    // 5s-1b. Empty & Null Handling
    // =========================================================================

    it('should omit empty strings and nulls but preserve 0 and false', () => {
        formContainer.innerHTML = `
            <input name="emptyText" value="">
            <input type="number" name="emptyNumber" value="">
            <input type="number" name="zeroNumber" value="0">
            <input type="checkbox" name="falseBool"> 
        `;
        // Note: unchecked checkbox usually results in false in our generator logic

        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp).not.toHaveProperty('emptyText');
        expect(dpp).not.toHaveProperty('emptyNumber');
        expect(dpp.zeroNumber).toBe(0);
        expect(dpp.falseBool).toBe(false);
    });

    // =========================================================================
    // 5s-2. Custom Field Type Support (Primitives)
    // =========================================================================

    it('should respect explicit types for custom fields (Text vs Number)', () => {
        // Scenario: User selects "Text" for "123" -> should be string "123"
        // Scenario: User selects "Number" for "123" -> should be number 123
        voluntaryFieldsWrapper.innerHTML = `
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="myString">
                <select class="voluntary-type"><option value="Text" selected>Text</option></select>
                <input class="voluntary-value" value="123">
            </div>
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="myNumber">
                <select class="voluntary-type"><option value="Number" selected>Number</option></select>
                <input class="voluntary-value" type="number" value="123">
            </div>
        `;

        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp.myString).toBe("123"); // Should NOT be cast to number
        expect(typeof dpp.myString).toBe('string');
        
        expect(dpp.myNumber).toBe(123);
        expect(typeof dpp.myNumber).toBe('number');
    });

    it('should handle Boolean custom fields', () => {
        voluntaryFieldsWrapper.innerHTML = `
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="myTrue">
                <select class="voluntary-type"><option value="True/False" selected>True/False</option></select>
                <select class="voluntary-value">
                    <option value="true" selected>True</option>
                    <option value="false">False</option>
                </select>
            </div>
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="myFalse">
                <select class="voluntary-type"><option value="True/False" selected>True/False</option></select>
                <select class="voluntary-value">
                    <option value="true">True</option>
                    <option value="false" selected>False</option>
                </select>
            </div>
        `;

        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp.myTrue).toBe(true);
        expect(dpp.myFalse).toBe(false);
    });

    it('should include units for Number custom fields if present', () => {
        // Note: The current generator might not support this structure yet.
        // We expect { value: 10, unit: 'kg' } or similar if we model it as QuantitativeValue,
        // OR just a flat property if the requirement is simple. 
        // Based on 5p design, it renders a unit input. Let's assume we want a QuantitativeValue-like structure 
        // OR just the number if unit is empty. 
        // For this test, let's assume we want to capture the unit if provided.
        // If the generator doesn't support object creation for primitives, this might need adjustment.
        // Let's assume for now the requirement is to output a simple number, ignoring unit, 
        // UNLESS we decide custom numbers with units become objects. 
        // Re-reading 5p: "Numbers with units (QuantitativeValues)..."
        
        voluntaryFieldsWrapper.innerHTML = `
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="weight">
                <select class="voluntary-type"><option value="Number" selected>Number</option></select>
                <input class="voluntary-value" type="number" value="50">
                <input class="voluntary-unit" value="kg">
            </div>
        `;

        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);
        
        // If unit is present, we likely want an object structure, or we need a convention.
        // For now, let's assert it captures the value. 
        // If we want to support units, the generator needs to create { value: 50, unit: 'kg' }.
        // Let's test for that structure.
        expect(dpp.weight).toEqual({ value: 50, unit: 'kg' });
    });

    // =========================================================================
    // 5s-3. Custom Field Group Support
    // =========================================================================

    it('should handle nested Custom Groups', () => {
        voluntaryFieldsWrapper.innerHTML = `
            <div class="voluntary-field-row">
                <input class="voluntary-name" value="myGroup">
                <select class="voluntary-type"><option value="Group" selected>Group</option></select>
                
                <div class="voluntary-group-container">
                    <!-- Nested Child 1 -->
                    <div class="voluntary-field-row">
                        <input class="voluntary-name" value="subField1">
                        <select class="voluntary-type"><option value="Text" selected>Text</option></select>
                        <input class="voluntary-value" value="val1">
                    </div>
                    <!-- Nested Child 2 -->
                    <div class="voluntary-field-row">
                        <input class="voluntary-name" value="subField2">
                        <select class="voluntary-type"><option value="Number" selected>Number</option></select>
                        <input class="voluntary-value" type="number" value="42">
                    </div>
                </div>
            </div>
        `;

        const dpp = generateDpp(['test'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp.myGroup).toEqual({
            subField1: "val1",
            subField2: 42
        });
    });

    // =========================================================================
    // 5s-5. Multiple Sectors
    // =========================================================================

    it('should merge data from multiple sectors and handle overlapping fields', () => {
        // Simulate two sector forms co-existing in the formContainer
        formContainer.innerHTML = `
            <div id="sector-battery">
                <input name="uniqueToBattery" value="BatteryVal">
                <input name="sharedField" value="SharedValue">
            </div>
            <div id="sector-construction">
                <input name="uniqueToConstruction" value="ConstructionVal">
                <!-- 
                   In the UI, these would be synced. 
                   In the generator, we expect it to scrape both. 
                   Since they have the same name, the last one scraped will overwrite the first.
                   This is acceptable behavior for the generator.
                -->
                <input name="sharedField" value="SharedValue">
            </div>
        `;

        const dpp = generateDpp(['battery', 'construction'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp).toEqual(expect.objectContaining({
            uniqueToBattery: "BatteryVal",
            uniqueToConstruction: "ConstructionVal",
            sharedField: "SharedValue"
        }));
    });

    it('should generate an array of contexts when multiple sectors are selected', () => {
        const dpp = generateDpp(['battery', 'construction'], coreFormContainer, formContainer, voluntaryFieldsWrapper);

        expect(dpp['@context']).toEqual([
            'https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld',
            'https://dpp-keystone.org/spec/contexts/v1/dpp-construction.context.jsonld'
        ]);
    });
});
