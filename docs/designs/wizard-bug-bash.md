# Design Doc: DPP Wizard Bug Bash

This document is referenced by Task #5o in the main [DPP Wizard MVP Design Doc](./005-dpp-wizard.md). It outlines a series of identified bugs and design gaps in the wizard's implementation. The goal of this "bug bash" is to address these issues in a structured, test-driven manner to improve the wizard's stability and correctness.

---

## Detailed Bug Descriptions

### 1. Critical Bug: Incorrect JSON Structure Generation
This is the most severe issue. The `dpp-generator.js` script creates a **flat** JSON object from the form data, not the required nested structure.

- **Symptom:** A form field for a nested property, like `batteryCarbonFootprint.bcfTotal`.
- **Buggy Behavior:** Instead of generating a nested object like `{ "batteryCarbonFootprint": { "bcfTotal": 120.5 } }`, the generator currently creates a flat property: `{ "batteryCarbonFootprint.bcfTotal": 120.5 }`.
- **Impact:** The generated JSON is fundamentally invalid for any schema containing nested objects.

### 2. Internationalization (i18n) Bug: Missing Translated Labels
The wizard does not correctly display labels that are provided as language-tagged strings in the ontology.

- **Symptom:** The "Ontology" column in the wizard is empty for all EPD (Environmental Product Declaration) properties.
- **Buggy Behavior:** The `ontology-loader.js` does not correctly parse `rdfs:label` properties that are structured as an array of language-tagged objects (e.g., `[{ "@language": "en", "@value": "Label" }, ...]`). It only handles simple strings, causing it to return an empty label for these terms.
- **Impact:** Important human-readable information is missing from the UI, degrading the user experience.

### 3. Gaps in JSON Schema Support
The wizard's ability to interpret schemas is limited, which will cause it to render incomplete forms for more complex but valid schemas.

- **Composition Keywords (`allOf`, `anyOf`, `oneOf`):** The `schema-loader.js` and `form-builder.js` only process properties from the top-level `properties` keyword. They do not understand how to merge properties from an `allOf` array or how to present choices for `anyOf`/`oneOf`.
- **The `default` Keyword:** The form builder does not recognize the `default` keyword. Form fields are always rendered empty, even if a default value is specified.
- **The `format` Keyword:** The form builder does not use `format` to create specialized inputs (e.g., for `uri`, `email`, `date-time`), resulting in generic text boxes.

### 4. Inconsistent Data Modeling & Unhandled Patterns
There are still unaddressed properties in the ontology that will cause the `[object]` UI bug if they are ever added to a schema.

- **Example: `expectedLifetime`:** In `Battery.jsonld`, this property is still an `owl:ObjectProperty` with a range of `dppk:QuantitativeValue`. If this were added to the battery schema, it would render as `[object]` because the data model has not been corrected like we did for `nominalVoltage`.

### 5. Minor UI and Data-Entry Issues
- **No Client-Side Validation:** The UI does not prevent invalid data entry (e.g., text in a number field) or enforce schema rules like `pattern` or `minLength`.
- **Voluntary Fields are Always Strings:** The "Add Custom Field" feature only allows string values, with no way to specify a number or boolean.

---

## Bug Bash Task List

### Task 1: Fix Critical JSON Generation Bug
- **Status:** `[COMPLETED]`
- **Sub-tasks:**
  - **1a. Add Failing Unit Test:** `[COMPLETED]` In `testing/unit/wizard.test.js`, add a test for `dpp-generator.js` that provides a form with nested field names (e.g., `a.b`) and asserts that the generated JSON has the correct nested structure (`{ "a": { "b": "value" } }`). This test will fail. Pause and allow the user to test and discuss next steps.
  - **1b. Implement Nested Object Reconstruction:** `[COMPLETED]` In `dpp-generator.js`, replace the flat property assignment logic with a function that correctly reconstructs a nested object from dot-notation paths. This should make the unit test pass. Pause and allow the user to test and discuss next steps.

### Task 2: Fix Missing Ontology Labels
- **Status:** `[COMPLETED]`
- **Initial Diagnosis:** The "Ontology" column was empty for many fields. The initial hypothesis was that the `ontology-loader.js` could not parse language-tagged `rdfs:label` arrays.
- **Sub-tasks:**
  - **2a. [Investigation]** Verified that a unit test for language-tagged arrays already existed and was passing, disproving the initial hypothesis.
  - **2b. [Investigation]** Added a new unit test for simple string `rdfs:label` values, which also passed. This proved the label-parsing logic in `ontology-loader.js` was correct.
  - **2c. [Hypothesis]** The new hypothesis was a data loading failure. The Playwright integration test was failing with an empty label, suggesting the ontology files were not being loaded at all in the test environment.
  - **2d. [Investigation]** Confirmed via Playwright console logs that the browser was receiving 404 errors when trying to fetch imported ontologies (e.g., `.../core/Product.jsonld`).
  - **2e. [Fix]** Implemented a recursive `owl:imports` processing feature in `ontology-loader.js` so it would fetch the full dependency tree.
  - **2f. [Investigation]** After the previous fix, tests still failed. A URL mismatch was discovered: source files used import URLs *without* a `/spec/` path segment, while the test URL map expected URLs *with* `/spec/`.
  - **2g. [Hypothesis]** The final hypothesis was that the `owl:imports` URLs in the source data were incorrect and should match the final public URL structure, which includes `/spec/`.
  - **2h. [Fix]** Corrected the `owl:imports` URLs in all source ontology files in `src/ontology/` to include the required `/spec/` path segment.
  - **2i. [Verified]** Confirmed that with the correct source data and test environment, all tests pass and labels for all fields now render correctly in the live UI.

### Task 3: Implement Hierarchical Labels for Nested Objects
- **Description:** The current UI flattens nested objects (like EPD), causing a loss of context as labels on parent objects are not displayed. This task will refactor the UI to render nested objects with visual hierarchy, using non-editable "header rows" for parent objects and indented rows for their children.
- **Status:** `[PENDING]`
- **Sub-tasks:**
    - **3a. [Data] Enhance EPD Ontology:** Add the necessary labels to the `EPD.jsonld` ontology to support the new UI.
        - **3a-1. Add Lifecycle Stage Labels:** For each lifecycle stage (`a1`, `a2`, etc.), add a language-tagged `rdfs:label` in both English and German (e.g., "Upstream A1" / "Upstream A1").
        - **3a-2. Add Top-Level EPD Label:** For the main `epd` property itself, add a language-tagged `rdfs:label` (e.g., "Environmental Product Declaration" / "Umweltproduktdeklaration").
    - **3b. [Test] Add Failing UI Test:** In `testing/integration/playwright/wizard.spec.js`, modify the `construction` sector test. After selecting the sector, assert that a non-editable "header row" for `epd.gwp` exists and contains the text "Global Warming Potential". This test will fail because the header row logic does not exist yet. Pause and allow the user to test and discuss next steps.
    - **3c. [Code] Implement Hierarchical Rendering:** In `src/wizard/form-builder.js`, refactor the `generateRows` function.
        - When processing a nested object, it should first create and append a styled, non-editable "header" row that displays the object's path and its looked-up label.
        - It should then recursively call itself for the object's children, passing down an increased indentation level.
        - Child rows should have their `grid-cell`s indented based on this level to create a visual hierarchy.
        - This should make the failing Playwright test from step 3b pass. Pause and allow the user to test and discuss next steps.
    - **3d. [Data] Add Remaining Translations:** As a follow-up, populate the remaining translations for the new lifecycle stage labels in `EPD.jsonld`.

### Task 4: Add Support for Schema Composition (`allOf`)
- **Status:** `[PENDING]`
- **Sub-tasks:**
  - **4a. Add Failing Unit Test:** In `testing/unit/schema-loader.test.js`, add a test that loads a mock schema containing an `allOf` keyword and asserts that the properties from all parts of the `allOf` array are present in the resolved schema's `properties` object. This test will fail. Pause and allow the user to test and discuss next steps.
  - **4b. Implement `allOf` Logic:** In `schema-loader.js`, update the schema resolution logic to correctly merge properties from schemas inside an `allOf` array. This should make the unit test pass. Pause and allow the user to test and discuss next steps.

### Task 5: Add Support for the `default` Keyword
- **Status:** `[PENDING]`
- **Sub-tasks:**
  - **5a. Add Failing Unit Test:** In `testing/unit/wizard.test.js`, add a test for `form-builder.js` that uses a schema with a `default` value for a property and asserts that the generated input field has that value. This test will fail. Pause and allow the user to test and discuss next steps.
  - **5b. Implement `default` Keyword Handling:** In `form-builder.js`, update the input creation logic to check for `prop.default` and set the input's `value` accordingly. This should make the unit test pass. Pause and allow the user to test and discuss next steps.

### Task 6: Find All Leaf Nodes Missing Labels
- **Status:** `[PENDING]`
- **Description:** Now that the data loading infrastructure is fixed and robust, perform a comprehensive audit of all sectors to identify any leaf-node properties that still do not have an `rdfs:label` in their respective ontology files. This involves cross-referencing the generated forms for each sector against the source ontology files.

