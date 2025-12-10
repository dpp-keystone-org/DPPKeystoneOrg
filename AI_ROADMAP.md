# AI Development Roadmap

This document outlines the development tasks, priorities, and progress for AI-assisted software engineering on the DPP Keystone project. It serves as a shared context between sessions to ensure continuity and alignment.

For a history of completed tasks, please see the [CHANGELOG.md](./CHANGELOG.md).

---

## Tier 2: High-Impact Features & Maintenance (Medium Priority)

- **[PENDING] 4. Implement Full Data Transformation to Target Schemas**
  - **See Design Doc:** [docs/designs/004-data-transformation.md](./docs/designs/004-data-transformation.md)

- **[IN PROGRESS] 5. DPP Wizard MVP**
  - **See Design Doc:** [docs/designs/005-dpp-wizard.md](./docs/designs/005-dpp-wizard.md)

- **[PENDING] 6. Interactive Adapter Showcase & Documentation**
  - **See Design Doc:** [docs/designs/006-adapter-showcase.md](./docs/designs/006-adapter-showcase.md)

- **[PENDING] 7. Assign Explicit IRIs to all Ontology Terms:** Audit all ontology files in `src/ontology/` and ensure every defined Class and Property has an explicit `@id` to guarantee a stable, unique identifier.

- **[PENDING] 8. Ontology and Example Refinement:** Establish a recurring task to audit and refactor existing ontologies, contexts, and examples.
  - **[PENDING] 8b. Identify Redundancy:** Periodically review all ontologies and contexts to identify superseded terms or files.
  - **[PENDING] 8c. Update Examples:** Refactor older examples to use the most current and streamlined ontologies.
  - **[PENDING] 8d. Remove Dead Code:** Deprecate and remove unused context and ontology files after ensuring no examples rely on them.

---

## Tier 3: Long-Term Growth (Lower Priority / Ongoing)

- **[PENDING] 9. Incremental SHACL Enhancement:** Continuously improve SHACL shapes to validate semantic mappings as they are developed or refined.

- **[PENDING] 10. New Sector Model Development:** Research and create new ontologies, contexts, schemas, and examples for new sectors (e.g., Construction DoPC) following the established project patterns.

- **[PENDING] 11. Multi-language Support:** After the generic adapter is complete (Task 2), port it to other key languages, starting with Python.

- **[PENDING] 12. Advanced Voluntary Attributes:** Expand the DPP Wizard's voluntary information capability (Task 5d) to support complex, nested objects and arrays, beyond simple name-value pairs.
