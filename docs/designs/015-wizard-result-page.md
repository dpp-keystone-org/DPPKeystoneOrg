# Design Doc 015: Wizard HTML Result Page

## Goal
Transform the raw JSON output of the DPP Wizard into a tangible, visually appealing HTML "Product Page." This page serves as a proof-of-concept for how a Digital Product Passport could be rendered for an end-user, while also providing technical insights for developers via embedded adapter outputs.

## Motivation
- **"So What?" Factor:** Users filling out forms need to see a compelling result. A raw JSON dump is useful for developers but abstract for business stakeholders. A rendered page makes the value proposition immediate.
- **Adapter Showcase:** This feature naturally demonstrates the power of the `dpp-adapter`. By showing the "View Source" or "Developer Mode" of the generated page, we can reveal the `schema.org` and `GS1` structured data blocks that were automatically derived from the user's input.
- **Shareability:** An HTML page (even if just a client-side blob) feels like a "finished product" that can be screenshotted or demoed.

## User Experience (UX)

1.  **Generate Action:**
    *   The existing "Generate DPP" button in the Wizard remains.
    *   A new secondary action: "Preview Product Page" (opens in new tab/modal).

2.  **The Result Page Structure:**
    The page follows a strictly deterministic structure (Fixed Sections), avoiding brittle "smart" categorization.

    *   **A. Hero Section:**
        *   **Image:** First valid image URL found in the data (or specific `productImage` field).
        *   **Identity:** 
            *   **Title:** Constructed from `brand` and `model` (e.g., "Toyota Tercel"). If only `model` exists, use it. Fallback to "Digital Product Passport".
            *   **ID:** Unique Product ID (GTIN/UUID).
            *   *(Removed: "Manufacturer" line and "Untitled Product" default)*.
    
    *   **B. DPP Header (Metadata):**
        *   A distinct block for Passport-specific data: `dppStatus`, `lastUpdate`, `dppSchemaVersion`, `digitalProductPassportId`.
    
    *   **C. Product Attributes (The Body):**
        *   This is the catch-all for `productData`.
        *   Renders all remaining fields (e.g., `nominalVoltage`, `dimensions`, `epd`, `dopc`).
        *   Uses a **Recursive Algorithmic Renderer** to display data as Labels, Cards, or Tables based on structure, not semantics.
    
    *   **D. Components / Ingredients (Hoisted):**
        *   Specific checks for known list-heavy keys (`components`, `ingredients`, `spareParts`).
        *   Rendered as full-width tables at the bottom.

    *   **E. Developer View (Toggle):**
        *   "View Source" switch.
        *   Reveals the raw JSON and generated JSON-LD (Schema.org) blocks.

## Technical Architecture

1.  **Generator Logic (`src/lib/html-generator.js`):**
    *   **Input:** The full DPP JSON object.
    *   **Algorithmic Rendering Strategy:**
        *   **Primitives:** Render as `Label: Value`.
        *   **Simple Arrays:** Render as bulleted lists.
        *   **Objects (Deep Structure Detection):**
            *   *Standard Object:* Render as a **Card/Subsection** with the Key as the title.
            *   *Matrix Object (e.g., EPD data):* If an object contains child objects that share a significant overlap of keys (e.g., `gwp` has `a1, a2` and `odp` has `a1, a2`), render this as a **Table**.
                *   Rows = Parent Keys (`gwp`, `odp`)
                *   Columns = Child Keys (`a1`, `a2`)
        *   **Arrays of Objects:** 
            *   *Uniform Schema:* If objects in the array share keys, render as a **Table** (Keys = Headers).
            *   *Mixed Schema:* Render as a **Grid of Cards**.
    *   **Output:** A standalone HTML string (Blob URL).

2.  **Asset Handling:**
    *   **Images:** Use URLs from the JSON. Fallback to generic SVG placeholders (Gear, Factory) if no images exist.
    *   **Styling:** A clean, print-friendly CSS layout embedded or linked.

3.  **Adapter Integration:**
    *   Reuse `src/util/js/client/dpp-adapter.js` to inject structured data (JSON-LD) into the `<head>` of the generated page for SEO/Machine-readability.

## Implementation Plan

### Phase 1: Core Framework & Basic Rendering
*   [COMPLETED] **Step 1.1: HTML Generator Shell**
    *   Create `src/lib/html-generator.js`.
    *   Implement basic function `generateHTML(dppJson)` that returns a simple HTML string.
    *   Create `testing/unit/html-generator.test.js` to verify it returns a string containing the input.

*   [COMPLETED] **Step 1.2: CSS Foundation**
    *   Create `src/branding/css/dpp-product-page.css` with basic variables (colors, fonts).
    *   Update `generateHTML` to read this file and embed it into the `<style>` tag of the output.
    *   **Test:** Update unit test to verify CSS content is present in the output.

*   [COMPLETED] **Step 1.3: Hero Section Implementation**
    *   Update `generateHTML` to extract `productName`, `manufacturer.organizationName`, and `uniqueProductIdentifier`.
    *   Render them in a `<header class="dpp-hero">` block.
    *   **Test:** Update unit test with a sample containing these fields and verify they appear in the HTML.

*   [COMPLETED] **Step 3.1: Wizard UI Button** (Pulled forward for early interaction)
    *   Add "Preview Product Page" button to `src/wizard/index.html`.
    *   Add event listener in `src/wizard/wizard.js` (or new logic file) to call `generateHTML`.
    *   **Test:** Manual verification (Browser) - Button appears and opens new tab.

*   [COMPLETED] **Step 1.4: Metadata Header Implementation**
    *   Update `generateHTML` to extract `dppStatus`, `lastUpdate`, `digitalProductPassportId`.
    *   Render them in a `<section class="dpp-metadata">` block.
    *   **Test:** Verify metadata fields are rendered correctly.

### Phase 2: Algorithmic Content Rendering
*   [COMPLETED] **Step 2.1: Recursive Primitive Renderer**
    *   Create a helper function `renderValue(key, value)` inside the generator.
    *   Handle string/number/boolean types by returning a `<div class="dpp-field">` with label and value.
    *   Iterate over root keys (excluding those already used in Hero/Header) and call this helper.
    *   **Test:** Feed a simple flat JSON object and verify all keys are rendered.

*   [COMPLETED] **Step 2.2: Matrix/Table Detection Logic (Unit Logic)**
    *   Implement `detectTableStructure(object)` helper.
    *   Returns `true` if children are objects sharing > 50% keys.
    *   **Test:** Add specific test cases in `html-generator.test.js` for this function (export it for testing or test via effect).

*   [COMPLETED] **Step 2.3: Rendering Matrix Objects**
    *   Update `renderValue` to handle objects.
    *   If `detectTableStructure` is true, render as `<table>`.
    *   **Test:** Use an EPD-like mock object and verify it renders as a table with correct headers.

*   [COMPLETED] **Step 2.4: Rendering Object Arrays**
    *   Update `renderValue` to handle arrays.
    *   If array contains objects with shared schema, render as `<table>`.
    *   Else, render as list of cards.
    *   **Test:** Use a `components` array mock and verify table output.

### Phase 2.5: Immediate Fixes & Adjustments
*   [COMPLETED] **Step 2.5.1: Fix Unit Test Warnings**
    *   Address the console warning regarding `fetch` mocking in `html-generator.test.js`.

*   [COMPLETED] **Step 2.5.2: Stabilize Playwright Tests**
    *   Investigate and fix the flaky Chrome/Playwright test (`validator.spec.js`) where `toBeEnabled` times out.
    *   Ensure robust waiting for button states.

*   [COMPLETED] **Step 2.5.3: UI Renaming & Hiding**
    *   Rename "Preview Product Page" button to "Generate Example HTML".
    *   Ensure this button is hidden/shown in sync with the "Generate DPP" button (only visible when valid).
    *   **Reasoning:** Avoid implying this is a transactional product page.

*   [COMPLETED] **Step 2.5.4: Remove Raw Data View**
    *   Remove the `<pre>` block displaying raw JSON from `html-generator.js`.
    *   **Reasoning:** User confusion reduction; focus on visual representation.

### Phase 3: Integration & Polish
*   [COMPLETED] **Step 3.1: Wizard UI Button**
    *   Add "Generate Example HTML" button to `src/wizard/index.html`.
    *   Add event listener in `src/wizard/wizard.js` (or new logic file) to call `generateHTML`.
    *   **Test:** Manual verification (Browser) - Button appears and opens new tab.

*   [COMPLETED] **Step 3.2: Web-Friendly Data Injection (Adapter)**
    *   Import `dpp-adapter.js` in `html-generator.js`.
    *   Generate JSON-LD (Schema.org/GS1) using the adapter.
    *   Inject this structured data into a `<script type="application/ld+json">` tag in the `<head>` of the generated HTML.
    *   **Goal:** Ensure the HTML is "web-ready" and machine-readable by standard crawlers.
    *   **Test:** Unit test to verify `<script type="application/ld+json">` presence and valid JSON content.

*   [IN PROGRESS] **Step 3.3: Image Handling (Detailed)**
    *   [COMPLETED] **Step 3.3.1: Create Example Assets**
        *   Create directory `src/examples/images`.
        *   Generate simple SVG placeholders for each product category in our examples:
            *   `battery.svg`
            *   `beam.svg` (Construction)
            *   `drill.svg`
            *   `rail.svg`
            *   `sock.svg` (Textile)
        *   *Note:* SVGs should be simple, lightweight, and clearly labeled with the product type.
    *   [COMPLETED] **Step 3.3.2: Update Example Data**
        *   Modify the existing JSON files in `src/examples/` (`battery-dpp-v1.json`, `drill-dpp-v1.json`, etc.) to include a top-level `image` array (compliant with `general-product.schema.json`) containing a `RelatedResource` object.
        *   The `url` property of this resource should point to `/spec/examples/images/<filename>.svg`.
    *   [COMPLETED] **Step 3.3.3: Create Multi-View Assets (Carousel Test)**
        *   Generate additional SVGs for the battery example: `battery-side.svg`, `battery-top.svg`.
        *   Update `src/examples/battery-dpp-v1.json` to include these 3 images in its `image` array.
    *   [COMPLETED] **Step 3.3.4: Implement Image Carousel**
        *   Update `src/lib/html-generator.js` to detect if `image` has > 1 item.
        *   If multiple images: Render a vanilla JS/CSS carousel in the Hero section (max 3 visible or 1 main + thumbnails/arrows).
        *   If single image: Render static image.
        *   **Constraints:** Must use only internal CSS/JS (no external library dependencies).
    *   [COMPLETED] **Step 3.3.5: Refined Unit Testing & Cleanup**
        *   [COMPLETED] **Step 3.3.5.1: Remove Legacy Support**
            *   Update `src/lib/html-generator.js` to remove fallback logic for `productImage` (string) and `images` (string array).
            *   Ensure only the schema-compliant `image` (array of RelatedResource objects) is processed.
        *   [COMPLETED] **Step 3.3.5.2: Comprehensive Unit Tests (Jest)**
            *   Update `testing/unit/html-generator.test.js` with specific scenarios:
                *   *Header Only:* Verify minimal HTML structure with placeholders ("No Image", "Unknown Manufacturer").
                *   *Single Image:* Verify `dpp-hero-image` renders (no carousel).
                *   *Multiple Images:* Verify `dpp-carousel-container` renders with buttons/indicators.
                *   *Legacy Fields:* Verify passing `productImage` results in NO image rendering (enforcing strict schema).
                *   *Voluntary Attributes:* Verify arbitrary keys appear in "Product Attributes".
    *   [COMPLETED] **Step 3.3.6: Debugging & Logging (JSON-LD)**
        *   Add verbose console logging to `src/lib/html-generator.js` and `src/util/js/client/dpp-adapter.js`.
        *   Log the input `dppJson`, intermediate expansion results, and final `transformed` output.
        *   **Goal:** diagnose why `image` arrays might be causing empty JSON-LD output.

*   [COMPLETED] **Step 3.4: UI Restructuring & Custom Styling**
    *   [COMPLETED] **Step 3.4.1: Wizard UI Refactoring**
        *   Move "Generate DPP" and "Generate Example HTML" buttons into a new dedicated `<section id="dpp-generation">` at the bottom of the form (distinct from input sections).
        *   Add a header "Generate Passport".
        *   Add a text input field: "Custom CSS URL (optional)" near the "Generate Example HTML" button.
    *   [COMPLETED] **Step 3.4.2: Default CSS Polish (GS1/Enterprise Style)**
        *   Update `src/branding/css/dpp-product-page.css` with a clean, professional look (Variables, Typography, Tables, Card layouts).
    *   [COMPLETED] **Step 3.4.3: Implement Custom CSS Logic**
        *   Update `src/wizard/wizard.js` to capture the Custom CSS URL value.
        *   Update `src/lib/html-generator.js` to accept `customCssUrl` as an optional argument.
        *   Inject `<link rel="stylesheet" href="${customCssUrl}">` into the generated HTML head *after* the default styles.
    *   [COMPLETED] **Step 3.4.4: Testing**
        *   **Unit:** Verified `generateHTML` injects the custom link when provided.
        *   **Integration:** Verified the Wizard UI changes and that the custom CSS input functions.

*   [IN PROGRESS] **Step 3.5: Advanced Rendering Logic Refinement**
    *   **Goal:** Improve the recursive renderer to handle complex, nested, or partially populated structures (specifically EPDs) with high fidelity.
    *   [COMPLETED] **Step 3.5.1: Refine Matrix Detection Heuristic**
        *   Update `detectTableStructure` in `src/lib/html-generator.js`.
        *   Refine "Sparcity Check": Allow tables if > 50% density, but fallback to lists if data is too sparse.
        *   Ensure it handles "Object of Objects" (EPD style) correctly.
    *   [COMPLETED] **Step 3.5.2: Dynamic Column Generation**
        *   Update `renderValue` table logic to compute the *union* of all keys across rows.
        *   Sort columns alphabetically (or prioritizing common keys like 'total' or 'value').
        *   Render empty cells as `-` for missing data points.
    *   [SKIPPED] **Step 3.5.3: Visual Hierarchy (Recursive Cards)**
        *   Update `renderValue` to accept a `depth` parameter.
        *   When rendering nested objects (Cards within Cards), apply a CSS class `dpp-card-nested`.
        *   Update CSS to style nested cards with subtle background variation or left border indentation.
    *   [COMPLETED] **Step 3.5.4: Testing (Advanced)**
        *   Create `testing/unit/advanced-rendering.test.js`.
        *   Test Case: EPD Matrix (Object of Objects) -> Renders Table.
        *   Test Case: Sparse EPD -> Renders List/Card.
        *   Test Case: Deeply nested object -> Renders nested cards.

*   [COMPLETED] **Step 3.6: Integration Testing (Playwright)**
    *   Create `testing/integration/playwright/wizard-html-generator.spec.js`.
    *   **Test Case 1: Button Visibility Logic**
        *   Load Wizard.
        *   Verify "Generate Example HTML" is hidden.
        *   Populate minimal valid data.
        *   Verify button becomes visible.
    *   **Test Case 2: Battery Flow (No Images)**
        *   Populate valid Battery data (Brand, Model, etc.) but NO images.
        *   Generate HTML.
        *   Verify Hero Title matches "Brand Model".
        *   Verify Hero shows "No Image Available" placeholder.
        *   **Verify JSON-LD:** Script tag exists, `@type` is Product.
    *   **Test Case 3: Battery Flow (Single Image) & Custom CSS**
        *   Populate valid Battery data.
        *   Add 1 Image URL via "General Product" sector (or relevant field).
        *   Enter a Custom CSS URL.
        *   Generate HTML.
        *   Verify Hero shows single static image (`.dpp-hero-image`).
        *   Verify NO carousel controls.
        *   **Verify CSS:** `<link rel="stylesheet">` with correct href exists.
        *   **Verify JSON-LD:** `image` property is populated correctly.
    *   **Test Case 4: Battery Flow (Multiple Images - Carousel)** (Partial)
        *   *Note:* Testing complex UI population (array of images) is brittle in the Wizard.
        *   *Deferred:* Verification of Carousel rendering logic is deferred to the **Validator Integration** phase where we can inject raw complex JSON.
    *   **Test Case 5: Complex Construction Product (DoPC + EPD)** (Partial)
        *   Select "Construction" sector.
        *   Populate mandatory Construction fields.
        *   *Deferred:* Verification of deep DoPC nesting and EPD tables is deferred to the **Validator Integration** phase to allow direct JSON input of complex structures.
        *   Verify correct content specification ID mapping (e.g., `draft_construction_specification_id`).