# Technical Review & Recommendations: EU DPP Semantic Artifacts & Guide (v1.0.0)

**Scope:** Review of `DPP Registry – Semantic Data Artifacts/` (v1.0) and *DPP Registry – Semantic Data Guide* (DG GROW G2/B3, 2026-10-30, v1.0) against EN 18223:2026, EN 18219:2026, Regulation (EU) 2024/1781 (ESPR), and Regulation (EU) 2023/1542 (Batteries).  
**Companion Document:** See attached *EU DPP semantic artefacts: **SHACL vs JSON Schema differences*** for the detailed cross-format comparison and test harness results.

---

## Executive Summary

The v1.0 DPP Registry semantic framework establishes **the right architectural foundation for Digital Product Passports**: using W3C SKOS taxonomies and SHACL shapes as the normative source of truth, paired with clean, compact JSON payloads (EN 18223:2026 Clause 5.2) and JSON-LD `@context` mappings. Crucially, this approach avoids the heavy payload bloat and developer friction of expanded metamodel wrappers (such as EN 18223 Annex A) while delivering full semantic rigor and multi-format interoperability.

To help ensure this architecture is rock-solid and resilient in production, we ran an automated QA and linter pass (`Ajv 8.20.0` and `pyshacl 0.40.2` across all 36 SHACL and JSON Schema pairs) alongside a clause-by-clause check against EN 18223:2026 and the EU Battery Regulation (EU) 2023/1542.

Importantly, **none of the issues identified call the underlying architecture into question**. Almost all findings are straightforward v1.0 generator synchronization items, regular-expression typos, or cardinality flags that can be resolved cleanly in a `v1.0.1` point release:

A combined mechanical, execution-based (`Ajv 8.20.0` and `pyshacl 0.40.2`) \- detailed in “ ***SHACL vs JSON Schema differences*** ”, and source-level review of the v1.0 semantic artefacts and accompanying guide identified five categories of issues:

1. **SHACL vs. JSON Schema Divergence (Section 2 & 3):** Despite the Guide stating that JSON Schemas *"are compiled from the master SHACL shape files"*, the two formats enforce different rules and different property sets. Inputs that pass JSON Schema fail SHACL, and vice versa.  
2. **Internal Inconsistencies with the EC Guide (Section 4):** The URI patterns enforced in the schemas and shapes contradict the URI patterns documented in the Guide (e.g., missing `/releases/` segments and inverted `{SemVer}` placement in subgroup `$id`s).  
3. **JSON Schema & Data Modelling Defects (Section 5):** Structural bugs exist across both formats, including missing root `"type": "object"` declarations on restricted schemas, misplaced `"additionalProperties": false` keywords on arrays, scalar counters (`numberOfChargingCycles`) typed as arrays, and restrictive regexes (`[a-zA-Z]+$`) that reject valid battery chemistries containing numbers or hyphens.  
4. **Departures from EN 18223:2026 & Battery Regulation (EU) 2023/1542 (Section 6):** Mandatory EN 18223 header attributes (`dppSchemaVersion`, `economicOperatorId`) are absent, mandatory Battery Regulation fields (`manufacturerContactDetails`) are omitted from `required`, and static public fields (`expectedLifetimeYears`) are misplaced into dynamic restricted views (`res3`).  
5. **Federation & Extensibility Lock-outs (Section 7):** Regex constraints on `contentSpecificationIds` and controlled vocabularies hardcode the `ec.europa.eu` domain on all array items, preventing DPPs from referencing additional CEN standards or federated industry specifications alongside the EC release.

## 1\. Recommendations on Resolving SHACL vs. JSON Schema Differences

As documented in the attached *SHACL vs. JSON Schema Differences* report, the JSON Schemas and SHACL shapes currently diverge in rules and property coverage. To preserve semantic interoperability, JSON-LD compatibility, and alignment with the Battery Regulation, we recommend resolving those differences in the following specific directions:

1. **Subgroup Property-Set Discrepancies (`pub-ind`, `pub-lmt`, `res3-evb`, `res3-ind`, `res3-lmt`)**  
   * **Recommendation \- In general, treat SHACL as Authoritative:**  
   * Cross-checking against Regulation (EU) 2023/1542 Annex VI and Annex VII confirms that the **SHACL shapes contain the legally required properties** (e.g., `remainingCapacity`, `remainingPowerCapability`, `remainingRoundTripEfficiency`, `selfDischargingRateSet`, and `ohmicResistance` in `res3-evb`). The missing properties should be added to the corresponding JSON Schemas.  
2. **Closed Sub-Objects (`additionalProperties: false` in JSON vs. Open Shapes in SHACL)&nbsp;**  
   * **Recommendation \- Keep SHACL Open, Relax JSON Schema:**  
   * **Do not add `sh:closed true` to the SHACL shapes**, as closed shapes break RDF/JSON-LD open-world extensibility and reject `@type` (`rdf:type`) triples unless explicitly exempted on every shape.  
   * In JSON Schema, relax `additionalProperties: false` on sub-objects (or explicitly allow `@id`, `@type`, `@context`, and legal extensions) so JSON-LD payloads and extended `RelatedResource` objects (permitted under EN 18223 Clause 4.1.2.7) are not rejected.  
3. **Multilingual Fields (`$defs/multiLanguage` vs. `rdf:langString`)**  
   * **Recommendation \- Keep Representation, Remove `sh:maxCount 1` in SHACL:**  
   * Using a language-map object (`{"en-IE": "..."}`) in JSON and `rdf:langString` in SHACL is **correct by design** for JSON-LD 1.1 (`"@container": "@language"`).  
   * However, in `pub-batteries-shapes.ttl`, **remove `sh:maxCount 1`** from `notInUseTemperatureRangeTest` and the 10 properties of `wasteBatteryPreventionManagementInfo` so DPPs can include multiple EU languages without failing SHACL validation (matching `bat:extinguishingAgent`). In `common.schema.json`, add `"additionalProperties": { "type": "string" }` to `$defs/multiLanguage`.  
4. **Allowing Repeatable `RelatedResource` Entries for Multilingual Documents**  
   * **Recommendation \- Where resources in multiple languages are relevant, ensure that RelatedResource is repeated:**  
   * Properties referencing `$defs/relatedResource` (`euDeclarationOfConformity` in `pub-batteries`; `sparePartReplacementDetails`, `dismantlingInformation`, and `safetyMeasures` in `res1-batteries`; and `complianceTestReportResults` in `res2-batteries`) are currently constrained to a single object in JSON Schema and `sh:maxCount 1` in SHACL.  
   * Because `RelatedResource` carries a single `language` attribute (e.g., pointing to a language-specific PDF manual or Declaration of Conformity) and products often require multiple documents or translations across EU Member States, these properties should be repeatable (`"type": "array"` of `$defs/relatedResource` in JSON Schema, and unbounded `sh:maxCount` in SHACL).  
5. **Array vs. Scalar Cardinalities**  
   * **Recommendation \- Fix Cycle Counters in SHACL & JSON Schema:**  
   * Having unbounded `maxCount` in SHACL and `"type": "array"` in JSON Schema for genuinely multi-valued properties (`batteryChemistry`, `hazardousSubstances`, `criticalRawMaterials`, `chemicalSymbol`, `powerLimit`, `stateOfChargeHistogram`) is normal when paired with `"@container": "@set"` in JSON-LD.  
   * However, `numberOfChargingCycles` and `numberOfDischargingCycles` (`res3-batteries`) are scalar counters that were compiled into JSON arrays because `sh:maxCount 1` was omitted in SHACL. Add `sh:maxCount 1` in SHACL and change both to `"type": "integer"` in `res3-batteries.schema.json`.  
6. **Granularity Restriction on Batteries (`C9`)**  
   * **Recommendation \- Allow `#model`, `#batch`, and `#item` on Public Shape:**  
   * `pub-batteries-shapes.ttl` forces `dpp:granularity` to `granularity-level#item` via `sh:hasValue`, overriding `core-shapes.ttl`. Unless public battery data is strictly forbidden at model/batch level during prototyping, `granularity-level#item` should only be enforced on item-specific telemetry (`res3`).

---

## 2\. Internal Contradictions Between the EC Guide and the Artefacts

1. **Missing `/releases/` Segment in `contentSpecificationIds` Regexes:**  
   * **Guide (Pages 7 & 11):** Defines release URIs as `https://repository.product-passport.ec.europa.eu/core/releases/{SemVer}` and `.../product/{product-name}/releases/{SemVer}`.  
   * **Artefacts (`core.schema.json` & SHACL):** The regex patterns omit `/releases/` (`.../core/\d+\.\d+\.\d+$`). Payloads following the Guide will fail validation.  
2. **Inverted `{SemVer}` Placement in Subgroup `$id`s:**  
   * **Guide (Pages 7 & 20):** Places `{SemVer}` at the subgroup level (`.../product/{product-name}/subgroup/{subgroup-name}/{SemVer}/schemas/...`) to allow independent subgroup versioning.  
   * **Artefacts (`pub-evb.schema.json`, etc.):** Place `1.0.0` at the product level (`.../product/batteries/1.0.0/subgroup/evb/schemas/...`), preventing subgroups from being versioned independently of the parent product group.  
3. **Guide vs. Schema Naming & Context Metadata:**  
   * Guide Pages 19 & 24 refer to `stateCertifiedEnergy`, whereas the schemas and shapes use `stateOfCertifiedEnergy`.  
   * In the battery JSON-LD context, `@base` points to the `core` vocabulary namespace instead of the `batteries` vocabulary namespace.

---

## 3\. Alignment Gaps with EN 18223:2026 & Battery Regulation (EU) 2023/1542

1. **Missing Mandatory EN 18223 Header Fields (`core.schema.json` & `core-shapes.ttl`):**  
   * **EN 18223:2026 Table 1** requires `dppSchemaVersion` (`[1]`) and `economicOperatorId` (`[1]`), plus optional `facilityId` (`[0..1]`).  
   * `dppSchemaVersion` and `economicOperatorId` are missing from both `core.schema.json` and `core-shapes.ttl`. `facilityId` is present in the Core SKOS vocabulary (Guide Page 12\) but omitted from `core.schema.json` and `core-shapes.ttl`.  
2. **Misplacement of `expectedLifetimeYears` and Depleted-Battery Bug (`res3-evb`):**  
   * Under Battery Regulation Annex XIII Point 1(a) and Annex VI Part A(4), expected battery lifetime in calendar years (`expectedLifetimeYears`) is a **public** model-level field, but is currently placed in restricted item-level `res3-evb` instead of `pub-evb`.  
   * In `res3-evb.schema.json`, `expectedLifetimeCyclesRest` (remaining lifetime cycles) sets `"minimum": 1`, which prevents an end-of-life battery with `0` remaining cycles from having a valid DPP. Change to `"minimum": 0`.  
3. **Mandatory Fields Omitted from `required` / `sh:minCount 1`:**  
   * `manufacturerContactDetails` (`pub-batteries`) is optional (`sh:minCount 0` in SHACL, omitted from `required` in JSON Schema), despite being mandatory under Battery Regulation Annex VI Part A(1).  
   * In `res3-batteries`, only `batteryStatus` is required, leaving mandatory Annex VII parameters (`roundTripEnergyEfficiency`, `numberOfChargingCycles`, `negativeEvents`, `stateOfChargeHistogram`, etc.) optional.  
4. **Copy-Paste Bug on `manufacturerEmail` (`format: uri` / `xsd:anyURI`):**  
   * In `manufacturerContactDetails`, `manufacturerEmail` is typed as `"format": "uri"` (JSON Schema) and `xsd:anyURI` (SHACL), rejecting standard email addresses (`"info@example.com"`) unless prefixed with `mailto:`. Change to `"format": "email"` in JSON Schema and `xsd:string` in SHACL.  
5. **Restrictive Vocabulary Regex `#[a-zA-Z]+$` Rejects Valid Chemistries:**  
   * Controlled vocabulary regexes in `core.schema.json` and `pub-batteries.schema.json` (`batteryChemistry`, `chemicalSymbol`, `criticalRawMaterials`, `batteryCategory`) end with `#[a-zA-Z]+$`, which rejects any notation containing digits or hyphens (e.g., `#LiFePO4`, `#NMC811`, `#Na-ion`, `#lead-acid`). Widen to `#[a-zA-Z0-9_-]+$` (matching `common.schema.json`) and escape literal dots (`\\.`) in the domain name.  
6. **Unitless `commercialWarrantyPeriod` & Country Code Mismatch:**  
   * `commercialWarrantyPeriod` (`pub-batteries`) is a bare `integer` without a `$defs/unitValue` or ISO 8601 duration format, leaving its time unit (months vs. years) undefined.  
   * `manufacturingCountry` uses 3-letter ISO 3166-1 alpha-3 (`^[A-Z]{3}$`), whereas language tags and EN 18223 Clauses 4.1.2.7–4.1.2.8 use 2-letter ISO 3166-1 alpha-2.  
7. **Non-Standard `"message"` Keyword in JSON Schemas:**  
   * The custom `"message"` keyword causes standard JSON Schema Draft 2020-12 validators (such as `Ajv` in default strict mode) to fail schema compilation unless strict mode is disabled. Consider moving error codes to `"$comment"` or declaring a custom meta-schema vocabulary.  
8. **No support for product names and labels**  
   * While not of a maximal concern from a mandatory perspective, it would be good to include productName and productLabel as voluntary fields in the dpp core schema or in the sector specific schema for batteries. There may be sectors that prefer not to package this data into the DPP’s low-sensitivity payload because of B2B data governance/protection concerns, but it makes sense to have it available.  
9. **No support for EPD**  
   * It is also noted that no EPD has been implemented so far. We would assume that such an implementation will follow.

---

## 4\. Observations on the OpenAPI Service Contracts (`registry`, `dashboard`, `common`)

Reviewing the accompanying OpenAPI 3.1.0 specifications alongside the semantic artefacts highlights a few areas where the API contracts could be simplified and aligned with the semantic repository:

1. **Keeping the Registration API Sector-Agnostic:**  
   * In `openapi-dpp-registry-public.txt`, `DPPRegistrationSubmissionRequest` uses a hardcoded `oneOf` discriminator mapped to `BatteriesSubmissionRequest` and `BatteriesSubmissionItem` (which itself defines an empty `properties: {}` block). Hardcoding sector-specific schema classes into the OpenAPI contract means the API specification must be modified every time a new ESPR product group is introduced.  
   * Because the Registry resolves the submitted `uniqueProductIdentifier` over HTTPS to validate the DPP payload—and because the DPP payload already declares its applicable specifications via `contentSpecificationIds` (and dynamic product group codes are already exposed via `GET /api/v1/dpp/product-groups`)—the submission contract can remain completely sector-agnostic without per-sector `oneOf` subclasses.  
2. **Aligning Identifiers and Enumerations Across the API and Semantic Layers:**  
   * **Subgroup Codes (`EV` vs. `evb`):** The Registry and Dashboard OpenAPI examples use `productSubGroup: EV`, whereas the Semantic Repository URI paths, schemas, and taxonomies use `evb`.  
   * **Granularity Naming & Values:** The Registry API uses `granularity` with short enum values (`item`, `batch`, `model`), the Dashboard API renames the field to `granularityLevel`, and `core.schema.json` requires the full vocabulary URI (`https://.../granularity-level#item`).  
   * **Confirmation of `granularity: batch` on Batteries (Case C9):** Notably, the Registry OpenAPI example for `DPPRegistrationSubmissionRequest` submits an LMT battery with `granularity: batch`, confirming that `pub-batteries-shapes.ttl` should not restrict `dpp:granularity` exclusively to `#item`.  
3. **Minor OpenAPI Schema Refinements:**  
   * **`submissionItems` Bounds:** The prose description specifies that a submission contains between 1 and 100 items, but `submissionItems` in `BaseDPPRegistrationSubmissionRequest` and `BatteriesSubmissionRequest` omits `minItems: 1` and `maxItems: 100`.  
   * **Optionality of `productSubGroup` in Dashboard Outcomes:** While `BaseDPPRegistrationSubmissionRequest` notes that `productSubGroup` is optional for product groups that do not have subgroups, `DppRegistrationItemOutcomeData` in `openapi-dpp-dashboard-public.txt` lists `productSubGroup` as unconditionally `required`.

---

## 5\. Federation, Composition & JSON-LD Extensibility Recommendations

1. **Allow Federated Specification IDs in `contentSpecificationIds`:**  
   * In `core.schema.json`, placing `^https://repository\.product-passport\.ec\.europa\.eu/...` inside `"items"` forces **every** entry in `contentSpecificationIds` to be an EC repository URL—blocking economic operators from declaring conformance with additional CEN standards or federated industry specifications alongside the EC release.  
   * **Recommendation:** Use JSON Schema `"contains"` (matching the `sh:qualifiedValueShape` approach in SHACL) so the array must include the required EC release URIs while allowing additional federated specification identifiers.  
2. **Decouple `core.schema.json` from `pub-batteries.schema.json`:**  
   * While SHACL shapes and `res1`/`res2`/`res3` JSON Schemas are decoupled mixins composed at validation time, `pub-batteries.schema.json` hardcodes `"allOf": [{ "$ref": ".../core/1.0.0/schemas/core.schema.json" }]`. Hardcoding a pinned `core` version inside product schemas creates diamond-dependency conflicts for multi-category products and prevents reusing product schemas for sub-components.  
3. **Support Short Vocabulary Notations via JSON-LD `@context`:**  
   * Rather than requiring full HTTP IRIs inside raw JSON string values for enumerations and units (diverging from EN 18223 Clause 5.2.4 examples like `"Model"` and `"Active"`), allow short `skos:notation` codes in compact JSON that expand automatically to full SKOS IRIs via `"@type": "@vocab"` in the JSON-LD `@context`.  
4. **Document SKOS Graph Loading Requirement for SHACL Validators:**  
   * Because the SHACL shapes use `SPARQLConstraint` (`FILTER NOT EXISTS { ?concept skos:inScheme ... }`) without `owl:imports`, SHACL validation will fail on every DPP unless the validator pre-loads all referenced SKOS vocabulary `.ttl` files into the data graph prior to validation. This prerequisite should be explicitly documented in the Guide (or `owl:imports` added to the shapes).  
5. **Moving Measurement Units from the Payload (`unitValue`) to the Vocabulary/Ontology Layer:**  
   * **Alignment with EN 18223 Compact Serialization:** Under EN 18223:2026 Clauses 5.2.2 and 5.2.6, a `SingleValuedDataElement` is serialized in compact JSON as a direct scalar key-value pair (e.g., `"recycledContentPercentage": 25.5`), with its semantic metadata and unit defined in the dictionary/ontology. In the current v1.0 artefacts, simple numeric properties (`batteryWeight`, `batteryCapacity`, `renewableContentShare`, `originalPowerCapability`, `internalCellResistance`, etc.) are instead wrapped in complex `$defs/unitValue` objects (`{ "value": ..., "unit": "https://.../measurement-unit#..." }`).  
   * **Payload Redundancy vs. Client Conversion Complexity:**  
     1. Where the SHACL shape already locks a property to a single mandatory unit via `sh:hasValue` (such as `percent` for `renewableContentShare`, `watt` for `originalPowerCapability`, or `ohm` for `internalCellResistance`), requiring every DPP instance to repeat the full unit URI in the payload adds significant verbosity and intermediate RDF blank nodes without adding information.  
     2. Where the SHACL shape permits multiple units (such as `kilogram` or `gram` for `batteryWeight`, and `ampereHour` or `milliampereHour` for `batteryCapacity`), allowing different units in operational payloads forces every downstream DPP client, validator, and market-surveillance query to hardcode unit-conversion logic in order to compare or aggregate values across products.  
   * **Suggestion:** Define a single canonical measurement unit per property directly on the `skos:Concept` in the vocabulary/ontology (e.g., via `dppcom:unit` in `battery-vocabulary.ttl`), and represent simple quantitative properties in the JSON Schema and SHACL shapes as plain scalar numbers (`"type": "number"` / `xsd:decimal`). This keeps the unit machine-readable in the semantic layer while making DPP payloads, SHACL validation, and downstream querying significantly simpler and fully aligned with EN 18223\.  
6. **JSON-LD Context Composition (`@import` and `@protected: true`):**  
   * **Single-Hop Limit on `@import`:** The 3-tier context hierarchy (`subgroup` \$\\rightarrow\$ `product` \$\\rightarrow\$ `core`) relies on `@import`. However, the W3C JSON-LD 1.1 Context Processing Algorithm (Step 5.6.6) explicitly forbids chained `@import` statements: if a context referenced via `@import` itself contains an `@import` entry, compliant JSON-LD 1.1 processors must abort with an `invalid context entry` error. Additionally, `batteries-context.jsonld` uses a relative path (`"../../../../core/1.0.0/contexts/core-context.jsonld"`), which tightly couples the context to a specific folder depth and pins `core/1.0.0`.  
   * **Interoperability Friction from Global `"@protected": true`:** Setting `"@protected": true` across the entire context causes JSON-LD processors to throw a fatal `protected term redefinition` error whenever an implementer combines multiple contexts (e.g., for a multi-category product or when layering a sector/federated context alongside the EC context) that share common field names such as `unit`, `value`, `url`, or `language`.  
   * **Suggestion:** Rather than chaining `@import` with global `"@protected": true`, contexts can be kept modular and composed as a standard JSON-LD `@context` array (`"@context": [".../core-context.jsonld", ".../batteries-context.jsonld", ...]`), which supports multi-layer and multi-category composition in all JSON-LD processors without triggering `@import` or term-redefinition errors.

&nbsp;

&nbsp;