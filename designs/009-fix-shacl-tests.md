# Design Doc 009: Refactor SHACL Tests for Ontological Mapping Validation

This document outlines the sub-roadmap for a tech-debt task to fix and enhance our SHACL validation suite. Currently, the tests primarily validate basic data constraints rather than the more complex ontological mappings (e.g., `owl:equivalentProperty`). This is partly due to minor invalidities in the mappings themselves. The goal is to make our SHACL tests a true check of semantic interoperability.

---

- **[PENDING] Task: Refactor SHACL Validation Suite:** Fix underlying ontology mappings and update SHACL shapes and tests to properly validate semantic equivalencies. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 1. Analysis & Ontology Correction Phase:**
    - **[PENDING] 1a. Audit Ontological Mappings:** Systematically review all `owl:equivalentProperty` and `owl:equivalentClass` declarations in `src/ontology/v1/` to identify and correct any invalid or inconsistent statements. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 1b. Audit SHACL Shapes:** Review the existing shapes in `src/validation/v1/shacl/` to identify why they are not effectively testing the mappings. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 2. SHACL Shape Refactoring:**
    - **[PENDING] 2a. Design Advanced Shapes:** Design new or refactor existing SHACL shapes that specifically target the ontological mappings. For example, a shape could check that if a DPP uses `dpp:productName`, its value also validates against the constraints for `schema:name` due to an `owl:equivalentProperty` axiom. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 2b. Implement Advanced Shapes:** Implement the newly designed shapes using appropriate SHACL features (e.g., `sh:property`, `sh:path`, SPARQL-based constraints). Pause and allow the user to test and discuss next steps.
  - **[PENDING] 3. Test Integration & Verification:**
    - **[PENDING] 3a. Update Validation Test Runner:** Modify the test runner script (`testing/integration/run-shacl-validation.mjs`) and the corresponding Jest test (`dpp-examples.validation.test.js`) to use the new, more advanced shapes. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 3b. Verify Test Failures and Successes:** Run the tests. Expect them to fail initially on examples that do not conform to the cross-ontology constraints. Fix the example data or the shapes until all tests pass as expected. This confirms the validation is working correctly. Pause and allow the user to test and discuss next steps.
