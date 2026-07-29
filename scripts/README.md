# Scripts Directory

This directory contains all the automation, build, validation, and maintenance scripts for the DPP Keystone project.

## General Workflow

> **CRITICAL WORKFLOW RULE:** Between any file changes, the only command you need to run to update the build targets is `npm run build` (which invokes `build-and-clean.mjs`). This is automatically run when executing `npm test` to ensure tests always run against the latest code.
> 
> **CRITICAL AI INSTRUCTION:** AI Agents MUST NOT independently run `npm run build`, `npm test`, or execute these scripts directly in a shell. Always ask the user to run the appropriate commands in the terminal.

> **STYLE GUIDELINE:** All Node.js scripts in this repository must consistently use ES Modules syntax (`import`/`export`) and the `.mjs` file extension. Avoid CommonJS (`require`) and `.cjs` or `.js` extensions for scripts.

Detailed documentation for each script is located directly within the scripts themselves as header comments. Use the following index to determine which script is relevant to your current task, and then read the script file for implementation details.

### Build and Deployment
*   [`build-and-clean.mjs`](build-and-clean.mjs): The primary build orchestrator. Cleans targets, lints JSON, strips comments, and generates the `dist/` folder.
*   [`clean.mjs`](clean.mjs): Utility to remove the `dist/` directory.
*   [`bundle-vendor.mjs`](bundle-vendor.mjs): Bundles Node dependencies (AJV, PapaParse) into browser-compatible ESM modules inside `src/lib/vendor/`.

### Formatting and Linting
*   [`compact-json.mjs`](compact-json.mjs): Standardizes the visual layout of JSON/JSON-LD source files without stripping comments.

### HTML Generation & Documentation
*   [`generate-spec-docs.mjs`](generate-spec-docs.mjs): **CRITICAL SCRIPT.** The core engine that parses the JSON-LD files and generates the static HTML specification documentation. 
    > **MAINTENANCE RULE:** You MUST update this script and add corresponding tests any time a new convention is introduced, a new external dependency is added, a new type of JSON-LD vocabulary/annotation is used, or if the directory structure changes in any way.
*   [`update-index-html.mjs`](update-index-html.mjs): Dynamically populates the root `index.html` (and the `util/index.html`) with actual links to all the generated contexts, ontologies, schemas, and examples by scanning the source directories.

### Diagnostics & Utilities
*   [`scan-schema-types.mjs`](scan-schema-types.mjs): A helpful debugging utility that scans all compiled JSON Schemas to list every unique `type` and `format` currently in use. Highly useful when expanding the Wizard UI to ensure you've built widgets for all required data types.
*   [`tag-html.mjs`](tag-html.mjs): Automates i18n extraction. **Workflow tip:** build a regular hardcoded HTML page, verify it looks good in the browser, and then run this script to automatically inject `data-i18n-key` tags and extract the strings to a JSON file.

### Ontology Utilities
*   [`strip-ontology-annotations.mjs`](strip-ontology-annotations.mjs): Strips all non-English `rdfs:label` and `rdfs:comment` translations from the source ontology, creating a lightweight `_stripped` copy. **Crucial workflow step for AI agents to save context window space when researching ontologies.**

### Validation & Integrity
*   [`validate-i18n.mjs`](validate-i18n.mjs): Ensures every `data-i18n-key` referenced in HTML or JS has a corresponding entry in the translation resource files.
*   [`validate-ontology-integrity.mjs`](validate-ontology-integrity.mjs): The ultimate gatekeeper script. Loads the entire 3-layer architecture (Ontologies, Contexts, Schemas) and audits it for type consistency, correct cross-referencing, metadata completeness, and strict 24-language translation enforcement.

*(More scripts will be documented here as we analyze them...)*
