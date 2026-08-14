# 2026-08-13 EC Battery Requirements Update

## Context
The European Commission published a refinement to the battery data point requirements, making the required and forbidden fields highly conditional based on the battery category (EV, LMV, or Industrial). 

To avoid complex conditional logic within a single JSON schema, we are splitting the existing `battery.schema.json` into three separate schemas. The underlying ontology and context will remain untouched, as they already contain the necessary data definitions.

## Step 1: Create Sector-Specific Battery Schemas
*   **Task:** [DONE] Create three new schema files in `src/validation/v3/json-schema/sector/`:
    *   `battery-ev.schema.json`
    *   `battery-lmv.schema.json`
    *   `battery-industrial.schema.json`
*   **Details:**
    *   Use the properties from the original `battery.schema.json` as a base.
    *   Assign each schema a unique `contentSpecificationId` (e.g., `https://dpp-keystone.org/spec/validation/{{VERSION}}/json-schema/sector/battery-ev.schema.json`).
    *   Map the `required` fields for each schema strictly according to the EC requirements document (`docs/sensitive/battery-ec-requirements.md`).
    *   Explicitly forbid or omit fields marked as "Not to be filled/displayed" for that specific category (e.g., carbon footprint data, or SOCE for non-EV batteries).

## Step 2: Deprecate the Old Battery Schema
*   **Task:** [DONE] Mark `src/validation/v3/json-schema/sector/battery.schema.json` as deprecated instead of deleting it.
*   **Details:** Add `"deprecated": true` to the top level of the JSON Schema and update its `description` to point users to the new category-specific schemas. This ensures the change is fully backward-compatible and won't force a major version bump.

## Step 3: Update Example Data Payloads
*   **Task:** [DONE] Update the existing example DPPs and add new ones to cover all three categories.
*   **Details:**
    *   Modify `src/examples/battery-dpp-v1.json` to conform to the new `battery-ev.schema.json` (update its `contentSpecificationIds` and ensure it has all EV-mandatory fields and lacks forbidden ones).
    *   Create a new example for LMV (`battery-lmv-dpp-v1.json`).
    *   Create a new example for Industrial (`battery-industrial-dpp-v1.json`).

## Step 4: Update Validation Tests
*   **Task:** [DONE] Implement mandatory activation and inactivation tests for all three new schemas.
*   **Details:**
    *   Following the methodology in `src/validation/README.md`, ensure there are tests proving that each schema correctly activates when its `contentSpecificationId` is present and correctly ignores payloads when it is not.
    *   Verify that `npm test` passes and that SHACL validation still succeeds for the expanded graphs of the new examples.

## Step 5: Update the Wizard & CSV Adapter (If Necessary)
*   **Task:** [DONE] Check if the web utilities need updates to reflect the three new battery schemas instead of the single generic one.
*   **Details:**
    *   The Wizard (`src/wizard/`) may need its sector selection UI updated to offer "Battery - EV", "Battery - LMV", and "Battery - Industrial" instead of just "Battery".
    *   The CSV Adapter (`src/csv-dpp-adapter/`) might need its sector mapping templates adjusted.

## Step 6: Consolidate Sector Mappings
*   **Task:** [DONE] Centralize scattered sector string and URL mapping logic into a single `src/lib/sector-mappings.js` file.
*   **Details:** 
    *   [DONE] create failing tests for csv adapter
    *   [DONE] fix the bug in csv adapter logic
    *   [DONE] factor sector mapping from csv-adapter to new sector-mappings.js in src/lib
    *   [DONE] retest and iterate until fixed on unit and playwright tests for csv adapter.
    *   [DONE] factor sector related mappings from the wizard and its dependencies to sector-mappings.js
    *   [DONE] Ask user to retest wizard unit and integration tests
    *   [DONE] factor sector related mappings from validator tool code and its dependencies to sector-mappings.js
    *   [DONE] Ask user to retest validator
    *   [DONE] Iterate on any newly broken tests.

## Step 7: Audit mappings for completeness and accuracy
*   **Task:** [PENDING] Review and fix the mappings table that was implemented for this project based on docs/sensitive/battery-ec-requirements.md
*   **Details:** 
    *   [DONE] Compare the schemas for the different battery categories to the EC mappings and ensure that the implementation is truly complete and that all fields required by the EC requirements are required in the schemas.
    *   [DONE] Fix any mismatches but first discuss what was found with the user and brainstorm if the rest of this Step 7 needs to be updated.
    *   [DONE] create failing playwright test case every for every single battery category which tests for the string "[undefined]" which should not appear on the page for any category but currently does.
    *   [DONE] Update Examples to reflect schema changes.
    *   [PENDING] Add every single missing term as a subtask exactly below this line for us to either
    reuse an existing battery ontology field that was already mapped in the legacy schema or to create a
    new one.
    *   [DONE] Re-enable `materialComposition` as a required Component array in the EV, LMV, and Industrial schemas.
    *   [DONE] Map or create term for ohmicResistance (EC 66)
    *   [DONE] Map or create term for internalResistance (dynamic) (EC 55)
    *   [DONE] translate newly added fields using the documented translator agent process
    *   [DONE] update the context mapping for battery to ensure it covers all schema fields and all new terms
    terms.
    *   [DONE] ensure that any new terms are skos mapped to any existing applicable ontologies.
    *   [PENDING] retest and iterate on any newly broken tests.
    