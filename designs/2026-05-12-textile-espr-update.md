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

### [COMPLETED] Step 4: Instructions & Repair
*   Plan: We will use the robust `RelatedResource` pattern for complex document links.
*   **[COMPLETED] Step 4.1: Safe Use & Disassembly (EoL)**
    *   Add `safeUseInstructions` and `endOfLifeInstructions` to Textile as `RelatedResource`s.
*   **[COMPLETED] Step 4.2: Repair Instructions**
    *   Add `repairInstructions` as a `RelatedResource`.
*   **[COMPLETED] Step 4.3: Repair Services**
    *   Add `repairServices` (mapping to our `Organization` schema).
*   **[COMPLETED] Step 4.4: Warranty**
    *   Add `warrantyDuration` (using string type for flexibility).

### [COMPLETED] Step 5: ESPR Categorization (The Content Spec ID Approach)
*   Plan: Rather than adding an `esprCategory` data field, we will solve this at the architectural level.
*   **[COMPLETED] Step 5.1: Introduce new Content Spec ID**
    *   Introduce `draft_textile_espr_specification_id`. This allows the DPP to clearly declare it is following the new ESPR rules alongside or instead of legacy textile rules.

### [COMPLETED] Step 6: Environmental Metrics (Carbon Footprint)
*   Plan: We will add two straightforward fields to accommodate the JRC footprint requirements without over-engineering them.
*   **[COMPLETED] Step 6.1: Add Carbon Footprint Fields**
    *   `carbonFootprint` (Absolute value object with value/unit).
    *   `carbonFootprintBenchmarkPercentage` (A simple numeric percentage field representing the delta against the benchmark).

### [COMPLETED] Step 7: Scores & Physical Tests
*   Plan: The new ESPR high-level scores and tests will live alongside our existing granular ISO tests.
*   **[COMPLETED] Step 7.1: Add Scores**
    *   Add `robustnessScore` & `recyclabilityScore` (0-10 numeric scale).
*   **[COMPLETED] Step 7.2: Add Physical Tests**
    *   Add `spirality` (%), `dimensionalChange` (%), and `visualInspection` (pass/fail or test result string).

### [COMPLETED] Step 8: GS1 Apparel Standards & Labelling
*   Plan: Leverage existing general-product architecture.
*   **[COMPLETED] Step 8.1: General GS1 Fields**
    *   Fields like `apparelSize`, `color`, and `brand` are already supported by our `general-product` architecture.
*   **[COMPLETED] Step 8.2: Animal Origin Label**
    *   `animalOriginNonTextile` will be added as a simple boolean (`true`/`false`) as required by the EU Textile Labelling Regulation.
*   **[COMPLETED] Step 8.3: Ontology Equivalency Sweep**
    *   Skipped explicit schema.org/GS1 mappings for highly specific ESPR terms, as no direct equivalents exist. Mapped `apparelSize` and `textileCertifications`.

### [COMPLETED] Step 9: Final Review & Verification
*   Plan: Explicitly review the finished schema and ontology context to ensure complete alignment with the source material, and add integration tests.
*   **[COMPLETED] Step 9.1: Source Material Verification**
    *   Cross-reference the final JSON schema and JSON-LD context against the original JRC Ecodesign slides and industry templates.
    *   Confirm that every required term is fittingly represented, mapped, and typed.
*   **[COMPLETED] Step 9.1.1: Review Assessment for Hallucinations 1 at a time**
    1.  **[COMPLETED] Compliance with JRC Slides (The ESPR Additions)**
    *   Our new schema is heavily compliant and successfully captures the novel ESPR requirements:
    *   **Instruction Consolidation:** `safeUseInstructions`, `repairInstructions`, `endOfLifeInstructions`, and `repairServices`.
    *   **New Metrics:** `carbonFootprint`, `carbonFootprintBenchmarkPercentage`.
    *   **Scores:** `robustnessScore` (0-10), `recyclabilityScore` (0-10).
    *   **ESPR Physical Tests:** `spirality`, `dimensionalChange`, `visualInspection`.
    *   **Composition:** Granular arrays for `organicMaterialComposition` and `recycledMaterialComposition`.
    2.  **Missing Fields (Legacy vs. ESPR)**
    *   Because textile-espr.schema.json is a new file being built from the ground up, there are several
    *   fields present in the legacy schema that we have not yet brought over. If this new schema is meant
    *   to eventually replace the legacy one side-by-side, we should likely port these:
    3.  **Basic Product & Supply Chain Data:**
    *   apparelSizeSystem: Often pairs with apparelSize.
    *   careInstructions: Washing/drying instructions (we added repair/safe-use, but missed general care).
    *   productionSteps: Supply chain mapping (Spinning, Weaving, Dyeing).
    *   Granular ISO Tests: Interestingly, the legacy schema had much higher detail for physical tests than the JRC ESPR requirements. The legacy schema used structured objects requiring specific ISO test methods (e.g., tearStrength via ISO 13937-2, abrasionResistance via ISO 12947, microplasticRelease via ISO 4484-1).
    4.  **Missing from ESPR:**
    *   tearStrength,
    *   abrasionResistance,
    *   colorfastnessToWashing,
    *   microplasticRelease,
    *   and the structured dimensionalStability.
    5.  **Conclusion on Detail Level:**
    *   Our new ESPR schema is much more advanced regarding circularity
    *   (repairability, footprint, organic/recycled content, high-level recyclability/robustness scores).
    *   However, the legacy schema was actually higher detail regarding textile engineering/manufacturing
    *  (ISO-standardized physical tests, supply chain steps, general care instructions).
    *   **Next Steps for 9.1:**
    *   Should I port careInstructions, productionSteps, apparelSizeSystem,
    *   and the legacy ISO tests over to textile-espr.schema.json (and the ESPR context/ontology)
    *   so that our ESPR schema becomes a true, complete superset of the legacy schema?
    6.  **ESPR Discrepancies to Correct (Action Items):**
    *   [COMPLETED] Design and add `pefcrCategory`.
    *   [COMPLETED] Add `manufacturerInfo` (map to Organization in the context).
    *   [COMPLETED] Redesign Recycled Content: Split into pre-consumer and post-consumer percentage fields (avoiding the complex 'components' array if unnecessary, following the battery schema approach).
    *   [COMPLETED] Redesign Organic Content: Convert to a simple percent field and separate kg field in `TextileEspr.jsonld` rather than a complex component array.
    *   [COMPLETED] Add Conformity Declaration reference.
*   **[COMPLETED] Step 9.2: Test Suite Coverage**
    *   Add Playwright and wizard flow integration test scenarios specifically covering the new ESPR textile schema elements to prevent future regressions.

### [COMPLETED] Step 10: Validation and Outputs (Schema.org Adapter & Examples)
*   Plan: Ensure that the new ESPR structures are correctly translated by the transformation engine and backed by concrete examples.
*   **[COMPLETED] Step 10.1: Update schema.org adapter**
    *   Update `src/util/js/common/transformation/profiles/schema.org.js` to extract and map the new ESPR textile attributes (`textileCertifications`, `safeUseInstructions`, `organicMaterialComposition`, `recycledMaterialComposition`, etc.) into standard schema.org types.
*   **[COMPLETED] Step 10.2: Create/Update Textile ESPR Examples**
    *   Create a new comprehensive `textile-espr-dpp-v1.json` (or update an existing textile example) to validate the new JSON validation schema, semantic expansion, and the schema.org output.

### [PENDING] Step 11: Address Feedback
*   Plan: Discuss and address feedback items, including potential pushbacks on specific items.
*   **[PENDING] Step 11.1: Review and Discuss Feedback**
    *   Review feedback items one by one.
    *   Discuss whether to implement or push back on each item based on logical reasons.
    *   Process a mix of text and screenshots (assisted by another Gemini session) to understand the feedback.
*   **[PENDING] Step 11.2: Implement Actionable Schema Updates**
    *   **[COMPLETED] Task 11.2.1**: Update instruction fields (`safeUseInstructions`, `endOfLifeInstructions`, `repairInstructions`) to allow either a `RelatedResource` object or a plain string.
    *   **[COMPLETED] Task 11.2.2**: Add `preConsumerRecycledContentMass` and `postConsumerRecycledContentMass` mass fields to `textile-espr.schema.json`.
    *   **[COMPLETED] Task 11.2.3**: Add `preConsumerTypeOfWaste` and `postConsumerTypeOfWaste` string fields to `textile-espr.schema.json` (split for granularity).
    *   **[COMPLETED] Task 11.2.4**: Add `carbonFootprintCalculationParameters` referencing `RelatedResource` to `textile-espr.schema.json`.
    *   **[COMPLETED] Task 11.2.5**: Add `environmentalFootprint` integer field to `textile-espr.schema.json`.
    *   **[COMPLETED] Task 11.2.6**: Add `euEcolabel` boolean field as a supplement to the certifications array.
    *   **[COMPLETED] Task 11.2.7**: Add `carbonFootprintClass` and `environmentalFootprintClass` integer fields to `textile-espr.schema.json`.
    *   **[COMPLETED] Task 11.2.8**: Add `weightExcludingTrims` mass field to `textile-espr.schema.json`.
    *   **[COMPLETED] Task 11.2.9**: Add `eori` optional field to `organization.schema.json`.

### [PENDING] Step 12: Ontology and Schema Versioning for Backward Compatibility
*   Plan: Plan how to handle versioning to ensure backward compatibility before pulling the textile project into the main branch.
*   **[PENDING] Step 12.1: Strategy for Coexistence**
    *   Determine how to supplant the legacy textile material while keeping v1 available.
    *   Design the structure for both versions to coexist in the repository and registry.

### [COMPLETED] Step 13: Visibility Annotations for Ontological Elements
*   Plan: Add visibility annotations to ontological elements based on the access rights specified in the ESPR draft (Public, Authority only, Legitimate interest).
*   **[COMPLETED] Step 13.1: Map Access Rights to Visibility**
    *   Review the access rights table and map them to `dppk:visibility` annotations in the ontology.
    *   *Details*: Added visibility annotations to core properties in `RelatedResource.jsonld` (instructions) and `Product.jsonld` (`warrantyDuration`) since they had no preexisting annotations.

### [PENDING] Step 14: Add Governance and Source Annotations
*   Plan: Add `dppk:governedBy` and `dcterms:source` annotations to the textile ontology elements to document regulatory references, using the consolidated table in `docs/sensitive/textile-espr-methodologies.md`.
*   **Convention**:
    *   `dcterms:source`: Use an object with `@id` to link to publicly available legislation (e.g., EUR-Lex URL).
    *   `dppk:governedBy`: Use a string to name the specific standard or methodology (e.g., "ISO 14021:2016", "TLR").

*   **[COMPLETED] Step 14.1: Map References to Annotations for Textile-Specific Terms**
    *   [x] Identify terms in `docs/sensitive/textile-espr-methodologies.md` that map to properties already defined in `TextileEspr.jsonld`.
    *   [x] Add `dcterms:source` and `dppk:governedBy` annotations to these properties (completed for 18 properties including environmental footprint, robustness score, recyclability score, etc.).
    *   [x] Skip editing `Header.jsonld` and `Product.jsonld` directly to avoid merge conflicts.

*   **[COMPLETED] Step 14.2: Specialize Shared RelatedResource Properties**
    *   [x] Create specialized properties in `TextileEspr.jsonld` for instruction terms that map to core `RelatedResource` properties but have textile-specific legislation:
        *   [x] `dppk:textileCareInstructions` (subPropertyOf `dppk:careInstructions`)
        *   [x] `dppk:textileSafeUseInstructions` (subPropertyOf `dppk:safeUseInstructions`)
        *   [x] `dppk:textileEndOfLifeInstructions` (subPropertyOf `dppk:endOfLifeInstructions`)
        *   [x] `dppk:textileRepairInstructions` (subPropertyOf `dppk:repairInstructions`)
    *   [x] Add `dppk:governedBy` and `dcterms:source` annotations to these new properties based on the methodology table.
    *   [x] Update `src/contexts/v1/dpp-textile-espr.context.jsonld` to map the context keys to these new specialized properties.

*   **[COMPLETED] Step 14.3: Specialize Other Common Properties (Components, Fibers, etc.)**
    *   [x] Identify other shared properties (e.g., substances of concern, fibre composition) that need textile-specific annotations.
    *   [x] Specialize them in `TextileEspr.jsonld` and update context mappings (to be subdivided later).

   

### [PENDING] Step 15: Translate Ontology Labels and Comments
*   Plan: Translate the labels and comments in the textile ontology to support multi-lingual requirements when all other edits are done.
*   **[PENDING] Step 15.1: Add Translations**
    *   Add translations for all defined terms, following the pattern in the Battery ontology.

### [PENDING] units: make sure carbon footprint is "/kg" and establish a unit enumeration in its own ontology file so that we have clearer, reusable definitions. The latter will be a major feature update.

### Scratchpad 



### Consolidated DPP Attributes, Methodologies, and Mappings

| Attribute Name / Description | Reference Methodologies & Ontology Mappings | ESPR Reference |
| :--- | :--- | :--- |
| **Unique product ID** | **Methodology:** Serialised Global Trade Item Number (SGTIN) or equivalent, compliant with prEN18219.<br>**Ontology Mappings:** `UNECE: Global Serial ID`; `circ.ID: sgtin`; `GS1: productID` | Annex III (b) |
| **Batch ID** | **Methodology:** GTIN + Lot number or equivalent, compliant with prEN18219.<br>**Ontology Mappings:** `UNECE: Batch ID`; `CEON: BatchOfObjects -> batchID` | Annex III (b) |
| **Model ID** | **Methodology:** GTIN-13 or equivalent, compliant with prEN18219.<br>**Ontology Mappings:** `UNECE: Model ID`; `circ.ID: gtin` | Annex III (c) |
| **Product ESPR category** | **Methodology:** ESPR classification (knitted, woven, high denim product).<br>**Ontology Mappings:** None | Scope of the DA |
| **Product PEFCR category** | **Methodology:** PEFCR for Apparel and Footwear.<br>**Ontology Mappings:** None | Scope of the DA |
| **Commodity Code: HS code (6-digit code)** | **Methodology:** WCO Harmonized System (HS).<br>**Ontology Mappings:** `UNECE: Classification (code type)`; `GS1: additionalProductClassification` | Annex III (d) |
| **Commodity Code: TARIC Code (10-digit code)** | **Methodology:** TARIC XML Schema.<br>**Ontology Mappings:** `UNECE: Classification (code type)`; `GS1: additionalProductClassification` | Annex III (d) |
| **Manufacturer unique operator identifier** | **Methodology:** Party Global Location Number (Party GLN) or equivalent, compliant with prEN18219, and Economic Operators Registration and Identification (EORI), if available.<br>**Ontology Mappings:** `UNECE: Global ID / EORI`; `circ.ID: gln`; `TRICK: PARTIn` | Annex III (g) |
| **Manufacturer name** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** None | Annex III (g) |
| **Manufacturer postal address** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** `UNECE: Address entity`; `circ.ID: street_address, city, postal_code` | Annex III (g) |
| **Manufacturer contact information** | **Methodology:** \[email or other electronic means\].<br>**Ontology Mappings:** `UNECE: Telephone Number, Email Address`; `TRICK: PARTIn -> contact references`; `GS1 Web: Organization -> customerSupportCentre` | Annex III (g) |
| **Unique facility identifier(s)** | **Methodology:** Global Location Number (GLN), or equivalent, compliant with prEN18219.<br>**Ontology Mappings:** `UNECE: Facility -> Global ID`; `circ.ID: oar (Open Apparel Registry)` | Annex III (i) |
| **Importer unique operator identifier** | **Methodology:** Party Global Location Number (Party GLN), or equivalent, compliant with prEN18219, and Economic Operators Registration and Identification (EORI).<br>**Ontology Mappings:** `UNECE: Global ID / EORI`; `circ.ID: gln`; `TRICK: PARTIn` | Annex III (j), (h) |
| **Importer name** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** None | Annex III (j) |
| **Importer postal address** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** `UNECE: Address entity`; `circ.ID: street_address, city, postal_code` | Annex III (j) |
| **Importer contact information** | **Methodology:** \[email or other electronic means\].<br>**Ontology Mappings:** `UNECE: Telephone Number, Email Address`; `TRICK: PARTIn -> contact references`; `GS1 Web: Organization -> customerSupportCentre` | Annex III (j) |
| **Other responsible operator identifier** | **Methodology:** Party Global Location Number (Party GLN), or equivalent, compliant with prEN18219, and Economic Operators Registration and Identification (EORI).<br>**Ontology Mappings:** `UNECE: Global ID / EORI`; `circ.ID: gln`; `TRICK: PARTIn` | Annex III (k) |
| **Other responsible operator name** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** None | Annex III (k) |
| **Other responsible operator address** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** `UNECE: Address entity`; `circ.ID: street_address, city, postal_code` | Annex III (k) |
| **Other responsible operator contact information** | **Methodology:** \[email or other electronic means\].<br>**Ontology Mappings:** `UNECE: Telephone Number, Email Address`; `TRICK: PARTIn -> contact references`; `GS1 Web: Organization -> customerSupportCentre` | Annex III (k) |
| **Fiber composition** | **Methodology:** Textiles Labelling Regulation (clean dry mass).<br>**Ontology Mappings:** `CEON: TextileProductCompositionDisclosureStatement`; `circ.ID: material_composition` | Annex I(d), Annex III(a) |
| **Contains non-textile parts of animal origin** | **Methodology:** Textiles Labelling Regulation (Regulation (EU) No 1007/2011).<br>**Ontology Mappings:** `dppk:animalOriginNonTextile` | Annex III (a) |
| **Components specification** | **Methodology:** GTIN-13 or equivalent, compliant with prEN18219.<br>**Ontology Mappings:** `CEON: includesTrims`; `GS1: includedAccessories`; `circ.ID: material_composition` (trims included in composition) | Article 7(2)(b), Annex I(b) |
| **Robustness score** | **Methodology:** Methodology to be proposed in detail under ESPR DA of textiles.<br>**Ontology Mappings:** `UNECE: Sustainability Score Index (Stress & Aging)`, `Conformity Attestation (Test/Inspection Results)`; `TRICK: TEXQualityRpt`; `circ.ID: circular_design_strategy -> Physical Durability`; `CEON: ResourceQuality, TextileDataSheet` | Article 7(2)(b), Annex I(a) |
| **Name or numerical code of the substances of concern present in the product** | **Methodology:** IUPAC name, EC number, or CAS name and number as defined in REACH / ESPR.<br>**Ontology Mappings:** `UNECE: Substance of Concern (ID/Name/Max Limit)`; `CEON: TextileChemicalSubstanceThresholdStatement`; `circ.ID: REACH / ZDHC compliance` | Art 7(5), Annex I(f) |
| **Location of the substances of concern within the product** | **Methodology:** Free text.<br>**Ontology Mappings:** None | Art 7(5), Annex I(f) |
| **Concentration, maximum concentration or concentration range of the substances of concern, at the level of the product** | **Methodology:** Values expressed in % w/w in relation to the weight of an article as defined in REACH.<br>**Ontology Mappings:** Shared with generic Substance of Concern (SoC) parameters. | Art 7(5), Annex I(f) |
| **Relevant instructions for the safe use of the product** | **Methodology:** Free text. Standard text: "The identification of the substance is enough to allow safe use" if no instructions are needed.<br>**Ontology Mappings:** `UNECE: Instructions -> Repair`; `circ.ID: disassembly_instructions`; `GS1 Web: instructionsForUse` | Art 7(5), Annex I(f) |
| **Information relevant for disassembly, preparation for reuse, reuse, recycling and the environmentally sound management of the product at end-of-life** | **Methodology:** Free text.<br>**Ontology Mappings:** None | Art 7(5), Annex I(f) |
| **Recyclability score** | **Methodology:** Methodology to be proposed in detail under ESPR DA of textiles.<br>**Ontology Mappings:** `CEON: TextileProductDesignForRecycling`; `UNECE: Sustainability Score Index (Recyclability)`; `circ.ID: Material Cyclability`; `GS1: consumerRecyclingInstructions` | Annex I(d), III(a) |
| **Recycled content** | **Methodology:** Value expressed in % w/w in relation to product weight (based on ISO 14021:2016).<br>**Ontology Mappings:** `UNECE: Recycled Material Content`; `CEON: PostConsumerRecycledCompositionStatement`; `circ.ID: is_recycled` | Annex I(h) |
| **Origin of the recycled content** | **Methodology:** Classification of post-industrial, pre-, and post-consumer waste aligned with ISO 14021:2016.<br>**Ontology Mappings:** Aligned with UNECE / CEON / circ.ID waste definitions. | Annex I(h) |
| **Organic content** | **Methodology:** Value expressed in % w/w in relation to product weight (aligned with Organic Regulation (EU) 2018/848).<br>**Ontology Mappings:** `UNECE: Sustainability Claim/Statement`; `circ.ID: certification_standard` | Annex III (a) |
| **EU Ecolabel** | **Methodology:** EU Ecolabel Certification.<br>**Ontology Mappings:** `circ.ID: certification_standard -> EU Ecolabel, certification_file`; `UNECE: Label (type EU eco label)`; `CEON: TextileProductCertification`; `GS1: certification`; `TRICK: SRVindicatorsDeclaration` | Annex III (a) |
| **Product carbon footprint – Class of performance** | **Methodology:** PEFCR climate change impact category (partial lifecycle).<br>**Ontology Mappings:** `UNECE: Environmental Footprint (Impact Category/Value)`; `TRICK: PEFInformationSupply` | Annex I(n) |
| **Product environmental footprint– Class of performance** | **Methodology:** PEFCR single score (partial lifecycle).<br>**Ontology Mappings:** `UNECE: Environmental Footprint (Impact Category/Value)`; `TRICK: PEFInformationSupply` | Annex I(n) |
| **Care instructions** | **Methodology:** Textiles Labelling Regulation (ISO 21600:2019).<br>**Ontology Mappings:** `UNECE: Instructions -> Care`; `circ.ID: care_guide`; `GS1 Web: consumerUsageInstructions` | Annex III(a)(f) |
| **Repair instructions** | **Methodology:** Free text (webpage link).<br>**Ontology Mappings:** `UNECE: Instructions -> Repair`; `circ.ID: disassembly_instructions`; `GS1 Web: instructionsForUse` | Article 7(2)(b), Annex I(b) |
| **Contact of repair services offered by brand** | **Methodology:** Free text ISO/IEC 6523.<br>**Ontology Mappings:** None | Article 7(2)(b), Annex I(b) |
| **Warranty duration / Commercial guarantee duration above the 2-year legal minimum** | **Methodology:** ISO 22059:2020 (aligned with Consumer Rights Directive).<br>**Ontology Mappings:** `UNECE: Warranty Period`; `GS1 Web: manufacturersWarranty` | Article 7(2)(b), Annex I(a) |
| **Visual inspection** | **Methodology:** Test results ISO 15487.<br>**Ontology Mappings:** None | Article 7(2)(b), Annex I(a), III(e) |
| **Spirality** | **Methodology:** Test results ISO 16322-3 (%).<br>**Ontology Mappings:** None | Article 7(2)(b), Annex I(a), III(e) |
| **Dimensional change** | **Methodology:** Test results ISO 3759 (%).<br>**Ontology Mappings:** None | Article 7(2)(b), Annex I(a), III(e) |
| **Conformity certification (third-party verification)** | **Methodology:** Verification rules specified in ESPR DA of textiles.<br>**Ontology Mappings:** None *(Deduplicated across Mechanical properties, Recyclability, Recycled content, and Organic content)* | Annex III(e) |
| **Conformity declaration (self-declaration)** | **Methodology:** Verification rules specified in ESPR DA of textiles.<br>**Ontology Mappings:** None *(Deduplicated across Mechanical properties, Recyclability, Recycled content, and Organic content)* | Annex III(e) |
| **Weight (excluding trims)** | **Methodology:** Value expressed in kg EN ISO 80000-1 (clean dry mass from TLR).<br>**Ontology Mappings:** None *(Deduplicated across Recycled content and Organic content)* | Annex III(e) |
| **Amount of recycled material** | **Methodology:** Value expressed in kg (based on ISO 14021:2016).<br>**Ontology Mappings:** None | Annex I(h), III(e) |
| **Amount of organic material** | **Methodology:** Value expressed in kg (aligned with Organic Regulation (EU) 2018/848).<br>**Ontology Mappings:** None | Annex III (e) |
| **Product carbon footprint – Absolute value** | **Methodology:** Value expressed in kg CO₂e/kg (based on PEFCR climate change category).<br>**Ontology Mappings:** None | Annex I(n), III(e) |
| **Product carbon footprint – Compared to a benchmark** | **Methodology:** Value expressed in % compared to PEFCR benchmark.<br>**Ontology Mappings:** None | Annex I(n), III(e) |
| **Product environmental footprint – Absolute value** | **Methodology:** Value expressed in environmental points/kg (PEFCR single score).<br>**Ontology Mappings:** None | Annex I(n), III(e) |
| **Product environmental footprint – Compared to a benchmark** | **Methodology:** Value expressed in % compared to PEFCR benchmark (single score).<br>**Ontology Mappings:** None | Annex I(n), III(e) |
| **Weight** | **Methodology:** Value expressed in kg EN ISO 80000-1 (including trims/accessories as per PEFCR average final product weight).<br>**Ontology Mappings:** `circ.ID: net_weight`; `UNECE: Net Weight`; `GS1: netWeight` | Annex III(e) |

---

Hopefully, this format serves as a solid foundation for defining the equivalency mappings and field definitions within your ontology. Please let me know if you require any adjustments.