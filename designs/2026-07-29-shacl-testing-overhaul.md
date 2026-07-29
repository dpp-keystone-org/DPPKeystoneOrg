# Design Document: SHACL Testing Overhaul (Ontology Fuzzer)

**Date**: 2026-07-29
**Objective**: Replace the permissive, manual SHACL testing strategy with a dynamic Ontology-Driven Fuzzer that programmatically guarantees 100% SHACL validation coverage against all 250+ ontology properties before finalizing v3.

## Phase 1: Build the Fuzzer Engine
- [ ] Create `testing/scripts/shacl-fuzzer.mjs`.
- [ ] Implement a function `loadOntologyDefinition(ontologyFilePath)` that parses a stripped ontology JSON-LD file into memory.
- [ ] Implement a function `extractClassRequirements(ontologyGraph, targetClass)` that finds all properties where `rdfs:domain` matches the target class, extracting their `rdfs:range` and `owl:oneOf` constraints.
- [ ] Implement a function `synthesizeHappyPathGraph(classRequirements)` that generates a valid, minimal RDF graph using `@rdfjs/data-model/Factory.js`. It must inject dummy data matching the required `rdfs:range` (e.g., a dummy URI for `@id`, a float for `xsd:double`, or a valid enum value).

## Phase 2: Implement Mutation Strategies (The Fuzzer)
- [ ] In `testing/scripts/shacl-fuzzer.mjs`, implement a function `generateMutations(happyPathGraph, classRequirements)`.
- [ ] Add mutation logic: **Missing Property**. For every mandatory property, generate a graph where that property is completely omitted.
- [ ] Add mutation logic: **Wrong Datatype**. For every property, generate a graph where the value is intentionally the wrong type (e.g., a literal string instead of an `xsd:double`).
- [ ] Add mutation logic: **Enum Violation**. For properties with `owl:oneOf`, generate a graph with a value that is explicitly outside the permitted enumeration list.
- [ ] Implement the assertion wrapper: Run every synthesized and mutated graph through `rdf-validate-shacl`. Assert that the happy path **passes**. Assert that every mutated graph **fails**. If a mutated graph passes, throw an error highlighting the specific property and mutation that the SHACL shape failed to catch.

## Phase 3: Run the Gauntlet (Zero-Config Auto-Discovery)
- [ ] Create directory `testing/unit/shacl-fuzzing/`.
- [ ] Create a single dynamic test suite: `testing/unit/shacl-fuzzing/fuzz-all-ontologies.test.js`.
- [ ] Implement an auto-discovery mechanism in the test file that recursively scans `src/ontology/v3_stripped/` for all `.jsonld` files.
- [ ] For each file found, dynamically extract every `rdfs:Class`.
- [ ] Dynamically generate Jest `describe()` blocks for every class discovered, passing them to the fuzzer engine. (This acts as permanent meta-validation: any new ontology file added to the project is automatically and unavoidably fuzz-tested in CI without developers having to write a manual test case).

## Phase 4: Identify and Patch Validation Gaps
- [ ] Run the new fuzzer test suite to generate a comprehensive failure report exposing all weaknesses in the current SHACL shapes.
- [ ] Systematically update `src/validation/v3/shacl/core-shapes.shacl.jsonld`, adding `sh:datatype`, `sh:node`, `sh:in`, and `sh:minCount` constraints based on the fuzzer's output until the core tests pass cleanly.
- [ ] Systematically update sector-specific SHACL shapes (e.g., `iron-steel-shapes.shacl.jsonld`, `textile-shapes.shacl.jsonld`) based on the fuzzer's output until the sector tests pass cleanly.
