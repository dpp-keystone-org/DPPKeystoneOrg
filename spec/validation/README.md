# DPP Keystone Validation Strategy

This document outlines the validation strategy for the DPP Keystone project. It is intended for developers and AI assistants to understand the different layers of validation and how they ensure data quality and conformance.

## Dual Validation Approach

We employ a two-pronged validation strategy to ensure both the structural integrity and the semantic correctness of Digital Product Passport (DPP) data.

1.  **JSON Schema:** Used for **structural validation**. It checks if a DPP JSON document has the correct shape, data types, and required fields. This is our primary tool for end-users and client-side applications.
2.  **SHACL (Shapes Constraint Language):** Used for **semantic validation**. It checks if the underlying RDF graph, after expanding the JSON-LD, conforms to our expected semantic rules and relationships. This is an internal tool for verifying our ontology mappings.

---

## Part 1: JSON Schema for Structural Validation

### Purpose and Audience

JSON Schema is our public-facing validation layer. Its purpose is to provide a clear, machine-readable definition of what a valid DPP payload looks like. This helps developers and companies create correct DPPs and will be used to power tools like the DPP Generation Wizard.

### Architecture: Header + Delegated Acts (DAs)

Our schema architecture is designed to be modular and extensible, mirroring the expected structure of the EU's DPP regulations (based on `prEN182223`). It consists of two main parts:

1.  **Core Header Schema (`dpp.schema.json`):** A single, primary schema that defines the common "header" information required for all DPPs, regardless of product type. This includes fields like `dppId`, `dppVersion`, etc.

2.  **Delegated Act (DA) Sub-Schemas:** Multiple, smaller schemas that apply conditionally based on the product type. Each DA corresponds to a specific product category (e.g., Batteries, Textiles) and defines the fields required for that category.

### Conditional Application of Sub-Schemas

A sub-schema for a Delegated Act is applied **only if** its unique identifier is present in the DPP payload's `contentSpecificationIds` array.

Each DA sub-schema must contain logic to enforce this. It first checks for the presence of its own ID in the `contentSpecificationIds` array. If the ID is present, the schema applies its rules to the rest of the payload. If the ID is not present, the schema must not apply any rules.

**Example:**

A sub-schema for "Batteries" might have the `contentSpecificationId` of `urn:eu:dpp:batteries:v1`. The schema would be structured with an `if/then` block like this:

```json
{
  "if": {
    "properties": {
      "contentSpecificationIds": {
        "type": "array",
        "contains": {
          "const": "urn:eu:dpp:batteries:v1"
        }
      }
    },
    "required": ["contentSpecificationIds"]
  },
  "then": {
    // ... all the specific rules for Batteries go here ...
    "properties": {
      "batteryType": { "type": "string" }
    },
    "required": ["batteryType"]
  }
}
```

### Mandatory Testing Methodology for Sub-Schemas

This conditional architecture requires a strict, two-part testing strategy for every sub-schema:

1.  **Activation Test:** A test must prove that if a payload **contains** the correct `contentSpecificationId`, the sub-schema activates and **FAILS** validation on a payload with incorrect or missing data for that DA.

2.  **Inactivation Test:** A test must prove that if a payload **does not contain** the correct `contentSpecificationId`, the sub-schema remains inactive and **PASSES** validation, even if the payload contains data that would otherwise be invalid for that DA.

---

## Part 2: SHACL for Semantic Validation

SHACL is an internal tool used exclusively for testing our data model's semantic integrity.

-   **Purpose:** To verify that our JSON-LD contexts and ontology mappings are correct.
-   **Process:** When we expand a DPP example from its compact JSON-LD form into a full RDF graph, SHACL shapes ensure that the resulting graph has the correct structure, relationships, and class types (e.g., ensuring a `dpp:manufacturer` entity correctly expands to a `schema:Organization`).
-   **Audience:** This is for internal project developers to catch errors in the ontology and context files. It is not intended for end-user DPP validation.
