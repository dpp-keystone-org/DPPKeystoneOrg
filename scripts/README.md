# Scripts Directory

This directory contains all the automation, build, validation, and maintenance scripts for the DPP Keystone project.

## General Workflow

> **CRITICAL WORKFLOW RULE:** Between any file changes, the only command you need to run to update the build targets is `npm run build` (which invokes `build-and-clean.mjs`). This is automatically run when executing `npm test` to ensure tests always run against the latest code.

Detailed documentation for each script is located directly within the scripts themselves as header comments. Use the following index to determine which script is relevant to your current task, and then read the script file for implementation details.

### Build and Deployment
*   [`build-and-clean.mjs`](build-and-clean.mjs): The primary build orchestrator. Cleans targets, lints JSON, strips comments, and generates the `dist/` folder.
*   [`clean.mjs`](clean.mjs): Utility to remove the `dist/` directory.
*   [`bundle-vendor.mjs`](bundle-vendor.mjs): Bundles Node dependencies (AJV, PapaParse) into browser-compatible ESM modules inside `src/lib/vendor/`.

*(More scripts will be documented here as we analyze them...)*
