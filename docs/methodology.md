# Methodology and Technical Approach

This document explains the technical methodology used in the DPP Harmonizing
Data Dictionary. Understanding this approach is crucial for interpreting the
definitions and contributing effectively.

## 1. The Challenge

The Digital Product Passport (DPP) ecosystem involves data from diverse sources,
standards (ISO, GS1, IEC), and regulatory domains. Often, these standards use
different names for the same concept (e.g., "Manufacturer" vs. "Producer") or
the same name for different concepts.

Traditional data exchange methods (like fixed XML schemas or rigid JSON
structures) struggle with this complexity. They often lead to data duplication,
ambiguity, and high implementation costs, particularly for SMEs.

We utilize **Semantic Web technologies** to address this challenge, providing a
flexible yet rigorous framework for data definition.

## 2. The "Keystone" Approach

This repository adopts a "Keystone" approach. Rather than attempting to recreate
or replace existing standards, we provide a central, harmonized ontology that
acts as the semantic "hub."

This involves:

1.  **Defining Core Concepts:** Establishing clear, stable definitions and URIs for the essential concepts required by the DPP regulations.
2.  **Mapping Equivalencies:** Formally declaring when a core concept is semantically identical to a concept in an external standard.
3.  **Modularity:** Separating horizontal (cross-sector) requirements (`core/`) from vertical (sector-specific) requirements (`sectors/`).

## 3. Why JSON-LD?

We use **JSON-LD (JavaScript Object Notation for Linked Data)** as the primary
serialization format for both the ontology definitions and the DPP examples.

*   **Developer Friendly:** JSON-LD is 100% valid JSON. Developers can use
    familiar tools and libraries to read, write, and process the data.
*   **Machine-Readable Semantics:** Through the `@context`, JSON-LD links simple
    JSON keys to globally unique identifiers (URIs), making the data unambiguous
    and machine-interpretable.
*   **Flexibility:** It supports a "data-as-a-graph" model, which is far better suited for the complex, interconnected nature of supply chain and lifecycle data than rigid hierarchical structures.

## 4. RDFS and OWL

The definitions in the `ontology/` directory utilize RDFS (Resource Description
Framework Schema) and OWL (Web Ontology Language). These provide the formal
mechanisms to:

*   **Define Classes:** (the "nouns" or types of things).
*   **Define Properties:** (the "verbs" or attributes/relationships).
*   **Establish Relationships:** (e.g., `rdfs:subClassOf`).
*   **Declare Equivalencies:** (e.g., `owl:equivalentProperty`). This is the core mechanism for harmonization, allowing data consumers to understand that two different URIs mean the exact same thing.

## 5. The Three-Layer Architecture

The repository structure reflects the separation of concerns necessary for a
scalable system:

### Layer 1: The Ontology (`ontology/`)

This is the semantic source of truth. It defines *what* the terms mean and how
they relate to each other and external standards.

*   **Audience:** Data modelers, standardization experts, ontology engineers.

### Layer 2: The Contexts (`contexts/`)

This layer provides the implementation mapping (the Vocabulary). It maps the
formal Ontology URIs to developer-friendly JSON keys.

*   **Audience:** Developers, implementation teams, SMEs. This layer shields implementers from the complexity of the underlying ontology while preserving semantic rigor.

### Layer 3: Validation Artifacts (`validation/`)

This layer defines the rules and constraints.

*   **JSON Schema:** Used for structural validation (ensuring the mandatory DPP header fields are present).
*   **SHACL (Shapes Constraint Language):** Used for semantic validation (ensuring the data claims and relationships within the payload are correct and logical).

## 6. Identifier Strategy

A cornerstone of the DPP methodology is the use of globally unique, persistent,
and resolvable identifiers (URIs).

*   **Term Definitions:** All terms defined in this dictionary have stable URIs in the `https://dpp-keystone.org/v1/terms#` namespace.
*   **Real-World Entities:** We strongly advocate for the use of established URI
    schemes for identifying products (e.g., GS1 Digital Link), organizations
    (e.g., URN:LEI, GLN URIs), and the DPP instances themselves.