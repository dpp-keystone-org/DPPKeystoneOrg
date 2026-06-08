# Design Doc: 2026-06-08 Internationalization

## Summary
Implements core internationalization (i18n) features across the DPP Keystone platform, including cookie-free sticky language selection, reusable UI language widgets, language-specific labels in generated HTML DPPs, presubmit validation for missing languages, and full site localization.

## Implementation Plan

### [PENDING] Feature 1: Make language selection on dpp-keystone.org "sticky" without using cookies
*   Plan: Implement persistent language preference selection on the live site using `localStorage` (`dpp_keystone_preferred_language`).
    *   **[COMPLETED] Step 1.1: Implement the language preference cache**
        *   **[COMPLETED] Task 1.1.1:** Create `LanguageManager` class under `src/lib/language-manager.js` to handle persistent cookie-free language caching and validation.
        *   **[PENDING] Task 1.1.2:** Add integration test coverage in `testing/integration/wizard-flow.test.js`.
    *   **[COMPLETED] Step 1.2: Introduce a reusable language selection widget**
        *   **[COMPLETED] Task 1.2.1:** Expand `LanguageManager` with 24 official EU languages and `renderSelectorWidget` method for instant cross-page widget reuse.

### [PENDING] Feature 2: Generated HTML DPPs should use the language-specific labels for the DPP fields
*   Plan: Ensure that when HTML DPPs are generated, field labels correctly resolve and render localized strings based on the selected language.

### [PENDING] Feature 3: Add a check to the presubmit validator that checks for missing languages
*   Plan: Update the validation suite to enforce presence of required language translations across schemas/contexts.

### [PENDING] Feature 4: Internationalize the dpp-keystone pages themselves
*   Plan: Enable full multi-language support and localized UI text across the main site index (`index.html`) and generated technical documentation pages.
