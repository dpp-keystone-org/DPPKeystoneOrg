# AI Development Roadmap

This document outlines the development tasks, priorities, and progress for AI-assisted software engineering on the DPP Keystone project. It serves as a shared context between sessions to ensure continuity and alignment.

For a history of completed tasks, please see the [CHANGELOG.md](./CHANGELOG.md).

---

## Tier 2: High-Impact Features & Maintenance (Medium Priority)

- **[PENDING] 4. Implement Full Data Transformation to Target Schemas.** Pause and allow the user to test and discuss next steps.
  - **See Design Doc:** [docs/designs/004-data-transformation.md](./docs/designs/004-data-transformation.md)

- **[IN PROGRESS] 5. DPP Wizard MVP.** Pause and allow the user to test and discuss next steps.
  - **See Design Doc:** [docs/designs/005-dpp-wizard.md](./docs/designs/005-dpp-wizard.md)

- **[PENDING] 6. Remove JSON-LD Annotations from Examples.** Pause and allow the user to test and discuss next steps.
  - **See Design Doc:** [docs/designs/008-remove-example-annotations.md](./docs/designs/008-remove-example-annotations.md)

- **[PENDING] 7. Interactive Adapter Showcase & Documentation.** Pause and allow the user to test and discuss next steps.
  - **See Design Doc:** [docs/designs/006-adapter-showcase.md](./docs/designs/006-adapter-showcase.md)

- **[PENDING] 8. Assign Explicit IRIs to all Ontology Terms:** Audit all ontology files in `src/ontology/` and ensure every defined Class and Property has an explicit `@id` to guarantee a stable, unique identifier. Pause and allow the user to test and discuss next steps.

- **[PENDING] 9. Ontology and Example Refinement:** Establish a recurring task to audit and refactor existing ontologies, contexts, and examples. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 9a. Identify Redundancy:** Periodically review all ontologies and contexts to identify superseded terms or files. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 9b. Update Examples:** Refactor older examples to use the most current and streamlined ontologies. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 9c. Remove Dead Code:** Deprecate and remove unused context and ontology files after ensuring no examples rely on them. Pause and allow the user to test and discuss next steps.

---

## Tier 3: Long-Term Growth (Lower Priority / Ongoing)

- **[PENDING] 10. Refactor SHACL Tests for Ontological Mapping Validation.** Pause and allow the user to test and discuss next steps.
  - **Note:** This addresses the tech debt where SHACL tests are not properly validating semantic mappings.
  - **See Design Doc:** [docs/designs/009-fix-shacl-tests.md](./docs/designs/009-fix-shacl-tests.md)

- **[PENDING] 11. New Sector Model Development:** Research and create new ontologies, contexts, schemas, and examples for new sectors (e.g., Construction DoPC) following the established project patterns. Pause and allow the user to test and discuss next steps.

- **[PENDING] 12. Multi-language Support:** After the generic adapter is complete (Task 2), port it to other key languages, starting with Python. Pause and allow the user to test and discuss next steps.

- **[PENDING] 13. Advanced Voluntary Attributes:** Expand the DPP Wizard's voluntary information capability (Task 5d) to support complex, nested objects and arrays, beyond simple name-value pairs. Pause and allow the user to test and discuss next steps.

- **[PENDING] 14. Complete Ontology Comments and Labels.** Pause and allow the user to test and discuss next steps.
  - **Note:** This addresses the tech debt where ontology definitions are missing `rdfs:comment` or `rdfs:label`.
  - **See Design Doc:** [docs/designs/010-ontology-comments-and-labels.md](./docs/designs/010-ontology-comments-and-labels.md)

---
## Proposed High-Impact Features

### [ PENDING ] Feature: Interactive DPP Validator (Linter)
- **Goal:** Create a web-based tool for users to paste their DPP JSON and receive instant validation feedback.
- **Why:** This is the natural counterpart to the DPP Wizard. It provides a utility for auditing and debugging existing DPPs, not just creating new ones, and serves as a live demonstration of our validation rules.
- **Sub-Tasks:**
  - [ PENDING ] **Design:** Plan the UI/UX for the validator tool (input pane, results pane, error highlighting). Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Scaffold:** Create the basic HTML, CSS, and JS files for the validator page. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Validation Logic (Client-Side):**
    - [ PENDING ] Integrate a JavaScript-based JSON Schema validator library (e.g., Ajv). Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Integrate a JavaScript-based SHACL validator library (e.g., shacl-engine). Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Load our core and sector-specific schemas/shapes into the tool. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **UI Implementation:**
    - [ PENDING ] Build the editor interface for pasting JSON (e.g., using CodeMirror or Monaco Editor). Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Implement logic to trigger validation on user input. Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Develop a user-friendly display for validation errors, linking them to specific lines in the JSON. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Integration:** Add a link to the new validator tool from the main project website/index. Pause and allow the user to test and discuss next steps.

### [ PENDING ] Feature: Enhanced Adapter Showcase with Rendered Preview
- **Goal:** Add a "Rendered Preview" tab to the adapter showcase to visualize how transformed data might appear in a consumer application (e.g., a search engine rich snippet).
- **Why:** This makes the abstract benefit of schema.org transformation tangible and visually compelling, showing why interoperability matters to business stakeholders.
- **Sub-Tasks:**
  - [ PENDING ] **Design:** Mock up the visual representation of a "rich snippet" for a product, using data from `schema.org/Certification` objects. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Component:** Create a new UI component that takes the transformed `schema.org` data as input. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Rendering Logic:** Implement the component to render the data into the designed "rich snippet" format. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Integration:** Add a new tab to the existing showcase UI and integrate the new rendering component, passing it the output from the EPD adapter. Pause and allow the user to test and discuss next steps.

### [ PENDING ] Feature: Adoption Accelerators (Starter Kits)
- **Goal:** Create a collection of simple, boilerplate projects to help developers integrate DPP Keystone artifacts quickly.
- **Why:** Lowers the barrier to adoption by giving developers a running start, which is a huge driver of community uptake.
- **Sub-Tasks:**
  - [ PENDING ] **Strategy:** Decide on the location for the starter kits (e.g., new repo `dpp-keystone-starters`, or a `/starters` directory in this repo). Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Starter Kit 1: Node.js/Express Server:** Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Create a minimal Express.js application to serve a static example DPP JSON file with the correct headers. Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Add a README explaining how to run the server and its purpose. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Starter Kit 2: React Frontend Component:** Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Create a basic React application (e.g., with Vite) that fetches a DPP. Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Use the `dpp-adapter.js` utility to process the fetched DPP and display the results. Pause and allow the user to test and discuss next steps.
    - [ PENDING ] Add a README with setup and usage instructions. Pause and allow the user to test and discuss next steps.
  - [ PENDING ] **Documentation:** Add a section to the main project documentation linking to the starter kits. Pause and allow the user to test and discuss next steps.
