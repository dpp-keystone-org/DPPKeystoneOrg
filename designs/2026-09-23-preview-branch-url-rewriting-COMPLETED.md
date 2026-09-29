# Design Document: Build-Time Preview Chunk Rewriting for Branch Deployments

## Summary
When building branch preview deployments on GitHub Actions (via `.github/workflows/preview.yml`), artifacts in `dist/` are published to `https://dpp-keystone.org/preview/${PREVIEW_BRANCH}/`. 

Currently, all generated schema, context, and ontology files contain hardcoded production URLs (`https://dpp-keystone.org/spec/...`). When a preview branch introduces new versions or modules (like `v3`) that do not yet exist on `main`, external consumers and tools cannot follow internal links or `@context` imports, causing HTTP 404s.

This design cleanly separates versioning from preview deployments:
1. **Versioning (`{{VERSION}}`)**: Left completely untouched; continues expanding to `KEYSTONE_VERSION` (`v3`).
2. **Preview Routing (`PREVIEW_CHUNK`)**: An optional prefix (`/preview/${PREVIEW_BRANCH}`) injected immediately before `/spec/` during the build process for generated contexts, ontologies, schemas, and examples.

---

## Architecture: Decoupled URL Model

### URL Model
In source files, all definitions continue to use the canonical template:
```
https://dpp-keystone.org/spec/...{{VERSION}}...
```

At site-build time (`scripts/build-and-clean.mjs`):
- `PREVIEW_CHUNK` is computed as:
  ```javascript
  const PREVIEW_CHUNK = process.env.PREVIEW_BRANCH ? `/preview/${process.env.PREVIEW_BRANCH}` : '';
  ```
- Replacements applied to all generated files:
  1. `https://dpp-keystone.org/spec/` &rarr; `https://dpp-keystone.org${PREVIEW_CHUNK}/spec/`
  2. `{{VERSION}}` &rarr; `KEYSTONE_VERSION`

### Environment Mapping

| Environment | `PREVIEW_BRANCH` | Resulting Base URL | Example Context URI |
| :--- | :--- | :--- | :--- |
| **Production (`main`)** | *unset* | `https://dpp-keystone.org/spec/` | `https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld` |
| **Preview (`feature/version3`)** | `feature/version3` | `https://dpp-keystone.org/preview/feature/version3/spec/` | `https://dpp-keystone.org/preview/feature/version3/spec/contexts/v3/dpp-core.context.jsonld` |

---

## Implementation Plan

### Phase 1: Build Orchestrator Update (`scripts/build-and-clean.mjs`)
*   [x] **Step 1.1: Add `PREVIEW_CHUNK` URL Rewriting Helper**
    *   In `scripts/build-and-clean.mjs`, define `PREVIEW_CHUNK` and a helper to transform file content.
*   [x] **Step 1.2: Apply `PREVIEW_CHUNK` to JSON and JSON-LD Files**
    *   Update `cleanAndCopyJsonFile` to apply the `https://dpp-keystone.org/spec/` &rarr; `https://dpp-keystone.org${PREVIEW_CHUNK}/spec/` rewrite.
*   [x] **Step 1.3: Preserve Canonical Spec URLs in JavaScript Application Code**
    *   In `processDirectory`, preserve canonical spec URLs in copied `.js` and `.mjs` files in `dist/` (only expanding `{{VERSION}}` to `KEYSTONE_VERSION`) so DPP generators and transformation libraries remain standard-compliant and stable across environments without modifying test assertions.
*   [x] **Step 1.4: Update Client-Side Redirects**
    *   Ensure `createRedirects` in `scripts/build-and-clean.mjs` consistently aligns with `PREVIEW_CHUNK`.
*   [x] **Step 1.5: Automatic Git Branch Detection (`scripts/branch-helper.mjs`)**
    *   Auto-detect active git branch if `PREVIEW_BRANCH` is undefined (ignoring `main`, `master`, `gh-pages`, `legacy/*`, `HEAD`).
    *   Support explicit override via `PREVIEW_BRANCH` (passing `PREVIEW_BRANCH=""` forces canonical production mode).

### Phase 2: Audit & Adapt Validation, Testing & UI Tools
*   [x] **Step 2.1: Adapt `testing/scripts/test-helpers.mjs`**
    *   Allow `CONTEXT_URL_TO_LOCAL_PATH_MAP` / document loader to resolve URLs regardless of whether they have a `/preview/<branch>/` prefix.
*   [x] **Step 2.2: Adapt `scripts/validate-ontology-integrity.mjs`**
    *   Ensure IRI and `owl:imports` audit checks tolerate the optional `PREVIEW_CHUNK` (supporting branch names with slashes like `feature/version3`).
*   [x] **Step 2.3: Adapt UI Context Interceptors**
    *   Update `src/validator/validator.js` and `src/lib/ontology-loader.js` regex to strip optional `/preview/<branch>` when mapping to local relative paths.
*   [x] **Step 2.4: Adapt SHACL Generators & Fuzzing**
    *   Update `scripts/generate-shacl.mjs` and `testing/scripts/shacl-fuzzer.mjs` to keep `dppk` vocabulary term IRIs canonical while using `PREVIEW_CHUNK` for generated shapes document IDs.
*   [x] **Step 2.5: Centralize URL & Path Helpers in `src/lib/keystone-version.js`**
    *   Unified all URL regexes and transformations into reusable functions (`isSpecUrl`, `normalizeSpecUrl`, `specUrlToRelativePath`, `specUrlToPreviewUrl`, `rewriteSpecFileUrls`).
    *   Strictly distinguished between physical file URLs (`spec/(contexts|ontology|validation|examples)/`) which require `PREVIEW_CHUNK` for preview deployments, and semantic vocabulary concept IRIs (`spec/v3/terms#...`) which must remain canonical.
    *   Added dedicated test suite in `testing/unit/lib/keystone-version.test.js`.

### Phase 3: Verification
*   [x] **Step 3.1: Verify Standard Production Build & Tests**
    *   Run `npm run build` and `npm test` with `PREVIEW_BRANCH=""`.
    *   Verify all generated files in `dist/` have canonical `https://dpp-keystone.org/spec/...` URLs.
*   [x] **Step 3.2: Verify Simulated Preview Build & Tests**
    *   Run `npm test` on feature branch (or with explicit `PREVIEW_BRANCH`).
    *   Verify all tests pass and that generated files in `dist/` have self-contained `https://dpp-keystone.org/preview/<branch>/spec/...` URLs.
