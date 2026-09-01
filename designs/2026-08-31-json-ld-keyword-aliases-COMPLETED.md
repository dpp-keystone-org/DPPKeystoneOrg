# JSON-LD keyword aliases (`type` → `@type`, `id` → `@id`)

The core context already maps developer-friendly `type` and `id` keys to the JSON-LD keywords `@type` and `@id`. JSON-LD 1.1 allows this. The ontology does not (and must not) define `dppk:id` / `dppk:type` just to satisfy that mapping.

Integrity checks currently require every context mapping target to exist in the ontology, so these aliases fail the suite. Spec docs also treat them as ordinary terms with nothing to link to.

## STEP 1: Make the integrity auditor importable for unit tests

- [x] **1.1** Guard `run()` in `scripts/validate-ontology-integrity.mjs` so importing the module from Jest does not execute the full suite or call `process.exit`.
- [x] **1.2** Export `processContextBlock`, `auditContextMappings`, `IntegrityReporter`, and a `resetIntegrityState()` helper so tests can drive the auditor through its public functions.

## STEP 2: Prove the current auditor fails on `@`-term mappings (red)

- [x] **2.1** Add `testing/unit/ontology-integrity.test.js`.
- [x] **2.2** Test: a context block `{ "type": "@type", "id": "@id" }` must not produce a `Context Mapping Integrity` failure. This test is expected to fail until STEP 3.
- [x] **2.3** Test: a context block mapping a term to an IRI that is not in the ontology still produces a `Context Mapping Integrity` failure (the exemption is only for `@`-terms).
- [x] **2.4** Test: a context block mapping a term to an IRI that is in the ontology produces no failure.

## STEP 3: Exempt mappings whose target is a JSON-LD keyword (green)

- [x] **3.1** Add a named helper that treats a mapping target as a JSON-LD keyword when it is a string starting with `@`.
- [x] **3.2** Skip those targets in `auditContextMappings` (do not require them to exist in the ontology).
- [x] **3.3** Skip those targets in `auditSchemaMappings` when resolving a schema property through the context to an ontology IRI.
- [x] **3.4** Do not add those targets to the live-IRI set used by dead-code detection.
- [x] **3.5** Confirm the tests from STEP 2 pass.

## STEP 4: Document keyword aliases in generated spec docs

- [x] **4.1** In `parseContextMetadata` (`scripts/generate-spec-docs.mjs`), detect mappings whose value is a JSON-LD keyword. Do not look them up in the ontology dictionary. Attach the description `JSON-LD keyword alias for @type` (or `@id`, etc.).
- [x] **4.2** Keep the existing term rendering so the context HTML reads `type - JSON-LD keyword alias for @type`.
- [x] **4.3** Unit test `parseContextMetadata`: inline context JSON with `type`/`id` aliases plus a normal term; aliases get the keyword-alias description and are not treated as missing ontology terms; the normal term still resolves from the dictionary.
- [x] **4.4** Unit test generated context HTML contains `JSON-LD keyword alias for @type` and `JSON-LD keyword alias for @id`.

## STEP 5: Full suite

- [x] **5.1** Run `npm test` from the project root (clean, rebuild, integrity, i18n, Jest, Playwright).
- [x] **5.2** Fix any remaining failures caused by the aliases.
