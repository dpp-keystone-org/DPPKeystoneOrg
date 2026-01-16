# Design Doc 004: Full Data Transformation to Target Schemas

This document outlines the sub-roadmap for Task #4, a large-scale effort to demonstrate broad interoperability by transforming DPP data into various target schemas.

---

- **[PENDING] 4. Implement Full Data Transformation to Target Schemas:** Expand the adapter to transform every example DPP into `schema.org`, `gs1`, and `un-cefact` formats. This is a large-scale effort to demonstrate broad interoperability. Pause and allow the user to test and discuss next steps.
  - **4a. Schema.org Transformation:**
    - **[COMPLETED] 4a-1. Design & Analysis:** Analyze DPP examples, `schema.org` vocabulary, and internal ontologies to create a comprehensive mapping strategy. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 4a-2. Implementation:** Enhance the `schema.org.js` profile to perform a full transformation for every example DPP, following the approved design. Pause and allow the user to test and discuss next steps.
      - [COMPLETED] 4a-2-i. Map Core Product Fields: Implement the transformation for the top-level `schema:Product` object, mapping core header fields (`productName`, `model`, `manufacturer` as a nested `Organization`, etc.) based on ontology equivalencies. Pause and allow the user to test and discuss next steps.
      - [COMPLETED] 4a-2-ii. Map Declared Performances: Implement the logic to transform the `dopcDeclarations` object into a list of `schema:PropertyValue` objects, attached via `schema:additionalProperty`. Pause and allow the user to test and discuss next steps.
      - [COMPLETED] 4a-2-iii. Refactor EPD Transformation: Refactor the existing EPD logic. The new implementation should create a single `schema:Certification` object for the entire EPD, with all individual indicators attached as a list of `schema:PropertyValue` objects under the `hasMeasurement` property. Pause and allow the user to test and discuss next steps.
      - [COMPLETED] 4a-2-iv. Implement DPP Type Inference from contentSpecificationId: Refactor the core logic to dynamically infer the DPP's semantic type (e.g., ConstructionProduct) based on `contentSpecificationId`, removing the need for an explicit `@type` array in the source documents. Pause and allow the user to test and discuss next steps.
      - [COMPLETED] 4a-2-v. Map Document Links: Implement the transformation for document links (`instructionsForUse`, `safetyDataSheet`) into `schema:DigitalDocument` objects linked from the main product. Pause and allow the user to test and discuss next steps.
      - [COMPLETED] 4a-2-vi. Add Schema.org Equivalencies to EPD Ontology: Enhance the `src/ontology/v1/core/EPD.jsonld` file with `owl:equivalentClass` and other mappings to `schema.org` to provide stronger semantic hints for generic JSON-LD parsers. Pause and allow the user to test and discuss next steps.
    - **[COMPLETED] 4a-3. Testing:** Create a comprehensive server-side test (`dpp-adapter-product.test.js`) to validate the full `schema.org` product transformation, ensuring parity with the client-side test suite. Pause and allow the user to test and discuss next steps.
  - **4b. GS1 Transformation:**
    - **[PENDING] 4b-1. Design & Analysis:** Research the GS1 Web vocabulary. For each DPP example, analyze the vocabulary to find the most appropriate mappings, leveraging the ontology. Document gaps. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 4b-2. Implementation:** Create a new `gs1.js` profile and implement the transformation logic. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 4b-3. Testing:** Create comprehensive tests to validate the output for each example. Pause and allow the user to test and discuss next steps.
  - **4c. UN/CEFACT Transformation:**
    - **[PENDING] 4c-1. Design & Analysis:** Research the UN/CEFACT vocabulary. For each DPP example, analyze the vocabulary to find appropriate mappings, leveraging the ontology. Document gaps. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 4c-2. Implementation:** Create a new `un-cefact.js` profile and implement the transformation logic. Pause and allow the user to test and discuss next steps.
    - **[PENDING] 4c-3. Testing:** Create comprehensive tests to validate the output for each example. Pause and allow the user to test and discuss next steps.
