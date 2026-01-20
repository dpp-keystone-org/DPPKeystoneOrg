# Design Doc 020: Ontology Integrity Suite & Remediation

## 1. Context & Problem Statement
Currently, the DPP Keystone project validates *data instances* (JSON files) against Schemas and SHACL shapes. However, we lack automated validation for the *definitions* themselves (Ontologies, Contexts, and JSON Schemas).

This leads to "silent" gaps, such as:
- Numeric properties defined in the ontology without specifying their measurement units.
- Missing `rdfs:label` or `rdfs:comment` annotations.
- Mismatches between the JSON-LD Context and the actual Ontology definitions.
- "Dangling" terms in schemas that map to nothing in the ontology.

## 2. Goals
1.  **Automated Quality Control:** Create a strictly typed, automated "Integrity Suite" to validate the internal consistency and completeness of the Keystone specifications.
2.  **Resolve Gaps:** Systematically resolve all failures reported by the suite to ensure a clean baseline.
3.  **Coherency:** Ensure that every Schema field has a meaningful Semantic definition.

## 3. Architecture
We have created a standalone Node.js script (`scripts/validate-ontology-integrity.mjs`) that utilizes the existing `ontology-loader.js` and `schema-loader.js` libraries to build an in-memory graph of the project's definitions.

### Audits Implemented
1.  **Numeric Unit Check:**
    - Identifies properties with numeric ranges (`xsd:decimal`, etc.) missing `dppk:Unit`.
    - **Refinement:** Supports `dppk:unit: "unitless"` for raw scalar values (like `dppk:value`).
    - **Refinement:** Supports `dppk:unitInherited: true` for properties (like EPD stages `a1`, `a2`) that derive their unit from the parent property/container.

2.  **Documentation Completeness:**
    - Verifies presence of `rdfs:label` (@en) and `rdfs:comment`.
3.  **Schema Mapping Integrity:**
    - Verifies that every property in every JSON Schema resolves to a defined term in the Ontology via the Contexts.
4.  **Dead Code Detection:**
    - **WARN:** Identifies Ontology terms not referenced by any Schema.

## 4. Current Status & Findings (As of 2026-01-16)
The script is operational (`npm run test:integrity`) and currently reports the following categories of failures:

### A. Numeric Unit Check (FAIL)
**Issue:** `xsd:decimal` / `xsd:integer` properties lack `dppk:unit`.
**Examples:** `dppk:weightPercentage`, `dppk:nominalVoltage`, `dppk:cycles`.

### B. Schema Mapping Integrity (FAIL)
**Issue 1: Missing Contexts.** `dopc.schema.json` properties are not in any loaded Context.
**Issue 2: Phantom Fields.** Terms like `certificationBodyId` map to IRIs not present in the Ontology.

### C. Documentation Completeness (FAIL)
**Issue:** Missing `rdfs:label` or `rdfs:comment` (e.g., `dppk:Model`, `dppk:Batch`).

## 5. Remediation Plan

We will tackle these sector by sector.

### Phase 0: Architectural Refactoring
-   [COMPLETED] **0.1. Centralize Meta-Properties:** Move `dppk:unit` definition from `DoPC.jsonld` to `Header.jsonld`.
-   [COMPLETED] **0.2. Define New Meta-Properties:** Define `dppk:unitInherited` in `Header.jsonld`.

### Phase 1: Core & Infrastructure
-   [COMPLETED] **1.1. Fix Core Numeric Units:**
    -   Add `dppk:unitInherited: true` to `EPD.jsonld` properties (`a1`, `a2`, `a3`, `a4`, `c1`, `c2`, `c3`, `c4`, `d`, `total`).
    -   Add `dppk:unit: "unitless"` to `Product.jsonld`'s `dppk:value`.
    -   Add `dppk:unit: "percent"` to `Product.jsonld`'s `dppk:weightPercentage` and `dppk:recycledContentPercentage`.
-   [COMPLETED] **1.2. Fix Core Documentation:** Add labels/comments to `Header.jsonld` and `Organization.jsonld`.
-   [COMPLETED] **1.3. Fix DoPC Context:** Address `dopc.schema.json` failures by ensuring `dpp-dopc.context.jsonld` maps the following terms which are currently missing or misaligned:
    -   `declarationCode`
    -   `dateOfIssue`
    -   `contentSpecificationIds`
    -   `ceMarking` (and related CE fields)
    -   `notifiedBody`
    -   `technicalDocumentation`

### Phase 2: Battery Sector
-   [COMPLETED] **2.1. Fix Numeric Units:** `nominalVoltage`, `ratedCapacity`.
-   [COMPLETED] **2.2. Fix Mappings:** Ensure all Battery schema fields map to ontology.

### Phase 3: Textile & Construction
-   [COMPLETED] **3.1. Fix Numeric Units:** `fibrePercentage`, `cycles`.
-   [COMPLETED] **3.2. Fix Mappings & Ontology Gaps:**
    -   **DoPC:** Add `dppk:avcpSystem4` and `dppk:reactionToFireSystem4` to `DoPC.jsonld`.
    -   **DoPC Schema:** Add `avcpSystem3` (and 4) to `dopc.schema.json` to match ontology.
    -   **Compliance:** Add `dppk:certificationBodyId` to `Compliance.jsonld`.
    -   **Substances:** Add `dppk:substanceName`, `dppk:casNumber`, `dppk:concentration` to `Compliance.jsonld`.
    -   **Context:** Add mappings for substance properties to `dpp-core.context.jsonld`.

### Phase 4: Script Refinement
-   [COMPLETED] **4.1. Update Script Logic:** Implement check for `dppk:unitInherited` and "unitless" value in the `validate-ontology-integrity.mjs` script.
-   [COMPLETED] **4.2. Smart Dead Code:** Update script to whitelist known Core classes or check for usage in `@type`.
-   [COMPLETED] **4.3. Improve Schema Mapping Logic:** Refine the "Schema Mapping Integrity" check to reduce spurious errors. (e.g., handling polymorphic schemas or complex context mappings better).

### Phase 5: Advanced Integrity Checks (Future)
-   [COMPLETED] **5.1. Undefined Term Usage:** Verify that every term used in an ontology file (e.g., `dppk:unit`) is actually defined in the file itself or its transitive imports. This catches "invisible dependencies" where a term is used without being imported.

## 6. Execution Strategy
1.  **Run Test:** `npm run test:integrity`.
2.  **Pick Task:** Select a specific set of errors.
3.  **Edit Source:** Modify `src/contexts/*.jsonld` or `src/ontology/*.jsonld`.
4.  **Rebuild:** `npm run build`.
5.  **Verify:** Run test again and confirm error count decreases.