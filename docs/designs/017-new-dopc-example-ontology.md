# Design Doc 017: New DoPC Example Ontology

This document outlines the roadmap for refactoring and replacing the legacy "DoPC" (Declaration of Performance and Conformity) context, schema, and ontology with a cleaner, improved version. This is part of an effort to provide better example structures within the project.

---

- **017. Refactor DoPC Artifacts:**
  - **017-1. Inventory & Analysis:**
    - **017-1a. [Analysis] Map Dependencies:** Search the codebase for all case-insensitive occurrences of `dopc`. Identify file paths (schemas, contexts, ontologies) and code references (wizard loaders, examples, test fixtures).
  - **017-2. Deprecation (Rename & Break):**
    - **017-2a. [Refactor] Rename Legacy Files:** Rename the existing DoPC files to indicate their legacy status (e.g., `dopc.schema.json` -> `dopc_legacy.schema.json`).
      - `src/validation/v1/json-schema/dopc.schema.json`
      - `src/ontology/v1/core/DoPC.jsonld`
      - `src/contexts/v1/dpp-dopc.context.jsonld`
    - **017-2b. [Update] Update Internal References (Temporary):** Update references in `package.json` or main entry points if necessary to prevent immediate crash, or prepare to observe test failures.
    - **017-2c. [Verification] Run Tests:** User to run tests to confirm the expected breakage (404s, load errors).
  - **017-3. Injection of New Artifacts:**
    - **017-3a. [Implementation] Create New Files:** Create the new versions of the DoPC files at the original locations.
    - **017-3b. [Implementation] Update Construction Example:** Update the construction product example (and any other relevant examples) to utilize the new DoPC structure.
  - **017-4. Integration & Fixes:**
    - **017-4a. [Fix] Update Schemas & Contexts:** Ensure `dpp.schema.json` and sector schemas refer to the new `dopc` structure correctly.
    - **017-4b. [Fix] Update Wizard:** Verify and fix `ontology-loader.js` or `schema-loader.js` if the internal structure of DoPC has changed significantly (e.g., ID changes, property name changes).
    - **017-4c. [Verification] Run Tests:** User to run tests to ensure the new system passes.
  - **017-5. Cleanup:**
    - **017-5a. [Cleanup] Delete Legacy Files:** Remove the `*_legacy` files once the new system is verified.
