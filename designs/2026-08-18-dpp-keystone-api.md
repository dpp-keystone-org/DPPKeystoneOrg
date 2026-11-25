# Design Document: DPP Keystone Stateless API (`api.dpp-keystone.org`)

## Summary

This design introduces a stateless, zero-external-framework Node.js API service for DPP Keystone hosted at `api.dpp-keystone.org` on Google Cloud Run. 

The API enables external platforms, discovery tools (e.g. Disco), and supply chain stakeholders to use Keystone's core capabilities "as-a-service"—specifically HTML product page rendering ("Preview as a service"), structural & semantic validation, and Schema.org JSON-LD transformation—without needing to implement the semantic stack or parse the raw ontologies themselves.

---

## Goals & Non-Goals

### Goals
1. **HTML Rendering Service**: Provide `POST /v1/render/html` to transform valid DPP JSON payloads into fully formatted, localized HTML product pages (with optional embedded Schema.org JSON-LD and custom CSS).
## Goals & Non-Goals

### Goals
1. **HTML Rendering Service with Validation Gate**: Provide `POST /v1/render/html` to accept a DPP JSON payload, perform strict structural & semantic validation, and:
   - If valid: Return a formatted, localized HTML product page (with optional embedded Schema.org JSON-LD and custom CSS) with `200 OK`.
   - If invalid: Return a structured validation error report with `422 Unprocessable Content`.
2. **Code Reuse & Factorization**: Factor the core business logic in `src/util/` so that the identical parsing, validation, and rendering code runs in both the static browser environment (`src/validator`, `src/wizard`) and the Node.js API server.
3. **Zero External Framework Dependencies**: Use Node.js native `node:http` to ensure zero dependency drift, no framework CVEs/Dependabot alerts, minimal memory footprint (~20MB), and instant cold starts (<150ms).
4. **Local Test Facility**: Provide complete unit and integration test suites in `testing/` that spin up and test the API endpoints locally without requiring active cloud infrastructure.
5. **Automated CI/CD Deployment**: Configure a GitHub Actions workflow that runs all tests, builds the container image, and deploys to Google Cloud Run (`dpp-keystone-prod`) with strict cost safeguards.

### Non-Goals (Deferred to Future Iterations)
- **Standalone `/v1/validate` and `/v1/transform` Endpoints**: Deferred to future iterations; the current focus is delivering the HTML rendering endpoint with integrated validation.
- **Data Persistence**: The API will remain 100% stateless. No database or user storage is required or included.
- **Modifying Static Site**: The existing GitHub Pages hosting for `dpp-keystone.org` remains completely unchanged.
- **External Network Dependency for Ontologies**: The API container bundles schemas, ontologies, and contexts in-memory to prevent hammering GitHub Pages or introducing external network latency during requests.

---

## Architecture Overview

```
                          +-------------------------------+
                          |  External Client / Integrator |
                          +---------------+---------------+
                                          |
                                          | HTTPS POST /v1/render/html
                                          v
                   +-----------------------------------------------+
                   |       api.dpp-keystone.org (Cloud Run)        |
                   |                                               |
                   |  +-----------------------------------------+  |
                   |  |      Native Node.js Server (node:http)  |  |
                   |  |   - CORS handling                       |  |
                   |  |   - Body parsing (1MB limit)            |  |
                   |  |   - Router & HTTP Error Envelopes       |  |
                   |  +--------------------+--------------------+  |
                   |                       |                       |
                   |                       v                       |
                   |  +-----------------------------------------+  |
                   |  |         Validation Gate Layer           |  |
                   |  |   1. JSON Schema (Ajv2020)              |  |
                   |  |   2. Ontology / Semantic Constraints    |  |
                   |  +--------------------+--------------------+  |
                   |           |                        |          |
                   |   (Invalid: 422)            (Valid: 200)      |
                   |           v                        v          |
                   |  +----------------+        +---------------+  |
                   |  | Error Report   |        | HTML Renderer |  |
                   |  | (JSON)         |        | (HTML / JSON) |  |
                   |  +----------------+        +---------------+  |
                   |                                    |          |
                   |                                    v          |
                   |  +-----------------------------------------+  |
                   |  |      In-Memory Bundled Spec Cache       |  |
                   |  |   - Preloaded JSON Schemas              |  |
                   |  |   - Preloaded Ontologies & Contexts     |  |
                   |  |   - Embedded default CSS stylesheet     |  |
                   |  +-----------------------------------------+  |
                   +-----------------------------------------------+
```

---

## Detailed Endpoint Specifications

### 1. `POST /render/html` & `POST /{version}/render/html`
- **Description**: Validates a DPP JSON payload and generates a complete HTML product page if valid.
  - `/render/html` (Canonical): Uses the latest active Keystone specification release (e.g. `v3`).
  - `/{version}/render/html` (e.g. `/v3/render/html`, `/v2/render/html`): Pinned to a specific specification release.
- **Request Headers**:
  - `Content-Type: application/json`
- **Request Body**:
  ```json
  {
    "dpp": { ... },
    "options": {
      "includeSchema": true,
      "language": "en",
      "customCssUrl": "https://example.com/styles.css"
    }
  }
  ```

#### HTTP Status Codes & Responses:

1. **`200 OK` — Validation Passed, HTML Rendered**
   - `Content-Type: text/html; charset=utf-8`
   - Body: Complete standalone HTML document (`<!DOCTYPE html>...`).
   - If `options.includeSchema` is `true` (default), the `<script type="application/ld+json">` Schema.org representation is embedded inside the `<head>` of the HTML.
   - If `options.includeSchema` is `false`, the HTML document is rendered cleanly without embedded Schema.org JSON-LD.

2. **`422 Unprocessable Content` — Schema or Ontology Validation Failed**
   - `Content-Type: application/json; charset=utf-8`
   - Body:
     ```json
     {
       "error": "DPP validation failed",
       "code": "VALIDATION_FAILED",
       "errors": [
         {
           "instancePath": "/batteryCapacity",
           "schemaPath": "#/properties/batteryCapacity/type",
           "keyword": "type",
           "message": "Must be a valid number"
         }
       ]
     }
     ```

3. **`400 Bad Request` — Malformed Request / Syntax Error**
   - `Content-Type: application/json; charset=utf-8`
   - Triggered when:
     - Request body is not valid JSON.
     - Root object does not contain a `"dpp"` object.
     - Payload exceeds body size limit (1MB).
   - Body:
     ```json
     {
       "error": "Invalid request: Missing 'dpp' payload object.",
       "code": "INVALID_REQUEST"
     }
     ```

4. **`405 Method Not Allowed`**
   - Triggered when requesting `GET`, `PUT`, `DELETE` on `/v1/render/html`.
   - `Allow: POST, OPTIONS`

---

### 2. `GET /health` & `GET /v1/version`
- **Description**: Lightweight health and version probe for Cloud Run and monitoring.
- **Response (`200 OK`)**:
  ```json
  {
    "status": "ok",
    "version": "v3",
    "uptime": 123.45,
    "timestamp": "2026-08-18T12:00:00Z"
  }
  ```

---

## Implementation Plan

### Phase 1: Server Service Layer & Resource Providers (`api/src/lib/`)
*   [x] **Step 1.1: Standardize In-Memory Resource Provider**
    *   Create `api/src/lib/server-resource-loader.js` capable of loading schemas, ontologies, and CSS from local disk/memory in Node.js without calling `window.fetch`.
*   [x] **Step 1.2: Unify Validator Service Logic**
    *   Create `api/src/lib/dpp-validator-service.js` orchestrating structural schema (`validateDpp`) and semantic ontology (`validateAgainstOntology` / `validateContextAwarePayload`) validation into a clean, single-call function.
*   [x] **Step 1.3: Unify HTML Generator for Server**
    *   Create `api/src/lib/html-generator-server.js` using bundled CSS and ontology map without browser `window.fetch`.

### Phase 2: Native Node.js Server Implementation (`api/`)
*   [x] **Step 2.1: Initialize `api/` Directory Structure**
    *   Create `api/` directory at project root with `api/package.json` (`"type": "module"`).
*   [x] **Step 2.2: Implement Native HTTP Request Dispatcher**
    *   Create `api/src/server.js` using `node:http` with CORS, 1MB body limit, and HTTP error envelopes (`400`, `404`, `405`, `422`, `500`).
*   [x] **Step 2.3: Implement Route Handlers**
    *   Implement `GET /health` and `GET /v1/version`.
    *   Implement `POST /v1/render/html` with integrated validation gate handling both `text/html` and `application/json` accept headers.

### Phase 3: Test Facility (Local Automated Testing)
*   [x] **Step 3.1: Server Lifecycle Test Helper**
    *   Create test helper in `testing/scripts/api-test-helper.mjs` to programmatically start and stop the native API server on an ephemeral port during test runs.
*   [x] **Step 3.2: API Unit & Integration Tests**
    *   Create `testing/unit/api/dpp-validator-orchestrator.test.js`: Verify schema & ontology constraint checks for valid/invalid/malformed payloads.
    *   Create `testing/unit/api/api-html-generator.test.js`: Verify server-side HTML generation, Schema.org embedding, and language localization.
    *   Create `testing/integration/api/api-health.test.js`: Verify health endpoint, CORS headers, 404/405 routing, and 1MB payload limits.
    *   Create `testing/integration/api/api-render.test.js`: 
        *   Test valid rendering with standard DPP examples (`200 OK`).
        *   Test content negotiation (`Accept: text/html` vs `Accept: application/json`).
        *   Test invalid payload validation failure (`422 Unprocessable Content` with error list).
        *   Test malformed JSON / missing `dpp` key (`400 Bad Request`).
        *   Test multi-language support (e.g. `de`, `fr`) and custom CSS URLs.
*   [ ] **Step 3.3: Root `package.json` Test Integration**
    *   Update root `package.json` test scripts so `npm test` runs both static tests and API tests cleanly.

### Phase 4: Containerization & Docker Setup
*   [x] **Step 4.1: Create `Dockerfile`**
    *   Multi-stage lightweight Node.js Alpine `Dockerfile` with build & clean spec compilation.
    *   Configured non-root user `node` for production security.
*   [x] **Step 4.2: Create `.dockerignore`**
    *   Excluded `node_modules`, `testing`, `.git`, `.github`, and dev artifacts.

### Phase 5: Google Cloud Run & GitHub Actions CI/CD Pipeline
*   [x] **Step 5.1: Create Deployment Workflow (`.github/workflows/deploy-api.yml`)**
    *   Trigger on push to `main` when paths in `api/**`, `src/**`, etc. change.
    *   Runs `npm test` before container build.
    *   Builds and pushes image to Google Artifact Registry.
    *   Deploys to Cloud Run with strict cost controls (`min-instances=0`, `max-instances=2`, `memory=256Mi`, `cpu=1`).
*   [ ] **Step 5.2: GCP Configuration & Domain Mapping Guide**
    *   Document cloud console steps for DNS domain mapping (`api.dpp-keystone.org` -> Cloud Run) and IAM Service Account permissions.

