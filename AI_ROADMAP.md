# AI Development Roadmap

This document outlines the development tasks, priorities, and progress for AI-assisted software engineering on the DPP Keystone project. It serves as a shared context between sessions to ensure continuity and alignment.

---

## Tier 1: Foundational Cleanup & Core Tooling (Highest Priority)

- **[COMPLETED] 1. JSON Schema Overhaul:** Clear critical tech debt related to data validation.
- **[COMPLETED] 1a. Document Strategy:** Create a `README.md` in `src/validation/` explaining the role of JSON Schema in the project, its connection to EU regulations, and the validation methodology. Update the main `README.md` to reference this new document.
- **[COMPLETED] 1a-2. Refine Schema Strategy Documentation:** Add detail to the validation README to clarify that schemas are scoped to sectors/domains, not individual examples.
  - **[COMPLETED] 1b. Audit and Update:** Perform a comprehensive audit of all examples in `src/examples/`. Identify all examples that lack corresponding JSON schema validation or are using outdated schemas.
  - **[COMPLETED] 1c. Implement Schemas:** Create or update the necessary JSON schemas to ensure all existing examples pass strict validation. Update the `testing/integration/dpp-examples.schema.test.js` suite to use these new, more specific schemas.
    - **[COMPLETED] 1c-1. Create Construction Schema:** Create and integrate a new conditional schema for the construction sector.
    - **[COMPLETED] 1c-2. Create Detailed EPD Schema:** Create a detailed, reusable schema for the EPD data block and reference it from other schemas.
    - **[COMPLETED] 1c-3. Add Negative Schema Validation Tests:** Implement a test case to ensure validation fails correctly for an invalid payload.
    - **[COMPLETED] 1c-4. Create Battery Schema:** Create and integrate a new conditional schema for the battery sector.
    - **[COMPLETED] 1c-5. Create Electronics Schema:** Create and integrate a new conditional schema for the electronics sector.
    - **[COMPLETED] 1c-6. Create Textile Schema:** Create and integrate a new conditional schema for the textile sector.

- **[COMPLETED] 2. Generalize the DPP Adapter:** Re-architect the `dpp-adapter` to be a generic, robust transformation engine.
  - **[COMPLETED] 2a. Restructure Files:** Create a `profiles` directory and a `schema.org.js` file inside `src/util/js/common/`.
  - **[COMPLETED] 2b. Isolate EPD Logic:** Move the current EPD transformation logic into the new `schema.org.js` profile, exporting it as a mapping configuration.
  - **[COMPLETED] 2c. Build Generic Engine:** Create a new generic `transform` function in `dpp-logic.js` that can load and run profiles.
  - **[COMPLETED] 2d. Update Entry Points:** Refactor the client and server adapter files to use the new generic engine.
  - **[COMPLETED] 2e. Ensure No Regressions:** Update the Jest tests to call the new engine and confirm the output for the EPD transformation is unchanged.

- **[COMPLETED] 3. Establish Contribution and Code Review Policy:** Formalize the contribution workflow to support future collaborators.
  - **[COMPLETED] 3a. Create CODEOWNERS file:** Create a `.github/CODEOWNERS` file to automatically assign pull request reviews to the project owner.
  - **[COMPLETED] 3b. Update CONTRIBUTING.md:** Update the contributing guide to explain the new policy: non-admin contributors must submit pull requests, which require review and approval. Clearly document the process for a smooth contributor experience.

---

## Tier 2: High-Impact Features & Maintenance (Medium Priority)

- **[PENDING] 4. Implement Full Data Transformation to Target Schemas:** Expand the adapter to transform every example DPP into `schema.org`, `gs1`, and `un-cefact` formats. This is a large-scale effort to demonstrate broad interoperability.
  - **4a. Schema.org Transformation:**
    - **[COMPLETED] 4a-1. Design & Analysis:** Analyze DPP examples, `schema.org` vocabulary, and internal ontologies to create a comprehensive mapping strategy.
    - **[PENDING] 4a-2. Implementation:** Enhance the `schema.org.js` profile to perform a full transformation for every example DPP, following the approved design.
      - [COMPLETED] 4a-2-i. Map Core Product Fields: Implement the transformation for the top-level `schema:Product` object, mapping core header fields (`productName`, `model`, `manufacturer` as a nested `Organization`, etc.) based on ontology equivalencies.
      - [COMPLETED] 4a-2-ii. Map Declared Performances: Implement the logic to transform the `dopcDeclarations` object into a list of `schema:PropertyValue` objects, attached via `schema:additionalProperty`.
      - [COMPLETED] 4a-2-iii. Refactor EPD Transformation: Refactor the existing EPD logic. The new implementation should create a single `schema:Certification` object for the entire EPD, with all individual indicators attached as a list of `schema:PropertyValue` objects under the `hasMeasurement` property.
      - [COMPLETED] 4a-2-iv. Implement DPP Type Inference from contentSpecificationId: Refactor the core logic to dynamically infer the DPP's semantic type (e.g., ConstructionProduct) based on `contentSpecificationId`, removing the need for an explicit `@type` array in the source documents.
      - [COMPLETED] 4a-2-v. Map Document Links: Implement the transformation for document links (`instructionsForUse`, `safetyDataSheet`) into `schema:DigitalDocument` objects linked from the main product.
      - [COMPLETED] 4a-2-vi. Add Schema.org Equivalencies to EPD Ontology: Enhance the `src/ontology/v1/core/EPD.jsonld` file with `owl:equivalentClass` and other mappings to `schema.org` to provide stronger semantic hints for generic JSON-LD parsers.
    - **[COMPLETED] 4a-3. Testing:** Create a comprehensive server-side test (`dpp-adapter-product.test.js`) to validate the full `schema.org` product transformation, ensuring parity with the client-side test suite.
  - **4b. GS1 Transformation:**
    - **[PENDING] 4b-1. Design & Analysis:** Research the GS1 Web vocabulary. For each DPP example, analyze the vocabulary to find the most appropriate mappings, leveraging the ontology. Document gaps.
    - **[PENDING] 4b-2. Implementation:** Create a new `gs1.js` profile and implement the transformation logic.
    - **[PENDING] 4b-3. Testing:** Create comprehensive tests to validate the output for each example.
  - **4c. UN/CEFACT Transformation:**
    - **[PENDING] 4c-1. Design & Analysis:** Research the UN/CEFACT vocabulary. For each DPP example, analyze the vocabulary to find appropriate mappings, leveraging the ontology. Document gaps.
    - **[PENDING] 4c-2. Implementation:** Create a new `un-cefact.js` profile and implement the transformation logic.
    - **[PENDING] 4c-3. Testing:** Create comprehensive tests to validate the output for each example.

- **[PENDING] 5. DPP Wizard MVP:** Develop a client-side web-based wizard to generate a valid DPP JSON file, serving as a proof-of-concept for stakeholders.
  - **[PENDING] 5a. Architecture & Setup:** Create `src/wizard/` containing `index.html`, `wizard.css`, and `wizard.js`. Configure `index.html` to link to the shared branding CSS at `../../branding/css/keystone-style.css`. Ensure the build process deploys this directory to `dist/spec/wizard/`.
  - **[PENDING] 5b. Sector Selection:** Implement UI in `index.html` and logic in `wizard.js` to handle sector selection.
  - **[PENDING] 5c. Dynamic Form Generation:** Create `src/wizard/schema-loader.js` to fetch JSON schemas from the relative path `../validation/v1/json-schema/`. Create `src/wizard/form-builder.js` to dynamically generate HTML form inputs based on the loaded schema definitions.
  - **[PENDING] 5d. Voluntary Information:** Implement logic in `wizard.js` to add dynamic name-value pair fields to the UI.
  - **[PENDING] 5e. JSON Generation:** Create `src/wizard/dpp-generator.js` to scrape the generated form data from the DOM and construct the final DPP JSON object.
  - **[PENDING] 5f. Unit Testing:** Create `testing/unit/wizard.test.js` using Jest and JSDOM. Test `form-builder.js` by passing mock schemas and asserting HTML output. Test `dpp-generator.js` by populating a virtual DOM and asserting the resulting JSON.
  - **[PENDING] 5g. Integration Testing:** Create `testing/integration/wizard-flow.test.js` to simulate a full user session. Mock the schema `fetch` calls, programmatically fill the virtual form, trigger generation, and validate the output JSON against the official `dpp.schema.json` using Ajv.
  - **[PENDING] 5h. Create HTML Generation Library:** Develop and test a library function that takes a DPP JSON object and returns a rendered HTML string representation, including the embedded `schema.org` JSON-LD transformation.
  - **[PENDING] 5i. Integrate HTML Preview:** Use the new HTML generation library to offer users of the wizard a way to preview or download their created DPP as a standalone HTML file.

- **[PENDING] 6. Interactive Adapter Showcase & Documentation:** Create a rich, interactive documentation page (`utils/index.html`) that not only explains the adapter but also serves as a live demonstration and a development tool.
  - **[PENDING] 6a. Build Interactive Showcase UI:** Develop a user interface with the following components:
    - An example selector: A dropdown menu to load any of our standard DPP examples (e.g., battery, textile, rail).
    - A profile selector: A dropdown to select the target transformation profile (`schema.org`, `gs1`, etc., as they are completed).
    - A "Transform" button to trigger the process.
  - **[PENDING] 6b. Implement Live Transformation:** Hook the UI to the actual client-side `dpp-adapter.js` script. On "Transform", the script should execute the transformation live in the browser.
  - **[PENDING] 6c. Create Code Display Panes:** Add a pane to display the raw source DPP JSON of the selected example, and a second pane to display the resulting transformed JSON-LD output, both with syntax highlighting, so developers can directly compare input and output.
  - **[PENDING] 6d. Provide "How-To" Guides and Snippets:** Below the interactive tool, write clear, developer-focused documentation explaining the adapter's API (`transform` function, parameters, profiles). Provide copy-paste-ready code snippets for common use cases, such as how to include the script and how to embed the final JSON-LD output within a `<script type="application/ld+json">` tag.

- **[PENDING] 7. Assign Explicit IRIs to all Ontology Terms:** Audit all ontology files in `src/ontology/` and ensure every defined Class and Property has an explicit `@id` to guarantee a stable, unique identifier.

- **[PENDING] 8. Ontology and Example Refinement:** Establish a recurring task to audit and refactor existing ontologies, contexts, and examples.
  - **[COMPLETED] 8a. Refine context hierarchy for Construction:** Ensure the construction context properly imports EPD, DoPC, and Core contexts, and simplify the corresponding example file.
  - **[PENDING] 8b. Identify Redundancy:** Periodically review all ontologies and contexts to identify superseded terms or files.
  - **[PENDING] 8c. Update Examples:** Refactor older examples to use the most current and streamlined ontologies.
  - **[PENDING] 8d. Remove Dead Code:** Deprecate and remove unused context and ontology files after ensuring no examples rely on them.
  - **[COMPLETED] 8e. Refine Rail Example:** Update the `rail-dpp-v1.json` example to be fully compliant with the `construction.schema.json`.

---

## Tier 3: Long-Term Growth (Lower Priority / Ongoing)

- **[PENDING] 9. Incremental SHACL Enhancement:** Continuously improve SHACL shapes to validate semantic mappings as they are developed or refined.

- **[PENDING] 10. New Sector Model Development:** Research and create new ontologies, contexts, schemas, and examples for new sectors (e.g., Construction DoPC) following the established project patterns.

- **[PENDING] 11. Multi-language Support:** After the generic adapter is complete (Task 2), port it to other key languages, starting with Python.

- **[PENDING] 12. Advanced Voluntary Attributes:** Expand the DPP Wizard's voluntary information capability (Task 5d) to support complex, nested objects and arrays, beyond simple name-value pairs.

---

## Completed

- **[COMPLETED]** Implement a client-side JavaScript utility (`dpp-adapter.js`) to transform EPD data into `schema.org/Certification` objects, complete with unit tests.
- **[COMPLETED]** Create and document the `AI_ROADMAP.md` file.
- **[COMPLETED]** Setup project and initial AI context.