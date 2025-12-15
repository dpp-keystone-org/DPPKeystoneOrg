# [10] Ontology Annotation Completion

- **State:** Not Started
- **Created:** 2025-12-13
- **Last Updated:** 2025-12-13
- **Objective:** Ensure comprehensive coverage of `rdfs:label` and `rdfs:comment` for all classes and properties across all ontologies.

---

## 1. Overview

Many classes and properties within the project's ontologies are missing human-readable `rdfs:label` annotations and descriptive `rdfs:comment` annotations. This makes the data models difficult to understand for developers and stakeholders and hinders automated documentation generation. 

This design document outlines the process for identifying and filling these gaps. It also covers the introduction of simple, reusable datatypes with built-in validation constraints (e.g., a "PercentageDecimal" with a min/max value) to make the ontology the single source of truth for business rules.

## 2. Core Tasks

1.  **Audit Coverage:**
    -   Write a script to recursively scan all `.jsonld` files in the `src/ontology/` directory.
    -   The script will parse the RDF graphs and identify all `owl:Class`, `owl:ObjectProperty`, and `owl:DatatypeProperty` definitions.
    -   For each definition, it will check for the existence of `rdfs:label` and `rdfs:comment`.
    -   The script will output a report (e.g., in Markdown or CSV format) listing all entities that are missing one or both annotations.

2.  **Remediate Annotations:**
    -   Using the generated report, systematically add the missing `rdfs:label` and `rdfs:comment` annotations to the respective ontology files.
    -   Labels should be concise and use a consistent case convention (e.g., Title Case for classes, camelCase for properties).
    -   Comments should clearly and succinctly explain the purpose and intended use of the class or property.

3.  **Define and Apply Reusable Datatypes:**
    -   Identify properties that can be constrained with a reusable datatype (e.g., percentages, specific string patterns).
    -   Define a new `rdfs:Datatype` in the ontology (e.g., `dppk:PercentageDecimal`) using `owl:onDatatype` and `owl:withRestrictions` to set XSD facets like `xsd:minInclusive` and `xsd:maxInclusive`.
    -   Update relevant properties (e.g., `dppk:stateOfHealth`) to use the new datatype as their `rdfs:range`.

4.  **Verification:**
    -   Re-run the audit script to confirm that all entities now have complete annotations.
    -   Add a new, permanent test to the integration suite that performs this audit automatically, failing the build if any ontology entity is missing a label or comment. This will prevent future regressions.

5. **Pause and allow the user to test and discuss next steps.**
