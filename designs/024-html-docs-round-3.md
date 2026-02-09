# Design Doc 024: HTML Spec Docs - Property Documentation UX

## Summary
This document outlines a set of improvements for the `generate-spec-docs.mjs` script, focusing on how ontology properties are documented in the generated HTML pages. The current presentation is minimal, often just a label and a term, making it difficult for users to understand a property's purpose, data type, and context. We will enrich this documentation to provide a more useful, developer-centric experience.

## Goals
1.  **Richer Information Display:** Move beyond simple labels and display critical metadata for each property, including its description, expected data type(s) (`range`), and the classes it applies to (`domain`).
2.  **Improved Navigability:** Make each property in the list a clickable link that navigates the user to a more detailed definition block on the same page.
3.  **Contextual Examples:** Provide concrete, context-aware JSON-LD snippets for each property to demonstrate its usage within a Digital Product Passport. This is crucial for developer adoption.
4.  **Clearer Structure:** Replace the simple bulleted list of properties with a more structured format (like a table) that presents the information consistently and readably.

## Implementation Plan

### Phase 1: Enhance Data Aggregation in the Script
Before we can display more information, we need to collect it. This involves updating the logic in `scripts/generate-spec-docs.mjs`.

*   **Step 1.1: Augment Property Indexing**
    *   In `generate-spec-docs.mjs`, locate the logic where properties (`owl:ObjectProperty`, `owl:DatatypeProperty`) are processed.
    *   For each property, ensure we extract and store the following fields from its JSON-LD definition:
        *   `rdfs:label` (already collected)
        *   `rdfs:comment` (the description)
        *   `schema:domainIncludes` (the class(es) this property belongs to)
        *   `schema:rangeIncludes` (the expected value type(s), e.g., `xsd:string` or another class)
    *   The data structure for a property should now look something like:
        ```javascript
        {
          id: 'dppk:documents',
          label: 'Documents',
          comment: 'Provides access to one or more documents...',
          domain: ['dppk:Compliance'],
          range: ['dppk:RelatedResource']
        }
        ```

### Phase 2: Redesign the Module Page's Property List
Transform the current `<ul>` into a more informative summary table.

*   **Step 2.1: Generate a Property Summary Table**
    *   In `generate-spec-docs.mjs`, modify the HTML generation logic for ontology module pages (`.../core/index.html`, etc.).
    *   Replace the existing bulleted list of properties with an HTML `<table>`.
    *   The table should have the following columns for each property:
        1.  **Property:** The `rdfs:label`. This will be a link.
        2.  **Term:** The compact term (e.g., `dppk:documents`).
        3.  **Expected Type(s):** The `schema:rangeIncludes` value(s). These should also be links if they point to other classes in the ontology.
        4.  **Description:** The `rdfs:comment`.
*   **Step 2.2: Implement Anchor Links**
    *   The link in the "Property" column should be an anchor link pointing to a detailed section further down the same page (e.g., `<a href="#dppk:documents">Documents</a>`). The `id` for the anchor should be a sanitized version of the property's term.

### Phase 3: Generate Detailed Property Sections with Examples
This is the "drill-down" view for each property.

*   **Step 3.1: Create a "Property Details" HTML Block**
    *   For each property in an ontology module, generate a dedicated `<section>` or `<div>` with an `id` matching the anchor from Step 2.2.
    *   This block should clearly display all the collected information: Label, Term, Comment, Domain(s), and Range(s).
*   **Step 3.2: Generate Contextual JSON-LD Examples**
    *   This is the most critical step. For each property, generate a `<pre><code>` block containing a JSON-LD example.
    *   **Logic for Example Generation:**
        *   The example should be based on the property's `schema:domainIncludes`. Pick one class from the domain as the "host" for the example.
        *   The example should show the property being used within an instance of that class.
        *   The value of the property in the example should be a sensible placeholder based on its `schema:rangeIncludes`.
            *   If range is `xsd:string`, use a placeholder like `"Sample String Value"`.
            *   If range is `xsd:date`, use an example date like `"2025-08-21"`.
            *   If range is another class (e.g., `dppk:Organization`), show a nested object with an `@type` and a placeholder `id`, like `{ "@type": "dppk:Organization", "dppk:name": "Example Corp" }`.
    *   **Example Output for `dppk:substancesOfConcern`:**
        ```html
        <section id="dppk:substancesOfConcern">
          <h3>Substances of Concern (dppk:substancesOfConcern)</h3>
          <p>Description: A list of substances of very high concern...</p>
          <p><strong>Domain:</strong> <a href="...">dppk:Compliance</a></p>
          <p><strong>Range:</strong> <a href="...">dppk:Substance</a></p>
          <h4>Example Usage</h4>
          <pre><code>
        {
          "@type": "dppk:Compliance",
          "dppk:substancesOfConcern": [
            {
              "@type": "dppk:Substance",
              "dppk:name": "Lead"
            }
          ]
        }
          </code></pre>
        </section>
        ```

### Phase 4: E2E Verification
Update tests to ensure the new documentation structure is generated correctly.

*   **Step 4.1: Update Spec Docs Generation Test**
    *   Modify `testing/integration/spec-docs-generation.test.js`.
    *   Add assertions to check for the existence of the new property `<table>`.
    *   Assert that property names are anchor links (`<a href=...`).
    *   Assert that the "Property Details" sections exist and contain `<pre><code>` blocks with example JSON-LD.
*   **Step 4.2: Update Crawler Test**
    *   Modify `testing/integration/crawler.test.js` to ensure the new anchor links are valid and do not lead to 404s or broken fragments.
