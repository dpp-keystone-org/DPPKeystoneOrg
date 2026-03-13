# 027: Extract src/util into Standalone Package

## Objective
Extract the self-contained utilities currently residing in `src/util` (such as the HTML renderer, schema adapters, and validation logic) into a separate, publicly consumable modern npm package (e.g., `@dpp-keystone/utils`).

## Background
Currently, files under `src/util` act as pure, dependency-free modules that parse or render DPP information. The intention is for this code to be decoupled from the `keystone.org` web platform so that external developers can easily integrate DPP functionality into their own servers or client applications.

## Proposed Strategy

### 1. Repository Restructuring
- Evaluate shifting to a monorepo setup (e.g., using `npm workspaces` or `pnpm`) or creating a dedicated separate repository for the package.
- Move the contents of `src/util` into the new package directory (e.g., `packages/dpp-utils`).

### 2. Package Configuration
- Initialize a `package.json` for the new library.
- Define proper entry points (`main`, `exports`, `module`) to support both CommonJS and ES Modules.
- Set up a bundler (like `tsup`, `rollup`, or `vite`) configured to output platform-agnostic code (Node.js and Browser compatible).

### 3. Consumption Updates
- Update the Keystone.org application to install and consume the new local package instead of referencing internal relative paths (e.g., replace `import { renderProductPage } from '../util/js/common/rendering/dpp-html-renderer.js'` with `import { renderProductPage } from '@dpp-keystone/utils'`).

### 4. Testing & CI/CD
- Add isolated unit tests for the extracted utilities.
- Configure a GitHub Action pipeline to automatically publish new versions of the package to the npm registry upon release.

## Open Questions
- Should the `src/util` extraction remain as a workspace package inside the current repository, or be spun out into an entirely separate codebase?
- Will we introduce TypeScript during the extraction process for better developer experience and type safety?
