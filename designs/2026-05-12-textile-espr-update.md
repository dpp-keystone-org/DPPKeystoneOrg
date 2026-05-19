# Design Doc: 2026-05-12 Textile ESPR Update

## Summary
Reconciles the EU Joint Research Centre (JRC) Ecodesign presentation against industry JSON templates, leveraging existing Keystone patterns to support new ESPR metrics without breaking legacy ISO testing objects.

## Implementation Plan

### [COMPLETED] Step 0: Schema Architecture Decision
*   Plan: Determine whether to update the existing `textile.schema.json` or create a new `textile-espr.schema.json`.
*   **[COMPLETED] Step 0.1: Decide Schema & Context Separation**
    *   **Decision:** We will create distinct `textile-espr.schema.json` and `dpp-textile-espr.context.jsonld` files alongside the existing ones. This allows branch reviewers to compare them side-by-side. Our final step (Step 10) will be to decide whether to overwrite the legacy files entirely.

### [PENDING] Step 1: Component Specs & Substances of Concern
*   Plan: We will heavily leverage `component.schema.json`.
*   **[PENDING] Step 1.1: Component Specs & Context Mapping**
    *   **[COMPLETED] Step 1.1.a: Schema Injection**
        *   We have mapped the JRC "Component Specifications" requirement, as well as `substancesOfConcern` and `fibreComposition`, to arrays referencing `component.schema.json` in the JSON schema.
    *   **[COMPLETED] Step 1.1.b: Context mapping for `components` (Core Refactor)**
        *   Refactor `dpp-core.context.jsonld` to introduce a scoped context for the generic `components` object.
        *   This decouples generic JSON keys by mapping them to dedicated URIs (e.g., `dppk:componentName`, `dppk:componentPercentage`, `dppk:componentIdentifier`, `dppk:componentCasNumber`, `dppk:componentEcNumber`, `dppk:componentIupacName`, and `dppk:componentLocationInProduct`).
        *   **[COMPLETED] Task 1.1.b.1:** Search the project for usage of old generic properties (`dppk:percentage`, `dppk:casNumber`, `dppk:ecNumber`, `dppk:iupacName`, `dppk:locationInProduct`).
        *   **[COMPLETED] Task 1.1.b.2:** If safe, remove the old generic properties from `Product.jsonld` and related context files.
        *   **[COMPLETED] Task 1.1.b.3:** Standardize Battery (`materialComposition`, `hazardousSubstances`) and Iron-Steel (`substancesOfConcern`) to use the new scoped `dppk:component*` terms.
        *   **[COMPLETED] Task 1.1.b.4:** Deprecate and remove the redundant `dppk:SubstanceOfConcern` class from `Compliance.jsonld`.
    *   **[COMPLETED] Step 1.1.c: Context mapping for `substancesOfConcern` (Textile)**
        *   In `dpp-textile-espr.context.jsonld`, define `substancesOfConcern` and map its nested keys to the generic `dppk:component*` terms (following the Iron-Steel/Battery pattern).
    *   **[COMPLETED] Step 1.1.d: Context mapping for `fibreComposition` (Textile)**
        *   In `dpp-textile-espr.context.jsonld`, define `fibreComposition` and map its nested keys to the generic `dppk:component*` terms (following the Iron-Steel/Battery pattern).
*   **[COMPLETED] Step 1.2: Substances of Concern (SoC)**
    *   We will transition Textile (and Iron & Steel) from inline SoC objects to use `component.schema.json` (just like Battery does for `hazardousSubstances`).
*   **[COMPLETED] Step 1.3: Update to Component Schema**
    *   We will add optional `casNumber` and `location` fields to `component.schema.json` to fully support SoC requirements across all sectors.

### [COMPLETED] Step 2: Materials (Organic & Recycled Content)
*   Plan: Instead of simple percentage fields, we will treat these as material components.
*   **[COMPLETED] Step 2.1: Add Organic & Recycled Components**
    *   We will add `organicMaterialComposition` and `recycledMaterialComposition` arrays to the Textile schema, both referencing `component.schema.json`.

### [COMPLETED] Step 3: Certifications
*   Plan: Instead of a generic `RelatedResource`, we will define a specific property.
*   **[COMPLETED] Step 3.1: Define textileCertifications**
    *   We will define `textileCertifications` to inherit from/align with GS1/Schema.org certification models to ensure direct mapping.
*   **[COMPLETED] Step 3.2: Clean up Schema Descriptions**
    *   *Note: Remove the temporary `description` fields from `certification.schema.json` once the terms are formally defined and documented in the ontology.*
*   **[COMPLETED] Step 3.3: Update any breakages**
    *   Address any test failures or integration issues caused by the certification schema updates.

### [PENDING] Step 4: Instructions & Repair
*   Plan: We will use the robust `RelatedResource` pattern for complex document links.
*   **[PENDING] Step 4.1: Safe Use & Disassembly (EoL)**
    *   Add `safeUseInstructions` and `endOfLifeInstructions` to Textile as `RelatedResource`s.
*   **[COMPLETED] Step 4.2: Repair Instructions**
    *   Add `repairInstructions` as a `RelatedResource`.
*   **[COMPLETED] Step 4.3: Repair Services**
    *   Add `repairServices` (mapping to our `Organization` schema).
*   **[COMPLETED] Step 4.4: Warranty**
    *   Add `warrantyDuration` (using string type for flexibility).

### [PENDING] Step 5: ESPR Categorization (The Content Spec ID Approach)
*   Plan: Rather than adding an `esprCategory` data field, we will solve this at the architectural level.
*   **[PENDING] Step 5.1: Introduce new Content Spec ID**
    *   Introduce `draft_textile_espr_specification_id`. This allows the DPP to clearly declare it is following the new ESPR rules alongside or instead of legacy textile rules.

### [PENDING] Step 6: Environmental Metrics (Carbon Footprint)
*   Plan: We will add two straightforward fields to accommodate the JRC footprint requirements without over-engineering them.
*   **[PENDING] Step 6.1: Add Carbon Footprint Fields**
    *   `productCarbonFootprint` (Absolute value object with value/unit).
    *   `carbonFootprintBenchmarkPercentage` (A simple numeric percentage field representing the delta against the benchmark).

### [PENDING] Step 7: Scores & Physical Tests
*   Plan: The new ESPR high-level scores and tests will live alongside our existing granular ISO tests.
*   **[PENDING] Step 7.1: Add Scores**
    *   Add `robustnessScore` & `recyclabilityScore` (0-10 numeric scale).
*   **[PENDING] Step 7.2: Add Physical Tests**
    *   Add `spirality` (%), `dimensionalChange` (%), and `visualInspection` (pass/fail or test result string).

### [PENDING] Step 8: GS1 Apparel Standards & Labelling
*   Plan: Leverage existing general-product architecture.
*   **[PENDING] Step 8.1: General GS1 Fields**
    *   Fields like `apparelSize`, `color`, and `brand` are already supported by our `general-product` architecture.
*   **[PENDING] Step 8.2: Animal Origin Label**
    *   `animalOriginNonTextile` will be added as a simple boolean (`true`/`false`) as required by the EU Textile Labelling Regulation.
*   **[PENDING] Step 8.3: Ontology Equivalency Sweep**
    *   Make an explicit sweep to mark `schema.org`, `gs1.org`, and UNECE equivalencies (e.g., using `skos:exactMatch` or `owl:sameAs`) wherever appropriate for any new ontology terms introduced in the previous steps.

### [PENDING] Step 9: Final Review & Verification
*   Plan: Explicitly review the finished schema and ontology context to ensure complete alignment with the source material, and add integration tests.
*   **[PENDING] Step 9.1: Source Material Verification**
    *   Cross-reference the final JSON schema and JSON-LD context against the original JRC Ecodesign slides and industry templates.
    *   Confirm that every required term is fittingly represented, mapped, and typed.
*   **[PENDING] Step 9.2: Test Suite Coverage**
    *   Add Playwright and wizard flow integration test scenarios specifically covering the new ESPR textile schema elements to prevent future regressions.

### [PENDING] Step 10: Validation and Outputs (Schema.org Adapter & Examples)
*   Plan: Ensure that the new ESPR structures are correctly translated by the transformation engine and backed by concrete examples.
*   **[PENDING] Step 10.1: Update schema.org adapter**
    *   Update `src/util/js/common/transformation/profiles/schema.org.js` to extract and map the new ESPR textile attributes (`textileCertifications`, `safeUseInstructions`, `organicMaterialComposition`, `recycledMaterialComposition`, etc.) into standard schema.org types.
*   **[PENDING] Step 10.2: Create/Update Textile ESPR Examples**
    *   Create a new comprehensive `textile-espr-dpp-v1.json` (or update an existing textile example) to validate the new JSON validation schema, semantic expansion, and the schema.org output.
