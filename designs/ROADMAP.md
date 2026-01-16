# Development Roadmap

This document outlines the development tasks, priorities, and progress for the DPP Keystone project. It serves as a shared context between sessions to ensure continuity and alignment.

For a history of completed tasks, please see the [CHANGELOG.md](./CHANGELOG.md).

---

## Tier 2: High-Impact Features & Maintenance (Medium Priority)

- **[PENDING] 4. Implement Full Data Transformation to Target Schemas.** Pause and allow the user to test and discuss next steps.
  - **See Design Doc:** [004-data-transformation.md](./004-data-transformation.md)

- **[PENDING] 5. Core Translations (24 EU Languages).**
  - **Goal:** Populate the ontology labels for the Core context (Header, Organization, etc.) for all 24 EU languages so the Wizard language switcher works for initial fields.
  - **Why:** Immediate improvement in professionalism and user trust.

- **[PENDING] 7. Remove JSON-LD Annotations from Examples.** Pause and allow the user to test and discuss next steps.
  - **See Design Doc:** [008-remove-example-annotations.md](./008-remove-example-annotations.md)

- **[PENDING] 8. Interactive Adapter Showcase & Documentation.** (Revised)
  - **Note:** This is now largely superseded by the "Wizard HTML Result Page" (Task 6), which serves as the "ultimate form" of the showcase. We will keep this here as a placeholder for potentially standalone documentation or specific technical demos not covered by the Wizard.
  - **See Design Doc:** [006-adapter-showcase.md](./006-adapter-showcase.md)

- **[PENDING] 9. Assign Explicit IRIs to all Ontology Terms:** Audit all ontology files in `src/ontology/` and ensure every defined Class and Property has an explicit `@id` to guarantee a stable, unique identifier. Pause and allow the user to test and discuss next steps.

- **[PENDING] 10. Ontology and Example Refinement:** Establish a recurring task to audit and refactor existing ontologies, contexts, and examples. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 10a. Identify Redundancy:** Periodically review all ontologies and contexts to identify superseded terms or files. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 10b. Update Examples:** Refactor older examples to use the most current and streamlined ontologies. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 10c. Remove Dead Code:** Deprecate and remove unused context and ontology files after ensuring no examples rely on them. Pause and allow the user to test and discuss next steps.

---

## Tier 3: Long-Term Growth (Lower Priority / Ongoing)

- **[PENDING] 11. Refactor SHACL Tests for Ontological Mapping Validation.** Pause and allow the user to test and discuss next steps.
  - **Note:** This addresses the tech debt where SHACL tests are not properly validating semantic mappings.
  - **See Design Doc:** [009-fix-shacl-tests.md](./009-fix-shacl-tests.md)

- **[PENDING] 13. Multi-language Support:** After the generic adapter is complete (Task 2), port it to other key languages, starting with Python. Pause and allow the user to test and discuss next steps.

- **[PENDING] 14. Advanced Voluntary Attributes:** Expand the DPP Wizard's voluntary information capability to support complex, nested objects and arrays, beyond simple name-value pairs. Pause and allow the user to test and discuss next steps.

- **[PENDING] 15. Complete Ontology Comments and Labels.** Pause and allow the user to test and discuss next steps.
  - **Note:** This addresses the tech debt where ontology definitions are missing `rdfs:comment` or `rdfs:label`.
  - **See Design Doc:** [010-ontology-comments-and-labels.md](./010-ontology-comments-and-labels.md)

- **[PENDING] 17. Ontology Integrity Suite (Meta-Validation).**
  - **Goal:** Create an automated suite to validate the completeness and coherency of the schemas, contexts, and ontologies (e.g., ensuring numeric fields have units, terms are documented).
  - **Why:** Prevents "silent" gaps in the standard and ensures high-quality, self-consistent data definitions.
  - **See Design Doc:** [020-ontology-integrity-suite.md](./020-ontology-integrity-suite.md)

- **[PENDING] 16. DPP Toolkit Page:** Create a centralized dashboard for developer utilities including a Validator and Ontology Explorer.

---
## Proposed High-Impact Features

### [PENDING] Feature: Adoption Accelerators (Starter Kits)
- **Goal:** Create a collection of simple, boilerplate projects to help developers integrate DPP Keystone artifacts quickly.
- **Why:** Lowers the barrier to adoption by giving developers a running start, which is a huge driver of community uptake.
- **Sub-Tasks:**
  - [PENDING] **Strategy:** Decide on the location for the starter kits (e.g., new repo `dpp-keystone-starters`, or a `/starters` directory in this repo). Pause and allow the user to test and discuss next steps.
  - [PENDING] **Starter Kit 1: Node.js/Express Server:** Pause and allow the user to test and discuss next steps.
    - [PENDING] Create a minimal Express.js application to serve a static example DPP JSON file with the correct headers. Pause and allow the user to test and discuss next steps.
    - [PENDING] Add a README explaining how to run the server and its purpose. Pause and allow the user to test and discuss next steps.
  - [PENDING] **Starter Kit 2: React Frontend Component:** Pause and allow the user to test and discuss next steps.
    - [PENDING] Create a basic React application (e.g., with Vite) that fetches a DPP. Pause and allow the user to test and discuss next steps.
    - [PENDING] Use the `dpp-adapter.js` utility to process the fetched DPP and display the results. Pause and allow the user to test and discuss next steps.
    - [PENDING] Add a README with setup and usage instructions. Pause and allow the user to test and discuss next steps.
  - [PENDING] **Documentation:** Add a section to the main project documentation linking to the starter kits. Pause and allow the user to test and discuss next steps.


  - **[PENDING] Stakeholder Enhancements:** Implement educational features to demonstrate the value of Linked Data, including Knowledge Graph links, JSON/JSON-LD toggles, and mocked signatures.
    - **See Design Doc:** 014-stakeholder-enhancements.md
