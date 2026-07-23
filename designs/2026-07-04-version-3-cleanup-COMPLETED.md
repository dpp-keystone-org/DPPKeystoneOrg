# Version 3 Cleanup & Stabilization (2026-07-04)

This document tracks the stabilization and cleanup efforts following the transition to the V3 architecture, specifically dealing with the fallout of the `dppk-unit:` enum refactoring, namespace updates, and translation integrity.

## STEP 1: Consolidate Translation Validation Logic [COMPLETED]

Update the ontology validator to treat all missing languages the same. Currently, the validation logic is fragmented and redundant, leading to inconsistent error reporting for missing translations depending on context. The logic needs to be refactored to reuse the same robust validation method everywhere.

Current symptoms of the fragmented validation logic:
- ❌ [FAIL] Ontology root translation issue: 'dcterms:title' is missing 23 required languages (e.g., bg, cs, da...)
  Location: dist/spec/ontology/v3/core/Unit.jsonld
- ❌ [FAIL] Term 'https://dpp-keystone.org/spec/ontology/v3/core/Unit' is missing an English rdfs:label.
  Location: dist/spec/ontology/v3/core/Unit.jsonld
- ⚠️ [WARN] Term 'dppk:additionalCertification' has translation issue: 'rdfs:label' is a plain string, missing language tags. Required: 24 languages.
  Location: dist/spec/ontology/v3/core/Compliance.jsonld
- ⚠️ [WARN] Term 'dppk:Unit' has translation issue: 'rdfs:label' is missing 23 required languages (e.g., bg, cs, da...)
  Location: dist/spec/ontology/v3/core/Unit.jsonld

LLMs need to be taught to loathe redundant code in a project as much as any decent software engineer. We will DRY this up.

## STEP 2: Mass-Translation Swarm Effort [COMPLETED]

Execute a mass-translation effort for the newly refactored terms (e.g., `Unit.jsonld`, newly added properties like `additionalCertification`).

**Swarm Workflow:**
We will use a sub-model swarm for translations with a very detailed system:
1. Dispatch one subagent per file to perform the initial translation.
2. Dispatch subsequent subagents to peer-review and double-check the translations in that file.
3. Require consensus: Iterate until at least **2 subsequent agents agree** that the file has no translation errors and uses domain-appropriate vocabulary in the target languages.

## STEP 3: Update DPP Generation Code [COMPLETED]

Thoroughly test and update the DPP generation code to work with the new Unit instances. The backend utilities need to gracefully extract and format the correct unit symbols and IRI references when creating a valid DPP instance document for export.

**Substeps:**
1. **Schema.org Mapper Fix (`dpp-schema-logic.js`)**: Update the `buildDictionary` function so that when it processes `dppk:unit` IRIs, it cross-references the actual unit definition to extract and use the `dppk:unitSymbol` for the `unitText` output. This will fix the `dpp-schema-logic.test.js` tests.
2. **HTML Generator Fix (`ontology-loader.js`)**: Update the vocabulary building logic to map `dppk:unit` IRIs to their respective `unitSymbol` values, ensuring the HTML templates render correct unit symbols. This will fix the `html-generator.test.js` and `advanced-rendering.test.js` tests.

## STEP 4: Update Wizard UI for Units [COMPLETED]

Thoroughly test and update the Wizard UI to properly show and interact with the new Units. The frontend must reliably parse, display, and submit the structured `dppk-unit:` enum instances rather than the old raw strings.

## STEP 5: Project-Wide Ripple Effect Audit [COMPLETED]

Thoroughly search the entire project for any additional areas where the new units will cause possible issues and then fix them. This includes checking documentation, data mocks, API schemas, validation logic, and frontend components for any lingering string-based unit assumptions.

**Substeps:**
1. **Ontology HTML Documentation Generation Scripts**: Check if the scripts that generate HTML documentation for the ontology have any issues with the new namespaces and unit enums.
