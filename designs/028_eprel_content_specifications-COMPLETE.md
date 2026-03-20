# Design Doc 028: EPREL Content Specifications

This document outlines the sub-roadmap for drafting JSON schema files for all EPREL payloads. We will examine each EPREL JSON API response and craft a corresponding JSON schema file that follows the model of existing sector schema files (e.g., `construction.schema.json`). Each schema will contain a `contentSpecificationIds` entry formatted as `eprel_[category]_specification_id`.

After every single Task and Subtask, pause and allow the user to test and discuss next steps.

## Design Principles
1. **Explicit Nulls:** The EPREL APIs often return explicit `null` values for empty fields rather than omitting the property entirely. To ensure validation passes for authentic payloads, the JSON schemas must explicitly allow `["type", "null"]` wherever a null can occur.
2. **EPREL Sub-schemas:** Nested objects (such as `contactDetails`, `organisation`, `heatingCharacteristics`, etc.) that are frequently reused across different EPREL payloads will be extracted into shared sub-schemas organized under a `src/validation/v1/json-schema/eprel/` subdirectory. This keeps them cleanly separated from the generic non-EPREL DPP schemas (like `organization.schema.json`) to avoid compatibility issues.
3. **Permissive Typing:** Avoid fragile strictness. For any fields where the API inconsistently uses data types (e.g., returning strings instead of numbers, or IDs sometimes numeric and sometimes string), prefer `["string", "null"]` or `["string", "number", "null"]` to ensure validation smoothly passes authentic payloads. Note: JSON Schema does not auto-coerce JSON number literals into strings, so a field receiving both `2791` and `"2791"` technically requires `["string", "number", "null"]`.
4. **Assess Payload Sufficiency:** For each task, check whether the single provided JSON example payload gives sufficient context to draft an accurate schema. If the payload is unusually sparse or introduces highly ambiguous nested objects, pause and ask the user to pull down additional examples for that specific product category before proceeding.
5. **Ontology Imports Need Extensions:** When adding URL references to `owl:imports`, the URLs must explicitly end with `.jsonld`. The integrity script's local path resolver will fail silently without it, disconnecting the graphs.
6. **Object Properties for Nested Blocks:** When extracting a sub-schema/sub-ontology (e.g., `contactDetails`), do not forget to explicitly define the `owl:ObjectProperty` (e.g. `dppk:eprelContactDetails`) that links the object, setting its `rdfs:range` to the nested class block.
7. **Strict Ontology Completeness:** To easily pass `validate-ontology-integrity.mjs`, every single `xsd:double` or `xsd:integer` must possess a `"dppk:unit"`. Explicitly assign `"unitless"` to efficiency ratios, identifiers, quantities, and timestamps. Furthermore, every single class and property needs both an English `rdfs:label` and an `rdfs:comment` (or `dcterms:description` for top-level ontologies).
8. **Register Category Ontologies:** Every newly created sector ontology (e.g. `EprelDishwashers.jsonld`) must be explicitly added to the `owl:imports` list inside the master `src/ontology/v1/dpp-ontology.jsonld` entry point.

## Out of Scope
This design document specifically focuses on establishing the core schemas, context fields, and ontology structures. The following critical follow-on tasks are explicitly **not covered** by this design and will require separate design efforts:
- ensuring that each single ontology definition has both comments and labels translated in all languages
- updating the DPP wizard for each new EPREL category
- adding equivalency annotations for each ontological term
- adding each ontology to the schema.org generators or HTML generators explicitly
- updating the validator to support the new schemas and subschemas
- let the user generate HTML versions of the examples once the DPP validator supports them

---

---

- **[ ] Task 1: Create Schema, Context, and Ontology for airconditioners:** Prove the end-to-end pipeline before proceeding to other payloads.
  - **[x] 1a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-airconditioners.schema.json` ensuring `contentSpecificationIds` includes `"eprel_airconditioners_specification_id"`.
  - **[x] 1b. Create Context File:** Create `src/contexts/v1/dpp-eprel-airconditioners.context.jsonld`. Use scoped contexts to map nested structures (like `heatingCharacteristics`) to flat table URIs (similar to `dpp-dopc.context.jsonld`).
  - **[x] 1c. Create Category Ontology:** Create `src/ontology/v1/sectors/EprelAirConditioners.jsonld` representing the core category properties.
  - **[x] 1d. Create Sub-Ontologies:** Output shared data types into `src/ontology/v1/eprel/` (e.g. `EprelHeatingCharacteristics.jsonld`).
  - **[x] 1e. Determine Units:** Check the `PDF Pages` directory to define appropriate units in the ontology properties. Pause and allow the user to test and discuss next steps.
  - **[x] 1f. Validate and Fix:** Run `validate-ontology-integrity.mjs` and iterative fix missing units, English labels, description comments, and mapping definitions until the script passes natively.
- **[/] Task 2: Create Schema, Context, and Ontology for dishwashers:** Examine the API payload and craft the corresponding schema.
  - **[x] 2a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-dishwashers.schema.json` ensuring `contentSpecificationIds` includes `"eprel_dishwashers_specification_id"`.
  - **[x] 2b. Create Context File:** Create the context map for flat URIs.
  - **[x] 2c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 2d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 2e. Determine Units:** Map the PDF units accurately.
  - **[x] 2f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 3: Create Schema, Context, and Ontology for electronicdisplays:** Examine the API payload and craft the corresponding schema.
  - **[x] 3a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-electronicdisplays.schema.json` ensuring `contentSpecificationIds` includes `"eprel_electronicdisplays_specification_id"`.
  - **[x] 3b. Create Context File:** Create the context map for flat URIs.
  - **[x] 3c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 3d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 3e. Determine Units:** Map the PDF units accurately.
  - **[x] 3f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 4: Create Schema, Context, and Ontology for hotwaterstoragetanks:** Examine the API payload and craft the corresponding schema.
  - **[x] 4a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-hotwaterstoragetanks.schema.json` ensuring `contentSpecificationIds` includes `"eprel_hotwaterstoragetanks_specification_id"`.
  - **[x] 4b. Create Context File:** Create the context map for flat URIs.
  - **[x] 4c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 4d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 4e. Determine Units:** Map the PDF units accurately.
  - **[x] 4f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 5: Create Schema, Context, and Ontology for lightsources:** Examine the API payload and craft the corresponding schema.
  - **[x] 5a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-lightsources.schema.json` ensuring `contentSpecificationIds` includes `"eprel_lightsources_specification_id"`.
  - **[x] 5b. Create Context File:** Create the context map for flat URIs.
  - **[x] 5c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 5d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 5e. Determine Units:** Map the PDF units accurately.
  - **[x] 5f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 6: Create Schema, Context, and Ontology for localspaceheaters:** Examine the API payload and craft the corresponding schema.
  - **[x] 6a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-localspaceheaters.schema.json` ensuring `contentSpecificationIds` includes `"eprel_localspaceheaters_specification_id"`.
  - **[x] 6b. Create Context File:** Create the context map for flat URIs.
  - **[x] 6c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 6d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 6e. Determine Units:** Map the PDF units accurately.
  - **[x] 6f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 7: Create Schema, Context, and Ontology for ovens:** Examine the API payload and craft the corresponding schema.
  - **[x] 7a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-ovens.schema.json` ensuring `contentSpecificationIds` includes `"eprel_ovens_specification_id"`.
  - **[x] 7b. Create Context File:** Create the context map for flat URIs.
  - **[x] 7c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 7d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 7e. Determine Units:** Map the PDF units accurately.
  - **[x] 7f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 8: Create Schema, Context, and Ontology for professionalrefrigeratedstoragecabinets:** Examine the API payload and craft the corresponding schema.
  - **[x] 8a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-professionalrefrigeratedstoragecabinets.schema.json` ensuring `contentSpecificationIds` includes `"eprel_professionalrefrigeratedstoragecabinets_specification_id"`.
  - **[x] 8b. Create Context File:** Create the context map for flat URIs.
  - **[x] 8c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 8d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 8e. Determine Units:** Map the PDF units accurately.
  - **[x] 8f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 9: Create Schema, Context, and Ontology for rangehoods:** Examine the API payload and craft the corresponding schema.
  - **[x] 9a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-rangehoods.schema.json` ensuring `contentSpecificationIds` includes `"eprel_rangehoods_specification_id"`.
  - **[x] 9b. Create Context File:** Create the context map for flat URIs.
  - **[x] 9c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 9d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 9e. Determine Units:** Map the PDF units accurately.
  - **[x] 9f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 10: Create Schema, Context, and Ontology for refrigeratingappliances:** Examine the API payload and craft the corresponding schema.
  - **[x] 10a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-refrigeratingappliances.schema.json` ensuring `contentSpecificationIds` includes `"eprel_refrigeratingappliances_specification_id"`.
  - **[x] 10b. Create Context File:** Create the context map for flat URIs.
  - **[x] 10c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 10d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 10e. Determine Units:** Map the PDF units accurately.
  - **[x] 10f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 11: Create Schema, Context, and Ontology for refrigeratingappliancesdirectsalesfunction:** Examine the API payload and craft the corresponding schema.
  - **[x] 11a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-refrigeratingappliancesdirectsalesfunction.schema.json` ensuring `contentSpecificationIds` includes `"eprel_refrigeratingappliancesdirectsalesfunction_specification_id"`.
  - **[x] 11b. Create Context File:** Create the context map for flat URIs.
  - **[x] 11c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 11d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 11e. Determine Units:** Map the PDF units accurately.
  - **[x] 11f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 12: Create Schema, Context, and Ontology for residentialventilationunits:** Examine the API payload and craft the corresponding schema.
  - **[x] 12a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-residentialventilationunits.schema.json` ensuring `contentSpecificationIds` includes `"eprel_residentialventilationunits_specification_id"`.
  - **[x] 12b. Create Context File:** Create the context map for flat URIs.
  - **[x] 12c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 12d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 12e. Determine Units:** Map the PDF units accurately.
  - **[x] 12f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 13: Create Schema, Context, and Ontology for smartphonestablets:** Examine the API payload and craft the corresponding schema.
  - **[x] 13a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-smartphonestablets.schema.json` ensuring `contentSpecificationIds` includes `"eprel_smartphonestablets_specification_id"`.
  - **[x] 13b. Create Context File:** Create the context map for flat URIs.
  - **[x] 13c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 13d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 13e. Determine Units:** Map the PDF units accurately.
  - **[x] 13f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 14: Create Schema, Context, and Ontology for solidfuelboilerpackages:** Examine the API payload and craft the corresponding schema.
  - **[x] 14a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-solidfuelboilerpackages.schema.json` ensuring `contentSpecificationIds` includes `"eprel_solidfuelboilerpackages_specification_id"`.
  - **[x] 14b. Create Context File:** Create the context map for flat URIs.
  - **[x] 14c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 14d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 14e. Determine Units:** Map the PDF units accurately.
  - **[x] 14f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 15: Create Schema, Context, and Ontology for solidfuelboilers:** Examine the API payload and craft the corresponding schema.
  - **[x] 15a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-solidfuelboilers.schema.json` ensuring `contentSpecificationIds` includes `"eprel_solidfuelboilers_specification_id"`.
  - **[x] 15b. Create Context File:** Create the context map for flat URIs.
  - **[x] 15c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 15d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 15e. Determine Units:** Map the PDF units accurately.
  - **[x] 15f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 16: Create Schema, Context, and Ontology for spaceheaterpackages:** Examine the API payload and craft the corresponding schema.
  - **[x] 16a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-spaceheaterpackages.schema.json` ensuring `contentSpecificationIds` includes `"eprel_spaceheaterpackages_specification_id"`.
  - **[x] 16b. Create Context File:** Create the context map for flat URIs.
  - **[x] 16c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 16d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 16e. Determine Units:** Map the PDF units accurately.
  - **[x] 16f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 17: Create Schema, Context, and Ontology for spaceheaters:** Examine the API payload and craft the corresponding schema.
  - **[x] 17a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-spaceheaters.schema.json` ensuring `contentSpecificationIds` includes `"eprel_spaceheaters_specification_id"`.
  - **[x] 17b. Create Context File:** Create the context map for flat URIs.
  - **[x] 17c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 17d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 17e. Determine Units:** Map the PDF units accurately.
  - **[x] 17f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 18: Create Schema, Context, and Ontology for spaceheatersolardevice:** Examine the API payload and craft the corresponding schema.
  - **[x] 18a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-spaceheatersolardevice.schema.json` ensuring `contentSpecificationIds` includes `"eprel_spaceheatersolardevice_specification_id"`.
  - **[x] 18b. Create Context File:** Create the context map for flat URIs.
  - **[x] 18c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 18d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 18e. Determine Units:** Map the PDF units accurately.
  - **[x] 18f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 19: Create Schema, Context, and Ontology for spaceheatertemperaturecontrol:** Examine the API payload and craft the corresponding schema.
  - **[x] 19a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-spaceheatertemperaturecontrol.schema.json` ensuring `contentSpecificationIds` includes `"eprel_spaceheatertemperaturecontrol_specification_id"`.
  - **[x] 19b. Create Context File:** Create the context map for flat URIs.
  - **[x] 19c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 19d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 19e. Determine Units:** Map the PDF units accurately.
  - **[x] 19f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 20: Create Schema, Context, and Ontology for tumbledryers:** Examine the API payload and craft the corresponding schema.
  - **[x] 20a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-tumbledryers.schema.json` ensuring `contentSpecificationIds` includes `"eprel_tumbledryers_specification_id"`.
  - **[x] 20b. Create Context File:** Create the context map for flat URIs.
  - **[x] 20c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 20d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 20e. Determine Units:** Map the PDF units accurately.
  - **[x] 20f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 21: Create Schema, Context, and Ontology for tyres:** Examine the API payload and craft the corresponding schema.
  - **[x] 21a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-tyres.schema.json` ensuring `contentSpecificationIds` includes `"eprel_tyres_specification_id"`.
  - **[x] 21b. Create Context File:** Create the context map for flat URIs.
  - **[x] 21c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 21d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 21e. Determine Units:** Map the PDF units accurately.
  - **[x] 21f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 22: Create Schema, Context, and Ontology for washerdriers:** Examine the API payload and craft the corresponding schema.
  - **[x] 22a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-washerdriers.schema.json` ensuring `contentSpecificationIds` includes `"eprel_washerdriers_specification_id"`.
  - **[x] 22b. Create Context File:** Create the context map for flat URIs.
  - **[x] 22c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 22d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 22e. Determine Units:** Map the PDF units accurately.
  - **[x] 22f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 23: Create Schema, Context, and Ontology for washingmachines:** Examine the API payload and craft the corresponding schema.
  - **[x] 23a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-washingmachines.schema.json` ensuring `contentSpecificationIds` includes `"eprel_washingmachines_specification_id"`.
  - **[x] 23b. Create Context File:** Create the context map for flat URIs.
  - **[x] 23c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 23d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 23e. Determine Units:** Map the PDF units accurately.
  - **[x] 23f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 24: Create Schema, Context, and Ontology for waterheaterpackages:** Examine the API payload and craft the corresponding schema.
  - **[x] 24a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-waterheaterpackages.schema.json` ensuring `contentSpecificationIds` includes `"eprel_waterheaterpackages_specification_id"`.
  - **[x] 24b. Create Context File:** Create the context map for flat URIs.
  - **[x] 24c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 24d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 24e. Determine Units:** Map the PDF units accurately.
  - **[x] 24f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 25: Create Schema, Context, and Ontology for waterheaters:** Examine the API payload and craft the corresponding schema.
  - **[x] 25a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-waterheaters.schema.json` ensuring `contentSpecificationIds` includes `"eprel_waterheaters_specification_id"`.
  - **[x] 25b. Create Context File:** Create the context map for flat URIs.
  - **[x] 25c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 25d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 25e. Determine Units:** Map the PDF units accurately.
  - **[x] 25f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.
- **[/] Task 26: Create Schema, Context, and Ontology for waterheatersolardevices:** Examine the API payload and craft the corresponding schema.
  - **[x] 26a. Draft Schema:** Create `src/validation/v1/json-schema/eprel-waterheatersolardevices.schema.json` ensuring `contentSpecificationIds` includes `"eprel_waterheatersolardevices_specification_id"`.
  - **[x] 26b. Create Context File:** Create the context map for flat URIs.
  - **[x] 26c. Create Category Ontology:** Draft the ontology mapped items.
  - **[x] 26d. Create Sub-Ontologies:** Output any new shared structural data types.
  - **[x] 26e. Determine Units:** Map the PDF units accurately.
  - **[x] 26f. Validate and Fix:** Check for schema mapping integrity, documentation completeness, and numeric unit existence. Pause and allow the user to discuss next steps.

- **[ ] Task 27: Finalize Public Examples & Cleanup**
  - **[x] 27a.** Generate unique AI product images (no branding) for each category.
  - **[x] 27b.** Anonymize/fuzz all EPREL payload fields with realistic proxy data.
  - **[x] 27c.** Inject DPP Header Schema fields (`uniqueProductIdentifier`, `contentSpecificationIds`, `image`, etc.).
  - **[x] 27d.** Inject correct JSON-LD mappings (`@context` arrays, `type` classes).
  - **[x] 27e.** Move outputs to `src/examples/eprel-[category]-dpp-v1.json`.
  - **[x] 27f.** Delete/unhook the sensitive validation parity script.