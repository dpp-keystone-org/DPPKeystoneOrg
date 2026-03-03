# Design 025: Component Unification

**Status:** Complete
**Author:** Gemini
**Date:** 2026-03-03

## Changelog
- 2026-03-03 - Initial draft.
- 2026-03-03 - Re-sequenced plan to update validation script first. Added detailed, pending sub-steps for all file modifications.
- 2026-03-03 - Consolidated all steps into a single Implementation Plan section for clarity.
- 2026-03-03 - Resolved open question regarding schema file location. Confirmed new dedicated file for Component schema.
- 2026-03-03 - Updated status to 'In Progress'. Broke down refactoring step to reflect completed fixes vs. pending work.
- 2026-03-03 - Marked component schema creation as complete.
- 2026-03-03 - Marked core context and general product schema refactoring as complete.
- 2026-03-03 - Marked battery context and schema refactoring as complete.
- 2026-03-03 - Finalized all steps and marked design as complete.

## 1. Summary

The `Component` entity is a fundamental data structure used across various parts of the Digital Product Passport (DPP) project. However, its definition is currently fragmented and inconsistent across the ontology, JSON-LD contexts, and JSON schemas. This disorganization leads to redundancy, potential for errors, and increased maintenance overhead.

This document proposes a plan to unify the `Component` definition. The goal is to establish a single, canonical definition and refactor all relevant assets to use it. This will also include enhancing our validation scripts to prevent such inconsistencies in the future.

## 2. Problem Details

The concept of a `Component` is used in multiple places with conflicting definitions:

- **Core Context (`dist/spec/contexts/dpp-core.context.jsonld`):** Appears to define `Component` inconsistently.
- **General Product Context (`dist/spec/contexts/dpp-general-product.context.jsonld`):** Defines a list of components.
- **Battery Context (`dist/spec/contexts/dpp-battery.context.jsonld`):** Uses `Component` within nested scopes like `materialComposition`, `hazardousSubstances`, etc.
- **DPP Ontology:** The semantic definition of a `Component` in the ontology does not align with the fields used in the contexts.
- **Battery Schema (`src/validation/v1/json-schema/battery.schema.json`):** Contains its own local definition of `Component`.
- **General Product Schema (`src/validation/v1/json-schema/general-product.schema.json`):** Also contains a local definition of `Component`.

This fragmentation makes it difficult to understand and use the `Component` entity correctly and makes the system brittle.

## 3. Proposed Solution

### 3.1. Integrity Script Enhancement

To prevent this issue from recurring, and to prove our fixes work, we will first enhance the `scripts/validate-ontology-integrity.mjs` script. The script will be modified to detect redundant term definitions across all `*.context.jsonld` files and to ensure schema mappings are valid. By running the script before and after the refactoring, we can verify that the script successfully identifies the problem and confirms its resolution.

### 3.2. Canonical Component Definition

We will establish a single, simple, and canonical definition for a `Component`. It will consist of the following properties:

- **`uniqueProductIdentifier`**: An identifier for the product.
- **`name`**: The name of the component.
- **`percentage`**: The percentage this component represents in the whole.

This definition will be anchored in the DPP Core ontology and its corresponding JSON-LD context.

### 3.3. Refactoring

The core of the work is to refactor the ontology, contexts, schemas, and examples to use the single canonical `Component` definition. This involves updating the ontology, removing duplicate definitions from other contexts and schemas, and ensuring all references point to the single source of truth. The canonical JSON Schema definition for `Component` will be stored in its own file, consistent with patterns used for `RelatedResource` and other common types.

## 4. Open Questions

1.  What are the precise data types and cardinality constraints for the properties of `Component` in the ontology? We should confirm these before implementation.

## 5. Implementation Plan

#### Step 1: Enhance `validate-ontology-integrity.mjs` Script (COMPLETE)
- **1.1. (COMPLETE)** Modify the script to perform case-insensitive checks for redundant term definitions within and across all context files.
- **1.2. (COMPLETE)** Add a new audit to check for schema properties that map to ontology terms not defined in the ontology.
- *Note: These changes are currently stashed to unblock other work.*

#### Step 2: Clean up `componentName` from Ontology (COMPLETE)
- **2.1. (COMPLETE)** Remove the definition for `dppk:componentName` from `src/ontology/v1/dpp-keystone.jsonld`.

#### Step 3: Refactor Contexts and Schemas (COMPLETE)

*Sub-step 3a: Immediate fix for broken mappings (COMPLETE)*
- **3.a.1. (COMPLETE)** In `src/contexts/v1/dpp-core.context.jsonld`, update the nested `component` context to map `name` to `dppk:name` instead of the removed `dppk:componentName`.
- **3.a.2. (COMPLETE)** In `src/contexts/v1/dpp-battery.context.jsonld`, update the nested contexts for `materialComposition`, `hazardousSubstances`, `preConsumerRecycledMaterialComposition`, and `postConsumerRecycledMaterialComposition` to map `name` to `dppk:name`.

*Sub-step 3b: Full refactor to a unified component definition (COMPLETE)*
- **3.b.1. (COMPLETE)** In `src/ontology/v1/core/Product.jsonld`, confirm that `dppk:components` (plural) is defined with `dppk:Product` as its domain and `dppk:Component` as its range.
- **3.b.2. (COMPLETE)** Create a new standalone schema file `src/validation/v1/json-schema/component.schema.json`.
- **3.b.3. (COMPLETE)** In `component.schema.json`, define properties for `name`, `uniqueProductIdentifier`, and `percentage`.
- **3.b.4. (COMPLETE)** In `src/contexts/v1/dpp-core.context.jsonld`, remove the local/nested context for `component` and create a new top-level mapping for it.
- **3.b.5. (COMPLETE)** In `src/validation/v1/json-schema/general-product.schema.json`, change the `components` property to `$ref` the new `component.schema.json`.
- **3.b.6. (COMPLETE)** In `src/contexts/v1/dpp-battery.context.jsonld`, remove the local/nested context definitions for `materialComposition`, `hazardousSubstances`, etc., and remap them to use the global `dppk:components` definition.
- **3.b.7. (COMPLETE)** In `src/validation/v1/json-schema/battery.schema.json`, update `materialComposition`, `hazardousSubstances`, etc., to `$ref` the new `component.schema.json`.
- **3.b.8. (COMPLETE)** Update `src/examples/` to conform to the new, unified `Component` structure.
