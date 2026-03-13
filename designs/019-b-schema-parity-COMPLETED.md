# Design Doc 019-b: Schema Parity (All Sectors)

## Goal
Building on the architecture from Design 019, this task focuses on achieving "schema parity" across all DPP sectors. The goal is to ensure that the rich data present in any DPP (e.g., Battery, Textile, Construction) is fully and semantically represented in the `schema.org` output, rather than being lost or poorly formatted.

## Strategy
We will methodically iterate through every context definition file in `src/contexts/v1/`. For each context, we will perform a gap analysis between the defined DPP terms and the current Schema.org adapter implementation, then implement the missing mappings.

## Steps

### 1. Core Context (`dpp-core.context.jsonld`)
*   **[COMPLETED] Step 1.1: Analyze**
    *   **Findings:**
        *   `dppk:component` is not mapped. Target: `schema:hasPart`.
        *   `dppk:productCharacteristics` (root) is not mapped (only `dopc` is). Target: `schema:additionalProperty`.
        *   `dppk:recycledContentPercentage` is not mapped. Target: `schema:additionalProperty`.
        *   `dppk:hsCode` is not mapped. Target: `schema:identifier` (with propertyID).
        *   `dppk:dppStatus`, `dppk:lastUpdate` are metadata, likely `additionalProperty`.
*   **[COMPLETED] Step 1.2: Align**
    *   **Mapping Table:**
        *   `dppk:component` -> `schema:hasPart` (Array of `schema:Product` or `schema:Thing`).
        *   `dppk:productCharacteristics` -> `schema:additionalProperty`.
        *   `dppk:recycledContentPercentage` -> `schema:additionalProperty` (Name: "Recycled Content", Unit: "%").
        *   `dppk:hsCode` -> `schema:identifier` (propertyID: "HS Code").
*   **[COMPLETED] Step 1.3: Test**
    *   Update `testing/unit/dpp-schema-logic.test.js` to include these fields in the input and verify output.
*   **[COMPLETED] Step 1.4: Implement**
    *   Update `src/util/js/common/transformation/profiles/schema.org.js`.

### 2. Battery Context (`dpp-battery.context.jsonld`)
*   **[COMPLETED] Step 2.1: Analyze**
    *   **Findings:**
        *   `dppk:performance` is a deep tree. Needs recursive flattening like `dopc`.
        *   `dppk:manufacturingDate` -> `schema:productionDate`.
        *   `dppk:warrantyPeriod` -> `schema:warranty`.
        *   `dppk:batteryMass` -> `schema:weight`.
        *   `dppk:materialComposition` (and Recycled/Hazardous variants) are lists.
        *   Many specific documents (`testReports`, `dismantlingInformation`).
*   **[COMPLETED] Step 2.2: Align**
    *   **Mapping Table:**
        *   `dppk:performance` -> Recursive `schema:additionalProperty`.
        *   `dppk:manufacturingDate` -> `schema:productionDate`.
        *   `dppk:warrantyPeriod` -> `schema:warranty`.
        *   `dppk:batteryMass` -> `schema:weight`.
        *   `dppk:materialComposition` -> `schema:additionalProperty` (Name: "Material: X", Value: Y%).
        *   Documents (`testReports`, etc.) -> `schema:subjectOf` (DigitalDocument).
        *   `dppk:carbonFootprintAbsolute` -> `schema:additionalProperty` (Name: "Carbon Footprint", Unit: "kg CO2e").
*   **[COMPLETED] Step 2.3: Test**
    *   Update `testing/unit/dpp-schema-logic.test.js` with a Battery fixture.
*   **[COMPLETED] Step 2.4: Implement**
    *   Refactor recursive logic in adapter.
    *   Add Battery mappings.

### 3. Construction Context (`dpp-construction.context.jsonld`)
*   **[COMPLETED] Step 3.1: Analyze**
    *   **Findings:**
        *   `dppk:notifiedBody` (Organization) needs mapping.
        *   `dppk:dopIdentifier` / `dopc:declarationCode` -> Identifier.
        *   Specific props (`harmonisedStandardReference`, `avsSystem`) -> `additionalProperty`.
        *   `dppk:reactionToFire` etc. are usually in `dopc` (already handled) but might be root.
*   **[COMPLETED] Step 3.2: Align**
    *   **Mapping Table:**
        *   `dppk:notifiedBody` -> `schema:additionalProperty` (Name: "Notified Body", Value: Org Name).
        *   `dppk:dopIdentifier` -> `schema:identifier` (PropertyID: "DoP ID").
        *   `dppk:harmonisedStandardReference` -> `schema:additionalProperty`.
        *   `dppk:avsSystem` -> `schema:additionalProperty`.
*   **[COMPLETED] Step 3.3: Test**
    *   Update `testing/unit/dpp-schema-logic.test.js` with Construction fixture.
*   **[COMPLETED] Step 3.4: Implement**
    *   Add mappings.

### 4. DOPC Context (`dpp-dopc.context.jsonld`)
*   **[COMPLETED] Step 4.1: Analyze**
    *   **Findings:**
        *   The `dopc` structure is recursive and handled by `flattenToAdditionalProperties`.
        *   `dppk:declarationCode`, `dppk:dateOfIssue` are top-level DOPC fields.
        *   `dppk:declaredUnit`, `dppk:functionalUnit`, `dppk:referenceServiceLife` are specific props.
    *   **Gap:**
        *   `declarationCode` is not mapped to `identifier` on the product directly, it stays in `additionalProperty` if flattened.
        *   However, `dpp-construction` maps `dopIdentifier` to `identifier`. `dopc` is usually a *property* of the product.
        *   If `dopc` is just a bag of characteristics, flattening is fine.
        *   Specific meta-fields of DOPC (`declarationCode`, `dateOfIssue`) might be better as `identifier` or `productionDate` equivalent for the DoP itself, but Schema.org Product doesn't have a direct "DoP" node unless we model it as a `DigitalDocument`.
        *   Current implementation flattens everything in `dopc`.
        *   `declarationCode` -> "Declaration Code" (PropertyValue) is acceptable.
        *   **Decision:** The generic recursive flattening handles this well enough. No specific "Parity" logic needed beyond what exists, assuming `declarationCode` as a property is sufficient.
*   **[COMPLETED] Step 4.2: Align**
    *   **Mapping:** Use existing recursive flattening.
*   **[COMPLETED] Step 4.3: Test**
    *   The `dpp-schema-logic.test.js` already covers generic `dopc` flattening.
*   **[COMPLETED] Step 4.4: Implement**
    *   No changes needed.

### 5. Electronics Context (`dpp-electronics.context.jsonld`)
*   **[COMPLETED] Step 5.1: Analyze**
    *   **Findings:**
        *   Root properties: `energyEfficiencyClass`, `ipRating`, `sparePartsAvailable`.
        *   Root measurements: `torque`, `voltage`, `ratedPower`, `maximumRatedSpeed`.
    *   **Gap:**
        *   These are root-level, so generic `dopc` flattening doesn't catch them.
        *   Need explicit mapping to `additionalProperty`.
*   **[COMPLETED] Step 5.2: Align**
    *   **Mapping Table:**
        *   `dppk:energyEfficiencyClass` -> `schema:additionalProperty`.
        *   `dppk:ipRating` -> `schema:additionalProperty`.
        *   `dppk:sparePartsAvailable` -> `schema:additionalProperty` (Boolean).
        *   `dppk:torque` -> `schema:additionalProperty` (Name: "Torque").
        *   `dppk:voltage` -> `schema:additionalProperty` (Name: "Voltage").
*   **[COMPLETED] Step 5.3: Test**
    *   Update `testing/unit/dpp-schema-logic.test.js` with Electronics fixture.
*   **[COMPLETED] Step 5.4: Implement**
    *   Add Electronics mappings.

### 6. EPD Context (`dpp-epd.context.jsonld`)
*   **[COMPLETED] Step 6.1: Analyze**
    *   **Findings:**
        *   `epdToSchemaOrgCertifications` already handles flattening of the EPD node.
        *   It iterates through all keys in `epd` (like `gwp`, `odp`) and their stage values (`a1`, `a2`, etc.).
        *   It constructs `hasMeasurement` objects for each stage.
    *   **Conclusion:**
        *   The current EPD logic is already "Parity" compliant as it exposes all data.
        *   No new gaps identified.
*   **[COMPLETED] Step 6.2: Align**
    *   **Mapping:** Existing `Certification` -> `hasMeasurement` strategy is solid.
*   **[COMPLETED] Step 6.3: Test**
    *   Already covered by `dpp-schema-logic.test.js` (Step 4 in original file).
*   **[COMPLETED] Step 6.4: Implement**
    *   No changes needed.

### 7. General Product Context (`dpp-general-product.context.jsonld`)
*   **[COMPLETED] Step 7.1: Analyze**
    *   **Findings:**
        *   `dppk:brand`, `dppk:model`, `dppk:netWeight`, `dppk:image`: Already mapped in Core.
        *   `dppk:color`: **Gap**. Target `schema:color`.
        *   `dppk:countryOfOrigin`: **Gap**. Target `schema:countryOfOrigin`.
        *   `dppk:grossWeight`: **Gap**. Target `schema:additionalProperty`.
        *   `dppk:length`: **Gap**. Target `schema:depth` (Standardize L/W/H -> W/H/D).
        *   `dppk:components` (Plural): **Gap**. Core uses `component`. General Product uses `components`. Target `schema:hasPart`.
        *   `dppk:additionalCertifications`: **Gap**. Target `schema:hasCertification`.
*   **[COMPLETED] Step 7.2: Align**
    *   **Mapping Table:**
        *   `dppk:color` -> `schema:color`.
        *   `dppk:countryOfOrigin` -> `schema:countryOfOrigin`.
        *   `dppk:grossWeight` -> `schema:additionalProperty` (Name: "Gross Weight").
        *   `dppk:length` -> `schema:depth` (if depth is missing, else ignore or alias).
        *   `dppk:components` -> `schema:hasPart`.
        *   `dppk:additionalCertifications` -> `schema:hasCertification` (Name: Body Name, StartDate, etc.).
*   **[COMPLETED] Step 7.3: Test**
    *   Update tests with General Product fixture.
*   **[COMPLETED] Step 7.4: Implement**
    *   Update adapter.

### 8. Packaging Context (`dpp-packaging.context.jsonld`)
*   **[COMPLETED] Step 8.1: Analyze**
    *   **Findings:**
        *   `dppk:packaging` (array of `Packaging` objects): **Gap**. Target `schema:hasPart` (or a specific packaging relation if Schema.org had one, but `hasPart` with a specific type is best).
        *   Properties inside `Packaging`:
            *   `dppk:packagingMaterialType`: -> `schema:name` or `schema:material`.
            *   `dppk:packagingMaterialCompositionQuantity`: -> `schema:weight` (if mass) or `schema:additionalProperty`.
            *   `dppk:packagingRecyclingProcessType`: -> `schema:additionalProperty`.
            *   `dppk:packagingRecycledContent`: -> `schema:additionalProperty` ("Recycled Content %").
            *   `dppk:packagingSubstanceOfConcern`: -> `schema:additionalProperty` (List).
    *   **Alignment:**
        *   Schema.org doesn't have a dedicated `packaging` property on Product.
        *   We can map it to `schema:hasPart` where the part has `@type`: `dppk:Packaging` (which we can leave as is, or map to `Product` with a role).
        *   Better: Flatten packaging info into `additionalProperty` if it's small, OR map to `hasPart` objects named "Packaging - [Material]".
*   **[COMPLETED] Step 8.2: Align**
    *   **Mapping Table:**
        *   `dppk:packaging` -> `schema:hasPart` (Type: `Product` (conceptually), Name: "Packaging - [Material]").
        *   Inside the packaging part:
            *   `material` -> `name` ("Packaging - Cardboard").
            *   `recyclingProcess` -> `additionalProperty`.
            *   `recycledContent` -> `additionalProperty`.
            *   `quantity` -> `weight`.
*   **[COMPLETED] Step 8.3: Test**
    *   Update tests with Packaging fixture.
*   **[COMPLETED] Step 8.4: Implement**
    *   Update adapter.

### 9. Textile Context (`dpp-textile.context.jsonld`)
*   **[COMPLETED] Step 9.1: Analyze**
    *   **Findings:**
        *   `dppk:fibreComposition`: List of type/percentage. Target `schema:material`.
        *   `dppk:apparelSize`: Target `schema:size`.
        *   Generic: `tearStrength`, `animalOriginNonTextile`. Target `schema:additionalProperty`.
*   **[COMPLETED] Step 9.2: Align**
    *   **Mapping Table:**
        *   `dppk:fibreComposition` -> `schema:material` ("X% Type, ...").
        *   `dppk:apparelSize` (+System) -> `schema:size` ("Size (System)").
        *   Others -> `schema:additionalProperty`.
*   **[COMPLETED] Step 9.3: Test**
    *   Update `testing/unit/dpp-schema-logic.test.js` with Textile fixture.
*   **[COMPLETED] Step 9.4: Implement**
    *   Update adapter.