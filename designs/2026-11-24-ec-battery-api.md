# Design Doc: 2026-11-24 EC Battery Validation & Adaptation API

## Summary

Repurposes the fledgling DPP Keystone API (`api.dpp-keystone.org`) to address GitHub Issues **#55** and **#56**:
1. **Issue #55 (API):**
   - Validate DPP payloads against both the **patched** EC Battery bundle (`ec-bundle/`) and the **unpatched/raw** official EC Battery bundle (`ec-bundle-raw/`).
   - Adapt Keystone Battery DPP payloads (v3 and older Keystone versions where feasible) into either the patched or raw EC Battery format via a parameterized flag.
2. **Issue #56 (Main Page):**
   - Inform the public on `index.html` about Keystone's EC Battery adaptation work, linking to the patched resource code, the original EC resources, and API usage instructions, noting that patched and original will converge once EC fixes the reported bugs.

## Key Architectural Decisions

* **Adaptation Scope Boundary:**
  * Adapt **Keystone Battery DPP → EC Battery DPP only** (not EC-to-EC).
  * Do **not** maintain historical EC release versions; always target the patched bundle (`ec-bundle/`) and the latest official unpatched EC release (`ec-bundle-raw/`). When the EC releases updates, we update `ec-bundle-raw/` and update the API/adapter accordingly.
* **Reuse Existing Project Foundations:**
  * **Validation:** Reuse and factor the layered Ajv2020 + JSON-LD 1.1 + SHACL Core engine from `src/examples/openapi/serve-validation-api.mjs` (and verified by `ec-bundle/verify-semantic-integrity.mjs`).
  * **Adaptation:** Reuse and extend the existing `ec-battery` transformation profile in `src/util/js/common/transformation/profiles/ec-battery.js` (invoked via `src/util/js/common/transformation/dpp-schema-logic.js`).
* **Parameterized Endpoints:**
  * `GET /specifications` (`?target=patched|raw`) — returns loaded schema/shape/context counts and recognized specifications.
  * `POST /validate` (alias `POST /v1/validate`) — accepts `{ dpp, options: { target: "patched" | "raw", mode: "strict" | "schema" | "shacl", requiredSpecs?: string[], subgroup?: "evb" | "ind" | "lmt", tiers?: string[] } }` or raw DPP JSON + query parameters.
  * `POST /adapt` (alias `POST /v1/adapt`) — accepts `{ dpp, options: { target: "patched" | "raw", subgroup?: "evb" | "ind" | "lmt", sourceVersion?: string, validate?: boolean, mode?: "strict" | "schema" | "shacl" } }` or raw DPP JSON + query parameters.
  * Keep existing `GET /health`, `GET /version`, and `POST /render/html` intact.
* **Validation Modes (`mode`):**
  * `"schema"`: JSON Schema Draft 2020-12 validation only (strict Ajv for `patched`; non-strict Ajv for `raw`).
  * `"shacl"`: JSON-LD 1.1 expansion + SHACL Core validation (with transparent in-memory context flattening & warnings for `raw` EC v1.0.0 spec bugs).
  * `"strict"` *(default)*: Runs both `"schema"` and `"shacl"` and returns combined findings.

---

## Implementation Plan

### [COMPLETED] Feature 1: Vendor Unpatched EC Bundle (`ec-bundle-raw/`) & Container Readiness
* **[COMPLETED] Step 1.1: Populate `ec-bundle-raw/`**
  * User copied official unmodified EC v1.0.0 bundle into `ec-bundle-raw/` (`ec-semantics/` + `ec-openapi/`).
  * Created `ec-bundle-raw/README.md` documenting source version and update procedure.
* **[COMPLETED] Step 1.2: Runtime Dependencies, Docker & CI/CD**
  * Promoted `@rdfjs/*`, `clownface`, and `rdf-validate-shacl` to root `package.json` `dependencies`.
  * Updated `Dockerfile` to `COPY ec-bundle ./ec-bundle` and `COPY ec-bundle-raw ./ec-bundle-raw`.
  * Updated `.github/workflows/deploy-api.yml` trigger paths to include `ec-bundle/**` and `ec-bundle-raw/**`.

### [COMPLETED] Feature 2: EC Battery Validation Service & `POST /validate` Endpoint (Issue #55)
* **[COMPLETED] Step 2.1: Implement EC Validator Service (`api/src/lib/ec-validator-service.js`)**
  * Implemented cached patched (`ec-bundle/semantics/`) and raw (`ec-bundle-raw/ec-semantics/`) validation engines supporting `mode: "strict" | "schema" | "shacl"` and `getEcEngineMetadata(target)`.
* **[COMPLETED] Step 2.2: Wire `GET /specifications` and `POST /validate` in `api/src/server.js`**
  * Added route handlers supporting both wrapped `{ dpp, options }` and raw JSON + query params.
* **[COMPLETED] Step 2.3: Unit, Integration & `ec-bundle-raw/` Drift-Detection Tests**
  * Added `testing/integration/api/api-ec-validate.test.js` covering patched/raw validation, all 3 modes, negative mutations, and bundle drift detection.

### [COMPLETED] Feature 3: Keystone → EC Battery Adapter Service & `POST /adapt` Endpoint (Issue #55)
* **[COMPLETED] Step 3.1: Implement Keystone → EC Battery Adapter (`api/src/lib/ec-battery-adapter-service.js`)**
  * Reused `ec-battery.js` profile for `target: "patched"` (with graceful version detection/fallback for older Keystone versions).
  * Implemented `convertPatchedEcToRawEc()` for `target: "raw"` (unit wrappers, full-URI enums, `xx-YY` locale keys, `valueRange` wrapping, `mailto:`, single `RelatedResource`, array cycle counters, `selfDischargingRateSet`, and dropped-field warnings).
* **[COMPLETED] Step 3.2: Wire `POST /adapt` in `api/src/server.js`**
  * Added `POST /adapt` (and `POST /v1/adapt`) with optional post-adaptation validation (`validate: true`).
* **[COMPLETED] Step 3.3: Adapter Integration Tests**
  * Added `testing/integration/api/api-ec-adapt.test.js` adapting all 3 Keystone battery examples (`battery-ev`, `battery-lmv`, `battery-industrial`) plus legacy Keystone `v1` to both `patched` and `raw` and validating each output against its target bundle.

### [COMPLETED] Feature 4: Public Information on Keystone Main Page (Issue #56)
* **[COMPLETED] Step 4.1: Update `index.html` & `index.i18n.json` (English)**
  * Added `#ec-battery-adaptation` section to `index.html` with links to patched `ec-bundle` code, original EC resources (`https://single-market-economy.ec.europa.eu/single-market/digital-product-passport/resources-documentation_en`), convergence note, and `curl` examples for `/validate` and `/adapt`.
* **[COMPLETED] Step 4.2: 24-Language Machine-Consensus Translation**
  * Translated all 9 new keys in `index.i18n.json` across all 24 EU languages via Translation Worker + Auditor consensus loops (`PERFECT`), including the revised `ec-battery-convergence-note` wording.
* **[COMPLETED] Step 4.3: End-to-End Verification**
  * Updated `package-lock.json`, fixed preview-branch `@context` normalization in `api/src/lib/server-resource-loader.js`, and verified `npm run test:api` and `npm test`.

### [COMPLETED] Feature 5: Voluntary Attribute Preservation & Cloud Run Memory Tuning
* **[COMPLETED] Step 5.1: TDD Tests Across All 3 Adapter Utilities**
  * Added voluntary/untransformed attribute preservation tests in `testing/integration/api/api-ec-adapt.test.js`, `testing/integration/validator-flow.test.js` (with order-independent `beforeEach` reset), and `testing/integration/wizard-flow.test.js`.
* **[COMPLETED] Step 5.2: Preserve Extra `@context` & Untransformed Voluntary Attributes**
  * Updated `src/util/js/common/transformation/dpp-schema-logic.js` and `src/util/js/common/transformation/profiles/ec-battery.js` to forward `rawDpp` and preserve extra `@context` entries and untransformed top-level fields.
* **[COMPLETED] Step 5.3: Memory Profiling & Cloud Run Sizing**
  * Added `scripts/measure-api-memory.mjs`, cached raw `SHACLValidator` per `(subgroup, tiers)` in `api/src/lib/ec-validator-service.js` (cutting peak RSS from 558.7 MiB to 321.0 MiB with flat heap), and updated `.github/workflows/deploy-api.yml` (`--memory 512Mi`, `--concurrency 20`, `NODE_OPTIONS=--max-old-space-size=384`).

### [IN PROGRESS] Feature 6: Formal OpenAPI 3.1 Spec, API Docs Sub-Page, & Live Cloud Run URL
* **Goal:** Provide formal, machine-readable OpenAPI 3.1 documentation and an interactive API docs sub-page (`api/`) using the live Cloud Run sandbox URL (`https://dpp-keystone-api-naamukjlba-ew.a.run.app`), and simplify `index.html` `curl` examples to read DPP files via `--data-binary @<file>`.
* **[COMPLETED] Step 6.1: Update `index.html` `curl` Examples & Live URL**
  * Updated `index.html` to use `https://dpp-keystone-api-naamukjlba-ew.a.run.app`, query params + `--data-binary @path/to/...json` as the last argument, and added a link to `api/` (`ec-battery-link-api-docs`, translated to 24 languages with Auditor Pass 1 `PERFECT`).
* **[COMPLETED] Step 6.2: Author OpenAPI 3.1 Contract (`src/api/openapi.yml`) & Serve at `GET /openapi.yml`**
  * Authored `src/api/openapi.yml` documenting `/adapt`, `/validate`, `/specifications`, `/render/html`, `/health`, `/version`, and `/openapi.yml` with request headers, query params, request/response schemas, status codes (`200`, `400`, `405`, `413`, `422`), and examples.
  * Wired `GET /openapi.yml` in `api/src/server.js`.
* **[COMPLETED] Step 6.3: Create Interactive API Documentation Sub-Page (`src/api/index.html`)**
  * Created Keystone-branded `src/api/index.html` rendering `./openapi.yml` with Swagger UI (`swagger-ui-dist@5`), download/live spec links, and file-based `curl` quick-start.
  * Updated `scripts/build-and-clean.mjs` to copy `src/api/` → `dist/api/`.
* **[ ] Step 6.4: Tests & Verification**
  * Added `GET /openapi.yml` integration test in `testing/integration/api/api-ec-validate.test.js`.
  * User to run `npm test`, verify `dist/api/index.html` in the preview, and rename this design doc with `-COMPLETED`.
