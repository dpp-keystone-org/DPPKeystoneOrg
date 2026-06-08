# Design Doc: 2026-06-08 Internationalization

## Summary
Implements core internationalization (i18n) features across the DPP Keystone platform, including cookie-free sticky language selection, language-specific labels in generated HTML DPPs, and validation checks for missing languages.

## Implementation Plan

### [PENDING] Feature 1: Make language selection on dpp-keystone.org "sticky" without using cookies
*   Plan: Implement persistent language preference selection on the live site using `localStorage` or another cookie-free mechanism suitable for EU privacy standards.

### [PENDING] Feature 2: Generated HTML DPPs should use the language-specific labels for the DPP fields
*   Plan: Ensure that when HTML DPPs are generated, field labels correctly resolve and render localized strings based on the selected language.

### [PENDING] Feature 3: Add a check to the presubmit validator that checks for missing languages
*   Plan: Update the validation suite to enforce presence of required language translations across schemas/contexts.
