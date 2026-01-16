# Design Doc 016: Dangling Field Overhaul & Modularization

## Status
**Status:** COMPLETE
**Author:** AI Assistant / User
**Date:** 2025-01-27

## Summary
This document outlines the plan to restructure the DPP Core Ontologies and Schemas to address "dangling" fields—properties defined in the ontology but not currently used in any active schema. The goal is to move from a monolithic core definition to a modular architecture where specific attributes are grouped into logical modules ("General Product", "Packaging") or integrated into specific sectors where they belong.

## Field Migration Plan

| Field Name | Current Ontology | New Location, meaning Schema, possibly changes to context and ontology | Notes |
| :--- | :--- | :--- | :--- |
| `brand` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `model` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `image` | `Product.jsonld` | **General Product** Module | Change type from URI string to `RelatedResource` (object). |
| `color` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `countryOfOrigin` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `netWeight` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `grossWeight` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `length` | `Product.jsonld` | **General Product** Module | Universal product attribute. |
| `packaging` | `Compliance.jsonld` | **Packaging** Module | New standalone module selectable for any product. |
| `hasPart` | `Product.jsonld` | **Core** (`dpp.schema.json`) | Rename to `component` (array). Maps to new `Component` class. |
| `dppLink` | `Product.jsonld` | **Core** (inside `component`) | **REPLACE** with `uniqueProductIdentifier`. |
| `weightPercentage` | `Product.jsonld` | **Core** (inside `component`) | Property of the `Component` class. |
| `certifications` | `Compliance.jsonld` | **Core** (`dpp.schema.json`) | Rename to `additionalCertifications`. |
| `productionSteps` | `Compliance.jsonld` | **Textile** Schema | Move to Textile sector for now. |
| `sizeCode` | `Product.jsonld` | **Textile** Schema | Rename to `apparelSize`. Move to Textile Context/Ontology. |
| `sizeSystemCode` | `Product.jsonld` | **Textile** Schema | Rename to `apparelSizeSystem`. Move to Textile Context/Ontology. Enhance definition. |
| `materialClassification`| `Product.jsonld` | **Removed** | Unused / Half-baked. |
| `ecoDesignProperties` | `Compliance.jsonld` | **Removed** | Legacy bucket; specific props should be used instead. |
| `complianceTopics` | `Compliance.jsonld` | **Removed** | Too vague. |
| `ProductCharacteristic`| `Product.jsonld` (Class)| **Wizard Registry** | Register as a selectable "Voluntary Field" type. |
| `RelatedResource` | `RelatedResource.jsonld` | **Wizard Registry** | Register as a selectable "Voluntary Field" type. |

## AI Workflow

To ensure stability and recoverability during this refactoring, the following workflow must be strictly followed for the implementation steps below:

1.  **Select Task:** Pick the next item marked "PENDING".
2.  **Mark In-Progress:** Update the status in this doc to "IN PROGRESS".
3.  **Discuss:** (Crucial) The AI must pause and discuss the specific implementation details of the task with the user before writing code.
4.  **Implement & Test:**
    *   Perform the code changes.
    *   Run relevant tests (Unit: `wizard.test.js`, Integration: `wizard-flow.test.js`, or Browser: `wizard.spec.js`).
    *   *Self-Correction:* If tests fail, fix them before moving on.
5.  **Mark Done:** Update the status in this doc to "DONE".
6.  **Checkpoint:** (User Action) The user will perform a git commit to save the state.
7.  **Next:** Proceed to the next task.

---

## Implementation Steps

### Phase 1: Ontology Cleanup

- [x] **Task 1.1: Refactor `sizeCode` to `apparelSize`**
    *   **Discuss:** Confirm details for `apparelSize` (Type: string/Text).
    *   **Action:**
        *   **Ontology:** Remove `sizeCode` from `Product.jsonld`. Add `apparelSize` to `Textile.jsonld`.
        *   **Context:** Remove `sizeCode` from `dpp-core.context.jsonld`. Add `apparelSize` to `dpp-textile.context.jsonld`.
        *   **Schema:** Remove `sizeCode` from `dpp.schema.json` (if present). Add `apparelSize` to `textile.schema.json`.
        *   **Examples:** Update any examples using `sizeCode` (e.g., `sock-dpp-v1.json`) to use `apparelSize`.
    *   **Test:**
        *   Update `dpp-examples.validation.test.js` to ensure modified examples pass validation.
        *   Update `wizard.spec.js` (or related unit tests) to verify `apparelSize` appears in the Textile form and `sizeCode` is gone from Core.
        *   Run `npm test` to ensure no regressions.
    *   **Status:** DONE

- [x] **Task 1.2: Refactor `sizeSystemCode` to `apparelSizeSystem`**
    *   **Discuss:** Confirm details and example values.
    *   **Action:**
        *   **Ontology:** Remove `sizeSystemCode` from `Product.jsonld`. Add `apparelSizeSystem` to `Textile.jsonld`. Enhance with clear label and example comment.
        *   **Context:** Remove `sizeSystemCode` from `dpp-core.context.jsonld`. Add `apparelSizeSystem` to `dpp-textile.context.jsonld`.
        *   **Schema:** Remove `sizeSystemCode` from `dpp.schema.json` (if present). Add `apparelSizeSystem` to `textile.schema.json`.
        *   **Examples:** Update examples to use `apparelSizeSystem`.
    *   **Test:**
        *   Update `dpp-examples.validation.test.js`.
        *   Verify correct rendering in Wizard via unit/spec tests.
        *   Run `npm test`.
    *   **Status:** DONE

- [x] **Task 1.3: Remove `materialClassification`**
    *   **Discuss:** Confirm removal.
    *   **Action:**
        *   **Ontology:** Remove `materialClassification` from `Product.jsonld`.
        *   **Context:** Remove `materialClassification` from `dpp-core.context.jsonld`.
        *   **Schema:** Remove `materialClassification` from `dpp.schema.json`.
        *   **Examples:** Remove from any examples.
    *   **Test:** Run `npm test` to ensure no broken references.
    *   **Status:** DONE

- [x] **Task 1.4: Remove unused fields from `Compliance.jsonld`**
    *   **Discuss:** Confirm list of fields to remove (`ecoDesignProperties`, `complianceTopics`). Preserving in examples if used.
    *   **Action:** Remove `ecoDesignProperties`, `complianceTopics` from `Compliance.jsonld` and `dpp-core.context.jsonld`.
    *   **Test:** `npm test`.
    *   **Status:** DONE

- [x] **Task 1.5: Rename and Restructure Core Ontology Terms**
    *   **Discuss:** Review the new `Component` class structure and Header label changes.
    *   **Action:**
        *   In `Product.jsonld`:
            *   Create a new class `dppk:Component`.
            *   Define properties for `Component`: `dppk:name` (string), `dppk:weightPercentage` (decimal), and reuse `dppk:uniqueProductIdentifier` (URI).
            *   Deprecate or remove `dppLink` in favor of `uniqueProductIdentifier`.
            *   Gracefully replace `hasPart` on examples with a new property `components` (plural) of type `dppk:Component`.
        *   In `Header.jsonld`:
            *   Update `dppk:digitalProductPassportId` label/comment to clarify it is an implementation-specific, potentially localized ID.
            *   Update `dppk:uniqueProductIdentifier` label/comment to clarify it is the globally resolvable URI for the product/DPP.
        *   In `Compliance.jsonld`: Rename `certifications` property to `additionalCertifications` (or create new property and deprecate old).
        *   **Private Example:** Updated `drill-dpp-v1-private.json` to use `components` (no `@type`) and `additionalCertifications`.
        *   **Battery Ontology:** Updated comment in `Battery.jsonld` to refer to `dppk:components`.
    *   **Test:** Manual verification of JSON-LD structure.
    *   **Status:** DONE

### Phase 2: General Product & Packaging Modules

- [x] **Task 2.1: Ontology Updates (Dimensions & Image)**
    - [x] **2.1a. [Ontology] Add Dimensions:**
        - **Action:** In `src/ontology/v1/core/Product.jsonld`, add `dppk:width`, `dppk:height`, and `dppk:depth`. Define them using `dppk:MetersLengthLiteral` (same as `length`).
        - **Test:** Verify valid JSON-LD structure.
    - [x] **2.1b. [Ontology] Refactor Image:**
        - **Action:** In `src/ontology/v1/core/Product.jsonld`, change `dppk:image` range from `xsd:anyURI` to `dppk:RelatedResource`.
        - **Test:** Verify valid JSON-LD structure.
    - [x] **2.1c. [Context] Update Core Context:**
        - **Action:** In `src/contexts/v1/dpp-core.context.jsonld`, add mappings for `width`, `height`, and `depth`.
        - **Test:** Run integration tests to ensure no regressions in core context loading.

- [x] **Task 2.2: Create General Product Schema**
    - [x] **2.2a. [Schema] Create Schema File:**
        - **Action:** Create `src/validation/v1/json-schema/general-product.schema.json`.
        - **Content:**
            - `brand`, `model`, `color`, `countryOfOrigin` (strings)
            - `netWeight` (KgWeightLiteral), `grossWeight` (QuantitativeValue/Literal)
            - `length`, `width`, `height`, `depth` (MetersLengthLiteral)
            - `image` (Array of `RelatedResource`)
        - **Test:** Add a test case in `testing/integration/wizard-flow.test.js` to verify the schema loads.

- [x] **Task 2.3: Create General Product Context**
    - [x] **2.3a. [Context] Create Module Context:**
        - **Action:** Create `src/contexts/v1/dpp-general-product.context.jsonld`.
        - **Content:** Include mappings strictly relevant to the General Product schema.
        - **Test:** Verify context generation or loading in integration tests.

- [x] **Task 2.4: Create Packaging Module**
    - [x] **2.4a. [Schema] Create Packaging Schema:**
        - **Action:** Create `src/validation/v1/json-schema/packaging.schema.json`.
        - **Content:** `packaging` (Array of `Packaging` objects).
    - [x] **2.4b. [Context] Create Packaging Context:**
        - **Action:** Create `src/contexts/v1/dpp-packaging.context.jsonld`.
        - **Content:** Mappings for `packaging` and related packaging terms.
    - [x] **2.4c. [Test] Verify Packaging:**
        - **Test:** Add a test case in `wizard-flow.test.js`.

### Phase 3: General Product Schema Expansion

- [x] **Task 3.1: Update `general-product.schema.json`**
    *   [x] **Action:**
        *   Add `components` field (Array of `Component` objects).
            *   Items: Object with properties: `name` (string), `uniqueProductIdentifier` (uri), `weightPercentage` (number).
        *   Add `additionalCertifications` field (Array of `Certification` objects).
            *   Description: "Certifications that are not required by sector-specific delegated acts."
            *   Items: Reference `certification` definition (or `RelatedResource` with type).
    *   **Test:** Update `wizard-flow.test.js` to verify these fields in the General Product form.

- [x] **Task 3.2: Update `dpp-general-product.context.jsonld`**
    *   [x] **Action:**
        *   Map `components` to `dppk:components`.
        *   Map `additionalCertifications` to `dppk:additionalCertifications`.
    *   **Test:** Verify context expansion in integration tests.

### Phase 4: Sector Updates (Textile Overhaul)

- [x] **Task 4.1: Consolidate Textile Schemas**
    *   **Discuss:** Merge `delegated_act_t123.schema.json` into `textile.schema.json`.
    *   **Action:**
        *   Update `textile.schema.json`:
            *   Adopt the "flat" structure (properties directly under `then`).
            *   Import detailed definitions from `t123`: `fibreComposition`, `abrasionResistance`, `dimensionalStability`, `colorfastnessToWashing`, `microplasticRelease`.
            *   Import and rename `majorProductionSteps` -> `productionSteps`.
            *   Preserve existing: `color`, `apparelSize`, `apparelSizeSystem`, `animalOriginNonTextile`.
        *   Delete `delegated_act_t123.schema.json`.
    *   **Test:** Validate `textile.schema.json` is a valid schema.
    *   **Status:** DONE

- [x] **Task 4.2: Update Textile Ontology & Context**
    *   **Discuss:** Ensure all new schema fields have ontology backing.
    *   **Action:**
        *   **Ontology (`Textile.jsonld`):** Ensure `productionSteps` (moved from Core), `abrasionResistance`, `dimensionalStability`, `colorfastnessToWashing`, `microplasticRelease` are defined.
        *   **Context (`dpp-textile.context.jsonld`):** Add mappings for all the above.
        *   **Core Context:** Remove `productionSteps` (it is now sector-specific).
    *   **Test:** Verify Context generation/loading.
    *   **Status:** DONE

- [x] **Task 4.3: Update Examples & Tests**
    *   **Discuss:** Fix examples to match the stricter/richer schema.
    *   **Action:**
        *   Update `sock-dpp-v1.json`: Add dummy data for new required fields (`abrasionResistance`, etc.) and format `productionSteps` correctly.
        *   Update `wizard.spec.js`: Ensure the form generates the correct fields for Textile.
    *   **Test:** `npm test`, `npx playwright test`.
    *   **Status:** DONE

### Phase 5: Wizard Registry & Configuration

- [x] **Task 5.1: Register New Modules**
    *   **Discuss:** Confirm UI placement for new modules.
    *   **Action:** Update `wizard.js` (or `schema-loader.js`) to include "General Product" and "Packaging" in the list of available modules/sectors.
    *   **Test:** `wizard.spec.js` - Verify buttons for "General Product" and "Packaging" appear and load forms.
    *   **Status:** DONE

- [x] **Task 5.2: Register Voluntary Types**
    *   **Discuss:** Confirm list of voluntary types.
    *   **Action:** Update `form-builder.js` (Voluntary Field Registry) to include:
        *   `ProductCharacteristic` (Class)
        *   `RelatedResource` (Class)
    *   **Test:** `wizard.test.js` - Add unit test to verify these types appear in the dropdown and render correct sub-fields.
    *   **Status:** DONE

### Phase 6: Final Cleanup

- [x] **Task 6.1: Verify Translations**
    *   **Discuss:** Check if any new terms need translation keys.
    *   **Action:** Ensure all moved fields have their labels/comments in the ontology files and are correctly picked up by the wizard in the new locations.
    *   **Test:** `wizard-flow.test.js` - Language switching test.
    *   **Status:** DONE

- [x] **Task 6.2: Full Regression Test**
    *   **Discuss:** Confirm test scope.
    *   **Action:** Run all tests.
    *   **Test:** `npm test` (Unit + Integration), `npx playwright test`.
    *   **Status:** DONE
