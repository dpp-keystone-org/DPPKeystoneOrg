# Source Directory (`src/`)

This directory contains the core source code, ontologies, and utilities for the DPP Keystone project. **All active development must happen in this directory.** The build process will compile, clean, and copy these files into the `dist/` directory for deployment.

## Directory Index

### Core Data Models
*   **[`ontology/`](ontology/)**: The semantic source of truth. Contains the JSON-LD definitions of all DPP classes and properties. *(Detailed documentation pending).*
*   **[`contexts/`](contexts/)**: Contains the JSON-LD context files mapping ontology terms to developer-friendly JSON keys. *(Detailed documentation pending).*
*   **[`validation/`](validation/)**: Contains the DPP JSON Schemas and SHACL shapes used to enforce constraints. See its [Validation Strategy README](validation/README.md).

### Web Utilities & Applications
*   **[`csv-dpp-adapter/`](csv-dpp-adapter/README.md)**: A utility to map and transform a database schema dump (as CSV) into compliant DPP JSON fields.
*   **[`explorer/`](explorer/README.md)**: A vocabulary search UI with auto-completion, allowing users to find and click through to detailed documentation for any term.
*   **[`validator/`](validator/README.md)**: A web interface to validate any DPP JSON payload against the project's schema and ontology constraints.
*   **[`wizard/`](wizard/README.md)**: A form generator that allows users to manually build a valid DPP JSON file by selecting a sector and schemas, and optionally transform it into HTML or Schema.org formats.

### Libraries & Assets
*   **[`branding/`](branding/)**: Contains CSS and branding assets reused across all static and dynamically generated HTML pages in the project.
*   **[`lib/`](lib/README.md)**: **Internal** libraries and reusable resources shared across the wizard, validator, adapter, and build scripts.
*   **[`util/`](util/README.md)**: **Publicly reusable** utilities (like the EPD adapter) for validating and generating DPPs.
*   **[`examples/`](examples/README.md)**: Sample DPP JSON-LD files and associated fake assets (like brand-less product images).
