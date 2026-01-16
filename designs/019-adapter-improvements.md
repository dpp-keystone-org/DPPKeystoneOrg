# Design Doc 019: DPP Adapter Improvements & Ontology Alignment

## Goal
Overhaul the `dpp-adapter` and its underlying logic (`dpp-logic.js`) to robustly handle all data structures defined in the DPP Keystone schemas, ensuring correct transformation to `schema.org` (JSON-LD) without data loss or fragmentation.

## Current State & Issues
*   **Missing Data (Images):** The adapter currently fails to transform the `image` field when it is structured as an array of `RelatedResource` objects (the current schema standard), resulting in an empty or missing JSON-LD output.
*   **Disparate Objects:** In some cases (e.g., sparse data), the adapter generates multiple disconnected JSON objects instead of a single cohesive `Product` graph.
*   **Incomplete Schema Coverage:** The current implementation does not appear to cover all fields from all sector-specific schemas (Battery, Electronics, Textile, Construction), leading to silent data drops during transformation.
*   **Silent Failures:** When transformation fails for a specific field or structure, the adapter often fails silently or returns an empty result instead of a partial success or meaningful error.

## Strategy: Test-Driven Hardening
This refactoring must be strictly Test-Driven (TDD) due to the complexity and number of edge cases.

### Key Requirements
1.  **Comprehensive Test Suite:**
    *   Create a matrix of test cases covering every field in every schema.
    *   Test edge cases: partial data, empty arrays, null values, complex nested objects.
    *   Test specifically for the `image` array (RelatedResource -> schema.org/ImageObject or URL).
    *   Test for "Graph Integrity" (ensuring output is a single connected graph where expected).

2.  **Logic Improvements:**
    *   Update `dpp-logic.js` to handle flexible inputs (e.g., mapping an array of objects to a property that `schema.org` might expect as a URL, or correctly typing it).
    *   Ensure all `dppk:` terms defined in our contexts have correct mappings or equivalent properties in the target profile (`schema.org`).

3.  **Observability:**
    *   Enhance logging (as started in `html-generator` debugging) to provide granular tracing of the transformation process.

## Next Steps
*   [ ] Session to flesh out detailed test cases and requirements.
*   [ ] Implementation of a comprehensive test harness for the adapter.
*   [ ] Iterative "Red-Green-Refactor" execution.
