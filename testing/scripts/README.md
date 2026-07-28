# Testing Scripts (`testing/scripts/`)

This directory contains utility scripts that support the testing infrastructure. They are primarily used during automated integration tests or for manual debugging.

*   **`test-helpers.mjs`**: Contains core utilities for setting up the test environment. **Crucially, this is where any new JSON-LD context URLs must be mapped to their local `dist/` file paths** so that the JSON-LD parser doesn't try to fetch them from the live internet during tests.
*   **`shacl-helpers.mjs`**: Provides helper functions for loading RDF datasets and running the local document loader for SHACL tests.
*   **`run-shacl-validation.mjs`**: The main execution script for validating expanded JSON-LD graphs against our SHACL shapes.
*   **`crawler.mjs`**: A site crawler that scans the generated `dist/` folder to ensure there are no broken links, missing assets, or malformed JSON/JSON-LD files.
*   **`debug-*.mjs`**: Various scripts (`debug-expansion.mjs`, `debug-shacl-logic.mjs`, `debug-validation.mjs`) used by developers to isolate and troubleshoot specific parts of the validation and expansion pipeline.
