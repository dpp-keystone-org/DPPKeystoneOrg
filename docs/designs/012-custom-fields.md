# Design Doc 012: Custom Field Implementation

This document outlines the sub-roadmap for Task #5p, implementing the "Add Custom Field" functionality in the DPP Wizard. This feature upgrades the existing simple key-value pair UI (Task 5d) to support typed data, validation, and complex structures.

---

- **[PENDING] 5p. Custom Field Implementation:**
  - **[PENDING] 5p-1. UI Upgrade & Type Selector:** Update the existing custom field row to include a "Type" dropdown. Supported types: `Text` (String), `Number`, `True/False` (Boolean), and `Group` (Object).
    - **[COMPLETED] 5p-1a. [Test] Add Failing Test for Type Selector:** Create a test in `testing/unit/wizard.test.js` that asserts `createVoluntaryFieldRow` returns a row with a `<select>` containing the required type options. Pause and allow the user to test.
    - **[COMPLETED] 5p-1b. [Implementation] Implement Type Selector:** In `form-builder.js`, implement `createVoluntaryFieldRow` to generate the row with the type selector. Update `wizard.js` to use this function. Pause and allow the user to test.
    - **[COMPLETED] 5p-1c. [CSS] Fix Custom Field Layout:** Update `wizard.css` to ensure the custom field row elements (Name, Type, Value, Button) are properly sized and aligned, specifically fixing the width of the Name column. Pause and allow the user to test.
  - **[PENDING] 5p-2. Conditional Input Rendering:** Implement logic to render different input fields based on the selected type:
    - **[COMPLETED] 5p-2a. [Test] Add Failing Test for Number Input:** Assert that selecting "Number" renders a numeric input AND an optional "Unit" text input. Pause and allow the user to test.
    - **[COMPLETED] 5p-2b. [Implementation] Implement Number Input Logic:** Add event listener to the type selector to swap the input element and show the unit field. Pause and allow the user to test.
    - **[COMPLETED] 5p-2c. [Test] Add Failing Test for Boolean Input:** Assert that selecting "True/False" changes the input to a dropdown with True/False options. Pause and allow the user to test.
    - **[COMPLETED] 5p-2d. [Implementation] Implement Boolean Input Logic:** Implement the boolean input swap. Pause and allow the user to test.
    - **[COMPLETED] 5p-2e. [Test] Add Failing Test for Group Container:** Assert that selecting "Group" renders a container with an "Add Property" button for nested fields. Pause and allow the user to test.
    - **[COMPLETED] 5p-2f. [Implementation] Implement Recursive Group Logic:** Implement the logic to add nested rows within the group container. Pause and allow the user to test.
  - **[COMPLETED] 5p-3. Universal Input Validation:** Implement robust validation for all text inputs to prevent data corruption, including trimming and control character checks.
    - **[COMPLETED] 5p-3a. [Test] Add Comprehensive Validator Tests:** Create `testing/unit/validator.test.js` to cover edge cases for text and key validation (control chars, trimming, camelCase). Pause and allow the user to test.
    - **[COMPLETED] 5p-3b. [Implementation] Implement Validator Logic:** Update `validator.js` with `validateText` and `validateKey` functions. Pause and allow the user to test.
    - **[COMPLETED] 5p-3c. [Test] Add Failing Playwright Test:** Add validation tests to `testing/integration/playwright/wizard.spec.js` to test input validation (control chars, trimming, camelCase) in a real browser environment. Pause and allow the user to test.
    - **[COMPLETED] 5p-3d. [Implementation] Apply to All Fields:** Update `form-builder.js` to apply `validateText` to all text inputs, `validateKey` to custom field names, and implement auto-trimming on blur. Pause and allow the user to test.
    - **[COMPLETED] 5p-3e. [Test] Verify Error Count Integration:** Add a Playwright test to ensure custom field validation errors update the global error count and are cleared upon row removal.
    - **[COMPLETED] 5p-3f. [Test] Add Failing Test for Required Fields:** Add Playwright test to assert voluntary fields (Key, Value) are required, but Unit is optional.
    - **[COMPLETED] 5p-3g. [Implementation] Implement Required Check:** Update `form-builder.js` to enforce non-empty values for voluntary fields (except units) and fix UI layout for error messages.
  - **[COMPLETED] 5p-4. Key Validation Extension:** Ensure custom field keys adhere to strict `camelCase` and do not collide with reserved words.
    - **[COMPLETED] 5p-4a. [Implementation] Refine Key Validator:** Ensure `validateKey` covers all specific naming requirements (merged into 5p-3b).
  - **[IN PROGRESS] 5p-5. Namespace Collision Avoidance:** Validate that the custom field key does not conflict with existing fields in the loaded schema/ontology.
    - **[COMPLETED] 5p-5a. [Test] Add Failing Playwright Test for Collision:** Create a test that adds a custom field with a name that exists in the Core schema (e.g., `dppStatus`) and asserts an error message "Field conflicts with Core". Also test with a sector field (e.g., `nominalVoltage` for Battery) and assert "Field conflicts with Battery".
    - **[PENDING] 5p-5b. [Implementation] Implement Collision Logic:** Create a helper function `getConflictingSectors(key)` in `wizard.js` that checks `coreSchema` and active sector schemas. Pass this function into `createVoluntaryFieldRow` in `form-builder.js` and update the validation logic to use it.
  - **[PENDING] 5p-6. JSON Generation Integration:** Ensure custom fields are correctly merged into the final generated JSON, respecting their types (e.g., numbers as primitives, `QuantitativeValue` as `{ "value": ..., "unit": ... }`, and nested objects).
    - **[PENDING] 5p-6a. [Test] Add Failing Test for Typed JSON Generation:** Assert that the generated JSON reflects the correct types (Number, Boolean). Pause and allow the user to test.
    - **[PENDING] 5p-6b. [Implementation] Update Generator for Primitives:** Update `dpp-generator.js` to parse values based on the selected type. Pause and allow the user to test.
    - **[PENDING] 5p-6c. [Test] Add Failing Test for Complex JSON Generation:** Assert that Numbers with units (QuantitativeValues) and nested Groups are structured correctly in the JSON. Pause and allow the user to test.
    - **[PENDING] 5p-6d. [Implementation] Update Generator for Complex Types:** Update `dpp-generator.js` to handle composite and nested structures. Pause and allow the user to test.
