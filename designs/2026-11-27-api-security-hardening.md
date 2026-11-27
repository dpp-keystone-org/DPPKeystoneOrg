# Design Doc: 2026-11-27 API & Deployment Security Hardening

## Summary

Captures all security and operational hardening findings across the DPP Keystone stateless API (`api/`), shared validation/adaptation/rendering utilities (`src/util/`, `src/api/`), container build (`Dockerfile`, `.dockerignore`), and CI/CD / cloud deployment configuration (`.github/workflows/deploy-api.yml`, Cloud Run / GS1 cloud hosting).

### Collaboration Workflow for This Design Doc
Unlike typical implementation-only design docs in `designs/`, each Feature below contains a **detailed vulnerability & trade-off analysis** upfront. We will walk through these Features **one by one**, decide whether and how to address each item, expand the agreed approach into granular sub-task TODOs, and implement/test them incrementally.

---

## Implementation & Review Plan

### [COMPLETED] Feature 1: Eliminate Local Path Traversal & Outbound Network Fallbacks in `server-resource-loader.js`
* **Severity:** High (Path Traversal) / Low–Medium (Air-Gapped Egress Hang)
* **Affected Files:**
  * `api/src/lib/server-resource-loader.js` (lines 76–81, 285–313, 362–391)
* **Detailed Problem & Exploitability:**
  1. **Local Path Traversal (`createServerDocumentLoader`, lines 366–391):**
     When a DPP payload passed to `POST /adapt`, `POST /render/html`, or Keystone validation contains a `@context` string starting with `https://dpp-keystone.org/spec/contexts/` or `https://dpp-keystone.org/spec/ontology/`, the loader strips that prefix via string replacement and passes the remainder `rel` directly into `path.join(PROJECT_ROOT, 'src/contexts', rel)` (and `dist/spec/contexts`). Because `normalizeSpecUrl()` performs a regex prefix replacement rather than URL path canonicalization, a crafted `@context` containing `..` segments (e.g., `https://dpp-keystone.org/spec/contexts/../../../package.json`) escapes `src/contexts/` and causes `readJsonFile()` to read and parse arbitrary JSON/JSONC files readable by the `node` user inside the container.
     * *Impact:* Non-JSON files fail `jsoncParse`, and parsed JSON is consumed by `jsonld.expand()` rather than returned verbatim, limiting direct data exfiltration. However, attackers can probe for the existence/structure of local JSON files (such as `package.json` or any accidentally mounted cloud credential JSON files) via timing, expansion side-effects, or error messages.
  2. **Silent Outbound Network Fallbacks (`getServerSchemaContext` lines 76–81 & `getServerOntologyMap` lines 285–313):**
     If a local schema or ontology file is missing on disk, the loader falls back to `fetch('https://dpp-keystone.org/...')`. In a locked-down GS1 enterprise VPC with restricted outbound egress, any missing-file edge case will hang requests until the OS TCP connection timeout (~30–120s) instead of failing fast and deterministically.
* **Agreed Decision (Option B + Offline External Pass-Through):**
  * **Keystone & EC Context Allowlist `Map`:** Pre-index valid `.context.jsonld` files under `contexts/` into a fixed `Map<canonicalUrl, frozenContextDoc>` (supporting both `/spec/contexts/<version>/<file>` and version-less `/spec/contexts/<file>`, normalized via `normalizeSpecUrl` so `/preview/<branch>/` URLs also match). Remove `ONTOLOGY_PREFIX` from `createServerDocumentLoader` completely (preventing ontology files from ever being loaded via `@context`), and remove all live `fetch('https://dpp-keystone.org/...')` fallbacks in `server-resource-loader.js`.
  * **External / Unrecognized `@context` URLs:** Never fetch over the network. Return the safe `{ '@context': {} }` stub in both `server-resource-loader.js` and `ec-validator-service.js` (adding a clear `warnings` note in `ec-validator-service.js` when an external URL is stubbed offline during SHACL validation instead of throwing a fatal `JSONLD_SHACL_ERROR`).
  * **`target=patched` vs. `target=raw` Voluntary Attributes:** `target=patched` preserves extra `@context` entries and all untransformed/voluntary attributes; `target=raw` strips **all** non-EC root attributes (not just a partial hardcoded list) and records every stripped attribute in `droppedFields` + `warnings` so raw EC payloads remain strictly valid under raw EC JSON Schema & SHACL.
* **TODOs:**
  * [x] **Step 1.0 (Pre-Step TDD Proof):** Created `testing/fixtures/outside-context-fixture.json` and `testing/integration/api/api-security-hardening.test.js` proving path traversal (`../../testing/fixtures/...`) and existence oracle (`../../package.json`) fail on unpatched code.
  * [x] **Step 1.1 (Comprehensive Edge-Case Tests):** Expand `api-security-hardening.test.js` and `api-ec-adapt.test.js` to cover:
    * `..` and `%2e%2e` traversal across both `/adapt` and `/render/html`, plus `../../package.json` existence oracle.
    * `dpp-keystone.org/spec/ontology/...` URLs inside `@context` (must not load ontology files from disk).
    * External `@context` URLs (e.g. `https://ref.gs1.org/epcis/epcis-context.jsonld`) on `/adapt` and `/validate` with both prefixed/inline-mapped attributes (`mode=strict` passes) and unprefixed short keys (`adaptedDpp` preserved, `mode=schema` passes, `mode=strict` flags `SEM-COM-MSG-013` cleanly with offline warning).
    * Version-less (`/spec/contexts/dpp-battery.context.jsonld`) and `/preview/<branch>/` Keystone context URLs on `/adapt`.
    * `target=raw` stripping all non-EC voluntary/custom root attributes into `droppedFields` and passing `mode=strict` validation.
  * [x] **Step 1.2 (Implementation):**
    * Refactored `createServerDocumentLoader` in `api/src/lib/server-resource-loader.js` to use an immutable in-memory `Map` of `.context.jsonld` files only, and removed outbound `fetch()` fallbacks in `getServerSchemaContext` and `getServerOntologyMap`.
    * Updated `documentLoader` in `api/src/lib/ec-validator-service.js` to stub unknown external `@context` URLs with `{ '@context': {} }` and record an explanatory warning instead of throwing `Unmapped remote JSON-LD context URL` (plus included `common-shapes.ttl` in raw SHACL shape merges).
    * Updated `convertPatchedEcToRawEc` in `api/src/lib/ec-battery-adapter-service.js` to allowlist valid EC Battery root keys (`ALLOWED_RAW_EC_ROOT_KEYS`) and strip all non-EC root keys into `droppedFields`.
  * [x] **Step 1.3 (Verification):** Verified all Feature 1 security & edge-case tests pass.

---

### [ ] Feature 2: Cache Compiled Ajv Validators on Keystone Validation (`/render/html` CPU DoS)
* **Severity:** Medium–High (Asymmetric CPU DoS)
* **Affected Files:**
  * `src/util/js/common/validation/schema-validator.js` (lines 14–64)
  * `api/src/lib/dpp-validator-service.js` (lines 26–29)
* **Detailed Problem & Exploitability:**
  `ec-validator-service.js` compiles its Ajv2020 schemas once per process and caches the compiled validator functions. By contrast, `validateDpp()` in `src/util/js/common/validation/schema-validator.js` (invoked on every `POST /render/html` request) instantiates a brand-new `new Ajv2020(...)`, registers all shared schemas, and runs `ajv.compile(compositeSchema)` across ~15+ Draft 2020-12 schemas synchronously on **every single HTTP request**. Schema compilation is orders of magnitude slower than validation and runs synchronously on the main Node.js event loop, allowing a low-bandwidth stream of `/render/html` requests to saturate a 1-vCPU container and starve `/validate` and `/adapt`.
* **Options to Discuss:**
  * **Option A (`WeakMap` Cache Inside `schema-validator.js` — Recommended):** Cache the compiled `validate` function in a `WeakMap` keyed on `schemaContext` inside `schema-validator.js` (since `server-resource-loader.js` already caches and returns the exact same `schemaContext` object per version, and browser callers also reuse `schemaContext`!). Zero API signature changes, benefits both server and browser.
  * **Option B (Server-Only Cache in `dpp-validator-service.js`):** Pre-compile and cache per `version` in `api/src/lib/dpp-validator-service.js` without touching `src/util/`.
* **TODOs (to expand once agreed):**
  * [ ] Step 2.1: Decide between `WeakMap` in `schema-validator.js` vs. server-only caching.
  * [ ] Step 2.2: Implement validator caching and verify all existing schema tests pass.

---

### [ ] Feature 3: Input Structural Limits & JSON-LD / RDF Expansion Caps (Stack & Graph-Bomb DoS)
* **Severity:** Medium–High (Event-Loop Blocking & Call-Stack Crash)
* **Affected Files:**
  * `api/src/server.js` (`readJsonBody`)
  * `api/src/lib/ec-validator-service.js` (`expandToRdfDataset`)
  * `src/util/js/common/validation/ontology-validator.js` (lines 62–71)
  * `src/util/js/common/validation/context-semantic-validator.js` (lines 60–80)
  * `src/util/js/common/rendering/dpp-html-renderer.js` (lines 124–273)
* **Detailed Problem & Exploitability:**
  Even with a 1 MiB raw byte cap, two structural DoS vectors exist:
  1. **Deep Nesting Stack Overflow:** Recursive walkers in `ontology-validator.js`, `context-semantic-validator.js`, and `dpp-html-renderer.js` have no maximum recursion depth. A ~40 KB payload of nested arrays/objects (`{"a":{"a":...}}` 12,000 levels deep) parses cleanly in `JSON.parse` and then throws `RangeError: Maximum call stack size exceeded`.
  2. **JSON-LD 1.1 Inline `@context` / RDF Quad Amplification:** Callers can embed inline `@context` objects on `/validate` and `/adapt`. Crafted term definitions or dense cross-referenced graphs can cause `jsonld.expand()` + `jsonld.toRDF()` + `SHACLValidator.validate()` to expand a <1 MiB JSON document into hundreds of thousands of RDF quads, blocking the single-threaded event loop for seconds and spiking heap usage.
* **Options to Discuss:**
  * **Structural Guard on Parsed JSON:** Enforce a fast iterative structural check in `server.js` right after `JSON.parse`: e.g., max nesting depth `32` (valid DPPs rarely exceed depth `8`), max total object keys / array items `15,000` -> reject with `400 Bad Request` (`PAYLOAD_TOO_COMPLEX`).
  * **RDF Expansion Guard:** Cap the N-Quads string length / quad count produced by `jsonld.toRDF()` (e.g., max `25,000` quads or `2 MiB` N-Quads) before feeding `N3Parser` and `SHACLValidator`.
  * **Inline `@context` Policy:** Keep inline `@context` support (needed for custom voluntary attributes in Feature 5 of the previous design doc), but optionally block `@import` inside user-supplied inline `@context` objects or cap inline `@context` size.
* **TODOs (to expand once agreed):**
  * [ ] Step 3.1: Agree on max JSON depth, max node/key count, and max RDF quad count thresholds.
  * [ ] Step 3.2: Implement structural complexity guard and RDF quad cap.
  * [ ] Step 3.3: Add unit/integration tests for deeply nested JSON and oversized graph rejections.

---

### [ ] Feature 4: HTTP Transport Hardening (`413` Socket Teardown & Slowloris Timeouts)
* **Severity:** Medium–High (Connection & Bandwidth Exhaustion, especially outside Cloud Run)
* **Affected Files:**
  * `api/src/server.js` (lines 35–85, 333–339)
* **Detailed Problem & Exploitability:**
  1. **Unclosed Socket on `413 Payload Too Large` (`readJsonBody`, lines 41–53):**
     When `receivedBytes > MAX_PAYLOAD_BYTES`, `readJsonBody` sets `isTooLarge = true` and rejects the promise so the route handler writes a `413` response—**but never calls `req.destroy()` or sets `Connection: close`**. An attacker streaming a multi-gigabyte body over keep-alive or slow chunks can continue pushing data into OS/Node socket buffers after the rejection, or desynchronize HTTP pipelining on the connection because the remaining request body was never drained.
  2. **Missing Server Timeouts (`createServer`, line 83):**
     Node's default `headersTimeout` (60s) and `requestTimeout` (300s / 5 minutes!) are very permissive. While Google Cloud Run's front-end proxy buffers requests, **deploying this container in GS1's cloud (e.g., behind an AWS NLB/ALB or Kubernetes Ingress)** exposes Node directly to Slowloris / slow-body connection exhaustion if timeouts aren't explicitly tightened.
  3. **`Content-Type` Enforcement:**
     `POST` endpoints currently parse any body as JSON regardless of `Content-Type` (e.g., `text/plain` sent via HTML `<form>` or simple cross-origin `fetch` without CORS preflight!). Requiring `Content-Type: application/json` (or `application/ld+json`) forces browsers to send a CORS `OPTIONS` preflight before cross-origin `POST`s.
* **Options to Discuss:**
  * Send `Connection: close` on `413` and destroy `req.socket` once the `413` response flushes (`res.on('finish', () => req.destroy())`), plus check `Content-Length` header upfront before reading chunks!
  * Configure `server.headersTimeout = 10_000`, `server.requestTimeout = 15_000`, and `server.keepAliveTimeout = 5_000`.
  * Decide whether to strictly enforce `Content-Type: application/json` / `application/ld+json` (`415 Unsupported Media Type`) on `POST` routes.
* **TODOs (to expand once agreed):**
  * [ ] Step 4.1: Agree on timeout values, upfront `Content-Length` check + socket teardown, and `Content-Type` check.
  * [ ] Step 4.2: Implement in `api/src/server.js` and add integration tests (`413`, `415`).

---

### [ ] Feature 5: HTML Renderer (`/render/html`) Sanitization & CSP Hardening
* **Severity:** Medium (Downstream Stored XSS / UI Redressing if Integrators Host Rendered HTML)
* **Affected Files:**
  * `src/util/js/common/rendering/dpp-html-renderer.js` (lines 26–33, 348–375, 431–450)
  * `api/src/server.js` (lines 306–312)
* **Detailed Problem & Exploitability:**
  Although `/render/html` is de-emphasized for service providers building custom UIs, it remains active on the API and in the browser tools (`Validator`, `Wizard`):
  1. **`data:image/svg+xml` in `sanitizeUrl()` (line 31):** Currently allows any `data:image/*` URI. SVG data URIs can contain executable `<script>` payloads—inert inside `<img>`, but executed if a user opens the image in a new tab or if `sanitizeUrl()` is ever reused on an `<a href>` or `<object>`.
  2. **Arbitrary External CSS (`options.customCssUrl`, lines 432–438):** Allows injecting any `https://` stylesheet (and `http://localhost` / `http://127.0.0.1`, enabling local-port probing from a viewer's browser). External CSS enables full UI redressing/phishing and CSS attribute/text side-channel exfiltration if `options` comes from an untrusted caller.
  3. **Permissive CSP on `/render/html` (`server.js` line 309):** Currently emits `script-src 'self' 'unsafe-inline'` on every response (solely to support the inline `onclick="moveSlide(...)"` carousel when `images.length > 1`) and omits `frame-ancestors 'none'`, `base-uri 'none'`, and `object-src 'none'`. Also, `renderProductPage` interpolates `${css}` inside `<style>` without escaping `</style>`.
* **Options to Discuss:**
  * Restrict `data:` URIs in `sanitizeUrl()` to raster formats only: `/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i`.
  * Decide fate of `customCssUrl` on the API (`http://localhost` allowance in prod vs. HTTPS-only vs. deprecating/disabling external CSS on the server).
  * Tighten CSP (`object-src 'none'; base-uri 'none'; frame-ancestors 'none'`, and use a per-render CSP cryptographic nonce—or only allow script execution when the multi-image carousel is present without inline `onclick` attributes!).
  * Strip/escape `</style` in `${cssContent}` inside `renderProductPage` as defense-in-depth.
* **TODOs (to expand once agreed):**
  * [ ] Step 5.1: Decide policy on SVG `data:` URIs, `customCssUrl`, and CSP nonces/directives.
  * [ ] Step 5.2: Implement renderer & CSP hardening and add unit/integration tests.

---

### [ ] Feature 6: Prototype-Key Sanitization (`__proto__`, `constructor`, `prototype`) & `language` Validation
* **Severity:** Low–Medium (Per-Request Prototype Mutation / Unexpected 500s / UI Glitch)
* **Affected Files:**
  * `api/src/server.js` (`readJsonBody`)
  * `src/util/js/common/transformation/profiles/ec-battery.js` (lines 178–194, 912–917)
  * `src/util/js/common/rendering/dpp-html-renderer.js` (lines 103–116)
* **Detailed Problem & Exploitability:**
  * `JSON.parse('{"__proto__": {"x": 1}}')` creates an own enumerable `"__proto__"` property on the parsed object. When `ec-battery.js` copies voluntary keys via `ecPayload[key] = ...` (line 916), or when `toMultiLang` assigns `map[lang] = ...` (line 186), assigning `"__proto__"` mutates the target object's prototype chain (or throws / corrupts serialization if set to a primitive/non-plain object). While this does **not** pollute global `Object.prototype` across requests, it can break per-request validation or cause `500` errors.
  * Similarly, in `dpp-html-renderer.js` line 108, `info.label[language]` checks prototype properties on plain label maps—so passing `options.language = "toString"` or `"constructor"` renders `"function toString() { [native code] }"` as every field label.
* **Options to Discuss:**
  * Pass a `JSON.parse` reviver in `readJsonBody` (or recursive sanitizer) that drops `"__proto__"`, `"constructor"`, and `"prototype"` keys at the API boundary, **and** guard `ec-battery.js` and `dpp-html-renderer.js` (`Object.hasOwn(info.label, language)` + BCP 47 regex validation on `language`) so browser tools (`Validator`, `Wizard`) are equally protected.
* **TODOs (to expand once agreed):**
  * [ ] Step 6.1: Confirm boundary reviver + shared utility guards.
  * [ ] Step 6.2: Implement guards and add unit/integration tests with `__proto__` / `constructor` payloads.

---

### [ ] Feature 7: Sanitize `500` Error Responses & Structured Server Logging
* **Severity:** Low–Medium (Information Disclosure)
* **Affected Files:**
  * `api/src/server.js` (lines 322–328)
  * `api/src/lib/ec-validator-service.js` (lines 466–471, 569–575)
* **Detailed Problem & Exploitability:**
  In `server.js` line 325, the top-level `catch (err)` block returns `error: err.message` verbatim to the HTTP client even when `statusCode === 500`. Unexpected filesystem, N3Parser, or library exceptions can disclose internal container paths (`/app/ec-bundle/...`) or Node internals.
* **Options to Discuss:**
  * Only return `err.message` when `statusCode >= 400 && statusCode < 500` (client errors explicitly tagged with `err.statusCode`); for `500`, log the full error server-side (`console.error`) and return `{ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }`.
  * Sanitize any filesystem paths if `ec-validator-service.js` catches an unexpected expansion/parser error.
* **TODOs (to expand once agreed):**
  * [ ] Step 7.1: Confirm client-visible vs. server-logged error policy.
  * [ ] Step 7.2: Update error handling in `server.js` and `ec-validator-service.js` + test.

---

### [ ] Feature 8: Supply-Chain Hardening for `/api/` Swagger UI Documentation Page
* **Severity:** Medium (Third-Party CDN Script Trust)
* **Affected Files:**
  * `src/api/index.html` (lines 9, 164)
  * `scripts/bundle-vendor.mjs` (if vendoring locally)
* **Detailed Problem & Exploitability:**
  `src/api/index.html` currently loads `https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css` and `swagger-ui-bundle.js` using a floating `@5` major version tag and **without Subresource Integrity (`integrity="sha384-..."`)**. If `cdn.jsdelivr.net` were compromised or a malicious `5.x` patch version were published to npm, arbitrary JS would execute in the `dpp-keystone.org` (or GS1 documentation) origin. In addition, many enterprise security policies (potentially including GS1's) block third-party CDN scripts via strict CSP.
* **Options to Discuss:**
  * **Option A (Pin Exact Version + SRI Hash):** Pin e.g. `swagger-ui-dist@5.18.2` with `integrity="sha384-..." crossorigin="anonymous"`. Zero repo size increase; browser refuses to execute if a single byte changes on the CDN.
  * **Option B (Self-Host / Vendor Locally):** Add `swagger-ui-dist` to `devDependencies` and copy `swagger-ui.css` + `swagger-ui-bundle.js` into `src/lib/vendor/swagger-ui/` during `bundle:vendor` (or `build`). Increases `dist/` size by ~1.5 MB, but makes `/api/` 100% self-contained, offline-capable, and compliant with strict `'self'` CSPs.
* **TODOs (to expand once agreed):**
  * [ ] Step 8.1: Choose Option A (Pinned CDN + SRI) vs. Option B (Self-Hosted Vendor Assets).
  * [ ] Step 8.2: Implement and verify with `api-docs.spec.js`.

---

### [ ] Feature 9: Rate Limiting, CORS & Ingress Controls for Public / GS1 Cloud Deployment
* **Severity:** Medium (Service Availability / Quota Exhaustion)
* **Affected Files:**
  * `api/src/server.js`
  * `.github/workflows/deploy-api.yml` (and GS1 deployment runbook / documentation)
* **Detailed Problem & Exploitability:**
  The API is currently public (`--allow-unauthenticated`, `Access-Control-Allow-Origin: *`) with `--max-instances 2` and `--concurrency 20`. While `max-instances=2` prevents runaway cloud bills, ~40 simultaneous SHACL validation requests from a single abusive client will saturate all available capacity and cause `429`/`503` errors for legitimate callers.
* **Options to Discuss:**
  * **Lightweight In-Process Per-IP Token-Bucket Rate Limiter (Optional Defense-in-Depth):** Add a configurable, bounded-memory per-IP rate limiter in `server.js` (e.g., `RATE_LIMIT_RPM=120`, respecting `X-Forwarded-For` only when `TRUST_PROXY=true`), returning `429 Too Many Requests` with `Retry-After` before running expensive Ajv/JSON-LD/SHACL work!
  * **Configurable CORS Origin (`ALLOWED_ORIGINS` env var):** Default to `*` for public `dpp-keystone.org` sandbox, while allowing GS1's deployment to set `ALLOWED_ORIGINS=https://...` via environment variable without code changes.
  * **Cloud-Layer Guidance for GS1:** Document recommended WAF / API Gateway / Cloud Armor per-IP rate limiting, TLS termination, and optional API-key / IAM authentication in an operations/deployment README (`api/README.md`).
* **TODOs (to expand once agreed):**
  * [ ] Step 9.1: Decide on in-process rate limiter, `ALLOWED_ORIGINS` env config, and `api/README.md` GS1 deployment guide.
  * [ ] Step 9.2: Implement agreed controls and add tests.

---

### [ ] Feature 10: Container (`Dockerfile` / `.dockerignore`) & CI/CD (`deploy-api.yml`) Hardening
* **Severity:** Low–Medium (Supply-Chain Reproducibility & Deployment Governance)
* **Affected Files:**
  * `Dockerfile`
  * `.dockerignore`
  * `.github/workflows/deploy-api.yml`
* **Detailed Problem & Exploitability:**
  1. **`npm install` in `Dockerfile` (line 9):** `RUN npm install --omit=dev` can resolve newer semver-compatible transitive packages than those locked in `package-lock.json` and runs package `postinstall` scripts. Using `RUN npm ci --omit=dev --ignore-scripts` guarantees byte-for-byte lockfile reproducibility and blocks malicious install scripts.
  2. **Mutable Base Image & Writable Filesystem:** `FROM node:24-alpine` is unpinned, and container security best practice (often required by enterprise scanners in GS1/cloud environments) includes a `HEALTHCHECK` instruction and compatibility with read-only root filesystems (`--read-only`).
  3. **Excess Files in Container Image (`.dockerignore`):** Currently copies `scripts/`, `index.html`, `index.i18n.json`, `ec-bundle/verify-semantic-integrity.mjs`, and `ec-bundle*/**/tests/` into the production container unnecessarily.
  4. **Branch Trigger in `deploy-api.yml` (lines 6–7):** Currently allows pushes to `feature/api-setup` to deploy directly to `dpp-keystone-prod`, and uses mutable tag references (`@v4`, `@v2`) on third-party GitHub Actions.
* **Options to Discuss:**
  * Switch `Dockerfile` to `npm ci --omit=dev --ignore-scripts`, verify the server writes zero temp files to disk (so `--read-only` works out of the box), and trim `.dockerignore`.
  * Decide when to remove `feature/api-setup` from `deploy-api.yml` (e.g., as the final step right before merging the PR to `main`) and whether to pin GitHub Action commit SHAs.
* **TODOs (to expand once agreed):**
  * [ ] Step 10.1: Confirm `Dockerfile`, `.dockerignore`, and `deploy-api.yml` hardening items.
  * [ ] Step 10.2: Apply container & workflow updates and verify local Docker build / tests.
