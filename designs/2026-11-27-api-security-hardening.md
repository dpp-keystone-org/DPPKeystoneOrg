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

### [COMPLETED] Feature 2: Cache Compiled Ajv Validators on Keystone Validation (`/render/html` CPU DoS)
* **Severity:** Medium–High (Asymmetric CPU DoS)
* **Affected Files:**
  * `src/util/js/common/validation/schema-validator.js` (lines 1–125)
  * `testing/integration/api/api-security-hardening.test.js` (lines 223–306)
* **Detailed Problem & Exploitability:**
  `ec-validator-service.js` compiles its Ajv2020 schemas once per process and caches the compiled validator functions. By contrast, `validateDpp()` in `src/util/js/common/validation/schema-validator.js` (invoked on every `POST /render/html` request) instantiates a brand-new `new Ajv2020(...)`, registers all shared schemas, and runs `ajv.compile(compositeSchema)` across ~15+ Draft 2020-12 schemas synchronously on **every single HTTP request**. Schema compilation is orders of magnitude slower than validation and runs synchronously on the main Node.js event loop, allowing a low-bandwidth stream of `/render/html` requests to saturate a 1-vCPU container and starve `/validate` and `/adapt`.
* **Agreed Decision (Option A — `WeakMap` Cache Inside `schema-validator.js`):**
  * **Why `schema-validator.js` over `dpp-validator-service.js`:** `schema-validator.js` is the shared/isomorphic module in `src/util/` used by the Node.js API server (`api/src/lib/dpp-validator-service.js`), the client-side Browser Validator Web App (`src/validator/validator.js`), and Jest schema suites. Caching inside `schema-validator.js` keeps all Ajv configuration and compilation localized in one file while giving one-time compilation to every caller automatically (without breaking `src/util/`'s decoupling from `version` strings or filesystem loaders).
  * **Cache Invalidation & Error Isolation:** Key a module-level `WeakMap` on `schemaContext` alongside a lightweight structural reference check over `baseSchema`, `sectorSchemas` entries, and `commonSchemas` items so in-place mutations to `schemaContext` (such as `validator.js` populating `schemaContext` fields or dynamic test fixtures) safely trigger recompilation. Return `structuredClone(validate.errors)` on validation failure so callers cannot mutate shared Ajv state and subsequent `validate()` calls cannot clobber previously returned error arrays.
  * **Testing Strategy:** Rather than flaky wall-clock latency assertions, spy deterministically on `Ajv2020.prototype.compile` in `api-security-hardening.test.js` across both direct `validateDpp()` calls and live `POST /render/html` HTTP requests.
* **TODOs:**
  * [x] **Step 2.1 (TDD Spy Tests):** Added deterministic `Ajv2020.prototype.compile` spy tests in `testing/integration/api/api-security-hardening.test.js` covering single compilation per `schemaContext`, error-array isolation across valid/invalid calls, cache invalidation on in-place `schemaContext` mutation, and zero recompilation across repeated `POST /render/html` requests.
  * [x] **Step 2.2 (Implementation):** Implement `WeakMap` validator caching + inner schema reference check + `structuredClone(validate.errors)` (with JSON fallback for older `jsdom` environments) in `src/util/js/common/validation/schema-validator.js`.
  * [x] **Step 2.3 (Verification):** Rebuilt (`npm run build`) and verified all `npm run test:api` suites pass.

---

### [COMPLETED] Feature 3: Input Structural Limits & JSON-LD / RDF Expansion Caps (Stack & Graph-Bomb DoS)
* **Severity:** Medium–High (Event-Loop Blocking & Call-Stack Crash)
* **Affected Files:**
  * `api/src/server.js` (`readJsonBody`)
  * `api/src/lib/ec-validator-service.js` (`expandToRdfDataset` & `validateEcDppPayload`)
  * `src/util/js/common/validation/ontology-validator.js` (lines 50–78)
  * `src/util/js/common/validation/context-semantic-validator.js` (lines 38–120)
  * `src/util/js/common/rendering/dpp-html-renderer.js` (lines 35–82, 156–322)
  * `src/api/openapi.yml` (line 583 — `PayloadTooLarge` response description)
* **Detailed Problem & Exploitability:**
  Even with a 1 MiB raw byte cap, two structural DoS vectors exist:
  1. **Deep Nesting Stack Overflow & Ultra-Dense JSON:** Recursive walkers in `ontology-validator.js`, `context-semantic-validator.js`, and `dpp-html-renderer.js` have no maximum recursion depth. A ~40 KB payload of nested arrays/objects (`{"a":{"a":...}}` 12,000 levels deep) parses cleanly in `JSON.parse` and then throws `RangeError: Maximum call stack size exceeded`. Likewise, a <800 KB array of `[0,0,...]` creates hundreds of thousands of AST entries.
  2. **JSON-LD 1.1 Inline `@context` / RDF Quad Amplification:** Callers can embed inline `@context` objects on `/validate` and `/adapt` (e.g., `"@container": "@list"` or dense multi-typed graphs). Crafted definitions can amplify a modest JSON document (<15,000 JSON entries) into tens of thousands of RDF quads in `jsonld.expand()` + `jsonld.toRDF()`, blocking the single-threaded event loop inside `N3Parser` and `SHACLValidator.validate()`.
* **Agreed Decision (`413 Content Too Large` + `code: 'PAYLOAD_TOO_COMPLEX'`):**
  * **Why `413` over `400`:** Per RFC 9110 §15.5.14, `413 Content Too Large` signifies a syntactically valid payload that exceeds the size or complexity bounds the server is willing to process (`code: 'PAYLOAD_TOO_LARGE'` for the 1 MiB raw byte stream cap vs. `code: 'PAYLOAD_TOO_COMPLEX'` for structural depth, AST entry count, or RDF quad expansion bounds). Note: unlike mid-stream `PAYLOAD_TOO_LARGE` (where Feature 4 will close/destroy the unread socket), post-parse `PAYLOAD_TOO_COMPLEX` responses have already consumed the request body cleanly and return a normal `413` response.
  * **Iterative JSON Complexity Guard (`readJsonBody` in `api/src/server.js`):** Immediately after `JSON.parse()`, run a non-recursive (explicit stack) check enforcing:
    * `MAX_JSON_DEPTH = 32` (real Keystone & EC DPPs—even wrapped in `{ dpp, options }`—are depth 5–10).
    * `MAX_JSON_ENTRIES = 15_000` total object keys + array elements across the parsed body.
    * Exceeding either throws `statusCode = 413`, `code = 'PAYLOAD_TOO_COMPLEX'`.
  * **RDF Expansion Cap (`expandToRdfDataset` in `api/src/lib/ec-validator-service.js`):**
    * Cap `nquads.length <= 2 * 1024 * 1024` (2 MiB N-Quads string) and streamed `quadCount <= 20_000` quads before `SHACLValidator.validate()` runs.
    * Throw `statusCode = 413`, `code = 'PAYLOAD_TOO_COMPLEX'` and rethrow `err.statusCode` errors inside `validateEcDppPayload()`'s SHACL `catch` blocks so both `/validate` and `/adapt?validate=true` return HTTP `413` consistently.
  * **Defense-in-Depth in `src/util/` Recursive Walkers (`MAX_TRAVERSAL_DEPTH = 64`):**
    * Add a `depth` guard (`64`) in `validateAgainstOntology()`, `validateContextAwarePayload()` (returning `{ valid: false, errors: [{ keyword: 'maxDepth', ... }] }`), and `renderProductPage()` / `renderValue()` (throwing a deterministic error instead of hitting V8 `RangeError: Maximum call stack size exceeded` when invoked directly outside the HTTP server).
* **TODOs:**
  * [x] **Step 3.1 (TDD Complexity & Amplification Tests):** Add deterministic tests in `testing/integration/api/api-security-hardening.test.js` covering:
    * `depth > 32` rejected with `413 PAYLOAD_TOO_COMPLEX` across `/validate`, `/adapt`, and `/render/html`.
    * `entries > 15,000` (<100 KB raw JSON) rejected with `413 PAYLOAD_TOO_COMPLEX` across `/validate`, `/adapt`, and `/render/html`.
    * Moderate nesting (`depth = 20`) still passes cleanly (`200`).
    * JSON-LD `@container: "@list"` amplification (<15,000 JSON entries -> >20,000 RDF quads) rejected with `413 PAYLOAD_TOO_COMPLEX` on `/validate` and `/adapt?validate=true`.
    * Direct library calls (`validateAgainstOntology`, `validateContextAwarePayload`, `renderProductPage`) on a 2,500-deep object handle recursion limits gracefully without throwing V8 `RangeError`.
  * [x] **Step 3.2 (Implementation):** Implement iterative JSON guard in `api/src/server.js`, RDF quad/N-Quads cap + `statusCode` rethrow in `api/src/lib/ec-validator-service.js`, `MAX_TRAVERSAL_DEPTH = 64` guards in `src/util/`, and `PayloadTooLarge` description update in `src/api/openapi.yml`.
  * [x] **Step 3.3 (Verification):** Rebuilt (`npm run build`) and verified all `npm run test:api` suites pass.

---

### [COMPLETED] Feature 4: HTTP Transport Hardening (`413` Socket Teardown, Slowloris Timeouts & `415` Media Type)
* **Severity:** Medium–High (Connection & Bandwidth Exhaustion, especially outside Cloud Run)
* **Affected Files:**
  * `api/src/server.js` (`readJsonBody`, `createServer`, `POST` route handlers)
  * `src/api/openapi.yml` (`UnsupportedMediaType` `415` response documentation)
* **Detailed Problem & Exploitability:**
  1. **Unclosed Socket & Missing `Content-Length` Pre-Check on `413` (`readJsonBody`):**
     `readJsonBody` does not pre-check `Content-Length` before buffering chunks, and when `receivedBytes > MAX_PAYLOAD_BYTES`, it rejects the promise without pausing `req`, setting `Connection: close`, or destroying the unread socket after the `413` response flushes. An attacker streaming a multi-gigabyte body over keep-alive or slow chunks can continue pushing data into OS/Node socket buffers or desynchronize HTTP pipelining. Additionally, `body += chunk` decodes `Buffer` chunks individually, corrupting multi-byte UTF-8 characters (`€`, `ä`, emoji) split across TCP packet boundaries.
  2. **Missing Server Timeouts (`createServer`):**
     Node's default `headersTimeout` (60s) and `requestTimeout` (300s / 5 minutes) expose the container to Slowloris / slow-body socket exhaustion when deployed outside Cloud Run (e.g., behind an AWS NLB or Kubernetes Ingress in GS1's cloud).
  3. **`Content-Type` Enforcement (`415 Unsupported Media Type`):**
     `POST` endpoints currently parse any body regardless of `Content-Type` (including `text/plain` and `application/x-www-form-urlencoded`, which browsers send cross-origin without a CORS `OPTIONS` preflight).
* **Agreed Decision:**
  * Pre-check `Content-Length > MAX_PAYLOAD_BYTES` upfront before reading chunks; accumulate `Buffer` chunks via `Buffer.concat(chunks).toString('utf-8')`; on any `PAYLOAD_TOO_LARGE` rejection (`err.closeConnection = true`), pause `req`, send `Connection: close`, and destroy `req.socket` right after `res.on('finish')` (via a short `.unref()` grace timer so clients cleanly read the `413` body before TCP teardown).
  * Configure `server.keepAliveTimeout = 5_000`, `server.headersTimeout = 10_000`, and `server.requestTimeout = 15_000` on `createServer()`.
  * Enforce `Content-Type` matching `application/json` or `application/*+json` (e.g. `application/ld+json`, ignoring `; charset=...`) on `POST` routes, returning `415` (`code: 'UNSUPPORTED_MEDIA_TYPE'`).
* **TODOs:**
  * [x] **Step 4.1 (TDD Transport & Media-Type Tests):** Add failing tests in `testing/integration/api/api-security-hardening.test.js` covering:
    * `createServer()` timeout properties (`keepAliveTimeout = 5000`, `headersTimeout = 10000`, `requestTimeout = 15000`).
    * Upfront `Content-Length > 1 MiB` rejection (`413 PAYLOAD_TOO_LARGE` + `Connection: close`) without waiting for body upload.
    * Mid-stream >1 MiB chunked upload rejection (`413 PAYLOAD_TOO_LARGE` + `Connection: close` + server-initiated socket teardown).
    * Multi-byte UTF-8 codepoint split across separate TCP chunks decoded intact without `U+FFFD` corruption.
    * `415 UNSUPPORTED_MEDIA_TYPE` on `text/plain`, `application/x-www-form-urlencoded`, and missing `Content-Type`, while `application/json; charset=utf-8` and `application/ld+json` succeed.
  * [x] **Step 4.2 (Implementation):** Implement transport hardening & `415` check in `api/src/server.js` and document `415` in `src/api/openapi.yml`.
  * [x] **Step 4.3 (Verification):** Rebuilt (`npm run build`) and verified all `npm run test:api` suites pass.

---

### [COMPLETED] Feature 5: HTML Renderer (`/render/html`) Sanitization & CSP Hardening
* **Severity:** Medium (Downstream Stored XSS / UI Redressing if Integrators Host Rendered HTML)
* **Affected Files:**
  * `src/util/js/common/rendering/dpp-html-renderer.js` (`sanitizeUrl`, `renderProductPage`, carousel script)
  * `api/src/lib/html-generator-server.js` (drop `customCssUrl` forwarding, support `cspNonce`)
  * `api/src/server.js` (`/render/html` CSP header + cryptographic nonce)
  * `src/api/openapi.yml` (remove `customCssUrl` from `/render/html` request schema)
  * `testing/unit/html-generator.test.js` & `testing/unit/api/api-html-generator.test.js`
* **Detailed Problem & Exploitability:**
  Although `/render/html` is de-emphasized for service providers building custom UIs, it remains active on the API and in the browser tools (`Validator`, `Wizard`):
  1. **`data:image/svg+xml` in `sanitizeUrl()`:** Currently allows any `data:image/*` URI. SVG data URIs can contain executable `<script>` payloads—inert inside `<img>`, but executed if a user opens the image in a new tab or if `sanitizeUrl()` is ever reused on an `<a href>` or `<object>`.
  2. **External Stylesheet Injection (`options.customCssUrl`):** On the HTTP API, injecting caller-supplied `<link rel="stylesheet" href="...">` URLs outside the server's bundled stylesheet enables full UI redressing/phishing, local-port probing (`http://localhost`), and CSS side-channel exfiltration—and forces CSP `style-src` to allow `https:`.
  3. **Permissive CSP & Raw `<style>` Interpolation:** `server.js` emits `script-src 'self' 'unsafe-inline'` on every response (solely for the multi-image carousel `onclick` handlers) and omits `frame-ancestors 'none'`, `base-uri 'none'`, and `object-src 'none'`. Also, `renderProductPage` interpolates `${css}` inside `<style>` without escaping `</style>`.
* **Agreed Decision:**
  * **Raster-only `data:image/` URIs:** Restrict `data:` URIs in `sanitizeUrl()` to base64 raster formats only (`/^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[a-z0-9+/=\s]+$/i`), rejecting `data:image/svg+xml`.
  * **Remove `customCssUrl` from the HTTP API (keep in static Browser UI):** Stop accepting/forwarding `customCssUrl` in `api/src/lib/html-generator-server.js` and remove it from `src/api/openapi.yml` (keeping `customCssUrl` intact in client-side `src/lib/html-generator.js` where users only style their own local browser tab). Lock server CSP `style-src` down to `'unsafe-inline'` only (no `https:` external stylesheets).
  * **Escape `</style` in `renderProductPage()`:** Replace `</style` (case-insensitive) inside `${cssContent}` with `<\/style`.
  * **Strict Nonce/Script-Free CSP on `/render/html`:** Replace inline `onclick="moveSlide(...)"` / `onclick="setSlide(...)"` attributes with `addEventListener` bindings inside the carousel `<script>` block, accept an optional `cspNonce` in `renderProductPage()`, and emit `default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; object-src 'none'; base-uri 'none'; frame-ancestors 'none';` plus `script-src 'none'` (when `images.length <= 1`) or `script-src 'nonce-<random>'` (when `images.length > 1`).
* **TODOs:**
  * [x] **Step 5.1 (Design Alignment):** Confirmed raster-only `data:image/`, dropping `customCssUrl` on the HTTP API (keeping client UI as-is), `</style>` escaping, and strict CSP without `'unsafe-inline'` in `script-src`.
  * [x] **Step 5.2 (TDD Sanitization & CSP Tests):** Add failing tests in `api-security-hardening.test.js` asserting:
    * `sanitizeUrl()` blocks `data:image/svg+xml` (both base64 and utf8) while preserving valid base64 `png`/`jpeg`/`gif`/`webp` data URIs.
    * `renderProductPage()` neutralizes `</style><script>` breakout sequences inside `css`.
    * `POST /render/html` ignores `options.customCssUrl` (emitting zero `<link rel="stylesheet">` tags even for `https://` or `http://127.0.0.1` URLs) and omits `https:` from CSP `style-src`.
    * `POST /render/html` emits hardened CSP headers (`object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `script-src 'none'` for 0–1 images, and `script-src 'nonce-...'` matching `<script nonce="...">` with zero `onclick=` attributes for multi-image carousels).
  * [x] **Step 5.3 (Implementation):** Implement renderer & CSP hardening in `dpp-html-renderer.js`, `html-generator-server.js`, `api/src/server.js`, `src/api/openapi.yml`, and update `testing/unit/html-generator.test.js` + `testing/unit/api/api-html-generator.test.js`.
  * [x] **Step 5.4 (Verification):** Rebuilt (`npm run build`) and verified all `npm run test:api` suites pass.

---

### [ ] Feature 6: Prototype-Key Sanitization (`__proto__`, `constructor`, `prototype`) & `language` Validation
* **Severity:** Low–Medium (Per-Request Prototype Mutation / Unexpected 500s / UI Glitch)
* **Affected Files:**
  * `api/src/server.js` (`readJsonBody`)
  * `src/util/js/common/transformation/profiles/ec-battery.js` (lines 178–194, 912–917)
  * `src/util/js/common/rendering/dpp-html-renderer.js` (lines 103–116)
* **Detailed Problem & Exploitability:**
  * `JSON.parse('{"__proto__": {"x": 1}}')` creates an own enumerable `"__proto__"` property on the parsed object. When `ec-battery.js` copies voluntary keys via `ecPayload[key] = ...`, or when `toMultiLang` assigns `map[lang] = ...`, assigning `"__proto__"` mutates the target object's prototype chain (or corrupts behavior if set to a primitive/non-plain object).
  * In `dpp-html-renderer.js`, `info.label[language]` accesses prototype properties on plain label maps—so passing `options.language = "toString"` or `"constructor"` renders `"function toString() { [native code] }"` as every field label.
* **Options to Discuss:**
  * Strip `"__proto__"`, `"constructor"`, and `"prototype"` keys via a `JSON.parse` reviver (or iterative cleaner) in `readJsonBody`, **and** guard `ec-battery.js` and `dpp-html-renderer.js` (`Object.hasOwn(info.label, language)` + BCP 47 validation on `language`) so browser tools (`Validator`, `Wizard`) are equally protected.
* **TODOs:**
  * [ ] **Step 6.1 (Design Alignment):** Confirm boundary reviver + shared utility guards.
  * [ ] **Step 6.2 (TDD Prototype & Language Tests):** Add failing tests in `api-security-hardening.test.js` asserting:
    * Raw JSON strings containing `"__proto__"`, `"constructor"`, and `"prototype"` keys sent to `/validate`, `/adapt`, and `/render/html` strip dangerous keys cleanly without mutating object prototypes or `Object.prototype`.
    * Direct calls to `renderProductPage` / `getDisplayLabel` with `language = "toString"` or `"constructor"` fall back cleanly to `'en'` / key name instead of rendering `Function.prototype.toString` source text.
    * Direct calls to EC Battery transformation with own `"__proto__"` properties (via `JSON.parse`) do not mutate `adaptedDpp`'s prototype chain.
  * [ ] **Step 6.3 (Implementation):** Implement reviver in `api/src/server.js` and prototype/`Object.hasOwn`/BCP 47 guards in `ec-battery.js` and `dpp-html-renderer.js`.
  * [ ] **Step 6.4 (Verification):** Rebuild (`npm run build`) and run `npm run test:api`.

---

### [ ] Feature 7: Sanitize `500` Error Responses & Structured Server Logging
* **Severity:** Low–Medium (Information Disclosure)
* **Affected Files:**
  * `api/src/server.js` (top-level `catch (err)`)
  * `api/src/lib/ec-validator-service.js` (SHACL `catch` blocks)
* **Detailed Problem & Exploitability:**
  In `server.js`, the top-level `catch (err)` block returns `error: err.message` verbatim to the HTTP client even when `statusCode === 500`. Unexpected filesystem, N3Parser, or library exceptions can disclose internal container paths (`/app/ec-bundle/...`) or Node internals.
* **Options to Discuss:**
  * Return `err.message` only when `statusCode >= 400 && statusCode < 500` (client errors explicitly tagged with `err.statusCode`); for `>= 500`, log the full error server-side (`console.error`) and return `{ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }`.
  * Scrub local filesystem paths if `ec-validator-service.js` catches an unexpected non-HTTP expansion/parser error.
* **TODOs:**
  * [ ] **Step 7.1 (Design Alignment):** Confirm client-visible vs. server-logged error policy.
  * [ ] **Step 7.2 (TDD Error-Masking Tests):** Add failing tests in `api-security-hardening.test.js` asserting:
    * When an internal dependency throws an untagged `Error('ENOENT: no such file /app/secret/internal.json')`, the API logs the full error via `console.error` (`jest.spyOn`) while returning `500` with `{ error: 'Internal Server Error', code: 'INTERNAL_ERROR' }` and zero path leakage in the HTTP body.
    * Explicit `4xx` errors (`400`, `413`, `415`, `422`) still preserve their actionable client-facing `error` messages and `code`s.
  * [ ] **Step 7.3 (Implementation):** Implement `500` masking + server logging in `api/src/server.js` and path scrubbing in `ec-validator-service.js`.
  * [ ] **Step 7.4 (Verification):** Run `npm run test:api`.

---

### [ ] Feature 8: Supply-Chain Hardening for `/api/` Swagger UI Documentation Page
* **Severity:** Medium (Third-Party CDN Script Trust)
* **Affected Files:**
  * `src/api/index.html` (lines 9, 164)
  * `scripts/bundle-vendor.mjs` / `scripts/build-and-clean.mjs` (if vendoring locally)
* **Detailed Problem & Exploitability:**
  `src/api/index.html` currently loads `https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css` and `swagger-ui-bundle.js` using a floating `@5` major version tag and **without Subresource Integrity (`integrity="sha384-..."`)**. If `cdn.jsdelivr.net` were compromised or a malicious `5.x` patch version were published to npm, arbitrary JS would execute in the `dpp-keystone.org` (or GS1 documentation) origin. In addition, enterprise CSPs often block third-party CDN scripts.
* **Options to Discuss:**
  * **Option A (Pin Exact Version + SRI Hash):** Pin exact `swagger-ui-dist@x.y.z` URLs with `integrity="sha384-..." crossorigin="anonymous"`. Zero repo size increase; browser refuses to execute modified assets.
  * **Option B (Self-Host / Vendor Locally):** Add `swagger-ui-dist` to `devDependencies` and copy `swagger-ui.css` + `swagger-ui-bundle.js` into local vendor assets during build (~1.5 MB `dist/` increase, 100% offline & `'self'` CSP compliant).
* **TODOs:**
  * [ ] **Step 8.1 (Design Alignment):** Choose Option A (Pinned CDN + SRI) vs. Option B (Self-Hosted Vendor Assets).
  * [ ] **Step 8.2 (TDD Supply-Chain Tests):** Add failing assertions in `testing/integration/api/api-docs-generation.test.js` verifying `dist/api/index.html` contains zero unpinned CDN `@5/` URLs and either carries valid `sha384-` SRI + `crossorigin="anonymous"` attributes (Option A) or loads exclusively from local relative vendor paths with zero external CDN `<script>`/`<link>` tags (Option B).
  * [ ] **Step 8.3 (Implementation):** Update `src/api/index.html` (and build scripts if Option B).
  * [ ] **Step 8.4 (Verification):** Run `npm run build && npm run test:api` (plus Playwright `api-docs.spec.js`).

---

### [ ] Feature 9: Rate Limiting, CORS & Ingress Controls for Public / GS1 Cloud Deployment
* **Severity:** Medium (Service Availability / Quota Exhaustion)
* **Affected Files:**
  * `api/src/server.js`
  * `api/README.md` (GS1 cloud deployment & security guide)
* **Detailed Problem & Exploitability:**
  The API is currently public (`--allow-unauthenticated`, `Access-Control-Allow-Origin: *`) with `--max-instances 2` and `--concurrency 20`. ~40 simultaneous SHACL validation requests from one abusive IP can saturate capacity for legitimate callers, and GS1 deployments may require locked-down CORS origins.
* **Options to Discuss:**
  * **Configurable In-Process Per-IP Token-Bucket Rate Limiter:** Bounded-memory per-IP limiter in `createServer()` (configured via `RATE_LIMIT_RPM` env var or `createServer({ rateLimitRpm, trustProxy })` options; respects `X-Forwarded-For` **only** when `TRUST_PROXY=true`), returning `429 Too Many Requests` (`code: 'RATE_LIMITED'`) + `Retry-After` header before running expensive validation.
  * **Configurable CORS Origin (`ALLOWED_ORIGINS` env var / option):** Default to `*` for the public `dpp-keystone.org` sandbox, while allowing GS1's deployment to set `ALLOWED_ORIGINS=https://...` without code changes.
  * **GS1 Cloud Operations Guide (`api/README.md`):** Document recommended WAF / API Gateway per-IP rate limiting, TLS termination, container flags, and environment variables.
* **TODOs:**
  * [ ] **Step 9.1 (Design Alignment):** Confirm rate-limiter defaults, `TRUST_PROXY` behavior, `ALLOWED_ORIGINS` config, and `api/README.md`.
  * [ ] **Step 9.2 (TDD Rate-Limit & CORS Tests):** Add failing tests in `api-security-hardening.test.js` using isolated `createServer({ ... })` instances asserting:
    * Exceeding `rateLimitRpm` returns `429` (`code: 'RATE_LIMITED'`) with `Retry-After` header.
    * Spoofed `X-Forwarded-For` headers cannot bypass per-IP rate limits when `trustProxy: false`, and distinct forwarded client IPs are tracked accurately when `trustProxy: true`.
    * `allowedOrigins: ['https://gs1.example.org']` reflects `Access-Control-Allow-Origin: https://gs1.example.org` + `Vary: Origin` for allowed origins and withholds CORS access for unlisted origins, while default `*` behavior remains intact when unset.
  * [ ] **Step 9.3 (Implementation):** Implement rate limiter & `ALLOWED_ORIGINS` in `api/src/server.js`, update `openapi.yml` (`429`), and create/update `api/README.md`.
  * [ ] **Step 9.4 (Verification):** Run `npm run test:api`.

---

### [ ] Feature 10: Container (`Dockerfile` / `.dockerignore`) & CI/CD (`deploy-api.yml`) Hardening
* **Severity:** Low–Medium (Supply-Chain Reproducibility & Deployment Governance)
* **Affected Files:**
  * `Dockerfile`
  * `.dockerignore`
  * `.github/workflows/deploy-api.yml`
* **Detailed Problem & Exploitability:**
  1. **`npm install` in `Dockerfile`:** `RUN npm install --omit=dev` can resolve newer semver-compatible transitive packages than `package-lock.json` and executes `postinstall` scripts (`npm ci --omit=dev --ignore-scripts` enforces exact lockfile reproducibility and disables install scripts).
  2. **Container Hardening (`HEALTHCHECK` & Read-Only Root FS):** Enterprise scanners in GS1/cloud environments expect non-root `USER`, `HEALTHCHECK`, and compatibility with `--read-only` root filesystems.
  3. **Excess Build Context (`.dockerignore`):** Currently copies `scripts/`, `index.html`, `index.i18n.json`, `ec-bundle/verify-semantic-integrity.mjs`, and `ec-bundle*/**/tests/` into the production image unnecessarily.
  4. **Branch Trigger in `deploy-api.yml`:** Currently deploys pushes on `feature/api-setup` to `dpp-keystone-prod` and uses mutable `@v4`/`@v2` tags on GitHub Actions.
* **Options to Discuss:**
  * Switch `Dockerfile` to `npm ci --omit=dev --ignore-scripts` + `HEALTHCHECK`, trim `.dockerignore`, and decide when to remove `feature/api-setup` from `deploy-api.yml` + pin Action SHAs (plus whether to keep/document or remove `scripts/measure-api-memory.mjs`).
* **TODOs:**
  * [ ] **Step 10.1 (Design Alignment):** Confirm `Dockerfile`, `.dockerignore`, `deploy-api.yml`, and `measure-api-memory.mjs` choices.
  * [ ] **Step 10.2 (TDD Container Hygiene Tests):** Add static configuration tests in `api-security-hardening.test.js` asserting:
    * `Dockerfile` uses `npm ci --omit=dev --ignore-scripts` (never `npm install`), sets a non-root `USER`, and defines a `HEALTHCHECK`.
    * `.dockerignore` excludes `testing`, `scripts`, `designs`, `docs`, `.git`, and root website-only files (`index.html`, `index.i18n.json`). *(Note: live `docker build` / `docker run --read-only` verification is executed via Docker CLI rather than inside Jest.)*
  * [ ] **Step 10.3 (Implementation):** Update `Dockerfile`, `.dockerignore`, and `.github/workflows/deploy-api.yml`.
  * [ ] **Step 10.4 (Verification):** Run `npm run test:api` (and optional `npm run docker:build` / full `npm test`).
