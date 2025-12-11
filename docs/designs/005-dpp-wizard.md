# Design Doc 005: DPP Wizard MVP

This document outlines the sub-roadmap for Task #5, the development of a client-side web-based wizard to generate a valid DPP JSON file.

---

- **[IN PROGRESS] 5. DPP Wizard MVP:** Develop a client-side web-based wizard to generate a valid DPP JSON file, serving as a proof-of-concept for stakeholders. Pause and allow the user to test and discuss next steps.
  - **[COMPLETED] 5a. Architecture & Setup:** Create `src/wizard/` containing `index.html`, `wizard.css`, and `wizard.js`. Configure `index.html` to link to the shared branding CSS at `../../branding/css/keystone-style.css`. Ensure the build process deploys this directory to `dist/spec/wizard/`.
  - **[COMPLETED] 5b. Sector Selection:** Implement UI in `index.html` and logic in `wizard.js` to handle sector selection.
  - **[COMPLETED] 5c. Dynamic Form Generation:** Create `src/wizard/schema-loader.js` to fetch JSON schemas from the relative path `../validation/v1/json-schema/`. Create `src/wizard/form-builder.js` to dynamically generate HTML form inputs based on the loaded schema definitions.
  - **[COMPLETED] 5d. Voluntary Information:** Implement logic in `wizard.js` to add dynamic name-value pair fields to the UI.
  - **[COMPLETED] 5e. JSON Generation:** Create `src/wizard/dpp-generator.js` to scrape the generated form data from the DOM and construct the final DPP JSON object.
  - **[COMPLETED] 5f. Unit Testing:** Create `testing/unit/wizard.test.js` using Jest and JSDOM. Test `form-builder.js` by passing mock schemas and asserting HTML output. Test `dpp-generator.js` by populating a virtual DOM and asserting the resulting JSON.
  - **[COMPLETED] 5g. Integration Testing:** Create `testing/integration/wizard-flow.test.js` to simulate a full user session. Mock the schema `fetch` calls, programmatically fill the virtual form, trigger generation, and validate the output JSON against the official `dpp.schema.json` using Ajv.
  - **[COMPLETED] 5h. Initial Core DPP Form:** On load, display a form for core DPP fields based on `dpp.schema.json`.
  - **[COMPLETED] 5i. Stabilize UI Test Runner:** Set up and stabilized the Playwright UI integration test runner, which was essential for debugging the form generation logic. This involved fixing timeouts and incorrect selectors in the spec files (`testing/integration/playwright/`) and ensuring the test commands in `testing/package.json` ran correctly.
  - **[IN PROGRESS] 5j. Fully Support Nested Object Display:** Debug the client-side `form-builder.js` to ensure that fully resolved nested objects (like EPD) are correctly rendered as dot-separated input fields in the browser, fixing the '[object]' UI bug.
  - **[PENDING] 5k. Fix empty ontology column:** Investigate and fix the empty ontology column for sector-specific schemas, ensuring that descriptions are correctly mapped and displayed. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 5l. Improve Array UX:** Revisit and improve the user experience for array input fields based on user feedback. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 5m. Custom Field Implementation:** Implement the 'Add Custom Field' button to add a row for Name, Value, and Units. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 5n. Custom Field Validation:** Add validation to ensure the 'Name' in custom fields is in camelCase format. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 5o. Form Validation & Button State:** Disable the 'Generate DPP' button until all required fields (from core and sector schemas) are filled. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 5p. Robust JSON Generation:** Ensure the 'Generate DPP' button correctly populates the output area with the full, valid JSON. Pause and allow the user to test and discuss next steps.
  - **[COMPLETED] 5n. Fix Wizard CSS Path:** Correct the relative path to `keystone-style.css` in the wizard's `index.html`.
