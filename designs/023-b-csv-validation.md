# Design Doc 023-b: CSV Adapter Validation & Constraints

## Summary
This document outlines the second major iteration of the CSV-to-DPP Adapter. The focus is on **validation**, **type safety**, and **user guidance**. We aim to prevent invalid DPP generation by restricting user choices to valid options, enforcing schema requirements (like mandatory fields), and handling complex schema structures (like `oneOf`) correctly.

## Goals
1.  **Type-Safe Filtering:** Limit the manual matching drop-down to only show schema fields that are data-type compatible with the selected CSV column (e.g., don't offer a `number` field for a `string` column).
2.  **Requirement Enforcement:** Block the "Generate DPPs" action until all mandatory schema fields (e.g., `id`, `@context`) are satisfied either by mapping or constant values.
3.  **Smart Fuzzy Matching:** Improve the auto-mapping heuristics to consider data type compatibility, reducing false positives.
4.  **`oneOf` Conflict Resolution:** Prevent users from creating invalid mappings where a single object violates `oneOf` exclusivity (e.g., mapping fields belonging to two mutually exclusive branches of a schema).
5.  **Value-Level Validation:** Analyze the actual content of CSV columns to flag values that don't match the target schema format (e.g., enums, date formats) *before* generation.
6.  **Visual Feedback:** Provide clear, immediate visual cues in the UI (red/yellow highlights, error messages) when constraints are violated or requirements are missing.
7.  **Type Inference:** Implement a client-side engine to scan CSV column data and infer the most specific applicable primitive type (Boolean -> Number -> String).

## Implementation Plan

### [COMPLETED] Phase 1: Type Inference Engine
We need to know what's in the CSV before we can suggest where to put it.

*   **[COMPLETED] Step 1.1: Logic - Column Analysis**
    *   Create `analyzeColumnData(rows, headerIndex)` in `src/lib/csv-adapter-logic.js`.
    *   Logic: Scan all (or a sample of) rows for a specific column.
    *   Determine the "Best Fit" type/format:
        *   `Boolean` (true/false/0/1/yes/no).
        *   `Integer` (strict whole numbers).
        *   `Number` (any valid numeric).
        *   `Date` (ISO 8601 date/date-time strings).
        *   `Email` (simple regex check).
        *   `URI` (valid URL/URI structure).
        *   `String` (fallback).
        *   `Empty` (if all null/undefined/empty string).
    *   Return structure: `{ type: 'string', format: 'email' }` or `{ type: 'integer' }`.
*   **[COMPLETED] Step 1.2: Unit Tests**
    *   Update `testing/unit/csv-adapter-logic.test.js` to test mixed data, clean numbers, dirty strings, etc.

### Phase 2: Schema-Aware Filtering (The "Smart" Dropdown)
Restrict the available options in the autocomplete based on the inferred type.

*   **[COMPLETED] Step 2.1: Enhanced Schema Flattening**
    *   Update `flattenSchema` in `src/lib/schema-loader.js` to capture and return:
        *   `type`: The JSON Schema type (e.g., 'string', 'number'). Handle array types (e.g., `['string', 'null']`) by normalizing to the primary type.
        *   `format`: e.g., 'date-time', 'email'.
        *   `enum`: If present, to allow value checking later.
    *   Return object structure: `{ path, isArray, type, format, enum }`.
*   **[COMPLETED] Step 2.2: Compatibility Logic**
    *   Add `isTypeCompatible(csvType, schemaType)` to `csv-adapter-logic.js`.
    *   Rules:
        *   `String` column -> Fits `string` fields.
        *   `Number` column -> Fits `number` OR `string` fields.
        *   `Boolean` column -> Fits `boolean` OR `string` fields.
*   **[COMPLETED] Step 2.3: UI Integration**
    *   Update `csv-dpp-adapter.js` to run `analyzeColumnData` for every column upon file load.
    *   Update the `focus` handler for inputs: Filter `generateIndexedSuggestions` and the main list using `isTypeCompatible`.
    *   **[COMPLETED] Step 2.4: E2E Verification**
        *   Update `csv-dpp-adapter.spec.js`:
            *   Upload a CSV with known types (Text vs Number columns).
            *   Verify that for a Number column, text-only schema fields do NOT appear in suggestions.
            *   Verify that for a Text column, numeric schema fields do NOT appear.

### Phase 2.5: Ontology Integration (Refined Typing)
Enhance type compatibility checks using the project's ontology files (e.g. strict URI types, range validation).

*   **Step 2.5.1: Ontology Loading**
    *   **[COMPLETED]** Update `csv-dpp-adapter.js` to load ontologies using `ontology-loader.js`.
    *   **[COMPLETED]** Build an `ontologyMap` (merged into schema fields via `enrichSchemaWithOntology`).
*   **Step 2.5.2: Ontology-Aware Compatibility**
    *   **[COMPLETED]** Update `isTypeCompatible` to accept `ontologyInfo` (via `schemaField.ontology`).
    *   **[COMPLETED]** Use `ontologyInfo.range` (e.g. `xsd:date`, `xsd:anyURI`) to refine string matching.
*   **Step 2.5.3: Validation Metadata & UI Enhancements**
    *   **Dropdown:** Display the field type (e.g., `xsd:dateTime` or `string`) next to the field name in the suggestion list. Add the ontology description as a tooltip (`title` attribute).
    *   **Config Loading:** When applying a saved config, check compatibility between the CSV column's inferred type and the saved schema field.
    *   **Visual Feedback:** If a type mismatch occurs on load, mark the row with an error style (Red) and show a tooltip explaining the mismatch (e.g., "Column is String, but Field requires Number").
*   **[COMPLETED] Step 2.5.4: "Show Incompatible" Toggle (UX Improvement)**
    *   Add a toggle (checkbox) in the mapping table header or near the "Approve All" button: "Show incompatible fields".
    *   When enabled, `isTypeCompatible` filtering in the dropdown is disabled.
    *   Incompatible fields appear in the dropdown but are visually distinct (e.g., greyed out text, warning icon).
    *   Selection of an incompatible field triggers the existing row validation error (Step 2.5.3).

### Phase 3: Structural Validation (`oneOf` Handling)
Prevent invalid object construction logic.

*   **[COMPLETED] Step 3.1: Conflict Detection Logic**
    *   Create `validateMappingConstraints(currentMapping, flatSchema)` in `csv-adapter-logic.js`.
    *   **Algorithm**:
        *   Iterate through all mapped paths.
        *   Identify paths that belong to `oneOf` groups (requires schema metadata from Step 2.1).
        *   Detect if multiple branches of a `oneOf` are active for the same object instance.
    *   Return a list of `conflicts` (e.g., `['path.to.fieldA', 'path.to.fieldB']`).
*   **[COMPLETED] Step 3.2: UI Feedback**
    *   In `csv-dpp-adapter.js`, run validation on every change.
    *   If a conflict is detected, highlight the conflicting rows in Red.
    *   Display a tooltip or error message: "Cannot map to 'X' because 'Y' is already mapped and they are mutually exclusive."
    *   **[COMPLETED] Step 3.3: E2E Verification**
        *   Update `csv-dpp-adapter.spec.js`:
            *   Map two conflicting fields (e.g. from different `oneOf` branches).
            *   Verify the row gets the error class.
            *   Verify the "Generate" button is disabled (if Phase 4 logic is active) or warning is visible.

*   **[COMPLETED] Step 3.4: Proactive Filtering (UX Enhancement)**
    *   Update `showDropdown` to check each suggestion against the *current mapping state* for `oneOf` conflicts.
    *   If a field would cause a conflict if selected:
        *   Mark it as `incompatible` (using the same mechanism as Step 2.5.4).
        *   Update tooltip to explain the conflict (e.g., "Conflict with existing mapping: 'otherField'").
    *   This prevents users from creating invalid mappings in the first place, rather than just warning them afterwards.

### Phase 4: Requirement Enforcement & Blocking
Ensure the minimum viable product is generated.

*   **Step 4.1: Missing Requirements Logic**
    *   Add `getMissingRequiredFields(currentMapping, flatSchema)` to `csv-adapter-logic.js`.
    *   Logic: Check if all root-level `required` fields (and recursively, required fields of mapped objects) are present.
*   **Step 4.2: UI "Gatekeeping"**
    *   Add a status section above the "Generate" button.
    *   Show "Ready" (Green) or "Missing Fields: [List]" (Red).
    *   Disable the "Generate DPPs" button if critical requirements are missing or if `oneOf` conflicts exist.
    *   **Step 4.3: E2E Verification**
        *   Update `csv-dpp-adapter.spec.js`:
            *   Upload CSV.
            *   Verify "Generate" is initially disabled (assuming required fields like ID/Context are missing).
            *   Map all required fields.
            *   Verify "Generate" becomes enabled.

### Phase 5: Value & Format Validation
Check the data itself.

*   **Step 5.1: Value Validator**
    *   Create `validateColumnValues(rows, headerIndex, schemaField)` in `csv-adapter-logic.js`.
    *   Check for:
        *   `enum` constraints (if the schema field has a fixed list).
        *   `format` constraints (e.g., `date-time`, `uri`).
*   **Step 5.2: UI Warning**
    *   If a user maps a column to a field, run this validation immediately.
    *   If < 100% valid, show a Yellow warning icon on the row.
    *   Tooltip: "3 rows contain invalid values for this field."
    *   **Step 5.3: E2E Verification**
        *   Update `csv-dpp-adapter.spec.js`:
            *   Map a text column to a Date field.
            *   Verify the warning icon appears.
            *   Verify the tooltip content.
*   **Step 5.4: Schema-Aware Type Coercion**
    *   Update `generateDPPsFromCsv` in `csv-adapter-logic.js` to stop aggressively converting all numeric-looking strings to numbers.
    *   Pass the `schemaFields` (or type map) to the generator.
    *   Only convert string values to Numbers if the target schema field type is `number` or `integer`.
    *   Preserve strings (e.g. "42") if the target is `string` (e.g. Brand Name).

### Phase 6: Refinement & E2E Testing
*   **Step 6.1: E2E Tests**
    *   Create `testing/integration/playwright/csv-adapter-validation.spec.js`.
    *   Test cases:
        *   Upload CSV with text data -> Verify Number fields are NOT in dropdown.
        *   Map conflicting `oneOf` fields -> Verify Error UI and Disabled Generate button.
        *   Map partial requirements -> Verify Disabled Generate button.
        *   Fix mapping -> Verify Enabled Generate button.

