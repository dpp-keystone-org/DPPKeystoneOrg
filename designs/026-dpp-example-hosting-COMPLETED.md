# 026: DPP Example Hosting Feature

## Objective
This feature enhances the Digital Product Passport (DPP) example generation by providing high-quality example images, fixing the HTML generator to display units (e.g., kg, kWh) alongside values based on the loaded ontology, and updating the hosted examples for Keystone.org.

## Proposed Changes

### 1. [COMPLETED] Image Generation & JSON Example Update
- **Action**: Use an AI image generation tool to create visually appealing product images (e.g. realistic or abstract product mockups) for the examples: battery, drill, construction product, rail, sock.
- **Modify**: Update all `src/examples/*-dpp-v1.json` files to point to the new image file URLs in `src/examples/images/`.

### 2. [COMPLETED] HTML Generator Bug Fix (Units)
- **Modify `src/lib/html-generator.js`**:
  - Import `loadOntology` from `./ontology-loader.js`.
  - Extract the specific sector identifier from the DPP JSON. If `contentSpecificationIds` is present (e.g., `"battery-product-dpp-v1"`), map it to the sector (e.g. `"battery"`). Fallback to `"dpp"`.
  - Call `await loadOntology(sector)` to fetch the parsed `ontologyMap`.
  - Pass the loaded `ontologyMap` object into `renderProductPage(...)`.
- **Modify `src/util/js/common/rendering/dpp-html-renderer.js`**:
  - Update `renderProductPage` to accept `ontologyMap` in its options.
  - Update recursive components such as `renderValue(key, value, ontologyMap)` to correctly look up the key in the `ontologyMap`.
  - Append the extracted unit string `(unit)` to Table Row headers (EPD Matrix mode for properties like `gwp`) and Table Column headers (Array mode).
  - Append the unit string `<span class="dpp-unit">({unit})</span>` to Card Titles (for group objects like `elasticRecovery`).
  - Fallback: for primitive values that have their own defined `unit` in the ontology, append it directly to the cell value.

### 3. JSON Example Refinement
- **Modify**: Update `uniqueProductIdentifier` in all JSON files located in `src/examples/` to correctly point to the future keystone.org hosted URLs of the respective generated HTML files.

## Verification Plan
1. **Automated Validation**: Synthetically verify that the HTML output correctly appends units by checking the script output.
2. **Manual Visual Check**: Open generated HTML files in a browser to inspect the placement of units and formatting of newly generated images in the product displays before deploying.
