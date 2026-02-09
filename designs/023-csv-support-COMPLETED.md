# Design Doc 023: Client-Side CSV to DPP Generator

## Summary
This design introduces a standalone, client-side utility (`src/csv-generator`) that allows users to generate Digital Product Passport (DPP) JSON files from a local CSV database dump. The tool runs entirely in the browser, leveraging the File API and a vendored CSV parsing library (`PapaParse`) to read user data, map it to the DPP schema, and export standard JSON-LD DPPs. This enables batch generation without server-side processing or data upload.

## Goals
1.  **Offline Batch Generation:** Enable users to convert existing product databases (CSV) into DPP format securely in the browser.
2.  **Schema Mapping:** Provide a UI to map CSV headers to standard DPP schema fields.
3.  **Configurable Workflows:** Allow users to save and load their "CSV-to-DPP" mapping configurations for repeated use.
4.  **No Server Dependencies:** Ensure all parsing and generation happens locally using static assets.

## Implementation Plan

### Phase 1: Foundation & Dependencies
*   **[COMPLETED] Step 1.1: Vendor PapaParse**
    *   Download `papaparse.min.js` (MIT License).
    *   Place it in `src/lib/vendor/papaparse.min.js`.
*   **[COMPLETED] Step 1.2: Refactor Shared Logic**
    *   Create `src/util/js/common/dpp-data-utils.js`.
    *   Extract the `setProperty` function (and any relevant helper logic) from `src/wizard/dpp-generator.js` into this new utility.
    *   Update `src/wizard/dpp-generator.js` to import and use `setProperty` from the shared utility.
*   **[COMPLETED] Step 1.3: Verify Refactor**
    *   Run existing Wizard tests (`testing/unit/dpp-generator.test.js` or `wizard.test.js`) to ensure no regression.

### Phase 2: Application Skeleton
*   **[COMPLETED] Step 2.1: Create Directory Structure**
    *   Create `src/csv-generator/`.
    *   Create `src/csv-generator/index.html`.
    *   Create `src/csv-generator/csv-generator.css`.
    *   Create `src/csv-generator/csv-generator.js`.
*   **[COMPLETED] Step 2.2: Basic UI Layout**
    *   Implement a clean HTML structure with three main sections:
        1.  **Source:** File Input for CSV.
        2.  **Mapping:** Container for the mapping table (initially hidden).
        3.  **Action:** Buttons for "Load Config", "Save Config", and "Generate DPPs".
*   **[COMPLETED] Step 2.3: Project Integration**
    *   Update `scripts/update-index-html.mjs` (or manually update `index.html`) to include the CSV Generator in the main project index page.

### Phase 3: Core Logic (Parsing & Mapping)
*   **[COMPLETED] Step 3.1: CSV Parsing**
    *   Implement file load handler in `csv-generator.js`.
    *   Use `Papa.parse()` to parse the uploaded file.
    *   Extract headers (first row) and display a success message with row count.
*   **[COMPLETED] Step 3.2: Schema Loading**
    *   Reuse `src/lib/schema-loader.js` to fetch available DPP fields (e.g., `tradeName`, `description`, `manufacturer.name`).
    *   Flatten the schema structure into a list of selectable "Target Fields".
*   **[COMPLETED] Step 3.3: Mapping Interface**
    *   Dynamically generate a table where each row corresponds to a CSV Header.
    *   Add a dropdown selector for each row populated with the flattened DPP Schema fields.
    *   Include a "Constant Value" option for fields that don't exist in the CSV but are required (e.g., generic context URLs).

### Phase 4: Configuration & Generation
*   **[COMPLETED] Step 4.1: Configuration Management**
    *   Implement `exportMapping()`: Serializes the current dropdown state to a JSON object (e.g., `{ "CSV_Col_A": "dpp_field_b" }`).
    *   Implement `importMapping()`: Reads a JSON config file and pre-fills the dropdowns.
*   **[COMPLETED] Step 4.2: Generation Logic**
    *   Implement the generation loop:
        *   Iterate through parsed CSV rows.
        *   For each row, create a new object.
        *   Apply the mapping: Use `setProperty(obj, targetField, csvValue)`.
        *   Inject required static fields (like `@context`).
*   **[COMPLETED] Step 4.3: Download Feature**
    *   Bundle the generated objects into a JSON array (or JSON Lines format).
    *   Create a `Blob` and trigger a browser download for `dpp-batch-export.json`.

### Phase 5: Verification
*   **[COMPLETED] Step 5.1: Manual Testing**
    *   Test with a sample CSV file containing typical product data.
    *   Verify the generated JSON validates against the DPP schema (using the existing Validator tool).
*   **[COMPLETED] Step 5.2: Documentation**
    *   Add a brief `README.md` or help text within the tool explaining the mapping format.

### Phase 6: Architecture Refinement & Testing (Iteration 2)
*   **[COMPLETED] Step 6.1: Renaming & Restructuring**
    *   Rename the feature directory from `src/csv-generator` to `src/csv-dpp-adapter` to better reflect its function (adapting CSV to DPP, not generating CSVs).
    *   Update all references in `index.html` and other files.
    *   Move internal logic (like `setProperty` wrappers or mapping helpers) from `src/util` (public SDK) to `src/lib/csv-adapter-logic.js` (project-internal library).
*   **[COMPLETED] Step 6.2: Build Integration**
    *   Update `scripts/build-and-clean.mjs` to ensure the `src/csv-dpp-adapter` directory is correctly copied/processed into the `dist/` folder during build.
    *   Verify `dist/csv-dpp-adapter/index.html` is accessible after build.
*   **Step 6.3: Comprehensive Testing**
    *   **[COMPLETED] Unit Tests:** Create `testing/unit/csv-dpp-adapter.test.js` to verify:
        *   CSV parsing behavior (mocking/using PapaParse).
        *   Schema mapping logic (CSV row -> DPP JSON transformation).
    *   **E2E Tests:** Create `testing/integration/playwright/csv-adapter.spec.js` to test the full user journey:
        *   Navigating to the tool.
        *   Uploading a CSV file.
        *   Configuring a mapping.
        *   Generating and validating the download blob (if possible) or success state.

### Phase 7: Usability & Polish (Iteration 3)
*   **Step 7.1: Fix Schema Loading & Flattening**
    *   **[COMPLETED] Step 7.1.1: Define Unit Tests:** Create `testing/unit/schema-loader.test.js` to define expected behavior for `flattenSchema`. Include test cases for:
        *   Basic property traversal.
        *   `allOf` merging.
        *   `oneOf` / `anyOf` unions.
        *   `if`/`then`/`else` conditional branches.
    *   **[COMPLETED] Step 7.1.2: Implement & Centralize Flattening Logic:** Implement the robust `flattenSchema` in `src/lib/schema-loader.js` to satisfy the new tests, and remove the legacy implementation from `src/csv-dpp-adapter/csv-dpp-adapter.js`.
    *   **[COMPLETED] Step 7.1.3: Adapter Integration:** Update `src/csv-dpp-adapter/csv-dpp-adapter.js` to import and use the new `flattenSchema` from the library.
    *   **[COMPLETED] Step 7.1.4: Core Schema Integration:** Ensure the adapter always loads the 'dpp' (Core) schema fields in addition to the selected sector(s), merging them into the available "Target Fields" list.
*   **Step 7.2: Autocomplete UI**
    *   **[COMPLETED] Step 7.2.1: Extract & Test Auto-Mapping Logic:**
        *   Extract the "smart auto-map" heuristic (matching CSV headers to schema fields) from `csv-dpp-adapter.js` into `src/lib/csv-adapter-logic.js` as `findBestMatch(header, availableFields)`.
        *   Add unit tests in `testing/unit/csv-dpp-adapter.test.js` to verify it correctly matches headers like "Manufacturer Name" to `manufacturer.name` and handles no-matches gracefully.
    *   **[COMPLETED] Step 7.2.2: DOM Structure Update:** Modify `renderMappingTable` in `src/csv-dpp-adapter/csv-dpp-adapter.js` to replace the `<select>` element with an `<input>` element linked to a shared `<datalist>`.
        *   Create a single `<datalist id="schema-fields-list">` in the DOM (e.g., appended to `action-section` or a new hidden container).
    *   **[COMPLETED] Step 7.2.3: Event Handling:** Update `getMappingConfig` and `applyMappingConfig` to read/write values from the new `<input>` fields instead of `<select>` elements.
        *   Update the logic to use the new `findBestMatch` function for initial population.
    *   **[COMPLETED] Step 7.2.4: UX Improvements:** Add a placeholder (e.g., "Type to search...") and ensure the input clears easily.
    *   **[COMPLETED] Step 7.2.5: Clean Up:** Remove the old `<select>` generation logic.
*   **Step 7.3: Enhanced Auto-Mapping (Synonyms & Heuristics)**
    *   **[COMPLETED] Step 7.3.1: Synonym Dictionary:**
        *   Add a `SYNONYM_MAP` constant in `src/lib/csv-adapter-logic.js`.
        *   Map common industry terms to DPP field paths (e.g., "EAN" -> `identifiers.gtin`, "Brand" -> `tradeName`, "Expiry" -> `lifespan.manufactureDate`).
    *   **[COMPLETED] Step 7.3.2: Fuzzy Matching (Levenshtein):**
        *   Implement a lightweight Levenshtein distance function in `src/lib/csv-adapter-logic.js`.
        *   Update `findBestMatch` to:
            1.  Check exact match.
            2.  Check `SYNONYM_MAP`.
            3.  Check Levenshtein distance against all field names (and leaf names) to find the closest match above a certain similarity threshold.
    *   **[COMPLETED] Step 7.3.3: Acronym Matching:**
        *   Implement a helper to generate acronyms from camelCase keys (e.g., `digitalProductPassportId` -> `DPPI`).
        *   Add a final pass in `findBestMatch` to compare the header against these acronyms (using fuzzy or exact matching) for any remaining unmatched fields.
    *   **[COMPLETED] Step 7.3.4: Verification:**
        *   Add unit tests in `testing/unit/csv-dpp-adapter.test.js` covering synonyms, typos (e.g. "Manufacutrer"), and acronyms (e.g. "DPPID").

*   **Step 7.4: Mapping Review & Constraints**
    *   **[COMPLETED] Step 7.4.1: Enhanced Schema Flattening:**
        *   Update `flattenSchema` in `src/lib/schema-loader.js` to correctly traverse `items` (for arrays).
        *   Change the return signature from `string[]` to `Array<{ path: string, isArray: boolean }>`.
        *   Refactor recursive logic to propagate the `isArray` flag if a parent is an array, or if the property itself is an array of primitives.
    *   **[COMPLETED] Step 7.4.2: Adapter Integration:**
        *   Update `src/csv-dpp-adapter/csv-dpp-adapter.js` (and `logic` helpers if needed) to handle the new object structure.
        *   Store the full metadata (path + isArray) for all available fields.
        *   Update `findBestMatch` to accept/work with this new structure (or map it back to strings temporarily if easier, but ideally we pass the full info).
    *   **[COMPLETED] Step 7.4.3: Review UI (Checkboxes):**
        *   Add a checkbox column to the mapping table in `csv-dpp-adapter.js` / `renderMappingTable`.
        *   **Behavior:**
            *   Initially unchecked for all rows.
            *   **Auto-Check:** If the user manually selects a value from the dropdown (input change event), programmatically check the box.
            *   **Styles:** Add visual styling (e.g., yellow background) for unchecked rows to draw attention.
        *   **Validation:**
            *   Disable "Generate DPPs" button until all rows are checked (verified).
            *   Allow checking a box even if Target Field is empty (explicitly confirming "Ignore this column").
    *   **[COMPLETED] Step 7.4.4: Unique Selection Constraint:**
        *   **Logic:**
            *   Maintain a tracked state of `selectedFieldPaths`.
            *   When rendering (or clicking) the dropdown input for a specific row, filter the `<datalist>`.
            *   **Filter Rule:** A field is available IF:
                *   It is NOT currently selected in another row.
                *   OR `field.isArray` is true (can be mapped multiple times).
                *   OR it is the value currently selected in *this* row.
        *   **Implementation:**
            *   Update the single shared datalist on `focus` event of any mapping input.
            *   Calculate the "forbidden" list (all selected values from *other* rows where !isArray).
            *   Rebuild options excluding forbidden ones.

*   **Step 7.5: UI Polish**
    *   **[COMPLETED] Step 7.5.1: Button Styling:** Fix the "Load Config" and "Save Config" buttons where text is reportedly invisible (likely white text on light background or missing styles).

*   **Step 7.6: General Product Data Support**
    *   **[COMPLETED] Step 7.6.1: Schema Availability:** Ensure `dpp-general-product` is available as a selectable sector or implicitly included.
    *   **[COMPLETED] Step 7.6.2: Validation:** Verify that general product fields (like `productName`, `image`) appear in the autocomplete list.

*   **[COMPLETED] Step 7.7: Optional Packaging Support**
    *   **[COMPLETED] Step 7.7.1: UI Control:** Add a "Include Packaging" checkbox to the sector selection area.
    *   **[COMPLETED] Step 7.7.2: Logic Update:** Update `updateSchema` to conditionally load `dpp-packaging` schema when checked.
    *   **[COMPLETED] Step 7.7.3: Context Handling:** Ensure the packaging context is added to the generated JSON if selected.

*   **Step 7.8: Comprehensive E2E Testing**
    *   **[COMPLETED] Step 7.8.1: Test Setup & Navigation**
        *   Create `testing/integration/playwright/csv-adapter-e2e.spec.js`.
        *   Test 1: Navigate to `/src/csv-dpp-adapter/index.html`. Verify page title is "DPP CSV Adapter".
        *   Test 2: Verify "Load Data" section is visible.
        *   Test 3: Verify "Map Fields" and "Generate" sections are initially hidden.
    *   **[COMPLETED] Step 7.8.2: Sector Selection Logic**
        *   Test 4: Verify default state (e.g. no sectors checked, or whatever default is).
        *   Test 5: Check 'Construction'. Verify schema loading triggers (via network spy or waiting for internal state).
        *   Test 6: Check 'Packaging' (Add-on). Verify schema loading.
        *   Test 7: Uncheck a sector. Verify implicit state update (this might be hard to test directly without inspecting internal `schemaFields`, but we can test it via autocomplete options later).
    *   **[COMPLETED] Step 7.8.3: CSV Upload & Parsing**
        *   Test 8: Upload `src/examples/csv/battery-product.csv` (using `setInputFiles`).
        *   Test 9: Verify "Loaded: battery-product.csv" text appears.
        *   Test 10: Verify row count display matches the file line count (minus header).
        *   Test 11: Verify "Map Fields" and "Generate" sections become visible.
        *   Test 12: Verify the Mapping Table renders the correct number of rows (one per CSV header).
        *   Test 13: Verify sample values in the table match the first row of the CSV.
    *   **[COMPLETED] Step 7.8.4: Mapping Logic & Constraints (The "Global Greedy" & UI Tests)**
        *   Test 14: **Auto-Mapping:** Verify known headers (e.g., "Brand") have their inputs pre-filled with `tradeName`.
        *   Test 15: **Scalar Uniqueness (Forward):** Select `identifiers.gtin` for Row 1. Focus input for Row 2. Verify `identifiers.gtin` is NOT in the suggestions list.
        *   Test 16: **Scalar Uniqueness (Reverse):** Clear `identifiers.gtin` from Row 1. Focus input for Row 2. Verify `identifiers.gtin` IS back in the suggestions list.
        *   Test 17: **Array Exception:** Select `referenceDocuments` (an array field) for Row 1. Focus input for Row 2. Verify `referenceDocuments` REMAINS available.
        *   Test 18: **Self-Exclusion:** For Row 1 (mapped to `gtin`), focus the input. Verify `gtin` IS in the list (so you don't lose your current selection).
    *   **[COMPLETED] Step 7.8.5: Review Workflow (Checkboxes & Buttons)**
        *   Test 19: Verify "Generate DPPs" button is DISABLED initially.
        *   Test 20: Verify "Save Mapping Config" button is DISABLED initially.
        *   Test 21: Verify rows with auto-suggestions are NOT checked by default (user must confirm).
        *   Test 22: Manually check the box for Row 1. Verify `needs-review` style is removed.
        *   Test 23: Type/Change mapping for Row 2. Verify the row is AUTO-CHECKED.
        *   Test 24: Check all boxes. Verify "Generate DPPs" and "Save Mapping Config" buttons become ENABLED.
        *   Test 25: Uncheck one box. Verify buttons become DISABLED again.
    *   **[COMPLETED] Step 7.8.6: Configuration Persistence**
        *   Test 26: **Save:** With a fully mapped and checked state, click "Save Mapping Config". Intercept the download and verify the JSON content matches the current UI state.
        *   Test 27: **Load:** Reload the page. Upload the same CSV. Click "Load Mapping Config" and upload the JSON from Test 26.
        *   Test 28: **Verify Restoration:** Verify all inputs have the correct values and ALL checkboxes are checked (config implies reviewed state).
    *   **[COMPLETED] Step 7.8.7: Generation & Output**
        *   Test 29: Click "Generate DPPs". Intercept download.
        *   Test 30: **Content Verification:**
            *   Parse the downloaded JSON.
            *   Verify it is an Array of objects.
            *   Verify array length matches CSV row count.
            *   Verify specific fields: Row 1 "Brand" value in CSV matches `tradeName` in JSON.
            *   Verify `@context` array includes `dpp-core`, `dpp-battery`, etc. (based on selection).
            *   Verify numeric fields (e.g. `weight`) are numbers, not strings.
            *   Verify boolean fields (if any) are booleans.

*   **[COMPLETED] Step 7.9: Advanced Array Support (Indexed Paths)**
    *   **Problem:** Mapping multiple CSV columns to an array (e.g. `components`) is ambiguous regarding object identity and order.
    *   **Goal:** Define and implement a robust strategy for indexed paths (e.g. `components[0].name`) covering complex edge cases.
    *   **Scenarios to Cover:**
        *   **[COMPLETED] Step 7.9.1: Basic Indexing:** Support explicit bracket notation `[0]`, `[1]` in `setProperty`.
        *   **[COMPLETED] Step 7.9.2: Sparse/Skipped Indices:** Verify behavior when indices are missing (e.g. `Mat 1` and `Mat 3`). Should it compact or leave holes? (Goal: Compact/Dense arrays preferred for JSON).
        *   **[COMPLETED] Step 7.9.3: Unordered Headers:** Verify behavior when columns appear out of order (e.g. `Mat 2` before `Mat 1`).
        *   **[COMPLETED] Step 7.9.5: Deep Nesting:** Support arrays within arrays (e.g. `components[0].parts[0].name`).
        *   **[COMPLETED] Step 7.9.6: Manual Overrides (E2E):** 
            *   **Goal:** Verify that user-typed specific indices (e.g. `[5]`) are respected by the UI and result in correctly grouped (and compacted) output.
            *   **Behavior:** Input `items[5]` should group data with other `items[5]` fields. Final output should be compacted (e.g. if `0-4` are empty, `items[5]` becomes `items[0]`).
        *   **[COMPLETED] Step 7.9.7: Advanced Array Strategies (UI):**
            *   **Selected Approach:** Context-Aware Path Selection (Option 1).
            *   **[COMPLETED] Step 7.9.7.1: Logic Extraction & Unit Testing:**
                *   Create `findUsedIndices(currentMapping, arrayFieldPath)` in `src/lib/csv-adapter-logic.js`.
                *   Create `generateIndexedSuggestions(field, usedIndices)` in `src/lib/csv-adapter-logic.js`.
                *   **Test:** Verify that if `arr[0].name` is mapped, `usedIndices` returns `[0]`.
                *   **Test:** Verify that suggestions include `arr[0].*` (existing) and `arr[1].*` (new).
            *   **[COMPLETED] Step 7.9.7.2: Logic Integration (Data Collection):**
                *   Update `src/csv-dpp-adapter/csv-dpp-adapter.js` to collect the current mapping state from all inputs effectively.
                *   Ensure this state is accessible when the `focus` event triggers.
            *   **[COMPLETED] Step 7.9.7.3: Dynamic Datalist Generation:**
                *   Update the `focus` event handler in `csv-dpp-adapter.js`.
                *   Call `findUsedIndices` and `generateIndexedSuggestions`.
                *   Dynamically rebuild the `<datalist>` options to show specific indexed paths (e.g., `components[0].name`, `components[1].name`).
            *   **[COMPLETED] Step 7.9.7.4: E2E Verification:**
                *   Update Playwright tests to verify:
                    *   Assign `arr[0].name` to Row 1.
                    *   Focus Row 2.
                    *   Verify suggestions include `arr[0].weight` (join) and `arr[1].name` (start new).

## Phase 8: Stabilization & Reliability
*   **Step 8.1: Fix Playwright Flakiness**
    *   Investigate and fix timeouts in E2E tests.
    *   Add appropriate `wait` statements (e.g., `waitForSelector`, `waitForLoadState`) to ensure robust element interaction.

## Phase 9: Validation Integration
*   **Step 9.1: CSV Data Validation**
    *   **Goal:** Ensure generated DPPs comply with the schema/ontology before export.
    *   **Implementation:** Reuse the existing DPP Validator logic (`src/validator/validator.js` or `src/lib/schema-validator.js`).
    *   **Workflow:**
        *   After generation (but before download), run the validation suite on the generated objects.
        *   Display a summary report (e.g., "3 Rows Invalid").
        *   Allow users to download a "Validation Report" or see inline errors.

## Phase 10: Future Improvements
*   **Step 10.1: User-Defined Voluntary Fields**
    *   **UI for Custom Fields:** Allow users to type a custom field path in the input box even if it's not in the datalist.
    *   **Schema Mapping for Complex Types:** Support mapping to `additionalProductCharacteristics` or `additionalOrganizationIds`.
    *   **Validation:** Ensure these custom fields are structured correctly in the output JSON.