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

> **TODO:** This section will be expanded with strict rules for agents regarding how to read, modify, and structure ontology files (e.g., utilizing the `_stripped` directories to save context).
