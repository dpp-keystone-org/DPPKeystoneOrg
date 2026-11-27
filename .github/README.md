# GitHub Actions & CI/CD (`.github/`)

This directory houses the project's continuous integration and continuous deployment (CI/CD) pipelines. These workflows are the core engine behind the project's dynamic preview environments and historical versioning capabilities on GitHub Pages.

## Workflows (`workflows/`)

The deployment process is split into four primary GitHub Actions workflows to support active development, production releases, historical versioning, and the stateless HTTP API:

*   **`publish.yml`**: The standard production deployment pipeline. It triggers on pushes to the `main` branch, building and deploying the latest `dist/` artifacts to the root of the live GitHub Pages site.
*   **`deploy-api.yml`**: Builds, tests, containerizes, and deploys the stateless Node.js API (`api/`) to Google Cloud Run (`dpp-keystone-prod`) on pushes to `main` affecting API/specification files (or via manual `workflow_dispatch`). See [`api/README.md`](../api/README.md) for full details.
*   **`preview.yml`**: The development preview pipeline. 
    *   **Trigger:** Pushes to any branch EXCEPT `main`, `gh-pages`, or branches starting with `legacy/`.
    *   **Behavior:** It builds the project and deploys it to a dedicated, isolated subdirectory: `/preview/<branch-name>/`. This allows developers and reviewers to navigate a live, working version of the site and ontology for that specific pull request without affecting production.
    *   **Cleanup:** When a pull request is closed, this workflow automatically deletes the associated preview folder from the `gh-pages` branch.
*   **`legacy-publish.yml`**: The historical versioning pipeline. 
    *   **Trigger:** Pushes to any branch whose name starts with `legacy/` (e.g., `legacy/v1`).
    *   **Behavior:** It builds the project, strips out all UI tools and HTML to keep *only* the `spec/` directory (the raw data files), and deploys it. Because the `spec/` folder naturally contains the version number in its path (e.g., `spec/ontology/v1`), deploying this preserves the older standards at their original URIs without duplicating the frontend tools.
