# Design Doc: 2026-11-24 EC Battery Validation & Adaptation API

## Summary

Repurposes the fledgling DPP Keystone API (`api.dpp-keystone.org`) to address GitHub Issues **#55** and **#56**:
1. **Issue #55 (API):**
   - Validate DPP payloads against both the **patched** EC Battery bundle (`ec-bundle/`) and the **unpatched/raw** official EC Battery bundle (`ec-bundle-latest/`).
   - Adapt Keystone Battery DPP payloads (supporting v3 and older Keystone versions where feasible) into either the patched or raw EC Battery format via a parameterized flag.
2. **Issue #56 (Main Page):**
   - Inform the public on `index.html` about Keystone's EC Battery adaptation work, linking to the patched resource code, the original EC resources, and API usage instructions, noting that patched and original will converge once EC fixes the reported bugs.

## Key Architectural Decisions

* **Adaptation Scope Boundary:**
  * Adapt **Keystone Battery DPP → EC Battery DPP only** (not EC-to-EC).
  * Do **not** maintain historical EC release versions; always target the patched bundle (`ec-bundle/`) and the latest official unpatched EC release (`ec-bundle-latest/`). When the EC releases updates, we update `ec-bundle-latest/` and update the API/adapter accordingly.
* **Reuse Existing Project Foundations:**
  * **Validation:** Reuse and factor the layered Ajv2020 + JSON-LD 1.1 + SHACL Core engine already implemented in `src/examples/openapi/serve-validation-api.mjs` (and verified by `ec-bundle/verify-semantic-integrity.mjs`).
  * **Adaptation:** Reuse and extend the existing `ec-battery` transformation profile in `src/util/js/common/transformation/profiles/ec-battery.js` (invoked via `src/util/js/server/dpp-schema-adapter.js`) rather than rewriting field mappings from scratch.
* **Parameterized Endpoints:**
  * `POST /validate` — accepts `{ dpp, options: { target: "patched" | "raw", mode: "strict" | "schema" | "shacl", requiredSpecs?: string[] } }` (defaults: `target: "patched"`, `mode: "strict"`).
  * `POST /adapt` — accepts `{ dpp, options: { target: "patched" | "raw", subgroup?: "evb" | "ind" | "lmt", tiers?: string[], validate?: boolean, mode?: "strict" | "schema" | "shacl" } }` (defaults: `target: "patched"`, `validate: false`).
  * Keep existing `GET /health`, `GET /version`, and `POST /render/html` intact (do not invest in fixing older-version HTML rendering).
* **Validation Modes (`mode`):**
  * `"schema"`: JSON Schema Draft 2020-12 validation only (strict Ajv for `patched`; non-strict Ajv for `raw` to tolerate EC v1.0.0's non-standard keywords).
  * `"shacl"`: JSON-LD 1.1 expansion + SHACL Core validation (with best-effort/documented workarounds for `raw` where EC's `@base` / chained `@import` / SPARQL shapes fail standard processors).
  * `"strict"` *(default)*: Runs both `"schema"` and `"shacl"` and returns combined findings.
* **Local Bundle Storage & Drift Detection:**
  * `ec-bundle/` remains the in-place patched EC v1.0.0 bundle.
  * `ec-bundle-latest/` stores the official unpatched EC release locally so the API container stays 100% offline/stateless.
  * Integration tests verify `ec-bundle-latest/` compatibility so that whenever `ec-bundle-latest/` is updated to a newer EC release, tests immediately fail if the API or adapter needs corresponding updates.

---

## Implementation Plan

> **Note:** Per `designs/README.md`, we will pause at each Step to agree on ultra-detailed sub-tasks before implementing.

### [ ] Feature 1: Vendor Unpatched EC Bundle (`ec-bundle-latest/`) & Container Readiness
* **Goal:** Make both `ec-bundle/` (patched) and `ec-bundle-latest/` (raw official EC) available offline in the repo and Docker container, with all required runtime dependencies.
  * **[ ] Step 1.1: Populate `ec-bundle-latest/`**
    * *(To be broken down with user before executing: restore original unpatched EC v1.0.0 files from git history or official archive into `ec-bundle-latest/`, add `ec-bundle-latest/README.md` noting source version and update procedure.)*
  * **[ ] Step 1.2: Runtime Dependencies, Docker & CI/CD**
    * *(To be broken down: ensure SHACL/RDF runtime deps are in root `package.json` `dependencies` for `npm install --omit=dev`; update `Dockerfile`, `.dockerignore`, and `.github/workflows/deploy-api.yml` to bundle `ec-bundle/` and `ec-bundle-latest/`.)*

### [ ] Feature 2: EC Battery Validation Service & `POST /validate` Endpoint (Issue #55)
* **Goal:** Validate any DPP payload against either `ec-bundle/` (`target: "patched"`) or `ec-bundle-latest/` (`target: "raw"`) using `mode: "schema" | "shacl" | "strict"`.
  * **[ ] Step 2.1: Implement EC Validator Service (`api/src/lib/ec-validator-service.js`)**
    * *(To be broken down: lazy/cached loading of patched & raw schemas, contexts, and SHACL shapes; strict vs. non-strict Ajv2020 setup; JSON-LD 1.1 + SHACL execution; unified structured error reporting.)*
  * **[ ] Step 2.2: Wire `POST /validate` (and optional `GET /specifications`) in `api/src/server.js`**
    * *(To be broken down: request validation, option parsing, HTTP status codes `200`/`400`/`405`/`422`, response envelope.)*
  * **[ ] Step 2.3: Unit, Integration & `ec-bundle-latest/` Drift-Detection Tests**
    * *(To be broken down: test `patched` vs. `raw` across `schema`, `shacl`, and `strict` modes; test conformance fixtures + negative mutations; add drift-detection assertions verifying every schema/context/shape in `ec-bundle-latest/` is loaded and handled cleanly.)*

### [ ] Feature 3: Keystone → EC Battery Adapter Service & `POST /adapt` Endpoint (Issue #55)
* **Goal:** Transform Keystone Battery DPPs (v3 and older Keystone versions where feasible) into EC Battery DPP payloads targeting either `patched` or `raw` EC schemas.
  * **[ ] Step 3.1: Design & Implement Keystone → EC Battery Adapter**
    * *(To be broken down: complete field-by-field mapping table between Keystone `battery-ev`/`battery-lmv`/`battery-industrial` + older generic `battery` schemas and EC `core` + `pub/res1/res2/res3-batteries` + `evb/ind/lmt` subgroups; handle unit wrappers `{ value, unit }` & full-URI enums for `raw` vs. scalarized values & short codes for `patched`; return `{ adapted, warnings, unmappedFields }`.)*
  * **[ ] Step 3.2: Wire `POST /adapt` in `api/src/server.js`**
    * *(To be broken down: request contract, optional post-adaptation validation using `ec-validator-service.js`, response envelope.)*
  * **[ ] Step 3.3: Adapter Unit & Integration Tests**
    * *(To be broken down: test adapting `battery-dpp-v1.json`, `battery-lmv-dpp-v1.json`, `battery-industrial-dpp-v1.json`, and legacy Keystone v1/v2 payloads to both `patched` and `raw`, asserting adapted outputs validate against their respective target bundles.)*

### [ ] Feature 4: Public Information on Keystone Main Page (Issue #56)
* **Goal:** Inform visitors on `index.html` about Keystone's EC Battery adaptation work, API instructions, and links to both patched and original EC resources.
  * **[ ] Step 4.1: Update `index.html` & `index.i18n.json` (English)**
    * *(To be broken down: add dedicated section/card with link to patched `ec-bundle/` code on GitHub, link to original EC repository, concise API usage instructions with `curl` examples, and convergence note.)*
  * **[ ] Step 4.2: 24-Language Machine-Consensus Translation**
    * *(To be broken down: follow `docs/translation-workflow.md` with worker + auditor consensus loop for all new i18n keys.)*
  * **[ ] Step 4.3: End-to-End Verification**
    * *(To be broken down: ask user to run `npm test`, `npm run test:api`, and `node ec-bundle/verify-semantic-integrity.mjs`.)*
