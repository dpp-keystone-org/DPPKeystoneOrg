# Design Doc 019: DPP Adapter Improvements & Ontology Alignment

## Goal
Overhaul the `dpp-schema-logic.js` and its profile `schema.org.js` to robustly handle all data structures defined in the DPP Keystone schemas. The primary goal is to produce a **single, cohesive, nested schema.org Product graph**, rather than the current output of disjointed siblings (e.g., a Product object next to an unlinked Certification object).

## Current State & Issues
*   **Disjunct Object Graph:** The current logic iterates through a list of transformers (`dppToSchemaOrgProduct`, `epdToSchemaOrgCertifications`) and concatenates their results into a flat array. This results in a `Product` and a `Certification` that are not semantically linked.
*   **Missing Core Fields:** The adapter only manually extracts `name`, `description`, and `model`. It completely ignores standard fields like `brand`, `gtin`, `color`, `material`, `width`, `height`, `depth`, and `weight`.
*   **Missing Images:** The `image` field (defined in Core as a `RelatedResource`) is not handled, resulting in products without visual representation in search results.
*   **Sector Blindness:** The adapter has no logic for:
    *   **Textile:** Fibre composition, care instructions, size.
    *   **Battery:** Capacity, chemistry, hazardous goods class.
    *   **Electronics:** Energy efficiency class, repairability score.
*   **Hardcoded URIs:** The logic uses hardcoded string URIs (e.g., `https://dpp-keystone.org/spec/v1/terms#address`). This makes the code brittle and redundant, as the mapping logic is already partly defined in the Ontology's `owl:equivalentProperty`.

## Strategy: Test-Driven Hardening

### 1. Unified Graph Architecture
*   **Single Root:** The output must be a single `schema:Product` object.
*   **Nesting:**
    *   `manufacturer` -> `schema:Organization` (Already partially done).
    *   `epd` -> `schema:hasCertification` (New relationship).
    *   `image` -> `schema:image` (Array of URLs or ImageObjects).
    *   `documents` -> `schema:subjectOf` (for generic docs) or specific slots like `schema:hasEnergyConsumptionDetails`.

### 2. Logic Improvements (`schema.org.js`)
*   **Generic Mapping Helper:** Create a helper that looks up `owl:equivalentProperty` in the expanded graph (or a pre-computed map) to automatically map `dppk:*` properties to `schema:*` properties, reducing the need for manual cherry-picking.
*   **Complex Types Handling:**
    *   **Images:** Flatten `dppk:RelatedResource` (which has a URL) into a simple string URL or `schema:ImageObject` for the `image` property.
    *   **QuantitativeValues:** Transform `dppk:QuantitativeValue` (value + unitCode) into `schema:QuantitativeValue`.
    *   **Certifications:** Transform the `epd` node into a `schema:Certification` and nest it under `schema:hasCertification`.

### 3. Testing Requirements
*   **Consolidated Logic Test:** `testing/unit/dpp-schema-logic.test.js`
    *   **Approach:** Test `src/util/js/common/transformation/dpp-schema-logic.js` directly.
    *   **Mocking:** Supply a mock `loader` function to `buildDictionary` to simulate ontology loading without disk/network I/O.
    *   **Scope:** This is where 95% of the testing happens (nesting, field mapping, sector logic).
*   **Client/Server Smoke Tests:**
    *   Keep/Reduce `src/util/js/client/testing` and `src/util/js/server/testing` to minimal checks.
    *   **Goal:** Verify only that the environment-specific `loader` (fetch vs fs) is correctly injected and passed to the common logic.
*   **Validation:** Use a JSON schema validator or snapshot testing to ensure output matches schema.org expectations.

## Next Steps

### Phase 1: Test Infrastructure
*   [COMPLETED] **Step 1: Scaffold Unit Test & Mocking**
    *   [COMPLETED] Step 1.a: Create `testing/unit/dpp-schema-logic.test.js`.
    *   [COMPLETED] Step 1.b: Define a `mockLoader` function that returns static JSON definitions for `Product`, `Compliance`, and `Textile` ontologies (avoiding disk/network I/O).
    *   [COMPLETED] Step 1.c: Define a `dpp-full-example.json` fixture containing a comprehensive set of data: EPDs, Images (RelatedResource), Dimensions, and Textile fields.
    *   [COMPLETED] Step 1.d: Write a "smoke test" confirming `buildDictionary` runs successfully with the `mockLoader`.

### Phase 2: Unified Graph Architecture
*   [COMPLETED] **Step 2: Enforce Single Root (Failing Test)**
    *   [COMPLETED] Step 2.a: Add a test case asserting that `transform` returns an array of exactly **one** object.
    *   [COMPLETED] Step 2.b: Assert that this object has `@type: "Product"`.
    *   [COMPLETED] Step 2.c: *Note:* This will fail because the current adapter returns `[Product, Certification]`.
*   [COMPLETED] **Step 3: Enforce Single Root (Implementation)**
    *   [COMPLETED] Step 3.a: Modify `src/util/js/common/transformation/profiles/schema.org.js`.
    *   [COMPLETED] Step 3.b: Remove the `epd` entry from the top-level `transformations` array so only `dppToSchemaOrgProduct` remains.
    *   [COMPLETED] Step 3.c: *Verify:* The test from Step 2 passes (though EPD data will be missing for now).
*   [COMPLETED] **Step 4: Nest EPD (Failing Test)**
    *   [COMPLETED] Step 4.a: Add a test case asserting the Product object has a `hasCertification` property.
    *   [COMPLETED] Step 4.b: Assert that `hasCertification` contains the EPD data (e.g., check for a specific "Global Warming Potential" measurement).
*   [COMPLETED] **Step 5: Nest EPD (Implementation)**
    *   [COMPLETED] Step 5.a: Refactor `epdToSchemaOrgCertifications` to be a helper function (not a top-level transformer).
    *   [COMPLETED] Step 5.b: Call this helper from *within* `dppToSchemaOrgProduct`, passing the `epd` node found inside the product graph.
    *   [COMPLETED] Step 5.c: Assign the result to `product.hasCertification`.

### Phase 3: Core Logic Hardening
*   [COMPLETED] **Step 6: Core Fields & Dimensions (Failing Test)**
    *   [COMPLETED] Step 6.a: Add assertions for missing core fields: `brand`, `gtin`, `sku`.
    *   [COMPLETED] Step 6.b: Add assertions for physical dimensions: `width`, `height`, `depth`, `weight`. Expect them to be mapped to `schema:QuantitativeValue` (or simple strings if appropriate).
*   [COMPLETED] **Step 7: Core Fields & Dimensions (Implementation)**
    *   [COMPLETED] Step 7.a: Update `dppToSchemaOrgProduct` to extract `brand`, `gtin`, `sku`.
    *   [COMPLETED] Step 7.b: Implement a helper `toSchemaQuantitativeValue(node)` that robustly handles `dppk:QuantitativeValue` (value + unitCode) and maps it to `schema:QuantitativeValue`.
    *   [COMPLETED] Step 7.c: Apply this helper to the dimension fields.
*   [COMPLETED] **Step 8: Image Handling (Failing Test)**
    *   [COMPLETED] Step 8.a: Add a test case asserting the `image` property exists.
    *   [COMPLETED] Step 8.b: Assert it is an array containing the URL string from the `dppk:RelatedResource` input.
*   [COMPLETED] **Step 9: Image Handling (Implementation)**
    *   [COMPLETED] Step 9.a: Implement a `flattenImage(node)` helper in `schema.org.js`.
    *   [COMPLETED] Step 9.b: Add logic to unwrap `dppk:RelatedResource` objects to extract the `dppk:url` and return it as the image source.

### Phase 4: Sector Extensibility & Cleanup
*   [COMPLETED] **Step 10: Generic Mapping Helper (Design/Test)**
    *   [COMPLETED] Step 10.a: Add a test case for a **Textile** field (e.g., `dppk:tearStrength` or `dppk:fibreComposition`) that is NOT explicitly hardcoded in the adapter.
    *   [COMPLETED] Step 10.b: Assert this field appears in `additionalProperty` (or a mapped schema field) in the output.
*   [COMPLETED] **Step 11: Generic Mapping Helper (Implementation)**
    *   [COMPLETED] Step 11.a: Implement `mapGenericProperties(node, dictionary)` in `schema.org.js`.
    *   [COMPLETED] Step 11.b: Logic: Iterate over all keys in the generic `dopc` (Declaration of Product Characteristics) node. If a key is not already handled, map it to a `schema:PropertyValue` using the label/unit from the dictionary.
*   [COMPLETED] **Step 12: Cleanup Client/Server Tests**
    *   [COMPLETED] Step 12.a: Delete the duplicate logic tests in `src/util/js/client/testing` and `server/testing`.
    *   [COMPLETED] Step 12.b: Replace them with a minimal test that simply verifies the `loader` (fetch/fs) function is correctly passed to the common logic.