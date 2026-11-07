# EU DPP semantic artefacts: SHACL vs JSON Schema differences

Artefacts: `DPP Registry – Semantic Data Artifacts/` (core 1.0.0, product/batteries 1.0.0, batteries subgroups evb / ind / lmt). Guide: *DPP Registry – Semantic Data Guide* (DG GROW G2/B3, published 2026-10-30, v1.0).

## 1\. Summary

The two formats do not describe the same schema. The differences are extensive and run in both directions: some inputs pass the JSON Schema and fail the SHACL, and others do the reverse.

- **Value rules differ.** SHACL fixes the unit for most battery quantities (for example `batteryWeight` to kg or g). JSON Schema accepts any measurement unit there. SHACL also checks controlled-vocabulary membership with SPARQL, where JSON Schema only checks the IRI prefix pattern.  
- **Some bounds exist in only one format.** JSON Schema forbids negative `commercialWarrantyPeriod` and requires a date-time offset on `lastUpdate`. SHACL allows both.  
- **Closedness differs.** JSON Schema sets `additionalProperties: false` on several objects. SHACL leaves those objects open.  
- **`contentSpecificationIds` is handled differently.** JSON Schema allows an empty array. SHACL requires exactly one release identifier per family, which is enforced only when the matching shapes are loaded together.  
- **Property sets differ for the subgroup restricted tiers and for IND/LMT public.** Details in section 5\.  
- **Some things agree.** The SEM message ID for each property is identical in both formats. The required-property sets agree wherever either format defines one.

The guide says all downstream JSON schema files "are compiled from the master SHACL shape files". The differences above contradict that statement. Whether they are errors or intended is for the publisher to confirm. This report does not assume either.

## 2\. How this was checked

- **Executed:** 10 targeted cases, each run through Ajv 8.20.0 (JSON Schema, `strict: false`, `ajv-formats`) and through pyshacl 0.40.2 with rdflib 7.6.0 (SHACL). Harness: `verification/` in this folder.  
- **Mechanical comparison, all 36 pairs:** property names, required sets, and SEM message IDs, extracted from each file and compared.  
- **Read from source:** the constraint-level differences in sections 3 and 4\. Each claim cites the file it comes from.  
- **Not checked:** JSON-LD expansion, which is needed to see how SHACL handles unknown keys (SEM-COM-MSG-013). The harness writes RDF directly, so the JSON-LD route is untested.

## 3\. Executed results

| Case | Input | JSON Schema (Ajv) | SHACL (pyshacl) |
| :---- | :---- | :---- | :---- |
| C1 | `contentSpecificationIds: []` (core) | PASS | FAIL SEM-MSG-009 |
| C2 | `granularity` \= `granularity-level#bogus` (core) | PASS | FAIL SEM-MSG-003 |
| C3 | `lastUpdate` \= `2026-11-03T10:00:00` (no offset) | FAIL (format date-time) | PASS |
| C4 | `batteryWeight` unit \= `ampereHour` (pub) | PASS | FAIL SEM-BAT-MSG-021 |
| C5 | `manufacturerIdentification` with extra key `manufacturerId` | FAIL (additionalProperties) | PASS |
| C6 | `commercialWarrantyPeriod` \= \-1 | FAIL (minimum 0\) | PASS |
| C7 | `minimalVoltage` valueRange unit \= `ohm` (must be degreeCelsius) | PASS | FAIL SEM-BAT-MSG-091 |
| C8 | `batteryCategory` \= `battery-category#bogus` | PASS | FAIL SEM-BAT-MSG-009 |
| C9 | `granularity` \= `granularity-level#model` on the battery public shape | PASS (core pattern) | FAIL SEM-MSG-003 (must be `item`) |
| C10 | `extinguishingAgent` \= plain string `"CO2"` | FAIL (type object) | FAIL SEM-BAT-MSG-025 |
| C11 | 2+ languages (e.g. `@en-GB` and `@de-DE`) on `notInUseTemperatureRangeTest` or any `wasteBatteryPreventionManagementInfo` field | PASS (multiLanguage allows  ≥1 ≥1 keys) | FAIL SEM-BAT-MSG-035 / 047..058 |
| C12 | Non-object primitive (e.g. `"hello"` or `123`) on `res1`/`res2`/`res3` | PASS (missing root type: object) | No Result |

C1, C2, C4, C7, C8 and C9 pass JSON Schema and fail SHACL. C3, C5 and C6 fail JSON Schema and pass SHACL. C10 fails both, but for different reasons.

## 4\. Constraint-level differences (read from source)

### 4.1 Constraints only in SHACL

- **Fixed units on battery quantities** (`battery-public` shape; the JSON Schema only checks the unit IRI pattern for measurement units):  
  - `batteryWeight`: kg or g (`SEM-BAT-MSG-021`)  
  - `batteryCapacity`: Ah or mAh (`SEM-BAT-MSG-022`)  
  - `renewableContentShare`: percent (`SEM-BAT-MSG-090`)  
  - `minimalVoltage`, `nominalVoltage`, `maximumVoltage`: volt, and the range unit must be degreeCelsius (`SEM-BAT-MSG-091`, `027`, `028`)  
  - `originalPowerCapability`: watt (`029`)  
  - `powerLimit`: watt, and the range unit is degreeCelsius or absent (`030`)  
  - `internalCellResistance`, `internalPackResistance`: ohm (`039`, `040`)  
  - `cycleLifeDischargeCRate`: reciprocal hour (`042`)  
  - EVB subgroup: `capacityExhaustionThreshold`, `initialRoundTripEnergyEfficiency`, `roundTripEfficiencyAtHalfCycleLife`: percent; `cycleLifeChargeCRate`: reciprocal hour. The JSON Schema uses `unitValue` with any unit. (Verified for EVB only; the IND and LMT units were not checked.)  
  - Res3 battery level: `roundTripEnergyEfficiency` and `roundTripEnergyEfficiencyFade` are percent only (`070`, `071`).  
- **Controlled-vocabulary membership** via SPARQL `skos:inScheme` checks: `granularity` (core), `dppStatus`, `batteryCategory`, `batteryChemistry`, `criticalRawMaterials`, `chemicalSymbol`, `batteryStatus`. The JSON Schema checks only the IRI prefix pattern. C8 shows the effect.  
- **Fixed value:** `granularity` must be `granularity-level#item` on the battery public shape (`hasValue`). Core allows model, batch or item. C9 shows the effect.  
- **Language tags on literals:** `rdf:langString` datatype for multilingual fields, plus a SPARQL check that each language tag matches `^[A-Za-z]{2}-[A-Za-z]{2}$` (`SEM-COM-MSG-012`).  
- **Fixed boolean:** `separateCollectionSymbol` must be `true`. The JSON Schema also uses `const: true`, so this one agrees.  
- **Subgroup-specific rules:** IND and LMT public SHACL shapes define `capacityExhaustionThreshold`, which their JSON Schemas do not define (see 5). The unit for that property in IND and LMT was not checked.  
- **Single-language restriction (`sh:maxCount 1`) on 11 of 12 multilingual fields:** In `pub-batteries-shapes.ttl`, `notInUseTemperatureRangeTest` (`SEM-BAT-MSG-035`) and all 10 properties of `wasteBatteryPreventionManagementInfo` (`SEM-BAT-MSG-047` to `058`) set `sh:maxCount 1` alongside `sh:datatype rdf:langString`. Because each language translation in RDF is a separate triple, providing more than one language fails SHACL validation (C11), whereas JSON Schema (`$defs/multiLanguage`) permits any number of language keys (`minProperties: 1`). Only `bat:extinguishingAgent` omits `sh:maxCount 1` in SHACL.

### 4.2 Constraints only in JSON Schema

- **Numeric bound:** `commercialWarrantyPeriod` must be \>= 0 (C6). SHACL uses `xsd:integer` with no bound.  
- **Date-time offset:** `lastUpdate` requires a timezone offset (C3). SHACL uses `xsd:dateTime`, which does not.  
- **Closed objects (`additionalProperties: false`):** `manufacturerIdentification`, `manufacturerContactDetails`, `batteryIdentification`, `manufacturingPlace`, `notInUseTemperatureRange`, `wasteBatteryPreventionManagementInfo`, and the `relatedResource` / `valueRange` definitions in `common.schema.json`. SHACL leaves all of these open (C5).  
- **Array form:** `batteryChemistry`, `hazardousSubstances`, `criticalRawMaterials`, `chemicalSymbol`, `powerLimit`, `numberOfChargingCycles`, `numberOfDischargingCycles`, and `stateOfChargeHistogram` are JSON arrays, with `uniqueItems` on several. SHACL does not restrict cardinality on these, so a single value is valid SHACL.  
- **Minimum items:** `environmentalConditionHistogram` and `stateOfChargeHistogram` require at least one item. SHACL has no equivalent.  
- **Date format:** `manufacturingDate` uses the pattern `^\d{4}-\d{2}$` in JSON. SHACL uses `xsd:gYearMonth`, which also allows an optional timezone. Minor.  
- **Missing root `type: object` and misplaced `additionalProperties: false`:** Only `core.schema.json` declares `"type": "object"` at the root. Because `res1`, `res2`, and `res3` do not `$ref` `core.schema.json`, non-object primitives pass JSON Schema validation on those tiers. Additionally, in `res3-batteries.schema.json`, `"additionalProperties": false` is placed on the `"environmentalConditionHistogram"` array (where it is a no-op) instead of its enclosing object `environmentalConditionHistogramSet`.

### 4.3 Same rule, different strictness

- **`contentSpecificationIds`:**  
  - Core JSON Schema: each item matches `core|product/...|subgroup/...`, `uniqueItems`, no minimum count. An empty array passes (C1).  
  - Core SHACL: exactly one value matching `core/\d+\.\d+\.\d+` (`qualifiedMinCount` \= `qualifiedMaxCount` \= 1).  
  - Battery public SHACL: exactly one value matching `product/batteries/\d+\.\d+\.\d+`.  
  - Subgroup SHACL: exactly one value matching `product/batteries/subgroup/<name>/\d+\.\d+\.\d+`.  
  - The guide says "At least two values, referencing a core release and a product release". Neither format enforces that alone.  
- **`granularity`:** JSON: any granularity-level IRI (C9 passes). Core SHACL: any member of the scheme. Battery public SHACL: must be `item`.  
- **`extinguishingAgent` and other multilingual fields:**  
  - JSON Schema: a language-map object (`multiLanguage`), with keys matching the language-tag pattern. The value must be an object.  
  - SHACL: `rdf:langString`, with the same tag pattern enforced by SPARQL.  
  - These are two representations of the same concept. Only JSON-LD expansion would map one to the other. C10 shows that a plain string fails both.  
- **`manufacturerContactDetails`:** JSON requires `anyOf` website or email, plus `format: uri`. SHACL requires `sh:or` of the two with `xsd:anyURI`. Same intent.  
- **`batteryIdentification`:** JSON uses `anyOf` plus `dependentRequired` in both directions. SHACL uses `sh:or` plus two node shapes that require batch and model together. Same intent. Not executed.  
- **`notInUseTemperatureRange`:** JSON requires a multilingual `test` and a `valueRange`. SHACL requires a `langString` test plus a value-range shape. The SHACL shape's unit requirement on the valueRange is not stated beyond the shape. Not verified.

### 4.4 Structure and composition

- **JSON Schema composes with `allOf` and `$ref`:** pub battery → core, subgroup → pub battery → core, resource / common via `$ref` into `common.schema.json`.  
- **SHACL does not import:** no `owl:imports` or `sh:node` from battery shapes into core. Every shape targets `dpp:DigitalProductPassport`. A validator sees each loaded shape applied to the same node, with no inheritance.  
- **Subgroup SHACL shapes repeat no base properties.** `pub-evb-shapes.ttl` defines only the six EVB-specific properties. The base properties are checked only if `pub-batteries-shapes.ttl` is loaded alongside.  
- **Subgroup selection:** neither format maps `batteryCategory` to a subgroup. The mapping is implied by folder and file names only.  
- **Restricted tiers:** the res1, res2 and res3 battery JSON Schemas do not `allOf` core. The `contentSpecificationIds` check for those tiers exists only in the SHACL.  
- **`resource-shapes` (SHACL):** has no target, so it applies only where a `sh:node` references it.

## 5\. Property-set differences (mechanical comparison)

Compared per file: top-level property names in the JSON Schema versus the SHACL property paths on the targeted shape.

| File | In SHACL, not in JSON |
| :---- | :---- |
| `pub-ind` | `capacityExhaustionThreshold` |
| `pub-lmt` | `capacityExhaustionThreshold` |
| `res3-evb` | `remainingCapacity`, `remainingPowerCapability`, `remainingRoundTripEfficiency`, `selfDischargingRateSet`, `ohmicResistance` |
| `res3-ind` | `stateOfCertifiedEnergy` |
| `res3-lmt` | `stateOfCertifiedEnergy` |

Within each format the three subgroups also disagree with each other:

- `stateOfCertifiedEnergy`: JSON EVB yes, JSON IND no, JSON LMT no. SHACL EVB yes, IND yes, LMT yes.  
- `remaining*`, `selfDischargingRateSet`, `ohmicResistance`: JSON EVB no, JSON IND yes, JSON LMT yes. SHACL all three yes.

No other file pair differs in property names. Base pub, base res1/res2/res3, and the EVB pub and res1/res2 match.

## 6\. Mechanical agreements

- **SEM message IDs:** for every property that exists in both formats, the JSON `message.type` equals the SHACL `sh:message`. No drift in any pair checked.  
- **Required sets:** JSON `required` and SHACL `minCount >= 1` agree in every file where either format sets one. IND public and IND/LMT res1/res2 define neither.

## 7\. Other points (reported earlier, not re-verified here)

- `core-shapes.ttl`: `resource-shapes` has no target (confirmed above).  
- The battery vocabulary declares `owl:versionInfo "1.0.0"` twice.  
- The battery context `@base` points to the core vocabulary rather than the battery vocabulary.  
- The contexts and shapes have no licence. Only the vocabulary files carry EUPL-1.2.  
- Ajv in strict mode refuses the schemas outright, because of the non-standard `message` keyword (verified). Any Ajv use needs `strict: false` or the keyword stripped.

The first three bullets came from an earlier read of the files and were not re-run.

## 8\. Questions for the publisher

These are questions, not conclusions:

1. Are the JSON Schemas generated from the SHACL, as the guide says? If yes, which of the differences in sections 4 and 5 are intended?  
2. Should `contentSpecificationIds` be exactly one per family (SHACL), or at least two in total (guide text), or any (JSON Schema)?  
3. Is `granularity` `item` only for batteries, or any of model, batch, item (SHACL core)?  
4. Should subgroup and IND/LMT property sets match between the two formats? Which set is correct for each subgroup?  
5. Are the unit fixes (kg, Ah, volt, degreeCelsius and so on) intended as hard rules, or only as examples?  
6. Is `lastUpdate` required to carry an offset?  
7. Are closed objects (`additionalProperties: false`) intended as hard rules?