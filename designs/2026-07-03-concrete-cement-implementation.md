# Design Doc: 2026-07-03 Concrete & Cement Standard Implementation

## Summary
Implements the data point requirements from the concrete/cement standards (e.g., prEN 197-1 Annex ZA) into the Keystone architecture. Adheres strictly to the "no generic properties" methodology by explicitly defining each required physical, chemical, environmental, and administrative data point in the ontology.

## Implementation Plan

### [COMPLETED] Step 1: Update Environmental & Resource Indicators (EPD)
*   Plan: Add the 23 new required indicators from EN 15804+A2 (impacts, resource use, and waste indicators) to `EPDIndicators.jsonld` (in the `epdBlock`).
*   Plan: Add the 2 biogenic carbon properties to `EPD.jsonld` (or `EPDMetadata.jsonld`), as they apply to the overall product rather than specific lifecycle stages.

### [COMPLETED] Step 2: Create Cement-Specific Ontology (`Cement.jsonld`)
*   Plan: Create a new `src/ontology/v3/sectors/Cement.jsonld` file to house all cement-specific physical, chemical, and compositional requirements to avoid bloating `DoPC.jsonld` or `Construction.jsonld`.

### [COMPLETED] Step 3: Define Physical & Chemical Characteristics
*   Plan: Define the ~60 explicit properties for metrics like compressive strength, loss on ignition, and composition ratios in `Cement.jsonld`.

### [COMPLETED] Step 4: Define Dangerous Substances
*   Plan: Define flat `DatatypeProperty` fields for each of the 22 specific dangerous substances (e.g., `dangerousSubstancesAntimony`) in the Cement DoPC ontology. This is more user-friendly and allows units and governing standards to be prepopulated per substance, avoiding the complexity of an array of generic components.

### [COMPLETED] Step 5: Administrative, Composition & Signature Metadata
*   Plan: Create a new core ontology file `src/ontology/v3/core/Signature.jsonld` (using a `dppk-signature:` namespace). This file will encapsulate ALL signature-related definitions to prevent namespace collisions and enable reuse across different document types. It will include:
    *   Flat `DatatypeProperty` fields for the "human/legal" signature (from Table ZA.3.2.1 and ZA.3.2.8): `signatory`, `signatoryPosition` (covers 'function'), `placeOfSignature` (covers 'place'), and `dateOfSignature` (covers 'date of issue').
    *   A new structural class `dppk-signature:CryptographicProof` for the digital signature block with properties: `signatureType`, `signatureAlgorithm`, `signatureCanonicalization`, `signatureKeyId`, `signatureCreated`, and `signatureValue` (covers 'signature - string' and 'signature').
    *   **Cleanup**: Remove any redundant `dppk-cement-dopc:` signature fields (e.g., `date`, `placeOfSignature`, `signatory`, `signatureAlgorithm`) from `src/ontology/v3/sectors/cement/DoPC.jsonld` since they are superseded by `Signature.jsonld`.
*   Plan: Define properties for the general REACH/database URLs.
*   Plan: Define specific composition constraints (clinker, slag, etc.) in `Cement.jsonld`.

### [COMPLETED] Step 6: Update JSON-LD Contexts
*   Plan: Map all the newly defined ontology terms into the relevant sector contexts (e.g., `dpp-construction.context.jsonld`, `dpp-dopc.context.jsonld`, and a new `dpp-cement.context.jsonld` if needed).
    *   **dpp-cement-dopc.context.jsonld**: Convert to a fully scoped context where all DoPC properties are nested beneath a root `dopc` key mapped to the `CementDoPC` class. This includes the 22 flat dangerous substances, a scoped `manufacturer`, flat header fields for the human signature, and a scoped `proof` block for the cryptographic signature.
    *   **dpp-cement.context.jsonld**: Added all explicit flat properties mapped to the `CementProduct` class.

### [COMPLETED] Step 7: JSON Validation Schemas
*   Plan: Enforce the structure mapped in the contexts through JSON Validation schemas.
    *   **Cement DoPC Schema** (`src/validation/v3/json-schema/sector/cement/dopc.schema.json`): Created a new cement-specific DoPC schema. It enforces the flat header signature fields, the nested manufacturer block, the 22 dangerous substances array/object, and the nested `proof` object.
    *   **Cement Product Schema** (`src/validation/v3/json-schema/sector/cement/cement.schema.json`): Generated from the ontology to validate the 65 flat physicochemical properties.
    *   **Shared EPD Schema** (`src/validation/v3/json-schema/shared/epd.schema.json`): Augment the existing EPD schema to validate the 23 new generic EN 15804+A2 indicators as well as the 2 biogenic carbon metrics.

### [PENDING] Step 8: Final Review and Integration Tests
*   Plan: Cross-reference the implemented files against the `concrete_cement.md` requirements and fix any broken tests or integration points.

### Scratchpad
