# TDD Ontology Validator Architecture

## Objective
We will strictly follow Test-Driven Development (TDD) by building a fully independent `ontology-validator.js` module inside `src/util/js/common/validation/`. The validator will enforce exact data types specified by `rdfs:range` metadata during processing, resolving schema permissiveness issues (e.g., catching string data bypassing JSON Schema when an ontology requires strict `xsd:date`).

## Work Steps

### 1. Test Harness Development (Test-Driven Phase)
**File**: `src/util/js/common/validation/testing/ontology-validator.test.js`

We will build a bulletproof Jest test suite for the yet-unwritten ontology validator.
* **Basic Primitive Checks**: `xsd:date`, `xsd:dateTime`, `xsd:decimal`, `xsd:integer`, `xsd:boolean`, and explicitly checking Country Codes and specific URIs.
* **Nested Object Evaluation**: Verifying that properties grouped deeply within organizational records or sub-classes correctly map to the underlying ontology.
* **Array Aggregation**: Asserting that iterating through `items` appropriately checks each underlying array primitive against the parent key's metadata map.
* **Context/Scoped Scrutiny**: Testing missing variables, missing maps, and external prefix overrides logically.

All tests will inherently fail initially.

### 2. Functional Implementation
**File**: `src/util/js/common/validation/ontology-validator.js`

Create the logic to make the test harness pass:
1. Export `validateAgainstOntology(dppData, ontologyMap)`.
2. Perform localized string evaluations for ranges correctly imported or contained securely against definitions:
   - `isDate()` for `date`
   - `isDateTime()` for `dateTime`
   - `isInteger()` / `isNumber()` checks.
3. Establish a robust recursive object walker and map matching array builder.

### 3. Integration & Browser Testing
**File**: `testing/integration/playwright/validator.spec.js` 

Build tests verifying standalone Validator Page GUI behaviors when merging strict ontology arrays into the JSON Schema's AJV errors to confirm edge cases display seamlessly in the dom. We will update the browser tests for lots of edge cases where a schema validator might be more lenient than the ontology validator.

### 4. Controller Integration
**File**: `src/validator/validator.js`

1. Dynamically import the specific `ontology-loader.js` during UI initialization to generate the sector tree mapping. 
2. Import `validateAgainstOntology`.
3. Pass parsed JSON input sequentially through `validateDpp` and `validateAgainstOntology`.
4. Smoothly concatenate resulting schema errors and format strictness issues to perfectly simulate complex validation feedback natively for the user. Verify that the browser tests start passing.
