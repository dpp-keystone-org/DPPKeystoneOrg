# EC Battery DPP Semantic & OpenAPI Resource Bundle — Preview Fixes & Diff Guide

## Overview

This directory contains an in-place corrected version of the European Commission (EC) v1.0.0 Digital Product Passport (DPP) semantic asset package (`semantics/`) and OpenAPI 3.1 service specifications (`openapi/`) for batteries.

All edits preserve the original directory hierarchy (`core/1.0.0`, `product/batteries/1.0.0`, `product/batteries/subgroup/{evb,ind,lmt}/1.0.0`, and `openapi/`) so reviewers can inspect a minimal, direct `git diff` against the published v1.0.0 bundle.

---

## Running the Automated Parity & Conformance Test Suite

Every file in `semantics/` and `openapi/` is verified by [`verify-semantic-integrity.mjs`](./verify-semantic-integrity.mjs), which tests:
1. **Syntax & Strict Compilation**:
   - Parses all **35 Turtle (`.ttl`)** files (18 SHACL shape graphs + 17 SKOS vocabularies).
   - Validates all **5 JSON-LD 1.1 context (`.jsonld`)** files (verifying removal of `@protected`, `@base`, chained `@import`, and stray top-level `@type`).
   - Compiles all **18 JSON Schemas (`.schema.json`)** in strict JSON Schema Draft 2020-12 mode (`new Ajv2020({ strict: true })`) with zero warnings or errors.
2. **Mechanical JSON Schema $\leftrightarrow$ SHACL Parity (`17 / 17` pairs)**:
   - Verifies decoupled conditional activation (`if`/`then` $\leftrightarrow$ `sh:or`), zero redundant self-ID checks, and 100% identical allowed, required, and forbidden (`false` / `sh:maxCount 0`) property sets across `core`, `pub/res1/res2/res3-batteries`, and all 12 `evb`/`ind`/`lmt` subgroup profiles.
3. **End-to-End Layered Conformance & Compaction Round-Trip (`20 / 20` fixtures)**:
   - Validates every full DPP conformance fixture against **all 17 JSON Schemas and all 18 SHACL shape files layered simultaneously** (and standalone restricted slices against all 16 sector schemas/shapes), plus JSON-LD compaction round-tripping.
4. **Positive & Negative Mutation Matrix (`32 / 32` cases, `C1a–C25`)**:
   - Runs targeted positive and negative edge-case mutations (including conditional activation, inactivation, and subgroup parent-tier enforcement) through both layered JSON Schema and JSON-LD + SHACL to confirm identical `PASS/PASS` and `FAIL/FAIL` outcomes.
5. **OpenAPI 3.1 Contract Checks (`3 / 3` YAML specs)**:
   - Verifies cross-sector neutrality, pagination bounds, `taskType` discriminators, property naming alignment, and EN 18223 identifier separation.

### Option A: Run inside the DPP Keystone repository
Dependencies are already hoisted to the root `node_modules/` workspace, so no additional install is required:

```bash
# From the repository root:
node ec-bundle/verify-semantic-integrity.mjs

# Or from inside ec-bundle/:
npm test
```

### Option B: Run standalone (outside the DPP Keystone repository)
If `ec-bundle/` is extracted as a standalone archive (Node.js 18+ required):

```bash
cd ec-bundle
npm install
npm test
```

---

## Summary of Changes by Layer

### 1. OpenAPI 3.1 Service Specifications (`openapi/`)

The DPP Registry, Common, and Dashboard APIs are cross-sector infrastructure under ESPR (Regulation (EU) 2024/1781) and EN 18223:

1. **Cross-Sector Neutrality (`openapi-dpp-registry-public.yml`, `openapi-dpp-dashboard-public.yml`)**:
   - Replaced battery-specific schema names (`BatteriesSubmission*` $\rightarrow$ generic `DppSubmission*` / `SubmissionItem`), endpoint summaries, operation descriptions, and example payloads with sector-neutral ESPR / EN 18223 structures.
2. **Pagination & Query Schema Fixes (`openapi-dpp-common-public.yml`)**:
   - Fixed `PageMetadata.size` bounds from `minimum: 0` (which contradicted the `1..100` query parameter) to `minimum: 1` and `maximum: 100`.
   - Fixed the `sort` query parameter schema to `type: array` with `items: { type: string }`.
3. **`oneOf` Discriminator Enforcement (`openapi-dpp-dashboard-public.yml`)**:
   - Added explicit `const` constraints on `taskType` across all 6 `oneOf` outcome/detail variants (`DPP_REGISTRATION`, `ORGANISATION_VERIFICATION_DECLARATION_GENERATION`, `ORGANISATION_VERIFICATION_SUBMISSION`) and aligned `granularityLevel` $\rightarrow$ `granularity`.
4. **RFC 9264 Linkset Media Types (`openapi-dpp-common-public.yml`, `openapi-dpp-registry-public.yml`)**:
   - Added standard `application/linkset+json` alongside `application/linkset` for resolver linkset responses.
5. **EN 18223 Identifier Separation (`openapi-dpp-registry-public.yml`, `openapi-dpp-dashboard-public.yml`)**:
   - Kept `uniqueProductIdentifier` (`1..1`) distinct per EN 18223 while adding optional `digitalProductPassportId` (`format: uri`, `maxLength: 2048`) to `SubmissionItem` and `DppRegistrationItemOutcomeData` so economic operators can register explicit UPI + DPP ID pairs when needed.

---

### 2. SKOS Vocabularies & Ontology-Driven Unit Scalarization (`semantics/**/vocabs/`)

#### 2.1 Canonical Units in the Ontology Instead of Payload Wrappers (`common-vocabulary.ttl`, `measurement-unit.ttl`, `battery-vocabulary.ttl`)
In v1.0.0, every numeric measurement required a `{ "value": <num>, "unit": "https://.../measurement-unit#<unit>" }` object in every DPP instance—even though each regulated battery metric has a single mandated unit (`kg`, `Ah`, `V`, `W`, `Ω`, `%`, `%/month`, `°C`, `month`, `year`).

- Added `dppcom:unit` in `core/1.0.0/vocabs/common-vocabulary.ttl` to attach canonical `dppunit:*` concepts directly to ontology terms.
- Added missing `dppunit:year` (`skos:notation "year"`) in `core/1.0.0/vocabs/measurement-unit.ttl`.
- Annotated all quantitative `skos:Concept`s in `product/batteries/1.0.0/vocabs/battery-vocabulary.ttl` with their canonical `dppcom:unit`:
  - `bat:batteryWeight` $\rightarrow$ `dppunit:kilogram`
  - `bat:batteryCapacity`, `bat:ratedCapacity`, `bat:remainingCapacity` $\rightarrow$ `dppunit:ampereHour`
  - `bat:minimalVoltage`, `bat:nominalVoltage`, `bat:maximumVoltage` $\rightarrow$ `dppunit:volt`
  - `bat:originalPowerCapability`, `bat:powerLimit`, `bat:powerCapability`, `bat:remainingPowerCapability` $\rightarrow$ `dppunit:watt`
  - `bat:internalCellResistance`, `bat:internalPackResistance`, `bat:internalResistance`, `bat:ohmicResistance` $\rightarrow$ `dppunit:ohm`
  - `bat:renewableContentShare`, `bat:capacityExhaustionThreshold`, `bat:initialRoundTripEnergyEfficiency`, `bat:roundTripEfficiencyAtHalfCycleLife`, `bat:roundTripEnergyEfficiency`, `bat:roundTripEnergyEfficiencyFade`, `bat:remainingRoundTripEfficiency`, `bat:capacityFade`, `bat:powerFade`, `bat:internalResistanceIncrease`, `bat:stateOfCertifiedEnergy` $\rightarrow$ `dppunit:percent`
  - `bat:selfDischargingRate` $\rightarrow$ `dppunit:percentPerMonth`
  - `bat:commercialWarrantyPeriod` $\rightarrow$ `dppunit:month`
  - `bat:expectedLifetimeYears` $\rightarrow$ `dppunit:year`
- Replaced deeply nested `TemperatureConditionValue` wrappers with 8 optional flat operating-temperature bound properties (`bat:minimalVoltageMinTemp`, `bat:minimalVoltageMaxTemp`, `bat:nominalVoltageMinTemp`, `bat:nominalVoltageMaxTemp`, `bat:maximumVoltageMinTemp`, `bat:maximumVoltageMaxTemp`, `bat:powerLimitMinTemp`, `bat:powerLimitMaxTemp`, all `dppcom:unit dppunit:degreeCelsius`), enforced as paired min/max bounds when supplied.

#### 2.2 EN 18223 Core Header Terms (`core-vocabulary.ttl`, `core-error-code.ttl`, `battery-error-code.ttl`)
- Added optional EN 18223 Core header concepts to `core/1.0.0/vocabs/core-vocabulary.ttl`: `dpp:additionalProductIdentifiers`, `dpp:dppSchemaVersion`, `dpp:economicOperatorId`, `dpp:facilityId`, `dpp:productName`, and `dpp:productLabel`.
- Updated error-code descriptions in `core-error-code.ttl` and `battery-error-code.ttl` to match scalarized measurements, `0..*` clean-battery substance lists, scalar cycle counters, and multi-language `rdf:langString` values.

---

### 3. JSON-LD 1.1 Contexts (`semantics/**/contexts/`)

Fixed five W3C JSON-LD 1.1 conformance and interoperability blockers across `core-context.jsonld`, `batteries-context.jsonld`, `evb-context.jsonld`, `ind-context.jsonld`, and `lmt-context.jsonld`:

1. **Removed `"@protected": true`**: Allowed multi-sector DPPs and federated extensions (e.g., DPP Keystone, GS1 Web Vocabulary, Catena-X) to compose contexts in a `@context` array without `protected term redefinition` errors.
2. **Removed `"@base"` inside `"@context"`**: Invalid in remote JSON-LD contexts per W3C JSON-LD 1.1 §4.1.5 (`invalid remote context`).
3. **Removed stray top-level `"@type": "dpp:DigitalProductPassport"` outside `"@context"`**: Prevented context documents from being parsed as instance nodes.
4. **Eliminated illegal chained `"@import"` in subgroup contexts**: JSON-LD 1.1 forbids `@import` targeting a context that itself uses `@import`. Consolidated all `bat:` terms into `batteries-context.jsonld` (so subgroup SHACL `sh:maxCount 0` prohibitions reliably match forbidden predicates) and kept `evb-context.jsonld`, `ind-context.jsonld`, and `lmt-context.jsonld` as clean lightweight contexts.
5. **Removed primitive `@type` coercions (`xsd:string`, `xsd:double`, `xsd:integer`, `xsd:boolean`)**: Prevented JSON-LD expansion from silently coercing wrong JSON primitive types (e.g., `"batteryWeight": "450"`) into typed RDF literals that bypassed SHACL datatype checks. Retained `@type` only for `xsd:dateTime`, `xsd:gYearMonth`, `xsd:anyURI`, and `@vocab` enumerations.
6. **Added `@container: "@set"` on multi-valued array properties**: Ensured single-element arrays survive JSON-LD expansion/compaction round-tripping without collapsing into scalars.

---

### 4. JSON Schema Draft 2020-12 & SHACL Parity (`semantics/**/schemas/` & `semantics/**/shapes/`)

#### 4.1 Strict Draft 2020-12 Compliance (`18 / 18` schemas)
- Replaced non-standard `"message": { "type": "SEM-..." }` keywords (which fail strict Draft 2020-12 compilation) with standard `"$comment": "Validation error code: SEM-..."`.
- Added missing root `"type": "object"` across all 16 battery and subgroup schemas so non-object primitives cannot vacuously pass validation.
- Fixed broken `$id` URIs across all 12 subgroup schemas (`evb`, `ind`, `lmt`) where `/subgroup/{sub}/` had been omitted and collided with base battery `$id`s.
- Declared `"properties": { "<field>": true }` inside `anyOf` requirement branches (`manufacturerIdentification`, `manufacturerContactDetails`, `batteryIdentification`, `manufacturingPlace`) to satisfy strict `strictRequired` checks.
- Removed closed-world `"additionalProperties": false` on sub-objects so JSON-LD `@id`/`@type` keywords and federated properties remain valid while unknown unmapped predicates continue to be caught via `unknown#` (`SEM-COM-MSG-013`).

#### 4.2 Enumeration Short Codes (`skos:notation`) & Portable SHACL `sh:in`
- Replaced full-URI regex patterns in JSON Schemas with clean `skos:notation` `"enum"` arrays (`granularity`, `dppStatus`, `batteryCategory`, `batteryChemistry`, `criticalRawMaterials`, `chemicalSymbol`, `batteryStatus`, `observedCharacteristic`, `binRangeUnit`, `binValueUnit`).
- Replaced non-portable SPARQL `skos:inScheme` queries (which lacked vocabulary graph imports) with standard SHACL Core `sh:in ( ... )` lists matching the exact same `skos:notation` concepts via JSON-LD `@type: "@vocab"` scoping.

#### 4.3 Decoupled Conditional Layering, Per-Schema `contentSpecificationIds`, & `granularity` Alignment
- **Domain-neutral Core (`core.schema.json`, `core-shapes.ttl`)**: Removed all `ec.europa.eu` domain lock-in from `core`, relaxed `contentSpecificationIds` to `minItems: 0` / `sh:minCount 0`, and added a root `anyOf` rule requiring **either** `"@context"` **or** a non-empty `"contentSpecificationIds"` (`minItems: 1`) so any federated sector dictionary/ontology can build on DPP Core.
- **Decoupled conditional self-activation across all 16 Battery & Subgroup schemas/shapes**: Removed hardcoded `allOf: [{ "$ref": ... }]` inheritance from `pub-batteries.schema.json` (which previously coupled `core.schema.json` into the battery schema) and from all 12 subgroup schemas (`{pub,res1,res2,res3}-{evb,ind,lmt}.schema.json`). Each of the 16 schemas and 16 SHACL shapes now conditionally enforces its constraints (`if`/`then` in JSON Schema; `sh:or ( [ sh:not ... ] <constraints-shape> )` in SHACL Core, with no redundant self-ID re-check inside `then` / `<constraints-shape>`) **only when** its unique `contentSpecificationId` is present in `contentSpecificationIds`:
  - Base Battery (`4` tiers): `https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/{pub,res1,res2,res3}`
  - Subgroups (`3` subgroups $\times$ `4` tiers = `12` specs): `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/{evb,ind,lmt}/1.0.0/{pub,res1,res2,res3}` (whose `then` / `<constraints-shape>` also requires the corresponding parent battery tier URI `.../product/batteries/1.0.0/{tier}`).
- **Endpoint-controlled multi-sector layering**: Validation endpoints, market-surveillance tools, or OpenAPI 3.1 contracts can layer `core` alongside **all** recognized sector/subgroup schemas simultaneously (`allOf: [{ $ref: ".../core.schema.json" }, { $ref: ".../pub-batteries.schema.json" }, ...]`) and merge all SHACL shape graphs into a single shapes dataset without cross-sector or cross-subgroup collisions.
- **Aligned `dpp:granularity` in `pub-batteries-shapes.ttl`**: Relaxed `sh:hasValue dppgra:item` to `sh:in ( dppgra:model dppgra:batch dppgra:item )` (matching `core` and `pub-batteries.schema.json`), while keeping item-only `sh:in ( dppgra:item )` on `res3-batteries` (item-level operational data).

#### 4.4 Domain & Cardinality Bug Fixes
- **`additionalProductIdentifiers` (`0..*`)**: Fixed `minItems: 1` $\rightarrow$ `minItems: 0` in `core.schema.json` to match `sh:minCount 0` in `core-shapes.ttl`.
- **Clean batteries (`0..*`)**: Relaxed `bat:hazardousSubstances` and `bat:criticalRawMaterials` from `1..*` to `0..*` so batteries with zero hazardous substances or critical raw materials validate cleanly (`[]`).
- **True multilingual maps**: Removed `sh:maxCount 1` from all `rdf:langString` properties (which previously rejected any passport providing 2+ EU languages!) and aligned `multiLanguage` keys + SHACL checks on standard BCP 47 tags (`en`, `de-DE`, etc.).
- **Flattened `notInUseTemperatureRange`**: Removed redundant intermediate `valueRange` wrapper object; validates `{ lowerBound, upperBound, notInUseTemperatureRangeTest }` directly with `lowerBound <= upperBound`.
- **`manufacturerEmail`**: Changed from `format: "uri"` / `xsd:anyURI` (which forced `mailto:` URIs) to standard `format: "email"` / RFC email pattern.
- **Cycle counters (`numberOfChargingCycles`, `numberOfDischargingCycles`)**: Changed from integer arrays (`[42]`) to scalar non-negative integers (`0..1`, `minimum: 0`).
- **Depleted cycle life & zero warranty**: Lowered `expectedLifetimeCyclesRest` and `commercialWarrantyPeriod` `minimum` from `1` to `0`.
- **Paired `selfDischargingRateSet` observations (`res3-ind`, `res3-lmt`)**: Structured as an array of `{ selfDischargingRate, recordedTime }` observation objects instead of disconnected sibling arrays.
- **Repeatable `RelatedResource` properties**: Allowed single object or array (`relatedResourceOrArray`) and removed `sh:maxCount 1` on `euDeclarationOfConformity`, `sparePartReplacementDetails`, `dismantlingInformation`, `safetyMeasures`, and `complianceTestReportResults`.
- **Valid `stateOfChargeHistogram` bounds**: Constrained state-of-charge `lowerBound`/`upperBound` to `0..100` (`%`) and `binValue` to `>= 0`.

---

### 5. Conformance Fixtures (`semantics/**/tests/conforms/`)

Updated all 20 conformance fixtures under `core/1.0.0/tests/conforms/` and `product/batteries/**/tests/conforms/` to conform simultaneously to strict Draft 2020-12 JSON Schema, JSON-LD 1.1 expansion/compaction, and SHACL validation.
