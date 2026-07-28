# DPP Keystone - Validation and Testing

This directory contains the integration and validation tests for the DPP Keystone data models. It uses [Jest](https://jestjs.io/) for automated testing and includes standalone scripts for manual validation.

The primary goal of this suite is to ensure that the example Digital Product Passports (DPPs) conform to their corresponding [SHACL](https://www.w3.org/TR/shacl/) shapes.

## Directory Structure

*   **`fixtures/`**: Contains small, static test data files (e.g., mock JSON-LD payloads, minimal ontology snippets) used by the test suites.
*   **`scripts/`**: Utility scripts to support testing and debugging. See [`scripts/README.md`](scripts/README.md) for details.
*   **`unit/`**: Contains genuinely self-contained source code tests.
*   **`integration/`**: Contains tests that run over artifacts in the generated `dist/` directory *after* the project is built. These tests ensure that the schemas and contexts are correctly assembled, but they do not exercise UI code in a browser.
    *   **`integration/playwright/`**: Large, end-to-end tests that launch a real browser environment to test the interactive web UI tools (Wizard, Validator).

## Important Rules for AI Agents and Developers

### 1. Re-use Existing Test Files
Before creating a brand new test file, **always examine the file names of existing test cases** in the `unit/` and `integration/` directories. It is often more appropriate to edit and expand an existing, related test file to cover your new logic rather than cluttering the directory with semi-redundant scripts.

### 2. URL to Local Path Mapping
During testing, the JSON-LD parser is restricted from fetching contexts from the live internet. 
If you add any new `.json` or `.jsonld` files (or other test inputs) in the project, they must be remapped from their public URIs to their compiled locations in the `dist/` directory.
**This mapping is maintained in [`scripts/test-helpers.mjs`](scripts/test-helpers.mjs).** You must update the mapping variables there whenever introducing a new context.

## Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (LTS version, e.g., 20.x or later, is recommended)
- [npm](https://www.npmjs.com/) (comes bundled with Node.js)

### Installation

All dependencies are managed in the `package.json` file within this directory. To install them, navigate to the `testing` directory and run:

```sh
$ npm install
```

This will download all necessary packages, including Jest, Babel, and the various RDF/JS libraries required for SHACL validation.

## Usage

There are two ways to run the validation checks:

### 1. Automated Testing (Recommended)

The automated test suite is the preferred method for validation, as it is designed for integration into CI/CD pipelines and provides clear pass/fail results.

To run all tests defined in the `integration/` directory, execute the following command:

```sh
$ npm test
```

Jest will discover and run all `*.test.js` files, reporting the results to the console. The key test suites in the `integration/` directory include:
- `dpp-examples.schema.test.js`: Validates all DPP examples against the master `dpp.schema.json` to ensure they have the correct structure.
- `dpp-examples.validation.test.js`: Validates the semantic content of various example DPPs against their corresponding core and sector-specific SHACL shapes.
- `index-html-generation.test.js`: Checks that the main `index.html` file is correctly populated with links to all data models.
- `simple-expand.test.js`: Ensures that the JSON-LD contexts are correctly wired and that example files can be successfully expanded to a full graph representation.
- `spec-docs-generation.test.js`: Confirms that the HTML documentation for the ontology and contexts is generated correctly.

### 2. Manual Validation Script

A standalone script is provided for quick, manual validation of a single example file. This can be useful for debugging or one-off checks.

To run it, execute the following command from the `testing` directory:

```sh
$ node scripts/run-shacl-validation.mjs
```

The script will output the validation status to the console. If the data does not conform, it will print a detailed report of the validation failures.