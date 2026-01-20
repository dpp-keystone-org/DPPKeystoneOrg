# Design Doc 021: Validator HTML Preview & SDK Promotion

## Summary
This design elevates the **HTML Generator** from an internal helper to a public-facing SDK component (`src/util`), distinct from the semantic adapters. It also renames the existing `dpp-adapter` to `dpp-schema-adapter` to clarify its specific role (Schema.org transformation) in anticipation of future adapters (GS1, HTML). Finally, it integrates these tools into the **Validator**, adding "Example Loading" and "HTML Preview" features.

## Goals
1.  **Clarify Architecture:** Rename `dpp-adapter` to `dpp-schema-adapter` to distinguish it from the new HTML renderer.
2.  **Promote HTML Logic:** Extract pure HTML rendering logic to `src/util/js/common/dpp-html-renderer.js`.
3.  **Validator Features:** Add "Example Loader" and "HTML Preview" to the Validator UI.

## Implementation Plan

### Phase 1: Rename & Refactor Existing Adapter
*   **[COMPLETED] Step 1.1: Rename Common Logic**
    *   Rename `src/util/js/common/dpp-logic.js` to `src/util/js/common/dpp-schema-logic.js`.
*   **[COMPLETED] Step 1.2: Rename Client Adapter**
    *   Rename `src/util/js/client/dpp-adapter.js` to `src/util/js/client/dpp-schema-adapter.js`.
    *   Update import inside it to point to `dpp-schema-logic.js`.
*   **[COMPLETED] Step 1.3: Rename Server Adapter**
    *   Rename `src/util/js/server/dpp-adapter.js` to `src/util/js/server/dpp-schema-adapter.js`.
    *   Update import inside it to point to `dpp-schema-logic.js`.
*   **[COMPLETED] Step 1.4: Update Dependents**
    *   Update `src/lib/html-generator.js` (existing) to import from `dpp-schema-adapter.js`.
    *   Update `src/util/js/client/testing/dpp-adapter.test.js` (rename to `dpp-schema-adapter.test.js` and update imports).
    *   Update `testing/unit/dpp-adapter-logging.test.js` (update imports).
    *   Update `designs/006-adapter-showcase.md` and others if strictly necessary (usually we just update code, but checking for hardcoded strings in docs is good).
*   **[COMPLETED] Step 1.5: Verify Rename**
    *   Run `npm test` to ensure no broken imports.

### Phase 2: Extract HTML Renderer SDK
*   **[COMPLETED] Step 2.1: Create Common Renderer**
    *   Create `src/util/js/common/dpp-html-renderer.js`.
    *   Extract pure logic from `src/lib/html-generator.js`:
        *   `detectTableStructure`
        *   `renderValue` (recursive)
        *   Main HTML template assembly.
    *   Function: `export function renderProductPage({ dppData, css, jsonLd, customCssUrl })`.
    *   Ensure it has NO dependencies on `fetch` or `adapter`.
*   **[COMPLETED] Step 2.2: Refactor Site Generator**
    *   Update `src/lib/html-generator.js`.
    *   Import `renderProductPage` from `../util/js/common/dpp-html-renderer.js`.
    *   Retain the orchestration logic:
        *   Fetch CSS.
        *   Call `dpp-schema-adapter` to get JSON-LD.
        *   Call `renderProductPage`.
*   **[COMPLETED] Step 2.3: Verify Refactor**
    *   Run `testing/unit/html-generator.test.js` (might need slight adjustment if internal functions were tested, but integration tests should pass).
    *   Run `testing/integration/playwright/wizard-html-generator.spec.js`.

### Phase 2.5: SDK Directory Cleanup (Architecture Refactor)
*   **[COMPLETED] Step 2.5.1: Create Domains**
    *   Create `src/util/js/common/rendering/`.
    *   Create `src/util/js/common/transformation/`.
*   **[COMPLETED] Step 2.5.2: Relocate Files**
    *   Move `src/util/js/common/dpp-html-renderer.js` to `src/util/js/common/rendering/dpp-html-renderer.js`.
    *   Move `src/util/js/common/dpp-schema-logic.js` to `src/util/js/common/transformation/dpp-schema-logic.js`.
    *   Move `src/util/js/common/profiles/` to `src/util/js/common/transformation/profiles/`.
*   **[COMPLETED] Step 2.5.3: Update Imports**
    *   Update `src/lib/html-generator.js` (rendering import).
    *   Update `src/util/js/client/dpp-schema-adapter.js` (logic import).
    *   Update `src/util/js/server/dpp-schema-adapter.js` (logic import).
    *   Update `src/util/js/common/transformation/dpp-schema-logic.js` (profiles import, if dynamic/relative).
*   **[COMPLETED] Step 2.5.4: Verify Cleanup**
    *   Run `npm test`.

### Phase 3: Validator "Example Loader"
*   **[COMPLETED] Step 3.1: Example Registry**
    *   Create `src/lib/example-registry.js`.
    *   Export map of `{ "Battery": "examples/battery-dpp-v1.json", ... }`.
*   **[COMPLETED] Step 3.2: UI Updates**
    *   Update `src/validator/index.html`: Add `<select>` and `<button>` for examples.
*   **[COMPLETED] Step 3.3: Logic Updates**
    *   Update `src/validator/validator.js`: Import registry, implement fetch & load logic.
*   **[COMPLETED] Step 3.4: Integration Test**
    *   Add a test case to `testing/integration/playwright/validator.spec.js` that clicks "Generate HTML Preview" and verifies a new page/tab is triggered (or at least the function is called).
    *   *Correction:* The test added in Step 3.4 was for Example Loader, not Preview (which is Phase 4). I added the Example Loader test.

### Phase 4: Validator "HTML Preview"
*   **[COMPLETED] Step 4.1: UI Updates**
    *   Update `src/validator/index.html`: Add "Generate HTML Preview" button & CSS URL input.
*   **[COMPLETED] Step 4.2: Logic Updates**
    *   Update `src/validator/validator.js`:
        *   Import `generateHTML` from `../lib/html-generator.js` (The site-specific orchestrator).
        *   Implement button handler to open the Blob URL.
*   **[COMPLETED] Step 4.3: Integration Test**
    *   Update `testing/integration/playwright/validator.spec.js` to test the new flow.

### Phase 5: Documentation & Polish
*   **[COMPLETED] Step 5.1: Index Generation**
    *   Update `scripts/update-index-html.mjs` to include the new `src/util/js/common/dpp-html-renderer.js` in the public listing.
*   **[COMPLETED] Step 5.2: Manual Review**
    *   Visually check the Validator in a browser to ensure the new buttons align well with the existing UI.

## Conclusion
The Validator now includes a robust HTML Preview feature and an Example Loader. The HTML generation logic has been successfully extracted to `src/util/js/common/rendering/dpp-html-renderer.js`, making it available as a public SDK component. The adapter architecture has been cleaned up, distinguishing between semantic transformation (`dpp-schema-adapter`) and visual rendering (`dpp-html-renderer`).