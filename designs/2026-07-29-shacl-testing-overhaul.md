# Design Document: SHACL Testing Overhaul (Ontology Fuzzer)

**Date**: 2026-07-29
**Objective**: Replace the permissive, manual SHACL testing strategy with a dynamic Ontology-Driven Fuzzer that programmatically guarantees 100% SHACL validation coverage against all 250+ ontology properties before finalizing v3.

## Phase 1: Build the Fuzzer Engine
- [x] Create `testing/scripts/shacl-fuzzer.mjs`.
- [x] Implement a function `loadOntologyDefinition(ontologyFilePath)` that parses a stripped ontology JSON-LD file into memory.
- [x] Implement a function `extractClassRequirements(ontologyGraph, targetClass)` that finds all properties where `rdfs:domain` matches the target class, extracting their `rdfs:range` and `owl:oneOf` constraints. (Bug fixed: now properly handles string-based `rdfs:range` values).
- [x] Implement a function `synthesizeHappyPathGraph(classRequirements)` that generates a valid, minimal RDF graph using `@rdfjs/data-model/Factory.js`. 

## Phase 2: Implement Mutation Strategies (The Fuzzer)
- [x] In `testing/scripts/shacl-fuzzer.mjs`, implement a function `generateMutations(happyPathGraph, classRequirements)`.
- [x] Add mutation logic: **Missing Property**. *Note: Explicitly disabled because the ontology does not strictly define presence requirements, and we defer to JSON schemas for structural required fields.*
- [x] Add mutation logic: **Wrong Datatype**.
- [x] Add mutation logic: **Enum Violation**.
- [x] Implement the assertion wrapper: Run every synthesized and mutated graph through `rdf-validate-shacl`. Assert that the happy path **passes** and mutated graphs **fail**.

## Phase 3: Run the Gauntlet (Zero-Config Auto-Discovery)
- [x] Create directory `testing/unit/shacl-fuzzing/`.
- [x] Create a single dynamic test suite: `testing/unit/shacl-fuzzing/fuzz-all-ontologies.test.js`.
- [x] Implement an auto-discovery mechanism in the test file that recursively scans `dist/spec/ontology/` for all `.jsonld` files.
- [x] For each file found, dynamically extract every `rdfs:Class` and dynamically generate Jest `describe()` blocks.

## Phase 4: Auto-Generate SHACL as a Build Artifact (PIVOT)
*Instead of manually patching the SHACL files (which leads to drift), we decided to auto-generate them during the build process.*
- [x] Create `scripts/generate-shacl.mjs` to auto-generate strict SHACL files (`auto-generated.shacl.jsonld`) from the compiled ontology files.
- [x] Include a cross-referencing feature in the generator to parse all `JSON Schema` files and map any `required` properties directly into `sh:minCount 1` rules in the generated SHACL.
- [x] Wire `generate-shacl.mjs` into the `scripts/build-and-clean.mjs` pipeline.
- [x] Update `scripts/update-index-html.mjs` to list the generated SHACL from `dist/` instead of `src/`.
- [x] Modify `generate-shacl.mjs` to split the generated SHACL into separate files per sector ontology.
- [x] Update test suites (e.g., `dpp-examples.validation.test.js` and `index-html-generation.test.js`) to dynamically load all generated SHACL files.

## Phase 5: Debugging and Fixing Issues
- [x] Verify crawler tests pass and front-page has generated SHACL shapes correctly linked.
- [x] Debug the failing **fuzz tests** together with the user to find the root cause and fix it.
- [ ] Debug the failing **example validation tests**, using lessons learned from fixing the fuzz tests to address sparse output issues.
