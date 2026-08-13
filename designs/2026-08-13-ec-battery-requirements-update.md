# 2026-08-13 EC Battery Requirements Update

## Context
The European Commission published a refinement to the battery data point requirements, making the required and forbidden fields highly conditional based on the battery category (EV, LMV, or Industrial). 

To avoid complex conditional logic within a single JSON schema, we are splitting the existing `battery.schema.json` into three separate schemas. The underlying ontology and context will remain untouched, as they already contain the necessary data definitions.

## Step 1: Create Sector-Specific Battery Schemas
*   **Task:** Create three new schema files in `src/validation/v3/json-schema/sector/`:
    *   `battery-ev.schema.json`
    *   `battery-lmv.schema.json`
    *   `battery-industrial.schema.json`
*   **Details:**
    *   Use the properties from the original `battery.schema.json` as a base.
    *   Assign each schema a unique `contentSpecificationId` (e.g., `urn:eu:dpp:battery:ev:v1`).
    *   Map the `required` fields for each schema strictly according to the EC requirements document (`docs/sensitive/battery-ec-requirements.md`).
    *   Explicitly forbid or omit fields marked as "Not to be filled/displayed" for that specific category (e.g., carbon footprint data, or SOCE for non-EV batteries).

## Step 2: Deprecate the Old Battery Schema
*   **Task:** Delete `src/validation/v3/json-schema/sector/battery.schema.json`.
*   **Details:** Ensure no remaining references exist to the generic battery schema in the codebase (e.g., in index generators or build scripts, though they should be dynamic).

## Step 3: Update Example Data Payloads
*   **Task:** Update the existing example DPPs and add new ones to cover all three categories.
*   **Details:**
    *   Modify `src/examples/battery-dpp-v1.json` to conform to the new `battery-ev.schema.json` (update its `contentSpecificationIds` and ensure it has all EV-mandatory fields and lacks forbidden ones).
    *   Create a new example for LMV (`battery-lmv-dpp-v1.json`).
    *   Create a new example for Industrial (`battery-industrial-dpp-v1.json`).

## Step 4: Update Validation Tests
*   **Task:** Implement mandatory activation and inactivation tests for all three new schemas.
*   **Details:**
    *   Following the methodology in `src/validation/README.md`, ensure there are tests proving that each schema correctly activates when its `contentSpecificationId` is present and correctly ignores payloads when it is not.
    *   Verify that `npm test` passes and that SHACL validation still succeeds for the expanded graphs of the new examples.

## Step 5: Update the Wizard & CSV Adapter (If Necessary)
*   **Task:** Check if the web utilities need updates to reflect the three new battery schemas instead of the single generic one.
*   **Details:**
    *   The Wizard (`src/wizard/`) may need its sector selection UI updated to offer "Battery - EV", "Battery - LMV", and "Battery - Industrial" instead of just "Battery".
    *   The CSV Adapter (`src/csv-dpp-adapter/`) might need its sector mapping templates adjusted.
