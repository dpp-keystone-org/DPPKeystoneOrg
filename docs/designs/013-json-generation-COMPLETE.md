# Design Doc 013: Robust JSON Generation

This document outlines the roadmap for Task #5s, finalizing the JSON generation logic for the DPP Wizard. This task consolidates deferred items from Task 5p (Custom Fields) and addresses the need for a comprehensive test suite to ensure the generated JSON is valid, complete, and correctly typed.

---

- **[COMPLETD] 5s. Robust JSON Generation:**
  - **[COMPLETED] 5s-1. Test Infrastructure & Baseline:**
    - **[COMPLETED] 5s-1a. [Test] Baseline Regression:** Create a new test file `testing/unit/dpp-generator.test.js`. Extract the existing generator tests from `testing/unit/wizard.test.js` into this file. Add a baseline test case that populates a standard sector form (e.g., Battery) with known values and asserts the generated JSON matches exactly.
    - **[COMPLETED] 5s-1b. [Test] Empty & Null Handling:** Add a test case to verify that empty strings and null values are omitted from the JSON, but `0` (number) and `false` (boolean) are preserved.
  - **[COMPLETED] 5s-2. Custom Field Type Support (Primitives):**
    - **[COMPLETED] 5s-2a. [Test] Typed Custom Fields:** Add a test case that adds three custom fields: one Text ("123"), one Number ("123"), and one Boolean ("True"). Assert that the JSON contains `"123"` (string), `123` (number), and `true` (boolean).
    - **[COMPLETED] 5s-2b. [Implementation] Remove Heuristics:** Update `src/wizard/dpp-generator.js` to stop using `isNaN` heuristics. Instead, read the selected "Type" from the DOM (e.g., from the `<select>` or a data attribute on the row) and cast the value explicitly.
  - **[COMPLETED] 5s-3. Custom Field Group Support (Nested Objects):**
    - **[COMPLETED] 5s-3a. [Test] Nested Custom Groups:** Add a test case that creates a Custom Field of type "Group" (e.g., "myGroup") and adds a child field (Text "subVal") inside it. Assert the JSON structure is `{ "myGroup": { "subVal": "val" } }`.
    - **[COMPLETED] 5s-3b. [Implementation] Recursive Scraping:** Refactor `dpp-generator.js` to handle the recursive structure of custom groups (likely iterating over `.voluntary-group-container` and its children).
  - **[COMPLETED] 5s-4. Complex Standard Fields (Arrays & Objects):**
    - **[COMPLETED] 5s-4a. [Test] Array of Objects:** Add a test case for a standard schema field that is an array of objects (e.g., `documents` in Battery). Populate two items and assert the JSON array is correct.
    - **[COMPLETED] 5s-4b. [Test] Deeply Nested Objects:** Add a test case for deep nesting (e.g., `manufacturer.address.street`).
  - **[COMPLETED] 5s-5. Multiple Sectors:**
    - **[COMPLETED] 5s-5a. [Test] Multi-Sector Generation:** Add a test case that simulates adding two sectors (e.g., Battery and Construction). Populate unique fields in both, and a shared field in both. Assert the generated JSON contains the union of datasets and the shared field value is consistent (last write wins).
    - **[COMPLETED] 5s-5b. [Implementation] Multi-Form Scraping:** Verified that `dpp-generator.js` iterates over the provided container's children. As long as sector forms are children of the `formContainer`, no changes are needed.
  - **[COMPLETED] 5s-6. Voluntary Complex Types (e.g., Organization):**
    - **[COMPLETED] 5s-6a. [Test] Complex Voluntary Type:** Add a test case using the "Organization" complex custom type. Populate its fields. Assert the JSON structure matches the Organization schema.
  - **[COMPLETED] 5s-6. Voluntary Complex Types (e.g., Organization):**
    - **[COMPLETED] 5s-6a. [Test] Complex Voluntary Type:** Add a test case using the "Organization" complex custom type. Populate its fields. Assert the JSON structure matches the Organization schema.