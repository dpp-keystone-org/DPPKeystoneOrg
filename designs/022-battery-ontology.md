# 022 - Battery Ontology Overhaul

## Objective
Overhaul the battery sector schema and ontology based on updated guidance and best practices from the Construction/DOPC data models.

## Workflow

### Phase 1: Preparation & Analysis
1.1 [COMPLETED] Create a script to strip `rdfs:comment` and `rdfs:label` from ontology files to facilitate easier analysis by AI. (`scripts/strip-ontology-annotations.mjs`)
1.2 [COMPLETED] Read the stripped DOPC ontology and the new battery data spreadsheet.
1.3 [COMPLETED] Flesh out the detailed design for the battery data model structure and DPP Wizard changes.

### Phase 2: Implementation (Detailed Design)

2.1 [COMPLETED] **Define Core Ontology Structure (`src/ontology/v1/sectors/Battery.jsonld`)**
   - Create a new ontology file replacing the existing one.
   - Define the main class `dppk:BatteryProduct` (renamed from `BatteryPassport`).
   - Map CSV rows to properties using the "Attribute" and "Name as per DPP Standards" columns.
   - **Grouping Strategy:** Use `rdfs:seeAlso` on high-level properties to group related "leaf" properties (similar to DOPC structure).
   - **Metadata Application:**
     - `dppk:governedBy` <- "Regulation Reference"
     - `dppk:unit` <- "Unit of attribute"
     - `rdfs:comment` <- "Requirements per Regulation" + "Description"
     - `rdfs:label` <- "Attribute" name.
   - **Refinement:** Imported `dppk:epd` and `dppk:dopc` from Core ontologies.
   - **Refinement:** Removed redundant identifiers (`batteryPassportId`, `batteryId`).
   - **Refinement:** Refactored `materialComposition`, `hazardousSubstances` to reuse `dppk:Component`.
   - **Refinement:** Refactored `recycledContent` into `preConsumerRecycledMaterialComposition` and `postConsumerRecycledMaterialComposition` reusing `dppk:Component`.

2.2 [COMPLETED] **Update Context Definitions (`src/contexts/v1/dpp-battery.context.jsonld`)**
   - Ensure all new terms are correctly mapped in the JSON-LD context.
   - Handle namespace imports for `dppk`, `schema`, `dcterms`.
   - Imported Core, EPD, and DoPC contexts.
   - Aligned context keys with ontology changes (e.g., `BatteryProduct`).

2.3 [COMPLETED] **Update JSON Schemas**
   - Replaced `src/validation/v1/json-schema/battery.schema.json` with a rewrite matching the new ontology (BatteryProduct, refactored components, nested performance).
   - Confirmed `src/validation/v1/json-schema/construction.schema.json` already supports polymorphic `dopc`.

2.4 [COMPLETED] **Create Example Data (`src/examples/battery-dpp-v2.json`)**
   - Created `src/examples/battery-dpp-v2.json` demonstrating the new structure, including `preConsumerRecycledMaterialComposition`, nested `performance` stats, and polymorphic `dopc` link.

2.5 [COMPLETED] **Update SHACL Shapes (`src/validation/v1/shacl/battery-shapes.shacl.jsonld`)**
   - Rewrote the SHACL shapes to validate the new ontology structure (BatteryProduct, nested performance, etc.) when `draft_battery_specification_id` is present.
   - Updated property paths to match the new ontology (e.g., `dppk:manufacturingDate`, `dppk:batteryMass`).

2.6 [PENDING] **Fix Test Breakages**
   - Run relevant tests (unit/integration) and fix any regressions caused by the ontology/schema/context changes.
   - Ensure the new example data passes validation.

2.7 [PENDING] **Wizard Adjustments**
   - Verify Wizard support for `rdfs:seeAlso` grouping.
   - **New Feature:** Implement UI support for `oneOf` / Union types.
     - User should be able to switch between "Structured Input" and "Upload/Link Resource" modes for fields like `dopc`.

2.8 [PENDING] **Verify & Cleanup**
   - Run ontology integrity scripts.
   - Verify the generated Wizard form against the new schema.

### Phase 3: Ontology Enrichment (Annotations)

3.1 [COMPLETED] **Update Labels and Comments (`src/ontology/v1/sectors/Battery.jsonld`)**
   - Mapped `rdfs:label` to the "Attribute" column from the longlist CSV.
   - Mapped `rdfs:comment` to a summary of regulations and DIN DKE Spec recommendations.
   - Enriched all property sections including Identifiers, Carbon Footprint, Supply Chain, Materials, and Performance.
   - **Refinement:** Converted all `rdfs:label` and `rdfs:comment` strings to language-tagged objects (`@language": "en"`).

3.2 [COMPLETED] **Update Governance and Source (`src/ontology/v1/sectors/Battery.jsonld`)**
   - Mapped `dppk:governedBy` to "Regulation Reference" from the CSV.
   - Mapped `dcterms:source` to the DIN DKE Spec 99100 URL (`https://www.dinmedia.de/en/standard/din-dke-spec-99100`) for all mapped properties.
