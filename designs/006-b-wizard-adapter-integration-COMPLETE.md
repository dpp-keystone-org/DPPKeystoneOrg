# Design Doc 006-b: Wizard Adapter Integration

## Goal
Integrate the Adapter Showcase features (Schema.org preview and HTML preview options) into the DPP Wizard, mirroring the functionality recently added to the DPP Validator.

## Context
The Validator now has three preview options:
1.  Preview HTML With Schema.org
2.  Preview HTML Without Schema
3.  Preview Schema.org

The Wizard currently only has a generic "Generate Example HTML" button. We will upgrade the Wizard to match the Validator's capabilities, allowing users to preview their created DPPs in these different formats.

## Steps

*   **[COMPLETED] Step 1: UI Updates (`src/wizard/index.html`)**
    *   Replace the single "Generate Example HTML" button with the three-button group found in the Validator.
    *   Add the explanatory text box describing the tools.
*   **[COMPLETED] Step 2: Logic Updates (`src/wizard/wizard.js`)**
    *   Import `transformDpp` from the adapter.
    *   Import `jsonld` (already in importmap, just need to use it for loader).
    *   Remove the old event listener for `preview-html-btn`.
    *   Add event listeners for the three new buttons.
    *   Reuse the existing `generateDpp(...)` result for all previews.
*   **[COMPLETED] Step 3: Integration Tests**
    *   Update `testing/integration/playwright/wizard-html-generator.spec.js` to verify the three new buttons:
        *   `preview-schema-btn` (HTML + Schema)
        *   `preview-no-schema-btn` (HTML only)
        *   `schema-btn` (Schema JSON-LD)
*   **[COMPLETED] Step 4: Fix Existing Tests**
    *   Run `testing/integration/playwright/wizard.spec.js` and other existing tests to ensure no regressions were introduced by the UI changes (e.g., removal of the old button).
