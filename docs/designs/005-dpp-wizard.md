# Design Doc 005: DPP Wizard MVP

This document outlines the sub-roadmap for Task #5, the development of a client-side web-based wizard to generate a valid DPP JSON file.

---

- **[IN PROGRESS] 5. DPP Wizard MVP:** Develop a client-side web-based wizard to generate a valid DPP JSON file, serving as a proof-of-concept for stakeholders.
  - **[COMPLETED] 5a. Architecture & Setup:** Create `src/wizard/` containing `index.html`, `wizard.css`, and `wizard.js`. Configure `index.html` to link to the shared branding CSS at `../../branding/css/keystone-style.css`. Ensure the build process deploys this directory to `dist/spec/wizard/`.
  - **[COMPLETED] 5b. Sector Selection:** Implement UI in `index.html` and logic in `wizard.js` to handle sector selection.
  - **[COMPLETED] 5c. Dynamic Form Generation:** Create `src/wizard/schema-loader.js` to fetch JSON schemas from the relative path `../validation/v1/json-schema/`. Create `src/wizard/form-builder.js` to dynamically generate HTML form inputs based on the loaded schema definitions.
  - **[COMPLETED] 5d. Voluntary Information:** Implement logic in `wizard.js` to add dynamic name-value pair fields to the UI.
  - **[COMPLETED] 5e. JSON Generation:** Create `src/wizard/dpp-generator.js` to scrape the generated form data from the DOM and construct the final DPP JSON object.
  - **[COMPLETED] 5f. Unit Testing:** Create `testing/unit/wizard.test.js` using Jest and JSDOM. Test `form-builder.js` by passing mock schemas and asserting HTML output. Test `dpp-generator.js` by populating a virtual DOM and asserting the resulting JSON.
  - **[COMPLETED] 5g. Integration Testing:** Create `testing/integration/wizard-flow.test.js` to simulate a full user session. Mock the schema `fetch` calls, programmatically fill the virtual form, trigger generation, and validate the output JSON against the official `dpp.schema.json` using Ajv.
  - **[COMPLETED] 5h. Initial Core DPP Form:** On load, display a form for core DPP fields based on `dpp.schema.json`.
    - **[COMPLETED] 5h-1. Update HTML:** In `src/wizard/index.html`, add a new `div` with `id="core-form-container"` to hold the initial form.
    - **[COMPLETED] 5h-2. Update Wizard Script:** In `src/wizard/wizard.js`, modify the script to load `dpp.schema.json` on page load.
    - **[COMPLETED] 5h-3. Generate and Inject Form:** In `src/wizard/wizard.js`, use the `buildForm()` function to generate the core form and inject it into the `core-form-container`.
    - **[COMPLETED] 5h-4. Update DPP Generator:** In `src/wizard/dpp-generator.js`, update the `generateDpp` function to scrape inputs from the new `core-form-container`.
    - **[COMPLETED] 5h-5. Update Integration Test:** In `testing/integration/wizard-flow.test.js`, add an assertion to verify that the core form is present on initial page load.
    - **[COMPLETED] 5h-6. Update Integration Test:** In `testing/integration/wizard-flow.test.js`, update the DPP generation part of the test to confirm data from the core form is included in the final output.
    **[COMPLETED] 5h-7. Implement Enum Handling in Form Builder:** Modify the form builder to render a `<select>` dropdown for any schema property containing an `enum`.
        - **[COMPLETED] 5h-7-i. Modify `form-builder.js`:** Update the `buildForm` function to detect properties with an `enum` and generate a corresponding `<select>` element populated with `<option>`s from the enum list.
        - **[COMPLETED] 5h-7-ii. Update Unit Test:** In `testing/unit/wizard.test.js`, add a new test to verify that a schema property with an `enum` correctly generates a populated `<select>` element.
        - **[COMPLETED] 5h-7-iii. Update Integration Test:** In `testing/integration/wizard-flow.test.js`, adjust the test to correctly select a value from the new `granularity` dropdown and assert its inclusion in the final generated object.
    - **[COMPLETED] 5h-8. Implement Automatic `contentSpecificationIds` Handling:** Remove the `contentSpecificationIds` field from the UI and instead populate it automatically in the DPP generator based on the selected sector.
        - **[COMPLETED] 5h-8-i. Modify `form-builder.js`:** Update the `buildForm` function to explicitly skip rendering the `contentSpecificationIds` field.
        - **[COMPLETED] 5h-8-ii. Modify `dpp-generator.js`:** Update the `generateDpp` function to accept the selected sector, and automatically derive and add the `contentSpecificationId` and `contentSpecificationIds` properties to the final DPP object.
        - **[COMPLETED] 5h-8-iii. Modify `wizard.js`:** Update the `generate-dpp-btn` event listener to pass the selected sector to the `generateDpp` function.
        - **[COMPLETED] 5h-8-iv. Update Integration Test:** In `testing/integration/wizard-flow.test.js`, remove the manual addition of `contentSpecificationIds` and assert that the property is now added automatically by the generator.
  - **[COMPLETED] 5i. Sector-Specific Form UI:** On sector selection, display a 3-column form: (Field Path, Value Input, Ontology Metadata).
    - **[COMPLETED] 5i-1. Create `ontology-loader.js`:** Create the new module to fetch and parse ontology files into a simple metadata map.
        - **[COMPLETED] 5i-1-i. Create file `src/wizard/ontology-loader.js` with initial implementation.**
        - **[COMPLETED] 5i-1-ii. Create unit test file `testing/unit/ontology-loader.test.js` with a failing test.**
        - **[COMPLETED] 5i-1-iii. Fix the `loadOntology` function to correctly parse JSON-LD multilingual strings (`@value`).**
        - **[COMPLETED] 5i-1-iv. Run the unit test to confirm the fix.**
    - **[IN PROGRESS] 5i-2. Initial `form-builder.js` Refactor:** Modify `form-builder.js` to generate a `<table>` structure instead of `<div>`s.
    - **[PENDING] 5i-3. Recursive Schema Traversal:** Enhance `form-builder.js` to recursively process nested objects in the JSON schema and display the full JSON path in the first column of the table.
    - **[PENDING] 5i-4. Integrate Ontology Metadata:** Update `wizard.js` to call the new `ontology-loader.js` and have `form-builder.js` display the metadata in the third column.
    - **[PENDING] 5i-5. Update Tests:** Update unit and integration tests to assert that the new 3-column table is generated correctly.
  - **[PENDING] 5j. Custom Field Implementation:** Implement the 'Add Custom Field' button to add a row for Name, Value, and Units.
  - **[PENDING] 5k. Custom Field Validation:** Add validation to ensure the 'Name' in custom fields is in camelCase format.
  - **[PENDING] 5l. Form Validation & Button State:** Disable the 'Generate DPP' button until all required fields (from core and sector schemas) are filled.
  - **[PENDING] 5m. Robust JSON Generation:** Ensure the 'Generate DPP' button correctly populates the output area with the full, valid JSON.
  - **[COMPLETED] 5n. Fix Wizard CSS Path:** Correct the relative path to `keystone-style.css` in the wizard's `index.html`.
