# Design Doc 006: Adapter Showcase & Validator Integration

## Goal
Demonstrate the DPP-to-Schema.org adapter functionality by integrating it directly into the DPP Validator tool. This allows users to validate their DPP JSON and immediately see how it transforms into structured data for search engines.

## Steps

*   **[COMPLETED] Step 1: Validator UI Updates**
    *   Add a "Generate Schema.org" button to `src/validator/index.html` alongside the existing "Generate HTML Preview" button.
    *   Ensure the button is disabled initially and enabled when schemas/logic are ready.
*   **[COMPLETED] Step 2: Implement Transformation Logic**
    *   Update `src/validator/validator.js` to import the client-side adapter (`src/util/js/client/dpp-schema-adapter.js`).
    *   Implement the click handler for the new button.
    *   The handler should:
        *   Parse the JSON from the textarea.
        *   Call `transformDpp` with the `schema.org` profile.
        *   Pass the correct ontology paths (handling `src` vs `dist` structure if possible, or defaulting to the build structure: `../spec/ontology/v1/...`).
        *   Open the resulting JSON-LD in a new browser tab (pretty-printed).
*   **[COMPLETED] Step 3: Documentation**
    *   Add a section to the Validator page explaining what "Schema.org Generation" does (converts DPP to structured data for SEO).
    *   Add clarification text stating that the **HTML Preview** uses code freely available in the "Developer SDKs" section, intended as inspiration for rendering legally compliant JSON DPPs.
*   **[COMPLETED] Step 4: UI Refinements & "No-Schema" Support**
    *   **UI Updates:**
        *   Rename "Generate HTML Preview" -> "Preview HTML With Schema.org".
        *   Rename "Generate Schema.org" -> "Preview Schema.org".
        *   Add a new button: "Preview HTML Without Schema".
    *   **Library Updates:**
        *   Update `src/lib/html-generator.js` `generateHTML` function to accept an `options` object (replacing or augmenting `customCssUrl`) with a flag `includeSchema` (default `true`).
    *   **Logic Updates:**
        *   Update `src/validator/validator.js` to call `generateHTML` with the correct flag based on which button was clicked.
*   **[COMPLETED] Step 5: Integration Test**
    *   Create or update a Playwright test (e.g., `testing/integration/validator-adapter.test.js`) to:
        *   Load the validator page.
        *   Input valid DPP JSON.
        *   Click the "Preview Schema.org" button.
        *   Verify that a new page/tab opens containing the JSON-LD content (or intercept the new window event to verify payload).