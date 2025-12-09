# AI Development Roadmap

This document outlines the development tasks, priorities, and progress for AI-assisted software engineering on the DPP Keystone project. It serves as a shared context between sessions to ensure continuity and alignment.

---

## Tier 1: Foundational Cleanup & Core Tooling (Highest Priority)

- **[PENDING] 1. JSON Schema Overhaul:** Clear critical tech debt related to data validation.
- **[COMPLETED] 1a. Document Strategy:** Create a `README.md` in `src/validation/` explaining the role of JSON Schema in the project, its connection to EU regulations, and the validation methodology. Update the main `README.md` to reference this new document.
  - **1b. Audit and Update:** Perform a comprehensive audit of all examples in `src/examples/`. Identify all examples that lack corresponding JSON schema validation or are using outdated schemas.
  - **1c. Implement Schemas:** Create or update the necessary JSON schemas to ensure all existing examples pass strict validation. Update the `testing/integration/dpp-examples.schema.test.js` suite to use these new, more specific schemas.

- **[PENDING] 2. Generic Adapter Refactoring:** Re-architect the `dpp-adapter` to be a generic, robust transformation engine.
  - **2a. Design Generic Engine:** Design a new adapter that accepts a DPP JSON-LD object and a "target profile" (e.g., 'schema.org') as input.
  - **2b. Implement Transformation Logic:** The engine should traverse the DPP data graph and use the semantic mappings in the `@context` to systematically convert DPP entities into the target vocabulary.
  - **2c. Create Validation Tests:** Implement unit tests that use the adapter to transform data and validate the output, confirming that it can serve as a primary tool for testing semantic mappings.

---

## Tier 2: High-Impact Features & Maintenance (Medium Priority)

- **[PENDING] 3. DPP Wizard MVP:** Develop a simple web-based wizard to generate a valid DPP JSON file for the stable header fields, serving as a proof-of-concept for stakeholders.
  - **3a. Setup Application:** Create a new directory and build process for a lightweight, single-page application (e.g., using vanilla JS or Preact).
  - **3b. Build UI:** Develop a user interface that presents form fields based on the stable `dpp.schema.json` (the DPP "header").
  - **3c. Implement Logic:** Add logic to take the user's input and generate a valid JSON object that can be copied or downloaded.

- **[PENDING] 4. Ontology and Example Refinement:** Establish a recurring task to audit and refactor existing ontologies, contexts, and examples.
  - **4a. Identify Redundancy:** Periodically review all ontologies and contexts to identify superseded terms or files.
  - **4b. Update Examples:** Refactor older examples to use the most current and streamlined ontologies.
  - **4c. Remove Dead Code:** Deprecate and remove unused context and ontology files after ensuring no examples rely on them.

---

## Tier 3: Long-Term Growth (Lower Priority / Ongoing)

- **[PENDING] 5. Incremental SHACL Enhancement:** Continuously improve SHACL shapes to validate semantic mappings as they are developed or refined.

- **[PENDING] 6. New Sector Model Development:** Research and create new ontologies, contexts, schemas, and examples for new sectors (e.g., Construction DoPC) following the established project patterns.

- **[PENDING] 7. Multi-language Support:** After the generic adapter is complete (Task 2), port it to other key languages, starting with Python.

---

## Completed

- **[COMPLETED]** Implement a client-side JavaScript utility (`dpp-adapter.js`) to transform EPD data into `schema.org/Certification` objects, complete with unit tests.
- **[COMPLETED]** Create and document the `AI_ROADMAP.md` file.
- **[COMPLETED]** Setup project and initial AI context.