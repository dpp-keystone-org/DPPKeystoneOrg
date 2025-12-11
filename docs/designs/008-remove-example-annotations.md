# Design Doc 008: Remove JSON-LD Annotations from Examples

This document outlines the sub-roadmap for a task to simplify DPP examples by removing all inline JSON-LD annotations (e.g., `@type`), with the sole exception of the `@context` property. The goal is to make the examples look like "plain" JSON, with all semantic meaning being derived from the context file. This may require enhancing the context files themselves.

---

- **[PENDING] Task: Remove JSON-LD Annotations from Examples:** Audit and refactor all DPP examples to remove inline JSON-LD keywords, ensuring semantic meaning is preserved via the context. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 1. Analysis Phase:**
    - **[PENDING] 1a. Audit Examples:** Systematically review all files in `src/examples/` to identify and list every occurrence of a JSON-LD keyword other than `@context`. This primarily includes `@type`. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 1b. Analyze Contexts:** For each annotation found, determine if its removal will cause a loss of semantic meaning. For `@type` annotations, this will likely be the case. The solution is to update the corresponding context file to associate that property with a type using `@type: "@id"`. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 2. Implementation Phase:**
    - **[PENDING] 2a. Update Contexts:** Apply the necessary changes to the context files in `src/contexts/v1/` to embed the type information that was previously in the examples. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 2b. Refactor Examples:** Remove the now-redundant annotations from all example files in `src/examples/`. Pause and allow the user to test and discuss next steps.
  - **[PENDING] 3. Verification Phase:**
    - **[PENDING] 3a. Test JSON-LD Expansion:** For each modified example, use a JSON-LD expansion tool (like the one in `testing/debug-expansion.mjs`) to confirm that the expanded output is identical before and after the change. This proves no semantic meaning was lost. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 3b. Run Full Test Suite:** Execute `npm test` to ensure that all validation and transformation tests still pass with the simplified examples. Fix any regressions. Pause and allow the user to test and discuss next steps.
