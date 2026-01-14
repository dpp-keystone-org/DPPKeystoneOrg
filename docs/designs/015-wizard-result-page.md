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
        *   **Identity:** Product Name, Manufacturer Name/Logo, Unique Product ID (GTIN/UUID).
    
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

*   [PENDING] **Step 3.3: Image Handling**
    *   Implement logic to find image URLs in the JSON.
    *   Update Hero section to display the image.
    *   **Test:** Mock JSON with image URL, verify `<img>` tag.

*   [PENDING] **Step 3.4: Visual Polish (GS1 Style)**
    *   Upgrade `dpp-product-page.css` to reflect a professional, GS1-aligned visual style.
    *   Ensure responsive tables and clean typography.
    *   **Test:** Manual verification of the generated page's aesthetics.

*   [PENDING] **Step 3.5: Integration Testing**
    *   Create a new Playwright test (or extend `wizard.spec.js`) to verify the "Generate Example HTML" flow.
    *   Simulate filling a valid form.
    *   Verify the button becomes visible.
    *   Verify clicking the button triggers the HTML generation (check for new page/tab content if possible, or intercept the blob creation).