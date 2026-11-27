# DPP Keystone Stateless HTTP API (`api/`)

This directory contains the stateless, zero-framework (`node:http`) Node.js API service for DPP Keystone. It exposes Keystone's validation, semantic adaptation, and HTML rendering capabilities over HTTP without requiring callers to host or wire up the underlying JSON Schema Draft 2020-12, JSON-LD 1.1, Ontology, or SHACL Core engines themselves.

* **Live Cloud Run Service (GS1 Hosted):** `https://dpp-keystone-api-naamukjlba-ew.a.run.app`
* **Interactive OpenAPI 3.1 Docs (Swagger UI):** [`src/api/index.html`](../src/api/index.html) (published to `https://dpp-keystone.org/api/`)
* **OpenAPI 3.1 Contract:** [`src/api/openapi.yml`](../src/api/openapi.yml) (also served live at `GET /openapi.yml`)

---

## 1. Directory & Dependency Architecture

```text
api/
├── README.md
└── src/
    ├── server.js                         # Native node:http router, transport/complexity guards, CSP & error handling
    └── lib/
        ├── ec-validator-service.js       # Dual-bundle EC Battery validator (patched ec-bundle/ & raw ec-bundle-raw/)
        ├── ec-battery-adapter-service.js # Keystone -> EC Battery adapter (patched pass-through & raw stripping)
        ├── dpp-validator-service.js      # Keystone JSON Schema + Ontology/Context semantic validator wrapper
        ├── html-generator-server.js      # Server-side standalone HTML product-page generator
        └── server-resource-loader.js     # In-memory caching & offline allowlist loader for Keystone schemas/contexts
```

### Critical Rules for Contributors & AI Sessions

1. **Dependencies Live in Root `package.json`:**
   * All runtime and build dependencies (`ajv`, `ajv-formats`, `jsonld`, `@rdfjs/*`, `clownface`, `rdf-validate-shacl`, `jsonc-parser`, etc.) are declared in the **repository root [`package.json`](../package.json)** and locked in root [`package-lock.json`](../package-lock.json)—**not** in `api/package.json`.
   * Root [`.npmrc`](../.npmrc) pins `registry=https://registry.npmjs.org/` so `package-lock.json` never records corporate-internal mirror URLs that would break `npm ci` in GitHub Actions or Docker.
2. **Strict `src/util/` Isomorphic Boundary:**
   * `api/` shares core logic with the client-side browser tools (`src/validator/`, `src/wizard/`) via [`src/util/`](../src/util/README.md) (`schema-validator.js`, `ontology-validator.js`, `context-semantic-validator.js`, `dpp-html-renderer.js`, and `transformation/profiles/ec-battery.js`).
   * **Files inside `src/util/` MUST NEVER import from `api/`, `src/lib/`, or Node-only built-ins.** Whenever you modify a file under `src/util/`, run `npm run build` so `dist/util/` stays synchronized for browser/unit tests.
3. **Keep `src/api/openapi.yml` Synchronized:**
   * `GET /openapi.yml` reads directly from [`src/api/openapi.yml`](../src/api/openapi.yml), and `npm run build` copies `src/api/` to `dist/api/` (bundling Swagger UI locally via `scripts/bundle-vendor.mjs` into git-ignored `src/lib/vendor/swagger-ui/`). Update `src/api/openapi.yml` whenever routes, parameters, or status codes change.
4. **Design-Doc-Driven TDD Workflow:**
   * Follow [`designs/README.md`](../designs/README.md) for any non-trivial changes, and note that AI agents must never run shell commands directly (always ask the developer to run builds/tests in their terminal).

---

## 2. Endpoints & Dual-Bundle Semantics

### `POST /validate` (alias `POST /v1/validate`)
Validates a DPP JSON / JSON-LD payload against either the **patched** EC Battery bundle ([`ec-bundle/`](../ec-bundle/)) or the **unmodified** official EC v1.0.0 release ([`ec-bundle-raw/`](../ec-bundle-raw/)).
* **Body:** Either a raw DPP JSON object or `{ "dpp": { ... }, "options": { ... } }`.
* **Options / Query Params:**
  * `target`: `"patched"` (default) or `"raw"`.
  * `mode`: `"strict"` (default — runs both JSON Schema + JSON-LD/SHACL), `"schema"`, or `"shacl"`.
  * `subgroup`: `"evb"` | `"ind"` | `"lmt"` (auto-detected when omitted).
  * `tiers`: Comma-separated or array (`pub,res1,res2,res3`, used when `target=raw`).
  * `requireSpecificationId` / `requiredSpecs`: Policy check requiring specific `contentSpecificationIds` URIs.
* **Responses:** `200 OK` (`valid: true`), `422 Unprocessable Content` (`valid: false` with structured `findings` and `warnings`), `400`, `405`, `413`, `415`.

### `POST /adapt` (alias `POST /v1/adapt`)
Adapts a **Keystone Battery DPP** (`v3` or legacy versions) into an EC Battery DPP.
* **Options / Query Params:**
  * `target`:
    * `"patched"` (default): Preserves voluntary/untransformed attributes and extra `@context` entries so domain extensions survive round-tripping.
    * `"raw"`: Formats output for unmodified EC v1.0.0 (`xx-YY` locale tags, `{ value, unit }` wrappers, `mailto:` URIs, single `@context`) and **strips all non-EC root attributes**, recording every stripped key in `droppedFields` and `warnings`.
  * `subgroup`: `"evb"` | `"ind"` | `"lmt"` (auto-detected when omitted).
  * `sourceVersion`: Optional Keystone source version hint (`v1`, `v2`, `v3`).
  * `validate`: `true` | `false` (default `false` — when `true`, validates `adaptedDpp` and attaches `validation` to the `200` response).
  * `mode`: `"strict"` (default) | `"schema"` | `"shacl"`.

### `GET /specifications` (alias `GET /v1/specifications`)
Returns loaded schema, SHACL shape, and JSON-LD context counts plus recognized `contentSpecificationIds` for `?target=patched` (default) or `?target=raw`.

### `POST /render/html` & `POST /{version}/render/html`
Validates a Keystone DPP against the target Keystone specification version (`/render/html` uses active `KEYSTONE_VERSION`; `/v1/render/html`, `/v2/render/html`, `/v3/render/html` pin a specific version) and returns a standalone localized HTML product page.
* **Body:** `{ "dpp": { ... }, "options": { "includeSchema": true, "language": "en", "version": "v3" } }`.
* *(Note: External `customCssUrl` stylesheet injection is intentionally disabled on the HTTP API to prevent UI redressing and CSS side-channel exfiltration; it remains available only in the local client-side Validator preview UI.)*

### `GET /health`, `GET /version` (`GET /{version}/version`), `GET /openapi.yml`
Lightweight health probe, active/pinned Keystone specification version metadata, and raw YAML OpenAPI 3.1 specification.

---

## 3. Established Security & Performance Invariants

Do not weaken or bypass any of the following protections when modifying `api/` or `src/util/`:

1. **100% Offline Execution (Zero Outbound Network / SSRF & Traversal Prevention):**
   * `server-resource-loader.js` and `ec-validator-service.js` pre-index known local `.context.jsonld` files into an immutable in-memory allowlist `Map` (never resolving `..` segments via `path.join`, never dereferencing `src/ontology/` files via `@context`, and never calling live `fetch()`).
   * Unrecognized or external `@context` URLs (e.g. `https://ref.gs1.org/epcis/...`) are **never fetched over the network**; they are stubbed offline as `{ '@context': {} }` (recording an explanatory `warnings` entry during SHACL validation instead of throwing).
2. **Compiled Validator Caching & Bounded Memory:**
   * `schema-validator.js` caches compiled Ajv validators in a `WeakMap` keyed on `schemaContext` (cloning `validate.errors` per call and invalidating safely on inner schema reference changes).
   * `ec-validator-service.js` caches compiled Ajv engines and merged `SHACLValidator` instances per `(subgroup, activeTiers)` (omitting custom `factory` overrides so `rdf-validate-shacl` uses its built-in `@rdfjs/term-map` environment, with an offline no-op `importGraph`).
3. **HTTP Transport, Media-Type & Complexity Limits (`server.js` & `ec-validator-service.js`):**
   * **`415 Unsupported Media Type`:** `POST` endpoints strictly require `Content-Type: application/json` or `application/*+json` (e.g. `application/ld+json`), forcing browser CORS preflights.
   * **`413 Payload Too Large` (`PAYLOAD_TOO_LARGE`):** `1 MiB` raw byte limit checked upfront on `Content-Length` and mid-stream; oversized streams pause `req`, send `Connection: close`, and destroy `req.socket` after flushing. Multi-byte UTF-8 chunks are reassembled via `Buffer.concat`.
   * **`413 Content Too Large` (`PAYLOAD_TOO_COMPLEX`):** Iterative (non-recursive) post-parse guard enforcing `MAX_JSON_DEPTH = 32` and `MAX_JSON_ENTRIES = 15,000`, plus `MAX_NQUADS_CHARS = 2 MiB` and `MAX_RDF_QUADS = 20,000` prior to SHACL validation (`src/util/` walkers also enforce `MAX_TRAVERSAL_DEPTH = 64` defense-in-depth).
   * **Slowloris Timeouts:** `keepAliveTimeout = 5_000`, `headersTimeout = 10_000`, `requestTimeout = 15_000`.
4. **Prototype-Key Sanitization & Strict HTML CSP:**
   * `readJsonBody()` strips own `"__proto__"`, `"constructor"`, and `"prototype"` keys via a `JSON.parse` reviver; `ec-battery.js` and `dpp-html-renderer.js` enforce matching guards plus BCP 47 validation and `Object.hasOwn` lookups on `options.language`.
   * `/render/html` permits only base64 raster `data:image/(png|jpeg|jpg|gif|webp)` URIs (blocking SVG `data:` URIs), escapes `</style>`, and sends `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; script-src 'none' | 'nonce-<random>'; object-src 'none'; base-uri 'none'; frame-ancestors 'none';`.
5. **Error Logging & Remote Debuggability:**
   * Unhandled `>= 500` errors are logged to `stderr` via `console.error` for Cloud Run logs. By default, `err.message` remains visible in `500` responses with host `PROJECT_ROOT` paths scrubbed to `<app>` so maintainers can diagnose reproducible issues remotely via `curl` against GS1's Cloud Run service without needing access to GS1's GCP console. Setting `HIDE_INTERNAL_ERRORS=true` masks `500` messages to generic `"Internal Server Error"`.

---

## 4. Local Development, Testing & Deployment

### Commands (Run from Repository Root)
```bash
# Start API locally on http://0.0.0.0:8080 (override with PORT=...)
npm run start:api

# Rebuild dist/ (when src/util/ or src/api/ changed) and run all API Jest suites
npm run build && npm run test:api

# Full repository validation (clean + build + ontology integrity + 24-lang i18n + Jest + Playwright)
npm test
```

### API Test Suites
* `testing/integration/api/api-ec-validate.test.js` — Patched & raw EC validation, specification drift checks, and OpenAPI YAML validation.
* `testing/integration/api/api-ec-adapt.test.js` — Keystone → EC Battery adaptation (`patched` & `raw`) across EV, LMT, and Industrial batteries, voluntary attribute preservation, and raw stripping.
* `testing/integration/api/api-render.test.js` & `testing/unit/api/api-html-generator.test.js` — `/render/html` integration and server renderer unit tests.
* `testing/integration/api/api-health.test.js` — `/health`, `/version`, CORS `OPTIONS`, `404`, and oversized payload checks.
* `testing/integration/api/api-docs-generation.test.js` & `testing/integration/playwright/api-docs.spec.js` — Vendored Swagger UI & OpenAPI build verification.
* `testing/integration/api/api-security-hardening.test.js` — Comprehensive security regression suite **plus** the automated Dependency Health Guard (offline `package-lock.json` sync & public-registry URL check, 0-day npm bulk security advisory check, and 90-day staleness check on non-test runtime/vendored dependencies; override grace window via `MAX_STALE_DEPENDENCY_DAYS`).

### Container & Cloud Run Deployment (`deploy-api.yml`)
* **Container ([`Dockerfile`](../Dockerfile)):** Built on `node:24-alpine` using `npm ci --omit=dev --ignore-scripts --workspaces=false`, running as non-root `USER node` with a native Node `fetch` `HEALTHCHECK` against `/health` and zero runtime filesystem writes (`--read-only` compatible).
* **CI/CD ([`.github/workflows/deploy-api.yml`](../.github/workflows/deploy-api.yml)):** Runs integrity + Jest tests and deploys pushes on `main` (or manual `workflow_dispatch`) to GS1's Google Cloud Run service (`dpp-keystone-prod` / `europe-west1` / `dpp-keystone-api`) with `--memory 512Mi`, `--cpu 1`, `--concurrency 20`, `--max-instances 2`, and `NODE_OPTIONS=--max-old-space-size=384`.

### Environment Variables
| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `8080` | TCP port `api/src/server.js` listens on. |
| `HIDE_INTERNAL_ERRORS` | `false` | When `'true'`, masks `>= 500` responses as `"Internal Server Error"` instead of returning `<app>`-scrubbed diagnostic messages. |

---

## 5. Relevant Design Documents
* [`designs/2026-08-18-dpp-keystone-api-COMPLETED.md`](../designs/) / `2026-08-18-dpp-keystone-api.md` — Initial stateless API & `/render/html` architecture.
* [`designs/2026-11-24-ec-battery-api.md`](../designs/2026-11-24-ec-battery-api.md) — Dual-bundle EC Battery validation, Keystone → EC adaptation, and OpenAPI 3.1 documentation.
* [`designs/2026-11-27-api-security-hardening.md`](../designs/2026-11-27-api-security-hardening.md) — Security & deployment hardening across loader, validators, transport, renderer/CSP, supply chain, and container build.
