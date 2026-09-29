# Rename and Deprecate carbonFootprintClass (Issue #36)

## Summary
Resolve semantic datatype inconsistency for `dppk:carbonFootprintClass` between Battery (`rdfs:range: "xsd:string"`) and Textile (`rdfs:range: { "@id": "xsd:integer" }`).
Per stakeholder consensus:
1. Introduce sector-specific terms `dppk:batteryCarbonFootprintClass` and `dppk:textileCarbonFootprintClass` (singular).
2. Retain existing `dppk:carbonFootprintClass` in both sector ontology files marked with `"owl:deprecated": true` and comments pointing to their respective replacements.
3. Update JSON-LD contexts (`dpp-battery.context.jsonld`, `dpp-textile.context.jsonld`), JSON schemas (`battery.schema.json`, `textile.schema.json`), and examples to reference the new sector-specific properties so DPPs covering both sectors avoid property collisions.
4. Add collision detection to `scripts/validate-ontology-integrity.mjs` to detect duplicate term definitions across non-deprecated ontology terms while respecting distinct namespaces and ignoring deprecated terms.

---

## Implementation Plan

### STEP 1: Feature Branch Setup
- [x] **1.1** User checks out a new feature branch in terminal: `git checkout -b feature/36-rename-carbon-footprint-class` (allows isolated review and live branch preview on GitHub Pages).

### STEP 2: Collision Detection in Ontology Integrity Suite
- [x] **2.1** Add unit tests in `testing/unit/ontology-integrity.test.js`:
  - Verify detection fails when two non-deprecated terms define the exact same `@id`.
  - Verify detection passes when terms share the same local name but different namespaces (e.g. `dppk:foo` vs `dppk-sector:foo`).
  - Verify detection ignores terms marked with `"owl:deprecated": true`.
- [x] **2.2** In `scripts/validate-ontology-integrity.mjs`, implement `auditTermCollisions(reporter)`:
  - Track definitions and source files per `@id` during ontology loading.
  - Filter out terms with `owl:deprecated === true`.
  - Report an integrity `FAIL` if multiple active definitions are found for the same `@id`.
- [x] **2.3** Export `auditTermCollisions` and wire it into the `run()` execution flow.

### STEP 3: Ontology Definitions and Deprecations
- [x] **3.1** In `src/ontology/v3/sectors/Battery.jsonld`:
  - Mark `dppk:carbonFootprintClass` with `"owl:deprecated": true` and update its comments indicating it is deprecated in favor of `dppk:batteryCarbonFootprintClass`.
  - Add new property `dppk:batteryCarbonFootprintClass`:
    - `@type`: `owl:DatatypeProperty`
    - `rdfs:domain`: `dppk:BatteryProduct`
    - `rdfs:range`: `"xsd:string"`
    - `dppk:governedBy`: `"DIN DKE SPEC 99100"`
    - `dcterms:source`: ESPR Annex XIII (1c); Art. 7(2)
    - Full 24-language translations for `rdfs:label` and `rdfs:comment`.
    - `skos:relatedMatch`: `schema:PropertyValue`, `gs1:AdditionalProductClassificationDetails`.
- [x] **3.2** In `src/ontology/v3/sectors/Textile.jsonld`:
  - Mark `dppk:carbonFootprintClass` with `"owl:deprecated": true` and update its comments indicating it is deprecated in favor of `dppk:textileCarbonFootprintClass`.
  - Add new property `dppk:textileCarbonFootprintClass`:
    - `@type`: `owl:DatatypeProperty`
    - `rdfs:domain`: `dppk:TextileProduct`
    - `rdfs:range`: `{ "@id": "xsd:integer" }`
    - `dppk:unit`: `{ "@id": "dppk-unit:Unitless" }`
    - `dppk:visibility`: `{ "@id": "dppk:Public" }`
    - `dppk:governedBy`: `"PEFCR climate change impact category"`
    - `dcterms:source`: ESPR Annex I(n)
    - Full 24-language translations for `rdfs:label` and `rdfs:comment`.
    - `skos:relatedMatch`: `schema:PropertyValue`, `gs1:AdditionalProductClassificationDetails`.

### STEP 4: Update JSON-LD Contexts
- [x] **4.1** In `src/contexts/v3/dpp-battery.context.jsonld`:
  - Replace `"carbonFootprintClass": "dppk:carbonFootprintClass"` with:
    `"batteryCarbonFootprintClass": "dppk:batteryCarbonFootprintClass"`
- [x] **4.2** In `src/contexts/v3/dpp-textile.context.jsonld`:
  - Replace `"carbonFootprintClass": { "@id": "dppk:carbonFootprintClass", "@type": "xsd:integer" }` with:
    `"textileCarbonFootprintClass": { "@id": "dppk:textileCarbonFootprintClass", "@type": "xsd:integer" }`

### STEP 5: Update JSON Schemas
- [x] **5.1** In `src/validation/v3/json-schema/sector/battery.schema.json`:
  - Rename property `"carbonFootprintClass"` to `"batteryCarbonFootprintClass"`.
- [x] **5.2** In `src/validation/v3/json-schema/sector/textile.schema.json`:
  - Rename property `"carbonFootprintClass"` to `"textileCarbonFootprintClass"`.

### STEP 6: Update Example DPPs
- [x] **6.1** In `src/examples/battery-dpp-v1.json`:
  - Update `"carbonFootprintClass": "A"` to `"batteryCarbonFootprintClass": "A"`.

### STEP 7: Consolidate Discovered Term Collisions
- [x] **7.1** Remove redundant duplicate `dppk:recycledContentPercentage` from `src/ontology/v3/sectors/IronSteel.jsonld` (already defined on `dppk:Product` in `src/ontology/v3/core/Product.jsonld`).
- [x] **7.2** Remove redundant duplicate `ProductionStep` terms (`dppk:ProductionStep`, `dppk:productionSteps`, `dppk:productionStepType`, `dppk:productionLocationCountry`) from `src/ontology/v3/sectors/Textile.jsonld`.
- [x] **7.3** Enrich `src/ontology/v3/core/Compliance.jsonld` with explicit range and the 24-language comments from Textile for the `ProductionStep` terms.
- [x] **7.4** Promote `dppk:manufacturingDate` to `src/ontology/v3/core/Product.jsonld` with `rdfs:domain: dppk:Product` and `rdfs:range: xsd:date` (complete with 24 translations).
- [x] **7.5** Add `manufacturingDate` to `src/contexts/v3/dpp-core.context.jsonld`.
- [x] **7.6** Remove duplicate `dppk:manufacturingDate` declarations from `src/ontology/v3/sectors/Battery.jsonld` and `src/ontology/v3/sectors/IronSteel.jsonld`.
