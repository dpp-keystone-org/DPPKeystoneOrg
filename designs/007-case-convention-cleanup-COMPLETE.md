# Design Doc 007: Case Convention Cleanup

This document outlines the sub-roadmap for a cleanup task to ensure consistent case conventions across all project artifacts. This was identified as a blocker for completing the DPP Wizard. The target convention for all JSON keys and schema properties is `camelCase`.
After every single Task and Subtask, pause and allow the user to test and discuss next steps.

---

- **[COMPLETED] Task: Review and Align Case Conventions:** Audit all ontologies, contexts, examples, and JSON schemas to ensure property names consistently use `camelCase`. Pause and allow the user to test and discuss next steps.
  - **[IN PROGRESS] 1. Analysis Phase:**
    - **[COMPLETED] 1a. Audit JSON Schemas:** Systematically review all files in `src/validation/v1/json-schema/` to identify any properties not using `camelCase`. (Note: Found and fixed `certificationID` and `certificationBodyID` in `delegated_act_t123.schema.json`; change was self-contained and tests passed.) Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 1b. Audit Contexts:** Systematically review all files in `src/contexts/v1/` to identify any JSON keys not using `camelCase`. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 1b-1. Sub-Quest (Analysis):** Rename inconsistent `certifying...` fields to `certification...`.
        - **[COMPLETED] Find usages:** Search for `certifyingBodyID` and `certifyingBodyName` in schemas, contexts, ontologies, and examples.
        - **[COMPLETED] Implement renames:** Apply changes to all affected files.
        - **[COMPLETED] Verify renames:** Search again to confirm all instances are updated.
    - **[COMPLETED] 1c. Audit Ontologies:** Review `src/ontology/v1/**/*.jsonld` files. While ontology class names are often `PascalCase`, this audit will confirm that defined properties intended for JSON representation are consistently `camelCase`. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 1d. Create Change-list:** Compile a definitive list of all files and properties that need to be changed. Pause and allow the user to test and discuss next steps.
  - **[IN PROGRESS] 2. Implementation Phase:** Based on the complete analysis, the following terms need to be changed.
    - **[COMPLETED] 2a. Rename `notifiedBodyID`:** Change to `notifiedBodyId` in `dpp-construction.context.jsonld`, `sectors/Construction.jsonld`, and applicable examples. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2b. Rename `additionalOrganizationID` & `...Type`:** Change to `additionalOrganizationId` and `additionalOrganizationIdType` in `dpp-core.context.jsonld`, `core/Organization.jsonld`, and applicable examples. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2c. Rename `documentURL`:** Change to `documentUrl` in `dpp-core.context.jsonld`, `core/Compliance.jsonld`, and applicable examples. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2d. Rename `referencedFileURL`:** Change to `referencedFileUrl` in `dpp-core.context.jsonld`, applicable examples, and applicable SHACL shapes. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2e. Rename ontology term `dppId` to `digitalProductPassportId`:** Change the ontology term in `core/Header.jsonld` to match the standard, and verify the context mapping in `dpp-core.context.jsonld`. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2f. Rename `EconomicOperatorID`:** Change `EconomicOperatorID` to camelCase in `core/Header.jsonld`, update the corresponding mappings in `dpp-core.context.jsonld`, applicable examples, and applicable SHACL shapes. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2g. Rename `FacilityID`:** Change `FacilityID` to camelCase in `core/Header.jsonld`, update the corresponding mappings in `dpp-core.context.jsonld`, applicable examples, and applicable SHACL shapes. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2h. Rename `Granularity`:** Change `Granularity` to camelCase in `core/Header.jsonld`, update the corresponding mappings in `dpp-core.context.jsonld`, applicable examples, and applicable SHACL shapes. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2i. Rename `StatusOfTheDPP` to `dppStatus`:** Change `StatusOfTheDPP` to `dppStatus` in `core/Header.jsonld`, update the corresponding mappings in `dpp-core.context.jsonld`, applicable examples, and applicable SHACL shapes. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2j. Rename `BaseDppSchemaVersion` to `dppSchemaVersion`:** Change the term `BaseDppSchemaVersion` to `dppSchemaVersion` in `core/Header.jsonld`, update the corresponding mappings in `dpp-core.context.jsonld`, applicable examples, and applicable SHACL shapes. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2k: Remove `SectorDataModelVersion` and define `contentSpecificationIds`**
      **Description:** The `SectorDataModelVersion` property is obsolete and has been replaced by the `contentSpecificationIds` array. We will proceed with correcting the ontology: this task will remove the old property and ensure the new one is correctly defined.
      **Analysis:**
      *   `SectorDataModelVersion` exists only as an orphaned term in `src/ontology/v1/core/Header.jsonld`.
      *   `contentSpecificationIds` is used correctly in contexts, examples, and schemas, but the term it maps to (`dppk:contentSpecificationIds`) is missing from the ontology.
      **Implementation Plan:**
      1.  **Add Property:** In `src/ontology/v1/core/Header.jsonld`, add a new `owl:ObjectProperty` definition for `dppk:contentSpecificationIds`. It should have `dppk:DigitalProductPassport` as its domain and `xsd:anyURI` as its range.
      2.  **Remove Property:** In the same file, delete the entire definition block for `dppk:SectorDataModelVersion`.
      3.  **Verify:** Run `npm test` to ensure no regressions were introduced by cleaning up the ontology.
      Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2l. Refactor `documentUrl` to `relatedResource`:**
      **Description:** Replace the custom `DigitalDocument` structure with the standardized `dppk:RelatedResource` structure. This task is broken down into smaller steps to ensure stability.
      - **[COMPLETED] 2l-i. Ontology Update (`Compliance.jsonld`):** In `src/ontology/v1/core/Compliance.jsonld`, remove the `dppk:DigitalDocument` class and its properties (`dppk:documentUrl`, `dppk:documentType`, `dppk:languageCode`). Then, update the `dppk:documents` property to have `dppk:RelatedResource` as its `rdfs:range`. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2l-ii. Context Update (`dpp-core.context.jsonld`):** In `src/contexts/v1/dpp-core.context.jsonld`, remove the context mappings for `DigitalDocument`, `documentUrl`, `documentType`, and `languageCode`. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2l-iii. JSON Schema Update (`battery.schema.json`):** In `src/validation/v1/json-schema/battery.schema.json`, update the `documents` property to be an array where each item references `related-resource.schema.json`. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2l-iv. Example Transformation:** In `battery-dpp-v1.json`, `sock-dpp-v1.json`, and `drill-dpp-v1.json`, convert objects in the `documents` array from the `DigitalDocument` format to the `RelatedResource` format. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2l-v. SHACL Shape Update (`core-shapes.shacl.jsonld`):** In `src/validation/v1/shacl/core-shapes.shacl.jsonld`, replace the `DigitalDocumentShape` with a `RelatedResourceShape` that validates the new structure. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2l-vi. Adapter Logic Update (`schema.org.js`):** In `src/util/js/common/profiles/schema.org.js`, update the `toSchemaOrgDigitalDocument` function to correctly transform `RelatedResource` nodes. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2l-vii. Final Test Run:** Run the full `npm test` suite to fix any remaining failures related to this refactoring. Pause and allow the user to test and discuss next steps.
- **[COMPLETED] 2m. Refactor `Certification` as a subclass of `RelatedResource`:**
      **Description:** Refactor the `dppk:Certification` class to be a specialized sub-class of `dppk:RelatedResource`. This clarifies that a certification is a linkable resource that has additional, specific properties. We will **remove** redundant properties on `Certification` in favor of the inherited, generic ones.
      - **[COMPLETED] 2m-i. Ontology Refactoring (`Compliance.jsonld`):**
          - **[COMPLETED] 2m-i-1. Add Subclass Statement:** In `src/ontology/v1/core/Compliance.jsonld`, find the definition for `dppk:Certification` and ensure it has the statement: `"rdfs:subClassOf": { "@id": "dppk:RelatedResource" }`. Pause and allow the user to test and discuss next steps.
          - **[COMPLETED] 2m-i-2. Remove Redundant Properties:** In the same file, delete the entire property definition blocks for `dppk:certificationStandard` and `dppk:certificationIdentification`, as they are now replaced by inherited properties. Pause and allow the user to test and discuss next steps.
          - **[COMPLETED] 2m-i-3. Remove Redundant URL Property:** Find and delete the property definition for `dppk:referencedFileUrl` (if it exists), as the inherited `dppk:url` property makes it redundant. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2m-ii. Context Update (`dpp-core.context.jsonld`):**
          - **[COMPLETED] 2m-ii-1. Remove Mappings:** In `src/contexts/v1/dpp-core.context.jsonld`, remove the context mappings for `referencedFileUrl`, `certificationStandard`, and `certificationIdentification`. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2m-iii. Example Transformation:**
          - **[COMPLETED] 2m-iii-1. Update Examples:** In the example files (`rail-dpp-v1.json`, `drill-dpp-v1.json`, etc.), update the `certifications` objects. Rename `certificationStandard` to `resourceTitle`, `certificationIdentification` to `identifier`, and `referencedFileUrl` to `url`. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2m-iv. JSON Schema & SHACL Shape Unification:**
          - **[COMPLETED] 2m-iv-1. Unify JSON Schema:** Review the JSON schemas for `certifications`. Remove the old properties and simplify the schema by referencing `related-resource.schema.json` and adding any extra fields specific to `Certification` (e.g., `certificationBodyName`). Pause and allow the user to test and discuss next steps.
          - **[COMPLETED] 2m-iv-2. Unify SHACL Shape:** In `core-shapes.shacl.jsonld`, update `CertificationShape`. Remove the separate validations for the deleted properties, as the inherited properties are validated by `RelatedResourceShape`. Pause and allow the user to test and discuss next steps.
      - **[COMPLETED] 2m-v. Final Test Run:**
          - **[COMPLETED] 2m-v-1. Run Tests:** Run the full `npm test` suite to ensure all changes are consistent and no regressions were introduced. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2o. Clean up `src/examples/battery-dpp-v1.json`:** Correct the casing and types in the battery example file. Specifically: change `carbonFootprint` to `batteryCarbonFootprint`, `recycledContentRatio` to `recycledContentPercentage`, and remove the incorrect `@type` from the `stateOfHealth` property. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2p. Clean up `src/examples/drill-dpp-v1.json`:** Correct the casing of `facilityID` to `facilityId` in the drill example file. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2q. Clean up `src/examples/rail-dpp-v1.json`:** Correct the casing of `notifiedBodyID` to `notifiedBodyId` within the `notifiedBody` object in the rail example file. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2r. Clean up `src/validation/v1/json-schema/battery.schema.json`:** Correct property names in the battery JSON schema. Specifically: change `recycledContentRatio` to `recycledContentPercentage` and `carbonFootprint` to `batteryCarbonFootprint`. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 2s. Create a native `dppk:identifier` property.**
      - **[COMPLETED] 2s-i. Create Ontology Definition:**
          - Create a new file: `src/ontology/v1/core/Identifier.jsonld`.
          - In this new file, define `dppk:identifier` as an `rdf:Property`.
          - Add the statement `"owl:equivalentProperty": { "@id": "schema:identifier" }` to the definition.
          - Update `src/ontology/v1/dpp-ontology.jsonld` to add an `owl:imports` statement for the new `Identifier.jsonld` file.
          - Pause and allow for user review.
      - **[COMPLETED] 2s-ii. Update Core Context:**
          - In `src/contexts/v1/dpp-core.context.jsonld`, find the line `"identifier": "schema:identifier"`.
          - Change it to `"identifier": "dppk:identifier"`.
          - Pause and allow for user review.
      - **[COMPLETED] 2s-iii. Update SHACL Shapes:**
          - Search for and replace any usage of `schema:identifier` in the `src/validation/v1/shacl/` directory with `dppk:identifier` to maintain consistency.
          - Pause and allow for user review.
      - **[COMPLETED] 2s-iv. Final Test Run:**
          - Run the full `npm test` suite to ensure the changes are consistent and have not introduced any regressions.
          - Pause and allow for user review.
    - **[COMPLETED] 2n. Refactor `granularity` to be an Enumeration in the Ontology**
      **Description:** The `granularity` property is currently defined as a string, with its allowed values validated externally by JSON Schema. To create a more semantically rich and self-contained ontology, we will refactor it to be a proper enumeration using `owl:oneOf`.
      - **[COMPLETED] 2n-i. Update Ontology:** In `src/ontology/v1/core/Header.jsonld`, locate the `granularity` property. Create a new class `dppk:GranularityValue` and define it with an `owl:oneOf` list containing individuals for each valid level (e.g., `dppk:Item`, `dppk:Batch`, etc.). Then, change the `rdfs:range` of the `dppk:granularity` property to `dppk:GranularityValue`. Pause and allow for user review.
      - **[COMPLETED] 2n-ii. Update Core Context:** In `src/contexts/v1/dpp-core.context.jsonld`, apply two changes to support the new enumeration.
          - **[COMPLETED] 2n-ii-a. Update `granularity` mapping:** Change the mapping for `granularity` from a simple string to an object with `"@type": "@vocab"` to ensure its value is processed as a term from the context's vocabulary. Pause and allow for user review.
          - **[COMPLETED] 2n-ii-b. Add enumeration mappings:** Add mappings for the enumeration members (`Item`, `Batch`, `Model`) to their full `dppk:` URIs. This allows the JSON payload to remain clean. Pause and allow for user review.
      - **[COMPLETED] 2n-iii. Update SHACL Shapes:** Review and update `core-shapes.shacl.jsonld` to validate against the new `dppk:GranularityValue` enumeration class instead of a list of strings. Pause and allow for user review.
      - **[DEPRECATED] 2n-iii. Update Examples:** Update all JSON-LD examples in `src/examples/*.json` that use the `granularity` property to use the new enumerated individuals (e.g., changing `"granularity": "Item"` to `"granularity": "dppk:Item"`). Pause and allow for user review.
      - **[COMPLETED] 2n-iv. Final Test Run:** Run the full `npm test` suite to ensure all changes are consistent and no regressions were introduced. Pause and allow for user review.
  - **[COMPLETED] 3. Verification Phase:**
    - **[COMPLETED] 3a. Run Full Test Suite:** After all implementation steps are complete, execute `npm test` to ensure that all changes are consistent and that all validation and transformation tests pass. Fix any regressions. Pause and allow the user to test and discuss next steps.