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

### [COMPLETED] Feature 2: Generated HTML DPPs should use the language-specific labels for the DPP fields
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

### [COMPLETED] Feature 3: Translate all remaining ontological items
*   **Plan:** Add translated labels and comments to all ontology files (`dist/spec/ontology/...`) that currently only have English strings, using subagents to farm out the work to prevent hallucination.

### [COMPLETED] Feature 4: Add a check to the presubmit validator that checks for missing languages
*   **Plan:** 
    1. Add a new audit function inside `validate-ontology-integrity.mjs` called `auditTranslations(reporter)`.
    2. It will loop through every term in our `ontologyGraph` that defines an `rdfs:label` or `rdfs:comment`.
    3. It will strictly verify that the label/comment is an array of language-tagged strings (e.g. `[ { "@language": "en", "@value": "Color" }, { "@language": "de", "@value": "Farbe" } ]`).
    4. If a term is missing a translation for a required language, it will log a `WARN` or `FAIL` violation.
    *   **[COMPLETED] Step 4.1: Implement validation logic and test coverage**
        *   **[COMPLETED] Task 4.1.1:** Add core translation validation logic to `src/util/js/common/validation/ontology-validator.js` and tests to `ontology-validator.test.js`.
        *   **[COMPLETED] Task 4.1.2:** Integrate the check into `scripts/validate-ontology-integrity.mjs` as `auditTranslations`.

### [COMPLETED] Feature 5: Internationalize the dpp-keystone pages themselves
*   Plan: Enable full multi-language support and localized UI text across the main site index (`index.html`) and generated technical documentation pages.
    *   **[COMPLETED] Step 5.1: Embed LanguageManager across all core tool pages**
        *   **[COMPLETED] Task 5.1.1:** Add the universal language selection widget to main `index.html`, Ontology Explorer (`src/explorer/index.html`), and CSV Adapter (`src/csv-dpp-adapter/index.html`) for domain-wide preference persistence.
    *   **[COMPLETED] Step 5.2: Localize the Schema, Context and Ontology generated pages**
### [IN PROGRESS] Feature 6: Internationalize Static HTML Pages
*   **Plan:** Extract the English strings from all static HTML pages into dedicated JSON resource files (using our standard `rdfs:label` JSON-LD array format), translate them into all 24 EU languages, and wire up `LanguageManager` to dynamically swap the text on the client-side.
    *   **[COMPLETED] Step 6.0: Pre-work Baseline Tests**
        *   Create integration tests that snapshot/compare the currently generated `dist/` HTML pages (e.g., `index.html`, `explorer/index.html`, `csv-dpp-adapter/index.html`, `validator/index.html`, `wizard/index.html`). This ensures our refactor doesn't inadvertently break the DOM structure or baseline English text.
    *   **[COMPLETED] Step 6.1: Factor out JSON resource files & Refactor LanguageManager**
        *   Move the inline `<script>` parsing logic from `generate-spec-docs.mjs` directly into `LanguageManager.js` as a unified `localizeDOM()` function.
        *   Create `*.i18n.json` files for each static HTML page, initially populated with just English.
        *   Tag the relevant HTML elements in `src/` with a special attribute (e.g., `data-i18n-key`) and add logic to `LanguageManager` to fetch the JSON and inject the English text.
    *   **[COMPLETED] Step 6.2: Ensure Baseline Passes**
        *   Verify that the `dist/` HTML output perfectly passes the integration tests established in Step 6.0, proving our `data-i18n-key` additions didn't disrupt the page.
    *   **[COMPLETED] Step 6.3: Translate JSON files**
        *   Translate all English strings in the `*.i18n.json` files into the other 23 official EU languages.
    *   **[COMPLETED] Step 6.4: Implement Build-Time English Injection**
        *   Update build scripts to automatically read the `.i18n.json` files and inject the default English text into the `dist/` HTML files. This allows us to strip hardcoded text from the `src/` HTML files for cleaner code, while preserving immediate, No-JS/SEO-friendly English rendering in production.
        *   **[COMPLETED] Task 6.4.1:** Update `scripts/build-and-clean.mjs` to intercept `.html` files in subdirectories during `processDirectory`, load their adjacent `.i18n.json` file, and inject the `en` string into `[data-i18n-key]` elements using `cheerio`.
        *   **[COMPLETED] Task 6.4.2:** Update `scripts/update-index-html.mjs` to perform the same `cheerio` injection for the root `index.html` using `index.i18n.json`.
        *   **[COMPLETED] Task 6.4.3:** Strip the raw inner text out of all `[data-i18n-key]` elements in the `src/` HTML files to establish the JSON files as the single source of truth.
    *   **[COMPLETED] Step 6.5: Add Playwright Tests**
        *   Add separate Playwright tests that load the static pages, switch the language widget, and assert that the text dynamically updates to the new language (similar to what we did for the spec docs).
        *   **[COMPLETED] Task 6.5.1:** Write a test that checks all HTML files for at least one language change (e.g., German) and checks at least one HTML file for all 24 languages.
        *   **[COMPLETED] Task 6.5.2:** Write a test that verifies that *every single string* in the translation resource for an HTML page is successfully rendered on the page in a target language (to prevent missing strings).
    *   **[PENDING] Step 6.6: Cleanup**
        *   Delete the baseline HTML snapshot integration tests from Step 6.0, as they have fulfilled their purpose of ensuring a safe refactor.

### [IN PROGRESS] Feature 7: Bug-Bash & Quality Assurance
*   **Plan:** Iteratively log, analyze, and fix visual or functional bugs uncovered during manual site navigation and integration testing of the new i18n features.
    *   **[PENDING] Issue 7.1 (Spec Docs):** Fix generated ontology sector summary pages (e.g., `spec/ontology/v2/sectors/Textile/index.html`).
        *   **[PENDING] Task 7.1.1 (Ontology Root Metadata Localization):** The main module descriptions are missing translations or improperly rendered.
            *   **[COMPLETED] Sub-Task 7.1.1.1 (Convention):** Establish a consistent standard across all `.jsonld` files for `dcterms:title` and `dcterms:description` (they must be arrays of `{@language, @value}` objects across all 24 EU languages).
            *   **[COMPLETED] Sub-Task 7.1.1.2 (Validation):** Update the `scripts/validate-ontology-integrity.mjs` script to enforce this standard for ontology roots, just like it already does for `rdfs:label` and `rdfs:comment` on classes/properties.
            *   **[IN PROGRESS] Sub-Task 7.1.1.3 (Translation):** Deploy subagents to backfill missing translations for `dcterms:title` and `dcterms:description` across all ontology files.
            *   **[PENDING] Sub-Task 7.1.1.4 (Data Binding):** Update `generate-spec-docs.mjs` to properly route the `dcterms:description` array through `renderI18nSpan()`.
        *   **[PENDING] Task 7.1.2 (Dictionary Expansion):** Add static UI header strings ("classes-and-concepts", "properties-header", "property-column", "description-column") to the root `index.i18n.json` with all 24 translations.
        *   **[PENDING] Task 7.1.3 (Template Update):** Update `generate-spec-docs.mjs` to wrap the UI headers in `<span data-i18n-key="...">` and update the `LanguageManager.init()` call to point to the root `index.i18n.json` resource path.
    *   **[PENDING] Issue 7.2 (Explorer):** Fix Ontology Explorer (`explorer/index.html`).
        *   The ontology cards display raw English text instead of using translated strings.
    *   **[PENDING] Issue 7.3 (Wizard):** Clean up the Wizard app (`wizard/index.html`).
        *   The main Keystone page header is missing the unified language switcher.
        *   The duplicate language switcher inside the "DPP Wizard" section is redundant and needs to be removed.
        *   Inconsistent naming: called "DPP Assistent" on the main index page, but "DPP Wizard" on its own page.
    *   **[PENDING] Issue 7.4 (Validator):** Clean up the Validator app (`validator/index.html`).
        *   Does not use the standard unified DPP Keystone page header.
        *   Missing the global language switcher at the top, but still has the redundant subpage switcher.
        *   Redundantly titled "DPP-Validator" and "JSON DPP-Validator".
    *   **[PENDING] Issue 7.5 (SDKs):** Modernize the Developer SDKs page (e.g. `src/sdks/index.html`).
        *   Does not use the standard DPP Keystone page header or footer.
        *   Missing the global language selector.
        *   The page title is not translated.
        *   The JSON file links lack standard styling (they don't show up in blue).
