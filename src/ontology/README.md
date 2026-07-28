# DPP Keystone Ontology

This directory contains the semantic source of truth for the DPP Keystone project. It is structured into versions (e.g., `v3`), which are further broken down into modular ontology files.

## Ontology Modularity and `owl:imports`

To keep the definitions maintainable, the ontology is split into a core file and multiple specialized modules (e.g., Header, specific product sectors like Battery or Textile). 

We do not use complex server rules to map individual term URIs to specific files. Instead, we use the standard `owl:imports` mechanism. The main entry file (`dpp-ontology.jsonld`) imports all the necessary sub-modules. Semantic software automatically understands `owl:imports` and will fetch the linked modules as needed.

## URI Resolution and Content Negotiation

The official base URI (Identifier) for terms in this ontology is:
`https://dpp-keystone.org/spec/v3/terms` *(or the relevant version)*

When a system attempts to resolve this Identifier, it needs to be redirected to the actual file location (e.g., `https://dpp-keystone.org/spec/ontology/v3/dpp-ontology.jsonld`).

Because this project is hosted statically on **GitHub Pages** (which lacks native HTTP 303 server-side redirect support), this redirection is handled via a **client-side HTML meta refresh**. 
During the automated build process (`scripts/build-and-clean.mjs`), a static `index.html` file containing a `<meta http-equiv="refresh">` tag is generated at the `/spec/[version]/terms/` path.

## AI Agent Guidelines

> **CRITICAL RULE FOR AI AGENTS:** DO NOT READ THE RAW `.jsonld` FILES IN THIS DIRECTORY FOR ONTOLOGY EXPLORATION! 

The primary ontology files in `src/ontology/[version]/` contain `rdfs:label` and `rdfs:comment` arrays translated into 24 different languages. Reading these files directly will massively bloat your context window and degrade your reasoning capabilities.

**When you need to examine the ontology:**
1. Check if the `src/ontology/[version]_stripped/` directory exists.
2. If not (or if it's stale), ask the human to run `node scripts/strip-ontology-annotations.mjs`.
3. Read the files from the `_stripped` directory. These files have all non-English translations removed, making them compact and easy for an AI to parse.

**When you need to modify the ontology:**
You must apply your changes to the raw source files in `src/ontology/[version]/` (not the stripped versions). Ensure that you preserve the existing 24-language translation arrays when adding or modifying terms, or ask the human how to handle translations for new terms.

## Semantic Modeling Rules

When defining or modifying terms in the ontology, strict adherence to these rules is mandatory:

### Core Identity and Metadata
*   **IRIs Required**: Every term must have a unique `@id` (IRI).
*   **Sector-Specific Namespaces**: When a term requires a sector-specific schema, it must be assigned a sector-specific namespace in the ontology (e.g., using a prefix like `dppk-sector:` rather than the generic `dppk:`). This ensures domain-specific schema definitions align with distinct semantic identities.
*   **File Metadata**: Every ontology file must include a `dcterms:title` (translated) and a `dcterms:description`.
*   **Versioning and Imports**: Every file must declare its version using `owl:versionInfo` (with the `{{VERSION}}` placeholder) and declare its dependencies using `owl:imports`. (Dependencies from W3C namespaces can be included liberally).

### Graph Structure and Types
*   **Strict Graph**: The ontology describes a strict class-and-membership graph, not a flat list of standalone terms. 
*   **Class Definitions**: Use `rdfs:Class` for defining classes.
*   **Property Definitions**: Use `owl:DatatypeProperty` or `owl:ObjectProperty` (do *not* use `rdf:Property`). 
*   **Data Types**: Every property must explicitly declare a data type using `rdfs:range` (e.g., `xsd:string`, `xsd:double`, or a specific class object).
*   **Sector Root Classes**: Each product category's sector ontology file must first define a root class (e.g., `dppk:TextileProduct`) that is an `rdfs:subClassOf` `dppk:Product`. All subsequent properties defined in that sector file should generally be fields belonging to that class, linked via `rdfs:domain`.

### Documentation and Translation
*   **24 Languages**: Every property and class definition must use `rdfs:label` and `rdfs:comment` with translated strings to support all 24 European languages.

### External Mappings and Sources
*   **SKOS Mappings**: Wherever feasible, map terms to their equivalent or most similar terms in `gs1.org`, `schema.org`, and `unece` vocabularies using `skos:exactMatch`, `skos:closeMatch`, or `skos:relatedMatch`.
*   **Legislation Source**: Every term should have a `dcterms:source`. This is usually the EU ESPR legislation that dictates the term's inclusion. The source must be an object with an `@id` pointing to the public link (usually EUR-Lex) and a label.
*   **Governing Standards**: Use the `dppk:governedBy` annotation (as a simple string) to indicate the exact standard (e.g., "DIN DKE SPEC 99100" or "EN 10168") used to derive the value. Do *not* duplicate the paid standard's text or complex rules; just name the standard.

### Units and Enumerations
*   **Units**: If a term is a measurement, it must declare its units using `dppk:unit`. The standard units are defined in `core/Unit.jsonld` (which can be expanded as necessary). Units should map to the QUDT ontology (`qudt`) using `skos:exactMatch` wherever feasible.
*   **Enumerations**: If a term has a finite set of controlled values instead of units, define an enumeration (typically utilizing a class with `owl:oneOf` and individual instances).
