# Design Doc 018: DPP Toolkit Page & Architecture Refactor

## Goal
Create a centralized **DPP Toolkit** page (`src/toolkit/index.html`) while establishing a robust architecture (`src/lib` vs `src/util`) to separate internal site logic from public-facing SDK code. Additionally, ensure the public utilities are discoverable via an auto-generated index page.

## Motivation
- **Centralization:** Developers need utilities (Validator, Explorer) without using the Wizard.
- **Architecture:** Clear separation between "internal site code" (`lib`) and "public reference implementations" (`util`) ensures we publish clean, self-contained SDKs.
- **Discovery:** Public utilities need a dedicated landing page (`dist/util/index.html`) listing available libraries.

## Relationship to Other Designs
This design defines the **canonical architecture** for future features.
*   **Design 006 (Adapter Showcase):** The "Showcase" will be implemented as a tool within the `src/toolkit/` framework, not as a standalone page.
*   **Design 015 (Wizard Result Page):** The logic for generating HTML results should be placed in `src/lib/` (e.g., `src/lib/html-generator.js`) so it can be shared between the Wizard and the Toolkit's "Visualizer" tool.

## Technical Architecture

### 1. Directory Structure Strategy

*   **`src/util/` (Public SDKs):**
    *   **Purpose:** Generic, reusable libraries for the community.
    *   **Constraints:** No hardcoded paths to `dpp-keystone.org`.
    *   **Build Target:** `dist/util/`.
    *   **Discovery:** `dist/util/index.html` (auto-generated) lists these files.

*   **`src/lib/` (Internal Shared Code):**
    *   **Purpose:** Helper logic specific to the Keystone website (e.g., loaders fetching from `/spec/`).
    *   **Build Target:** `dist/lib/` (bundled with site).

*   **`src/toolkit/` (Feature UI):**
    *   **Purpose:** The Toolkit page UI and glue code.

## Implementation Plan

### Phase 1: Architectural Restructuring
*   **[COMPLETED] 1a. Create Directories:** Create `src/lib`.
*   **[COMPLETED] 1b. Update Build Script (`scripts/build-and-clean.mjs`):**
    *   **[COMPLETED] 1b.1.** Modify copy logic: Copy `src/util` to `dist/util` (instead of `dist/spec/util`).
    *   **[COMPLETED] 1b.2.** Add copy logic: Copy `src/lib` to `dist/lib`.
*   **[COMPLETED] 1c. Update Index Generator (`scripts/update-index-html.mjs`):**
    *   **[COMPLETED] 1c.1.** Update main index generation to scan `dist/util` for the "Utilities" section.
    *   **[COMPLETED] 1c.2.** Implement `generateUtilIndex()` function. It should scan `dist/util`, create an HTML page using `keystone-style.css`, and list all files with links.
*   **[COMPLETED] 1d. Refactor Loaders:**
    *   **[COMPLETED] 1d.1.** Move `src/wizard/schema-loader.js` to `src/lib/schema-loader.js`.
    *   **[COMPLETED] 1d.2.** Move `src/wizard/ontology-loader.js` to `src/lib/ontology-loader.js`.
*   **[COMPLETED] 1e. Update Wizard Imports:**
    *   **[COMPLETED] 1e.1.** Update `src/wizard/wizard.js` imports to point to `../../lib/`.
    *   **[COMPLETED] 1e.2.** Update `src/wizard/form-builder.js` (if it imports loaders) or any other dependents.
*   **[COMPLETED] 1f. Move Tests:**
    *   **[COMPLETED] 1f.1.** Create `testing/unit/lib/` directory.
    *   **[COMPLETED] 1f.2.** Move `testing/unit/schema-loader.test.js` and `testing/unit/ontology-loader.test.js` to `testing/unit/lib/`.
    *   **[COMPLETED] 1f.3.** Update import paths in these tests to point to the new `src/lib` location.
*   **[COMPLETED] 1g. Verify Refactor:** Run `npm test` to ensure no regressions in Wizard functionality.

### Phase 2: Validation Library (Public SDK)
*   **[COMPLETED] 2a. Create Validator Module:**
    *   **Goal:** Implement `src/util/js/common/validation/schema-validator.js`.
    *   **Logic:**
        *   Import `Ajv2020` and `ajv-formats`.
        *   Export `validateDpp(dppData, schemaContext)` function.
        *   `schemaContext` parameter should be an object: `{ baseSchema, sectorSchemas: { [specId]: schema }, commonSchemas: [schema] }`.
        *   Function should:
            *   Initialize Ajv.
            *   Add common schemas.
            *   Determine which sector schemas to apply based on `dppData.contentSpecificationIds`.
            *   Create a composite schema using `{ allOf: [baseSchema, ...selectedSectorSchemas] }`.
            *   Compile and validate.
            *   Return `{ valid: boolean, errors: array }`.
*   **[COMPLETED] 2b. Colocated Unit Tests:**
    *   **Goal:** Create `src/util/js/common/validation/testing/schema-validator.test.js`.
    *   **Logic:** Test `validateDpp` with mock schemas and data (no file system dependencies) to verify the combining logic and error reporting.
*   **[COMPLETED] 2c. Refactor Existing Integration Tests:**
    *   **Goal:** Update `testing/integration/dpp-examples.schema.test.js` to use the new library.
    *   **Logic:**
        *   Keep the file reading logic (loading real schemas/examples from `dist/`).
        *   Remove the inline `Ajv` setup and loop logic.
        *   Call `validateDpp` with the loaded files.
        *   Assert on the returned result.

### Phase 3: Validator UI (Standalone Tool)
*   **[COMPLETED] 3a. Rename and Update Scaffolding:**
    *   **Goal:** Rename `src/toolkit` to `src/validator`.
    *   **Files:**
        *   Rename `index.html`, `toolkit.css` (to `validator.css`).
    *   **Updates:**
        *   Update HTML to reference new CSS/JS filenames.
        *   Update HTML content to remove "Explorer" placeholder and focus on Validator.
        *   Ensure button styles match Wizard.
        *   Ensure textarea sizing.
*   **[COMPLETED] 3b. Refactor CSS (Design System):**
    *   **Goal:** promote generic UI styles to `src/branding/css/keystone-style.css` for reuse across Wizard and Validator.
    *   **Logic:**
        *   Move `button`, `input`, `select`, `.card` (or equivalent container styles) from `src/wizard/wizard.css` to `keystone-style.css`.
        *   Verify Wizard still looks correct.
        *   Ensure Validator inherits these styles.
*   **[COMPLETED] 3c. Build Configuration:**
    *   **Goal:** Update `scripts/build-and-clean.mjs`.
    *   **Logic:**
        *   Exclude `validator` from being copied to `dist/spec`.
        *   Add logic to copy `src/validator` to `dist/validator`.
*   **[COMPLETED] 3d. Implement Validator Logic:**
    *   **Goal:** Create `src/validator/validator.js` with JSONC support.
    *   **Sub-steps:**
        *   **[COMPLETED] 3d.1. Initial Logic:** Create `src/validator/validator.js` that imports `validateDpp`, fetches schemas, and wires up the UI for standard JSON validation.
        *   **[COMPLETED] 3d.2. Fix Module Resolution:** Update `src/validator/index.html` to include an `importmap` for resolving `ajv` and `ajv-formats` via `esm.sh`.
        *   **[COMPLETED] 3d.3. Fix Caching:** Update `scripts/build-and-clean.mjs` to apply cache busting to `validator/index.html`.
        *   **[COMPLETED] 3d.4. Implement Transparent JSONC Support:**
            *   Update `src/validator/index.html` import map to include `strip-json-comments` (via `esm.sh`).
            *   Update `src/validator/validator.js` to implement the "Transparent with Warning" logic:
                *   Attempt to parse input as strict JSON.
                *   If strict parsing fails, attempt to strip comments and parse again.
                *   If stripped parsing succeeds:
                    *   Display a warning: "Note: Comments were stripped from valid JSONC."
                    *   Proceed with schema validation using the stripped data.
                *   If stripped parsing fails, display the original parsing error.
*   **[COMPLETED] 3e. Integration Test:**
    *   **Goal:** Create `testing/integration/playwright/validator.spec.js`.
    *   **Logic:** Test loading the page, invalid input, and valid input.
*   **[COMPLETED] 3f. Update Landing Page:**
    *   **Goal:** Add the Validator to the Toolkit grid in `index.html`.
    *   **Logic:** Add a new card linking to `validator/index.html` in the "DPP Toolkit" section.

### Phase 4: Ontology Explorer
*   **[COMPLETED] 4a. Create Indexer:** Implement `src/lib/ontology-indexer.js`. It should have a function `buildIndex()` that uses `ontology-loader` to fetch all sectors and flatten them into a searchable array.
*   **[COMPLETED] 4b. Build UI:**
    *   **[COMPLETED] 4b.1.** Create `src/explorer/index.html` with Search Input and Results Table.
    *   **[COMPLETED] 4b.2.** Wire up search logic in `src/explorer/explorer.js`.

### Phase 5: Ontology Explorer Contextualization
*   **[COMPLETED] 5a. Enhance Loader (`src/lib/ontology-loader.js`):**
    *   **Goal:** Capture source context (file/module) and RDF type during parsing.
    *   **Logic:**
        *   Update `loadAndParseOntology` to parse the file URL (e.g., `../spec/ontology/v1/core/Product.jsonld`) to extract `moduleType` ('core' or 'sectors') and `moduleName` ('Product').
        *   Extract `rdf:type` from the term definition to distinguish between `rdfs:Class` and `rdf:Property`.
        *   Store `definedIn` (module path) and `type` in the ontology map values.
*   **[COMPLETED] 5b. Update Indexer (`src/lib/ontology-indexer.js`):**
    *   **Goal:** Generate documentation links and context labels.
    *   **Logic:**
        *   Implement `getFragment(id)` helper (consistent with `generate-spec-docs.mjs`).
        *   In `buildIndex()`, for each term:
            *   Generate `contextLabel`: `${moduleType} / ${moduleName}` (Title Case).
            *   Generate `docUrl`:
                *   If Class: `/spec/ontology/v1/${moduleType}/${moduleName}/${fragment}.html`.
                *   If Property: `/spec/ontology/v1/${moduleType}/${moduleName}/index.html#${fragment}`.
            *   Add `docUrl` and `contextLabel` to the returned index objects.
*   **[COMPLETED] 5c. Update Explorer UI (`src/explorer/explorer.js` & `.css`):**
    *   **Goal:** Display context and link to official docs.
    *   **Logic:**
        *   Update `renderResults`:
            *   Add a badge/label showing `term.contextLabel`.
            *   Wrap the Term ID/Label in an `<a>` tag pointing to `term.docUrl`.
            *   If `term.domain` is present, display "Applies to: [Domain]" (ideally linking to the domain class if known).
            *   Add visual distinction between Classes and Properties (e.g., icon or label).
*   **[COMPLETED] 5d. Unit Testing:**
    *   **Goal:** Verify logic for context extraction and URL generation.
    *   **Logic:**
        *   Update `testing/unit/lib/ontology-loader.test.js`: Test that `loadOntology` correctly populates `definedIn` and `type` fields.
        *   Create `testing/unit/lib/ontology-indexer.test.js`: Test `buildIndex` with mock data to ensure `docUrl` is constructed correctly for Classes vs Properties.
*   **[COMPLETED] 5e. E2E Testing:**
    *   **Goal:** Verify Explorer UI functionality.
    *   **Logic:**
        *   Create `testing/integration/playwright/explorer.spec.js`.
        *   Test loading the page (smoke test).
        *   Test searching for a known term (e.g., "Product").
        *   Verify that results display the "Context" badge and "View Spec" link.