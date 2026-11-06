# Design Doc: 2026-11-05 EC Battery Semantic Bundle Fixes & Keystone Alignment

## Summary
Fix the European Commission's (EC) v1.0.0 DPP semantic resource bundle and OpenAPI contracts (`ec-bundle/`), package a clean `.zip` + changelog for return to the EC / standards body, and implement Keystone interoperability deliverables:
1. **Goal 1 — Fix `ec-bundle/` (`semantics/` + `openapi/`) + `.zip` Package**: Fix all semantic, JSON-LD `@context`, JSON Schema, SHACL, SKOS vocabulary, conformance-test, and sector-specific OpenAPI flaws with a minimal, clean diff (no folder moves).
2. **Goal 2 — Migrated Keystone Battery Example Prototype**: Create `src/examples/battery-dpp-ec-aligned-v1.json` loading Keystone's battery context first and the fixed EC contexts last, validating against EC JSON Schemas + SHACL while preserving Keystone-specific fields (`carbonFootprint*`, recycled content, due diligence, `materialComposition`, etc.).
3. **Goal 3 — Bridge Context (`EC Terms -> Keystone Ontology`)**: Create `src/contexts/v3/dpp-ec-to-keystone.context.jsonld` mapping scalarized EC battery JSON terms (and `@nest`-flattened wrapper objects) to Keystone `dppk:` IRIs.
4. **Goal 4 — Bridge Context (`Keystone Schemas -> EC Vocabulary`)**: Create `src/contexts/v3/dpp-keystone-to-ec.context.jsonld` mapping Keystone JSON schema keys to EC `dpp:` / `bat:` IRIs where compatible, retaining `dppk:` fallback for fields not yet in EC v1.0.0.
5. **Goal 5 — `ec-battery` Export Profile Showcase**: Add `src/util/js/common/transformation/profiles/ec-battery.js` (and Wizard / Transformation integration) so users (e.g., GS1 Switzerland) can author rich battery DPPs in Keystone and export EC-compliant payloads.

---

## Finalized Design Decisions (Signed Off in Step 2.2)

* **D (Regulatory Corrections & New Bug Findings — Approved)**:
  * Keep subgroup `sh:maxCount 0` prohibitions (`capacityExhaustionThreshold` on IND/LMT; `stateOfCertifiedEnergy` on IND/LMT; `remaining*`, `selfDischargingRateSet`, `ohmicResistance` on EVB) and mirror them with `"<prop>": false` in subgroup JSON Schemas.
  * Keep `manufacturerContactDetails` optional (DP 5), keep `expectedLifetimeYears` in `res3` (DP 60), and keep only `batteryStatus` unconditionally required in `res3-batteries` (DP 67).
* **D1 (Scalarizing Units & Flattening Brand-Supplied Temperature Ranges — Approved)**:
  * **Units -> Ontology**: Convert all 22 `unitValue` properties + `minimalVoltage`, `nominalVoltage`, `maximumVoltage`, and `powerLimit` to plain scalar numbers (`"type": "number"` / `xsd:double`), declaring canonical `dppcom:unit` (`dppunit:kilogram`, `dppunit:ampereHour`, `dppunit:percent`, `dppunit:volt`, `dppunit:watt`, `dppunit:ohm`, `dppunit:reciprocalHour`, `dppunit:percentPerYear`, `dppunit:month`, `dppunit:degreeCelsius`) directly on each `skos:Concept` in `battery-vocabulary.ttl`.
  * **Temperature Ranges -> Flat Optional Scalars**: Because temperature bounds in BR Annex XIII 1(h) & 1(i) (*"with temperature range when relevant"*) are brand-supplied per battery model rather than universal constants (and EC mistakenly required `valueRange` on voltages!), replace nested `unitValueWithRange` objects with optional flat scalar bounds (`minimalVoltageMinTemp`/`minimalVoltageMaxTemp`, `nominalVoltageMinTemp`/`nominalVoltageMaxTemp`, `maximumVoltageMinTemp`/`maximumVoltageMaxTemp`, `powerLimitMinTemp`/`powerLimitMaxTemp` in `°C`, pairwise `dependentRequired` if present). Flatten `notInUseTemperatureRange` (DP 34) to `{ lowerBound, upperBound, notInUseTemperatureRangeTest }` (removing the redundant inner `valueRange`, `unit`, and `observedCharacteristic` wrapper).
* **D2 (Short Enumerations — Approved)**:
  * Remove all full-URI regex patterns on controlled-vocabulary fields in JSON Schemas and replace them with explicit `"enum"` lists of `skos:notation` short codes (`"item"`, `"validStatus"`, `"electricVehicleBattery"`, `"lithiumIonLFP"`, `"lithium"`, `"cadmiumSymbol"`, `"original"`, `"degreeCelsius"`, `"percent"`, `"hour"`, etc.), which expand automatically to SKOS Concept IRIs via `"@type": "@vocab"` in `@context`.
* **D3 (`uniqueProductIdentifier` 1:1 per EN 18223 + Optional Workaround — Approved)**:
  * Keep `uniqueProductIdentifier` as a single mandatory string (`1..1`) per EN 18223, separate from `digitalProductPassportId`.
  * Add optional `additionalProductIdentifiers` (`array` of strings, `@container: @set`) in `core` for multi-GTIN scenarios, AND add optional `digitalProductPassportId` (HTTPS payload URL) to `SubmissionItem` in `openapi-dpp-registry-public.yml` (and `DppRegistrationItemOutcomeData` in `dashboard`) so operators can register multiple distinct `(uniqueProductIdentifier, digitalProductPassportId)` combinations pointing to the same DPP payload URL without conflating UPI and DPPID.
* **D4 (Remove `@protected: true` & Fix Context Composition — Approved)**:
  * Remove `"@protected": true`, invalid `"@base"`, outside-`@context` `"@type"`, and chained `"@import"` across all 5 EC context files so DPP contexts (both EC's own layered contexts and federated contexts like Keystone) compose cleanly without collisions.
* **D5 (Minimal Diff — No Folder Moves — Approved)**:
  * Keep all existing directory paths intact. Fix subgroup schema `$id`s to `.../product/batteries/subgroup/{evb|ind|lmt}/1.0.0/schemas/...` (matching the actual folder layout), and use `"contains"` with `(/releases)?/\d+\.\d+\.\d+` on `contentSpecificationIds` so both Guide and v1.0.0 EC URIs pass alongside federated URNs (`urn:dpp-keystone:...`).
* **D6 (Core Header Fields, Relaxed Language Tags, & `"$comment"` Error Codes — Approved)**:
  * Add EN 18223 / voluntary Core fields to `core` (`dppSchemaVersion`, `economicOperatorId`, `facilityId`, `productName`, `productLabel`—optional in v1.0.x so existing `registrantIdentity` battery payloads stay valid while supporting full EN 18223 headers).
  * Relax language tags from `^[A-Za-z]{2}-[A-Za-z]{2}$` to BCP 47 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` across `common.schema.json`, `core-shapes.ttl`, and SPARQL checks (allowing `"en"` as well as `"en-GB"`).
  * Replace non-standard `"message": { "type": "SEM-..." }` keywords in all JSON Schemas (which map to concepts in `core-error-code.ttl`, `common-error-code.ttl`, and `battery-error-code.ttl` and break strict Draft 2020-12 compilation) with standard `"$comment": "Validation error code: SEM-..."`.
* **D7 (`ec-battery` Export Profile Showcase — Approved)**:
  * Implement the `ec-battery` export/transformation profile in Step 4.4.

---

## Implementation Plan

### [COMPLETED] Step 1: Ingest & Review EC Bundle, Prior Feedback, and Keystone Battery Assets
*   **[COMPLETED] Step 1.1:** Stage `ec-bundle/` and `docs/sensitive/ec-bundle/` on a local git branch.
*   **[COMPLETED] Step 1.2:** Audit all 83 files in `ec-bundle/` against stakeholder reviews and `docs/sensitive/battery-ec-requirements.md`.
*   **[COMPLETED] Step 1.3:** Cross-reference all EC terms, schemas, shapes, and contexts against Keystone v3 (`src/ontology/`, `src/contexts/`, `src/validation/`, `src/examples/`, `src/util/`).

### [COMPLETED] Step 2: Reconcile Flaw List & Detail Fix Plan
*   **[COMPLETED] Step 2.1:** Synthesize complete issue matrix, 4 regulatory corrections, and Goal 2–4 feasibility analysis.
*   **[COMPLETED] Step 2.2:** Confirm Decisions D & D1–D7 with user and break down Steps 3 & 4 into granular, file-level tasks below.

---

### [ ] Step 3: Fix the EC Bundle (`ec-bundle/`), Verify, and Package `.zip` Deliverable (Goal 1)

*   **[COMPLETED] Step 3.1: Fix OpenAPI 3.1 Specifications (`ec-bundle/openapi/`)**
    *   **[COMPLETED] Step 3.1.a (`openapi-dpp-common-public.yml`):**
        *   In `PageMetadata.properties.size`, change `minimum: 0` to `minimum: 1` and add `maximum: 100`.
        *   In `AcceptedAsyncOperation.properties.correlationId`, change `type: [string, 'null']` to `type: string` (since `correlationId` is in `required` and maps to mandatory response header `X-Correlation-Id`).
    *   **[COMPLETED] Step 3.1.b (`openapi-dpp-registry-public.yml`):**
        *   Delete sector-specific `BatteriesSubmissionRequest` and `BatteriesSubmissionItem` schemas; replace `DPPRegistrationSubmissionRequest`'s `oneOf`/`discriminator` with the generic object schema (`required: [productGroup, submissionItems]`, optional `productSubGroup`, `submissionItems` with `minItems: 1`, `maxItems: 100` referencing `#/components/schemas/SubmissionItem`) and delete redundant `BaseDPPRegistrationSubmissionRequest`.
        *   In `SubmissionItem` (and examples), separate product identity from payload URL per D3: keep `uniqueProductIdentifier` (`format: uri`, product identifier per EN 18223) and add optional `digitalProductPassportId` (`type: string, format: uri, minLength: 8, maxLength: 2000`, description: dereferenceable HTTPS URL of the DPP payload when distinct from `uniqueProductIdentifier`).
        *   Update `ProductSubGroup` and request examples from `EV` / `LMT` to lowercase `evb` / `lmt` (aligning with `product/batteries/subgroup/{evb,ind,lmt}`), add `'401'` Unauthorized responses referencing `openapi-dpp-common-public.yml#/components/responses/UnauthorizedProblemResponse` on all 3 endpoints, and reference shared `CorrelationIdHeader` / `ErrorResponse` from `openapi-dpp-common-public.yml`.
    *   **[COMPLETED] Step 3.1.c (`openapi-dpp-dashboard-public.yml`):**
        *   Fix fatal OAS 3.1 `oneOf` bug: add `taskType: { type: string, const: DPP_REGISTRATION | ORGANISATION_VERIFICATION_DECLARATION_GENERATION | ORGANISATION_VERIFICATION_SUBMISSION }` on all 6 `oneOf` variants (plus `discriminator: { propertyName: taskType }`).
        *   In `TaskSummary.properties.completedAt`, change `type: string` to `type: [string, 'null']` (to match its description for `IN_PROGRESS`/`RECEIVED` tasks).
        *   In `DppRegistrationItemOutcomeData`: remove `productSubGroup` from `required` (since non-battery sectors may have no subgroup), rename `granularityLevel` to `granularity` with `enum: [item, batch, model]`, add optional `digitalProductPassportId` (`type: [string, 'null'], format: uri`), and update subgroup example `EV` -> `evb`.

*   **[COMPLETED] Step 3.2: Fix SKOS Vocabularies (`ec-bundle/semantics/.../vocabs/`)**
    *   **[COMPLETED] Step 3.2.a (`core/1.0.0/vocabs/measurement-unit.ttl`):**
        *   Add missing SKOS concepts `dppunit:month` (`skos:notation "month"`, QUDT `unit:MO`), `dppunit:percentPerYear` (`skos:notation "percentPerYear"`, `%/yr`), `dppunit:wattHour` (`skos:notation "wattHour"`), and `dppunit:kilowattHour` (`skos:notation "kilowattHour"`), and include them in `skos:hasTopConcept`.
    *   **[COMPLETED] Step 3.2.b (`core/1.0.0/vocabs/core-vocabulary.ttl` & `core-error-code.ttl`):**
        *   In `core-vocabulary.ttl`: remove duplicate `euvoc:status concept-status:CURRENT` triples; add missing EN 18223 / voluntary Core `skos:Concept`s (`dpp:additionalProductIdentifiers`, `dpp:dppSchemaVersion`, `dpp:economicOperatorId`, `dpp:facilityId`, `dpp:productName`, `dpp:productLabel`) and list them in `skos:hasTopConcept`.
        *   In `core-error-code.ttl`: remove `"(only item for batteries)"` sector leak from `dpperr:SEM-MSG-003`; fix `dpperr:SEM-MSG-005` (`"a code of instance-status"` instead of `"List of codes"`); add error concepts for new optional Core properties (`SEM-MSG-010`..`015`).
    *   **[COMPLETED] Step 3.2.c (`product/batteries/1.0.0/vocabs/battery-vocabulary.ttl` & `battery-error-code.ttl`):**
        *   In `battery-vocabulary.ttl`: remove the duplicate `owl:Ontology` / `skos:ConceptScheme` declaration block at lines 18–26; declare `@prefix dppcom:` and `@prefix dppunit:`; add canonical `dppcom:unit` triples to all 27 quantitative concepts (`batteryWeight` -> `kilogram`, `batteryCapacity` -> `ampereHour`, `renewableContentShare` -> `percent`, `minimalVoltage`/`nominalVoltage`/`maximumVoltage` -> `volt`, `originalPowerCapability`/`powerLimit`/`powerCapability`/`remainingPowerCapability` -> `watt`, `notInUseTemperatureRange` -> `degreeCelsius`, `commercialWarrantyPeriod` -> `month`, `internalCellResistance`/`internalPackResistance`/`internalResistance`/`ohmicResistance` -> `ohm`, `cycleLifeDischargeCRate`/`cycleLifeChargeCRate` -> `reciprocalHour`, `capacityExhaustionThreshold`/`initialRoundTripEnergyEfficiency`/`roundTripEfficiencyAtHalfCycleLife`/`roundTripEnergyEfficiency`/`roundTripEnergyEfficiencyFade`/`capacityFade`/`powerFade`/`internalResistanceIncrease`/`stateOfCertifiedEnergy`/`remainingRoundTripEfficiency` -> `percent`, `ratedCapacity`/`remainingCapacity` -> `ampereHour`, `selfDischargingRate` -> `percentPerYear`).
        *   Add the 8 optional flat temperature-bound concepts (`bat:minimalVoltageMinTemp`, `bat:minimalVoltageMaxTemp`, `bat:nominalVoltageMinTemp`, `bat:nominalVoltageMaxTemp`, `bat:maximumVoltageMinTemp`, `bat:maximumVoltageMaxTemp`, `bat:powerLimitMinTemp`, `bat:powerLimitMaxTemp`) with `dppcom:unit dppunit:degreeCelsius` and list them in `skos:hasTopConcept`.
        *   In `battery-error-code.ttl`: update `SEM-BAT-MSG-083` & `084` (`numberOfChargingCycles`/`numberOfDischargingCycles` occur `0..1` integer, not `at least 1 time` without upper bound); update `SEM-BAT-MSG-024` & `026` (`hazardousSubstances`/`criticalRawMaterials` allow `0..*` for clean batteries); update multilingual error descriptions (remove `"must not occur more than 1 time"` so multiple languages are permitted); update scalarized measurement error descriptions to `Decimal`/`Double` instead of `UnitValue`; add error codes for optional voltage/power temperature bounds.

*   **[COMPLETED] Step 3.3: Fix JSON-LD Contexts (`ec-bundle/semantics/.../contexts/`)**
    *   **[COMPLETED] Step 3.3.a (`core/1.0.0/contexts/core-context.jsonld`):**
        *   Remove `"@protected": true`, `"@base"` inside `"@context"`, `"@type": "dpp:DigitalProductPassport"` outside `"@context"`, and unused prefixes (`dct`, `rdf`, `unk`).
        *   Add `"id": "@id"`, `"type": "@type"`, and `"DigitalProductPassport": "dpp:DigitalProductPassport"`.
        *   Add `"@container": "@set"` on `contentSpecificationIds`, `additionalProductIdentifiers`, and `bin`.
        *   Add mappings for `additionalProductIdentifiers`, `dppSchemaVersion`, `economicOperatorId`, `facilityId`, `productName` (`@container: @language`), and `productLabel` (`@container: @set`), and avoid primitive `@type` coercion (`xsd:string`/`xsd:double`/`xsd:integer`/`xsd:boolean`) so JSON-LD preserves native JSON primitive types for strict JSON Schema <> SHACL parity.
    *   **[COMPLETED] Step 3.3.b (`product/batteries/1.0.0/contexts/batteries-context.jsonld` & subgroup `evb/ind/lmt-context.jsonld`):**
        *   Remove `"@protected": true`, `"@base"`, outside-`@context` `"@type"`, unused prefixes, and illegal chained `"@import"` from `batteries-context.jsonld` and all 3 subgroup contexts.
        *   Consolidate **all** `bat:` property definitions (including EVB's `capacityExhaustionThreshold`/`stateOfCertifiedEnergy` and IND/LMT's `remainingCapacity`, `remainingPowerCapability`, `remainingRoundTripEfficiency`, `selfDischargingRateSet`, `selfDischargingRate`, `recordedTime`, `ohmicResistance`, plus the 8 optional `*MinTemp`/`*MaxTemp` terms) into `batteries-context.jsonld` so subgroup SHACL `sh:maxCount 0` checks actually see and reject forbidden predicates! Keep `evb-context.jsonld`, `ind-context.jsonld`, and `lmt-context.jsonld` as clean lightweight pass-through contexts (`@version: 1.1`) so existing references don't break.
        *   Preserve native JSON numeric/boolean/string types (keeping `@type` only on `xsd:gYearMonth`, `xsd:dateTime`, `xsd:anyURI`, and `@vocab`) so wrong primitive JSON types fail both JSON Schema and SHACL identically.
        *   Add `"@container": "@set"` on all multi-valued battery properties: `batteryChemistry`, `hazardousSubstances`, `criticalRawMaterials`, `chemicalSymbol`, `selfDischargingRateSet`, `environmentalConditionHistogram`, `stateOfChargeHistogram`, and repeatable `RelatedResource` properties (`euDeclarationOfConformity`, `sparePartReplacementDetails`, `dismantlingInformation`, `safetyMeasures`, `complianceTestReportResults`).

*   **[COMPLETED] Step 3.4: Fix SHACL Shapes (`ec-bundle/semantics/.../shapes/`)**
    *   **[COMPLETED] Step 3.4.a (`core/1.0.0/shapes/core-shapes.ttl` & `common-shapes.ttl`):**
        *   Add EUPL-1.2 license header comments to SHACL files.
        *   In `core-shapes.ttl`: relax `contentSpecificationIds` regex to accept `(releases/)?\d+\.\d+\.\d+` via `sh:qualifiedMinCount 1` / `sh:qualifiedMaxCount 1` (so federated URNs in `contentSpecificationIds` don't fail!); add timezone offset `sh:pattern` on `lastUpdate`; replace SPARQL `skos:inScheme` blocks with SHACL Core `sh:in ( ... )`; add optional `sh:property` shapes for `additionalProductIdentifiers`, `dppSchemaVersion`, `economicOperatorId`, `facilityId`, `productName` (`rdf:langString` without `maxCount 1`), and `productLabel`.
        *   In `common-shapes.ttl`: add missing `a sh:PropertyShape` on `value-shape`, `lower-bound-shape`, and `upper-bound-shape`; add `sh:in` controlled-vocab validation on `unit-shape` (`measurement-unit`) and `histogram-shape` (`binRangeUnit` & `binValueUnit`); add `sh:minInclusive 0` on `binValue`; relax `resource-shapes` `dpp:language` regex to BCP 47 `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$` and add `sh:message` codes.
    *   **[COMPLETED] Step 3.4.b (`pub-batteries-shapes.ttl`, `res1/res2/res3-batteries-shapes.ttl`, and subgroup shapes):**
        *   In `pub-batteries-shapes.ttl`: change `dpp:granularity` constraint from `sh:hasValue gran:item` to `sh:in ( dppgra:model dppgra:batch dppgra:item )` (keep `sh:in ( dppgra:item )` in `res3-batteries-shapes.ttl`, which only applies to item-level operational passports).
        *   Remove `sh:maxCount 1` from all multilingual `rdf:langString` properties (`extinguishingAgent`, `notInUseTemperatureRangeTest`, all 10 `wasteBatteryPreventionManagementInfo` sub-properties, `detailedComposition` in `res1`, `cycleLifeReferenceTest`, and `negativeEvents` in `res3`), and relax all SPARQL language-tag regexes to BCP 47.
        *   Change `bat:hazardousSubstances` and `bat:criticalRawMaterials` from `sh:minCount 1` to `sh:minCount 0` so clean batteries (`[]`) pass SHACL.
        *   Update all scalarized quantitative properties to `sh:or ( [ sh:datatype xsd:double ] [ sh:datatype xsd:decimal ] [ sh:datatype xsd:integer ] )`, plus optional pairwise shapes for the 8 `*MinTemp`/`*MaxTemp` properties (`lower <= upper` + co-presence `sh:or`).
        *   Update `bat-shapes:not-in-use-temperature-range-shape` to validate flat `dppcom:lowerBound`, `dppcom:upperBound` (`lowerBound <= upperBound`), and `bat:notInUseTemperatureRangeTest` directly on the node without an intermediate `dppcom:valueRange` blank node.
        *   Fix `manufacturerEmail` (`sh:datatype xsd:string` + email regex instead of `xsd:anyURI`), `commercialWarrantyPeriod` (`sh:minInclusive 0`), `expectedLifetimeCyclesRest` (`sh:minInclusive 0` instead of `1`), `sh:minLength 1` on string properties, `sh:maxCount 1` on `numberOfChargingCycles` & `numberOfDischargingCycles`, repeatable `RelatedResource`s (remove `sh:maxCount 1`), and `selfDischargingRateSet` items (`{ bat:selfDischargingRate, dppcom:recordedTime }`).

*   **[COMPLETED] Step 3.5: Fix JSON Schemas (`ec-bundle/semantics/.../schemas/`)**
    *   **[COMPLETED] Step 3.5.a (`core/1.0.0/schemas/common.schema.json` & `core.schema.json`):**
        *   In `common.schema.json`: update `multiLanguage` to add `"additionalProperties": { "type": "string", "minLength": 1 }` and BCP 47 `propertyNames.pattern` `^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$`; relax `relatedResource.properties.language` to BCP 47, remove `"additionalProperties": false`, and define `"relatedResourceOrArray"`; update `histogram` `binRangeUnit` and `binValueUnit` from URI regexes to explicit short-code `"enum"`.
        *   In `core.schema.json`: allow `@context`, `id`, `type`; replace URI regexes on `granularity` (`enum: ["model", "batch", "item"]`) and `dppStatus` (`enum: ["validStatus", "invalidStatus"]`); use `"contains"` + `minContains: 1` + `maxContains: 1` on `contentSpecificationIds` so federated URNs pass alongside EC IDs; add optional `additionalProductIdentifiers`, `dppSchemaVersion`, `economicOperatorId`, `facilityId`, `productName`, and `productLabel`; replace all `"message": { "type": "..." }` with `"$comment": "Validation error code: ..."`.
    *   **[COMPLETED] Step 3.5.b (`pub/res1/res2/res3` battery & subgroup schemas — 16 files):**
        *   Add `"type": "object"` at root of all battery & subgroup schemas; fix subgroup `$id`s in all 12 `evb`/`ind`/`lmt` schemas to `.../product/batteries/subgroup/{sub}/1.0.0/schemas/...`.
        *   Replace all `"message": { "type": "SEM-BAT-MSG-..." }` keywords across all files with `"$comment": "Validation error code: SEM-BAT-MSG-..."`.
        *   Remove `"additionalProperties": false` on sub-objects (`manufacturerIdentification`, `manufacturerContactDetails`, `batteryIdentification`, `manufacturingPlace`, `notInUseTemperatureRange`, `wasteBatteryPreventionManagementInfo`, and the misplaced one on `environmentalConditionHistogram` in `res3-batteries.schema.json`) so federated properties and `@id`/`@type` are never rejected.
        *   Convert all quantitative fields to `{ "type": "number" }`, add optional flat `*MinTemp`/`*MaxTemp` (`{ "type": "number" }`) with pairwise `dependentRequired` in `pub-batteries.schema.json`, and flatten `notInUseTemperatureRange` to `{ lowerBound, upperBound, notInUseTemperatureRangeTest }`.
        *   Replace URI regexes with short-code `"enum"`s on `batteryCategory`, `batteryChemistry` items (`minItems: 1`), `criticalRawMaterials` items (`minItems: 0` allowed), `chemicalSymbol` items, and `batteryStatus`.
        *   Fix `manufacturerEmail` (`format: "email"`), repeatable `RelatedResource` fields (`relatedResourceOrArray`), `expectedLifetimeCyclesRest` (`minimum: 0`), scalar integers `numberOfChargingCycles` & `numberOfDischargingCycles` (`type: "integer", minimum: 0`), `selfDischargingRateSet` (`type: "array"` of `{ selfDischargingRate, recordedTime }` in `res3-ind` & `res3-lmt`), and subgroup prohibitions (`false` matching `sh:maxCount 0`).

*   **[ ] Step 3.6: Fix Conformance Test Payloads, Run SHACL <> JSON Schema Parity Test Bench, & Package `.zip`**
    *   **[COMPLETED] Step 3.6.a (Update Conformance Payloads):** Update all 20 `tests/conforms/*.json` files (`core`, `batteries`, `evb`, `ind`, `lmt`) to include `@context`, `"type": "DigitalProductPassport"`, short `skos:notation` enum values, scalar numeric values, flattened `notInUseTemperatureRange`, plain email addresses (no `mailto:`), scalar cycle counts (no `[42]`), realistic non-negative `stateOfChargeHistogram` bins (`0..100` `%`), and properly paired `selfDischargingRateSet` observations.
    *   **[COMPLETED] Step 3.6.b (SHACL <> JSON Schema Parity Test Bench & Back-and-Forth Validation):** Created standalone `ec-bundle/verify-ec-bundle-parity.mjs` + `ec-bundle/package.json` (modeled on `docs/sensitive/ec-bundle/SHACL-vs-JSON-Schema-differences.md`, plus full JSON-LD 1.1 expansion & compaction round-trip) that mechanically compares property sets, required sets, and forbidden sets across all 17 targeted schema/SHACL pairs and executes all 20 conformance fixtures plus 27 targeted positive/negative mutations (`C1–C25`) end-to-end through strict JSON Schema (Ajv Draft 2020-12) and SHACL (`rdf-validate-shacl` + SPARQL checks), plus OpenAPI 3.1 contract checks. Verified 100% passing.
    *   **[COMPLETED] Step 3.6.c (Diff Guide / Changelog):** Created `ec-bundle/README.md` (alongside internal `docs/sensitive/ec-bundle/EC-Bundle-v1.0.1-Fixes-Changelog.md`) summarizing every fix by layer and providing instructions to run the parity suite both inside Keystone and standalone.

---

### [ ] Step 4: Implement Keystone Interoperability Prototypes, Bridge Contexts, & Showcase (Goals 2, 3, 4 & 5)

*   **[COMPLETED] Step 4.1: Goal 2 — Migrated Keystone Battery Example Prototype**
    *   Created `src/examples/battery-dpp-ec-aligned-v1.json` loading `https://dpp-keystone.org/spec/contexts/{{VERSION}}/dpp-battery.context.jsonld` first and the fixed EC contexts (`core-context.jsonld`, `batteries-context.jsonld`) last.
    *   Uses EC's property names, short `skos:notation` codes, and scalar numbers for overlapping EV battery fields while keeping Keystone's federated fields (`carbonFootprint*`, `preConsumerRecycledMaterialComposition`, `postConsumerRecycledMaterialComposition`, `dueDiligenceReport`, `materialComposition`, `productName`, `serviceDate`, `image`).
    *   Added integration test in `testing/integration/ec-battery-interoperability.test.js` verifying validation against fixed EC JSON Schemas (`core` + `pub-batteries` + `pub-evb` + `res1/res2/res3`) AND fixed EC SHACL shapes while expanding both `bat:`/`dpp:` and `dppk:` triples cleanly.

*   **[COMPLETED] Step 4.2: Goal 3 — Bridge Context (`EC Terms -> Keystone Ontology`)**
    *   Created `src/contexts/v3/dpp-ec-to-keystone.context.jsonld` mapping EC Core + scalarized EC Battery terms (and `@nest`-flattened wrapper objects `batteryIdentification`, `wasteBatteryPreventionManagementInfo`, `notInUseTemperatureRange`, `environmentalConditionHistogramSet`) to verified Keystone `dppk:` IRIs.
    *   Added integration tests verifying JSON-LD expansion of an EC battery payload using `dpp-ec-to-keystone.context.jsonld` produces the expected `dppk:` RDF triples.

*   **[COMPLETED] Step 4.3: Goal 4 — Bridge Context (`Keystone Schemas -> EC Vocabulary`)**
    *   Created `src/contexts/v3/dpp-keystone-to-ec.context.jsonld` mapping Keystone Core + Battery JSON schema keys (including non-colliding `@nest` performance metrics and scoped `power` / `temperature` properties) to EC `dpp:` / `bat:` IRIs and SKOS concept IRIs while retaining `dppk:` fallback mappings for fields absent from EC v1.0.0.
    *   Added integration tests verifying JSON-LD expansion of `src/examples/battery-dpp-v1.json` with `dpp-keystone-to-ec.context.jsonld` emits `dpp:` and `bat:` predicates alongside `dppk:` predicates.

*   **[COMPLETED] Step 4.4: Goal 5 — `ec-battery` Transformation / Export Profile Showcase**
    *   Created `src/util/js/common/transformation/profiles/ec-battery.js` (registered in `src/util/js/common/transformation/dpp-schema-logic.js` and wired into the Wizard's `"Export EC Battery DPP"` button with 24-language i18n support) to transform any Keystone battery DPP (`battery-ev`, `battery-lmv`, `battery-industrial`) into an EC-compliant JSON-LD battery payload (converting mΩ -> Ω, parsing warranty periods, mapping enums to EC `skos:notation` short codes, enforcing subgroup prohibitions, and preserving Keystone federated extensions).
    *   Added integration tests across EV, LMV/LMT, and Industrial examples verifying strict EC JSON Schema + SHACL compliance.

*   **[ ] Step 4.5: Final Verification & Build Check**
    *   Run the verification script, `npm run build`, and `npm test` to confirm all Keystone tests and EC bundle checks pass with zero regressions, package `ec-bundle-fixed.zip`, and rename this design doc with `-COMPLETED`.
