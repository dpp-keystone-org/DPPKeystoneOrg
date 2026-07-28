# Scripts Directory

This directory contains all the automation, build, validation, and maintenance scripts for the DPP Keystone project.

## General Workflow

> **CRITICAL WORKFLOW RULE:** Between any file changes, the only command you need to run to update the build targets is `npm run build` (which invokes `build-and-clean.mjs`). This is automatically run when executing `npm test` to ensure tests always run against the latest code.

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

*(More scripts will be documented here as we analyze them...)*
