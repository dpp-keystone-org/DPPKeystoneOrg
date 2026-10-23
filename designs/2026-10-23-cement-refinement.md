# Design Doc: 2026-10-23 Cement Substance Precision Refinement (`rdfs:subPropertyOf` & Scoped Contexts)

## Summary
Refines the Cement ontology, JSON-LD contexts, and JSON schemas to model each line item in the `prEN 197-1:2026` Annex ZA substance tables (`Table ZA.1.1.1` through `Table ZA.1.1.12`) as a distinct, recognizable data point IRI while preserving semantic hierarchy and clean JSON keys.

We separate a data point's **identity**, **meaning**, and **value**:
1. **Shared Meaning (`dppk-cement:<topic>`):** Generic physical/chemical cement properties in `src/ontology/v3/sectors/Cement.jsonld` define shared semantics, 24-language `rdfs:label` / `rdfs:comment` translations, `rdfs:range`, and `dppk:unit`.
2. **Precise Identity (`dppk-cement-<substance>:<topic>`):** Dedicated substance ontology modules under `src/ontology/v3/sectors/cement/` define table-specific properties that specialize their parent topic via `rdfs:subPropertyOf`, attach `rdfs:domain` to the substance class, and record table-specific `dppk:governedBy` clauses/test standards.
3. **Clean JSON Structure (Scoped `@context`):** Substance container properties on `dppk-cement:CementProduct` (e.g., `commonCement`, `portlandCementClinker`) use JSON-LD scoped `@context` blocks in `src/contexts/v3/dpp-cement.context.jsonld` so that identical JSON keys (such as `magnesiumOxideContent` or `tricalciumAluminateContent`) expand to distinct table-specific IRIs.

---

## Implementation Plan

### [COMPLETED] Step 1: Tooling & Validation Support for `rdfs:subPropertyOf` and Multi-Segment Namespaces
*   Plan: Update ontology integrity validation, runtime/build loaders, SHACL fuzzer, and spec doc generation to support `rdfs:subPropertyOf` metadata inheritance and nested `/terms/cement/<substance>#` namespaces.
*   **[COMPLETED] Step 1.1: Update `scripts/validate-ontology-integrity.mjs`**
    *   **[COMPLETED] Task 1.1.1:** Support prefix inheritance across nested/scoped `@context` blocks in `processContextBlock`.
    *   **[COMPLETED] Task 1.1.2:** Update `getCompactIRI` to convert multi-segment `/terms/cement/<substance>#` URIs into `dppk-cement-<substance>:` compact IRIs.
    *   **[COMPLETED] Task 1.1.3:** Implement `resolveInheritedValue(term, fieldName)` to inherit `rdfs:label`, `rdfs:comment`, `rdfs:range`, `dppk:unit`, and `dppk:unitInherited` along `rdfs:subPropertyOf` chains.
    *   **[COMPLETED] Task 1.1.4:** Add `SubProperty Integrity` check in `auditDocumentation` to verify that any `dppk*` target of `rdfs:subPropertyOf` is defined in the ontology.
*   **[COMPLETED] Step 1.2: Add Unit Tests in `testing/unit/ontology-integrity.test.js`**
    *   **[COMPLETED] Task 1.2.1:** Add unit tests covering `rdfs:subPropertyOf` inheritance for `auditNumericUnits` and `auditDocumentation`, broken `rdfs:subPropertyOf` target detection, and prefix inheritance in nested scoped contexts.
*   **[COMPLETED] Step 1.3: Update Loaders, Fuzzer, Build Redirects, and Spec Docs Generator**
    *   **[COMPLETED] Task 1.3.1:** Update `src/lib/ontology-loader.js` to resolve `rdfs:subPropertyOf` across loaded ontology modules so browser tools (Validator, Renderer) inherit `range`, `unit`, `label`, and `comment`.
    *   **[COMPLETED] Task 1.3.2:** Update `testing/scripts/shacl-fuzzer.mjs` (`loadOntologyDefinition` and `extractClassRequirements`) to resolve `rdfs:range` across `owl:imports` via `rdfs:subPropertyOf`.
    *   **[COMPLETED] Task 1.3.3:** Update `scripts/generate-spec-docs.mjs` (`buildTermDictionary` and `generateSpecDocs`) to inherit `rdfs:label`, `rdfs:comment`, `rdfs:range`, and `dppk:unit` from parent properties across ontology files.
    *   **[COMPLETED] Task 1.3.4:** Update `scripts/build-and-clean.mjs` `specialRedirects` to map `['terms', 'cement', 'commoncement']` -> `sectors/cement/CommonCement.jsonld` and `['terms', 'cement', 'portlandcementclinker']` -> `sectors/cement/PortlandCementClinker.jsonld`.

### [COMPLETED] Step 2: Prototype First Two Substance Tables (`Table ZA.1.1.1` & `Table ZA.1.1.2`)
*   Plan: Prototype the modular substance ontology architecture for Table ZA.1.1.1 (Common cement) and Table ZA.1.1.2 (Portland cement clinker).
*   **[COMPLETED] Step 2.1: Define Substance Classes and Container Properties in `Cement.jsonld`**
    *   **[COMPLETED] Task 2.1.1:** Add `dppk-cement:CommonCement` (`rdfs:Class`), `dppk-cement:commonCement` (`owl:ObjectProperty`, domain `CementProduct`, range `CommonCement`), `dppk-cement:PortlandCementClinker` (`rdfs:Class`), and `dppk-cement:portlandCementClinker` (`owl:ObjectProperty`, domain `CementProduct`, range `PortlandCementClinker`) with 24 EU language translations in `src/ontology/v3/sectors/Cement.jsonld` (and English in `src/ontology/v3_stripped/sectors/Cement.jsonld`).
    *   **[COMPLETED] Task 2.1.2:** Add `owl:imports` for `CommonCement.jsonld` and `PortlandCementClinker.jsonld` in `src/ontology/v3/sectors/Cement.jsonld`, `src/ontology/v3/dpp-ontology.jsonld`, and their `v3_stripped` counterparts.
*   **[COMPLETED] Step 2.2: Create Dedicated Ontology File for Table ZA.1.1.1 (`CommonCement.jsonld`)**
    *   **[COMPLETED] Task 2.2.1:** Create `src/ontology/v3/sectors/cement/CommonCement.jsonld` (with 24-language ontology metadata) and `src/ontology/v3_stripped/sectors/cement/CommonCement.jsonld` defining all 28 `dppk-cement-commoncement:*` properties with `rdfs:subPropertyOf` -> `dppk-cement:*`, `rdfs:domain` -> `dppk-cement:CommonCement`, and Table ZA.1.1.1 `dppk:governedBy` strings.
*   **[COMPLETED] Step 2.3: Create Dedicated Ontology File for Table ZA.1.1.2 (`PortlandCementClinker.jsonld`)**
    *   **[COMPLETED] Task 2.3.1:** Create `src/ontology/v3/sectors/cement/PortlandCementClinker.jsonld` (with 24-language ontology metadata) and `src/ontology/v3_stripped/sectors/cement/PortlandCementClinker.jsonld` defining all 8 `dppk-cement-portlandcementclinker:*` properties with `rdfs:subPropertyOf` -> `dppk-cement:*`, `rdfs:domain` -> `dppk-cement:PortlandCementClinker`, and Table ZA.1.1.2 `dppk:governedBy` strings.
*   **[COMPLETED] Step 2.4: Update Context, JSON Schema, and Example DPP**
    *   **[COMPLETED] Task 2.4.1:** Update `src/contexts/v3/dpp-cement.context.jsonld` to add `dppk-cement-commoncement` and `dppk-cement-portlandcementclinker` prefixes and scoped `@context` mappings under `commonCement` and `portlandCementClinker`.
    *   **[COMPLETED] Task 2.4.2:** Update `src/validation/v3/json-schema/sector/cement.schema.json` to add the nested `commonCement` (28 properties) and `portlandCementClinker` (8 properties) object schemas.
    *   **[COMPLETED] Task 2.4.3:** Update `src/examples/cement-dpp-v3.json` to nest the Table ZA.1.1.1 and Table ZA.1.1.2 properties under `commonCement` and `portlandCementClinker`.

### [IN PROGRESS] Step 3: Diagnose and Fix Broken Build / Test Cases
*   Plan: Investigate and resolve any failing unit or integration tests resulting from the new multi-file `rdfs:subPropertyOf` substance architecture.
*   **[COMPLETED] Step 3.1: Review Test Failure Output & Fix `src/lib/ontology-loader.js`**
    *   **[COMPLETED] Task 3.1.1:** Diagnose `testing/unit/lib/ontology-loader.test.js` (`expect(ontologyMap.size).toBe(2)` receiving `4`): `loadAndParseOntology` in `src/lib/ontology-loader.js` was inserting both `targetKey` (`TestProperty`) and `rawKey` (`dpp:TestProperty`) into `ontologyMap` whenever `rawKey !== targetKey`. Remove the duplicate `rawKey` insertion and key `ontologyMap` solely by local property name `key`.
    *   **[COMPLETED] Task 3.1.2:** Diagnose `testing/integration/crawler.test.js` (8.758s failure): `testing/scripts/crawler.mjs` performs live `HEAD` requests with an 8000ms timeout against external `dcterms:source` URLs in ontologies, and any transient external timeout logs to `stderr`, causing `crawler.test.js` to fail on `!!stderr`. Verify all internal generated HTML/JSON/JSON-LD links and CSS/image references for `CommonCement` and `PortlandCementClinker` are valid.
*   **[PENDING] Step 3.2: Re-run Test Suite to Verify All Tests Pass**
    *   Re-run `npm test` to confirm `testing/unit/lib/ontology-loader.test.js` and `testing/integration/crawler.test.js` pass after rebuilding `dist/`.

### [PENDING] Step 4: Review Prototype & Roll Out Remaining Substance Tables (`ZA.1.1.3` – `ZA.1.1.12`)
*   Plan: Review the prototype for Tables ZA.1.1.1 and ZA.1.1.2 with the developer and, once aligned, decide on extending the pattern to the remaining 10 constituent tables (`Table ZA.1.1.3` through `Table ZA.1.1.12`).
