# Iron and Steel Data Architecture Design

## 1. Overview
This document serves as the persistent system design record for the Iron and Steel Digital Product Passport (DPP). It outlines the architectural decisions for the JSON schema, JSON-LD context mapping, and the backing OWL/RDF ontology definitions, reflecting consensus on ESPR requirements and Mill Test Certificate (MTC) parameter integration.

## 2. JSON Schema (`iron-steel.schema.json`)

### 2.1 Decoupling from Base Schemas
The schema **does not inherit** from `dpp.schema.json` nor `general-product.schema.json` using `allOf`.
- The DPP headers (`uniqueProductIdentifier`, `contentSpecificationIds`) are validated at the root envelope level of the serialization rather than inside the sector specific module.
- Identical fields commonly found in `general-product.schema.json` (such as GTIN, serial numbers) are explicitly defined inside `iron-steel.schema.json` to prevent catastrophic failures if the general specifications become deprecated.

### 2.2 Flat Data Structures
Following explicit guidance from stakeholders, domain-specific properties like MTC fields (e.g., `yieldStrength`, `carbonContent`) are flattened dynamically to the root layout of the payload. They are deliberately **not** nested inside an `"mtc": {}` wrapper object.

### 2.3 Substances of Concern
The `substancesOfConcern` payload utilizes `component.schema.json` but is extended inline.
- Added components: `casNumber`, `ecNumber`, `iupacName`, and `locationInProduct`.
- `locationInProduct` is scoped inside the `substancesOfConcern` array items to strongly link the exact material to its location, avoiding a loose root definition.

## 3. JSON-LD Context (`dpp-iron-steel.context.jsonld`)

### 3.1 Flat Map Linking
The flat root-level keys of the JSON schema are explicitly linked to unique, well-defined URI ontology paths. For example, the JSON key `"yieldStrength"` strictly resolves to `"dppk:steelYieldStrength"`.

### 3.2 Nested Component Scoping
For non-tabular structures, Kepler's nested context paradigm is enforced. 
Inside the `"substancesOfConcern"` grouping, a nested `@context` allows the generic JSON key `"locationInProduct"` to be mapped directly to the precise `"dppk:substanceLocationInProduct"` URI, avoiding cross-contamination with other "locations".

## 4. Sector Ontology (`IronSteel.jsonld`)

A strict requirement of the DPP Keystone semantic architecture is that **every single term** mapped in the JSON-LD context must be definitively declared in the ontology.

Ontology properties are established with the following required axioms:
- **`rdfs:label` / `rdfs:comment`:** Declared in 24 languages (English base established during draft implementations).
- **`dppk:governedBy`:** Explicit linkage to the governing physical standards dictating the definition. For example, mechanical variables from the MTC are annotated with `EN 10168` or `EN 10204`.
- **`dppk:unit`:** Prescribed measurement strings where applicable (e.g. `MPa`, `%`, `mm`).
- **`dppk:visibility`:** An ontological directive dictating the data privacy configuration (`PUBLIC` vs `RESTRICTED`). For example, `purchaserOrder` and `cbamReportId` are marked explicitly as `RESTRICTED` or governed by legitimate interest, while environmental/mechanical properties form the `PUBLIC` tier.
- **`rdfs:term_status`:** Enforced as `"unstable"` for all new terms introduced during the draft phases per strict contributor guidelines.

## 5. External Tooling & Future Prospects
There are concurrent industry proposals (such as the S1Seven material-identity schemas for EN 10168). While the Keystone project aims to adopt established structures to avoid reinventing the wheel, the core semantic logic defined in this ontology ensures that regardless of the incoming JSON structure (S1Seven standard or bespoke), the flat-mapping validation rules applied to the semantic URI layer guarantee uniform reporting to the European regulators.

## 6. Follow-on Implementation Plan

#### Step 1: Resolve Schema and Ontology Technical Debt
- **1.1. (PENDING)** Revisit `casNumber`, `ecNumber` and `iupacName` definitions. Evaluate whether they should be consolidated into acceptable URI mappings rather than relying on disparate string formats.

#### Step 2: Address Validation and Missing Attributes
*Validation Error Resolution*:
- **2.1. (COMPLETE)** Fix missing unit for `dppk:yieldStrengthRatio` (`IronSteel.jsonld`) - Expected: `unitless`
- **2.2. (COMPLETE)** Fix missing unit for `dppk:relativeRibArea` (`IronSteel.jsonld`) - Expected: `unitless`
- **2.3. (COMPLETE)** Fix missing unit for `dppk:radiometricControl` (`IronSteel.jsonld`) - Expected: `Bq/g`
- ~~**2.4. (DROPPED)** Fix schema mismatch: map `serialNumber` in `dpp-iron-steel.context.jsonld` to `dppk:serialNumber`~~ (Subsumed by base UPI).
- ~~**2.5. (DROPPED)** Fix schema mismatch: map `manufacturerName` in `dpp-iron-steel.context.jsonld`.~~
- ~~**2.6. (DROPPED)** Fix schema mismatch: map `manufacturerAddress` in `dpp-iron-steel.context.jsonld`.~~
- ~~**2.7. (DROPPED)** Fix schema mismatch: map `importerName` in `dpp-iron-steel.context.jsonld`.~~
- ~~**2.8. (DROPPED)** Fix schema mismatch: map `importerAddress` in `dpp-iron-steel.context.jsonld`.~~
- **2.8b (COMPLETE)** Refactor `iron-steel.schema.json` to remove flat importer/manufacturer fields and insert the `manufacturerInfo` object pattern from the battery schema.

*Missing Attribute Additions*:
- **2.9. (COMPLETE)** Added missing ESPR attributes (`countryOfOrigin`).

*Restored Identifiers*:
- **2.10. (COMPLETE)** Restore `heatNumber`
  - [x] Add to schema
  - [x] Add to ontology and review exact fit
  - [x] Add to context
- **2.11. (COMPLETE)** Restore `productNumber`
  - [x] Add to schema
  - [x] Add to ontology and review exact fit (Restored strict `dppk:productNumber` for EN 10168 compliance)
  - [x] Add to context
- **2.12. (COMPLETE)** Restore `castNumber`
  - [x] Add to schema
  - [x] Add to ontology and review exact fit
  - [x] Add to context
- **2.13. (COMPLETE)** Restore `lotNumber`
  - [x] Add to schema
  - [x] Add to ontology and review exact fit
  - [x] Add to context
- **2.14. (COMPLETE)** Move `locationInProduct` to core Product ontology
  - [x] Remove from `IronSteel.jsonld`
  - [x] Add to `Product.jsonld` under the Component definition
  - [x] Update mapping in `dpp-iron-steel.context.jsonld`

#### Step 3: Tooling Integration
- **3.1. (COMPLETE)** Integrate the new Iron and Steel schema into the DPP wizard.
  - **3.1.a (COMPLETE)** Ensure that urls are remapped for integration tests (test-helpers.mjs)
- **3.2. (COMPLETE)** Integrate the new schema and ontology into the dpp validator html page.
- **3.3. (COMPLETE)** Add Iron and Steel support to the CSV Adapter.
- **3.4. (COMPLETE)** Add equivalency annotations (schema.org, gs1.org, un-cefact/unece).
- **3.5. (COMPLETE)** Add Iron and Steel support to the schema.org transformation library.

#### Step 4: Localization (Future Session)
- **4.1. (PENDING)** Translate Iron and Steel ontology labels and comments into the remaining 23 official EU languages.

#### Step 5: Future Architecture & Refactoring Tasks
- **5.1. (PENDING)** Refactor `schema.org` monolithic profile into a plugin/decorator architecture.
  - Break `dppToSchemaOrgProduct` into `core.js` and dynamically loaded sector decorators (`sectors/battery.js`, `sectors/iron-steel.js`, etc.) using a registry.
