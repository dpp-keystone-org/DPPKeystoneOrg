# Design Doc: 2026-06-08 Internationalization

## Summary
Implements core internationalization (i18n) features across the DPP Keystone platform, including cookie-free sticky language selection, reusable UI language widgets, language-specific labels in generated HTML DPPs, presubmit validation for missing languages, and full site localization.

## Implementation Plan

### [COMPLETED] Feature 1: Make language selection on dpp-keystone.org "sticky" without using cookies
*   Plan: Implement persistent language preference selection on the live site using `localStorage` (`dpp_keystone_preferred_language`).
    *   **[COMPLETED] Step 1.1: Implement the language preference cache**
        *   **[COMPLETED] Task 1.1.1:** Create `LanguageManager` class under `src/lib/language-manager.js` to handle persistent cookie-free language caching and validation.
        *   **[COMPLETED] Task 1.1.2:** Add integration test coverage in `testing/integration/wizard-flow.test.js`.
    *   **[COMPLETED] Step 1.2: Introduce a reusable language selection widget**
        *   **[COMPLETED] Task 1.2.1:** Expand `LanguageManager` with 24 official EU languages and `renderSelectorWidget` method for instant cross-page widget reuse.
    *   **[COMPLETED] Step 1.3: Introduce LanguageManager in DPP Validator**
        *   **[COMPLETED] Task 1.3.1:** Add `#language-widget-wrapper` to `src/validator/index.html`.
        *   **[COMPLETED] Task 1.3.2:** Update `src/validator/validator.js` to render `LanguageManager.renderSelectorWidget()` and pass the selected language to `generateHTML`.

### [PENDING] Feature 2: Generated HTML DPPs should use the language-specific labels for the DPP fields
*   Plan: Ensure that when HTML DPPs are generated, field labels correctly resolve and render localized strings based on the selected language.
    *   **[COMPLETED] Step 2.1: Update core HTML renderer with multi-language resolution**
        *   **[COMPLETED] Task 2.1.1:** Implement `getDisplayLabel` helper in `src/util/js/common/rendering/dpp-html-renderer.js`.
        *   **[COMPLETED] Task 2.1.2:** Update `renderValue` and `renderProductPage` to render localized labels across metadata and product attributes.
        *   **[COMPLETED] Task 2.1.3:** Update `src/lib/html-generator.js` to pass `language` parameter to the renderer.
        *   **[COMPLETED] Task 2.1.4:** Create standalone SDK test suite `src/util/js/server/testing/dpp-html-renderer.test.js` to verify decoupled, public-facing localization behavior.
    *   **[COMPLETED] Step 2.2: Test and verify localized HTML generation in Validator**
        *   **[COMPLETED] Task 2.2.1:** Add unit/integration test coverage verifying localized HTML DPP previews from validated JSON (`testing/integration/validator-flow.test.js`).
    *   **[COMPLETED] Step 2.3: Test and verify localized HTML generation in Wizard**
        *   **[COMPLETED] Task 2.3.1:** Add integration test coverage verifying localized HTML DPP previews generated directly from Wizard sessions.

### [IN PROGRESS] Feature 3: Add a check to the presubmit validator that checks for missing languages
*   **Plan:** 
    1. Add a new audit function inside `validate-ontology-integrity.mjs` called `auditTranslations(reporter)`.
    2. It will loop through every term in our `ontologyGraph` that defines an `rdfs:label` or `rdfs:comment`.
    3. It will strictly verify that the label/comment is an array of language-tagged strings (e.g. `[ { "@language": "en", "@value": "Color" }, { "@language": "de", "@value": "Farbe" } ]`).
    4. If a term is missing a translation for a required language, it will log a `WARN` or `FAIL` violation.
    *   **[IN PROGRESS] Step 3.1: Implement validation logic and test coverage**
        *   **[PENDING] Task 3.1.1:** Add core translation validation logic to `src/util/js/common/validation/ontology-validator.js` and tests to `ontology-validator.test.js`.
        *   **[PENDING] Task 3.1.2:** Integrate the check into `scripts/validate-ontology-integrity.mjs` as `auditTranslations`.

### [PENDING] Feature 4: Internationalize the dpp-keystone pages themselves
*   Plan: Enable full multi-language support and localized UI text across the main site index (`index.html`) and generated technical documentation pages.
    *   **[PENDING] Step 4.1: Embed LanguageManager across all core tool pages**
        *   **[PENDING] Task 4.1.1:** Add the universal language selection widget to main `index.html`, Ontology Explorer (`src/explorer/index.html`), and CSV Adapter (`src/csv-dpp-adapter/index.html`) for domain-wide preference persistence.
