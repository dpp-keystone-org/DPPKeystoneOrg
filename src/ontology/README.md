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
