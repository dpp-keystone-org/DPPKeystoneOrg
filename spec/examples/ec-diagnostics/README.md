# EC v1.0.0 Validator Diagnostic Payloads (SHACL vs. JSON Schema)

These two **legitimate Public Battery Digital Product Passport (DPP)** payloads are designed to:

1. **Fingerprint which validation engine** an unpatched EC v1.0.0 endpoint is running (**SHACL / JSON-LD**, **JSON Schema**, or **both**), and
2. **Provide clear, indisputable bug-report artifacts** for the EC DPP help desk showing that valid real-world Battery DPPs are rejected due to contradictions inside the published EC v1.0.0 semantic bundle.

---

## 1. The Two Diagnostic Payloads

### Payload 1 — Valid in Raw EC SHACL, Fails Raw EC JSON Schema
- **File**: [`pub-battery-valid-shacl-fails-schema.json`](./pub-battery-valid-shacl-fails-schema.json)
- **Why it is a legitimate DPP**:
  - Uses standard compact SKOS `skos:notation` codes (`"granularity": "item"`, `"dppStatus": "validStatus"`, `"batteryCategory": "industrialBattery"`, `"unit": "kilogram"`, `"batteryChemistry": ["lithiumIonLFP"]`, etc.) — matching both the EC's own Registry OpenAPI example (`granularity: item` in `openapi-dpp-registry-public.yml`) and the explicit `"@type": "@vocab"` + scoped `"@vocab"` mappings authored in `core-context.jsonld` and `batteries-context.jsonld`.
- **Raw EC v1.0.0 SHACL + JSON-LD Result**: **PASSES (0 violations)** — JSON-LD expands every compact notation to its exact SKOS Concept IRI (`.../granularity-level#item`, `.../instance-status#validStatus`, etc.), satisfying all SHACL Core and SPARQL `skos:inScheme` constraints.
- **Raw EC v1.0.0 JSON Schema Result**: **FAILS** — `core.schema.json` (`SEM-MSG-003`, `SEM-MSG-005`), `common.schema.json`, and `pub-batteries.schema.json` hardcode full-URL regex patterns (`^https://repository.product-passport.ec.europa.eu/...#`), rejecting compact notations starting right in the core header.

### Payload 2 — Valid in Raw EC JSON Schema, Fails Raw EC SHACL
- **File**: [`pub-battery-valid-schema-fails-shacl.json`](./pub-battery-valid-schema-fails-shacl.json)
- **Why it is a legitimate DPP**:
  - Uses full EC vocabulary URLs everywhere, and provides **bilingual English (`en-IE`) and German (`de-DE`)** consumer safety and waste-prevention instructions (`notInUseTemperatureRangeTest` and `wasteBatteryPreventionManagementInfo`) for a battery placed on the EU single market.
- **Raw EC v1.0.0 JSON Schema Result**: **PASSES (0 errors)** — every multilingual field references `common.schema.json#/$defs/multiLanguage`, which explicitly allows one or more `xx-YY` language keys.
- **Raw EC v1.0.0 SHACL + JSON-LD Result**: **FAILS (11 violations: `SEM-BAT-MSG-035`, `SEM-BAT-MSG-047..058`)** — `pub-batteries-shapes.ttl` mistakenly places `sh:maxCount 1` on `rdf:langString` properties, causing SHACL to reject any Battery DPP translated into more than one EU language.

---

## 2. How to Interpret Live Endpoint Results (2×2 Matrix)

| Payload 1 (`valid-shacl-fails-schema`) | Payload 2 (`valid-schema-fails-shacl`) | What the EC Endpoint Is Running | Which Artifact to Send to Help Desk |
| :--- | :--- | :--- | :--- |
| **PASS** | **FAIL** | **SHACL (JSON-LD) only** | Send **Payload 2** (bilingual `en-IE` + `de-DE` Battery DPP rejected by `sh:maxCount 1` on `rdf:langString`). |
| **FAIL** | **PASS** | **JSON Schema only** | Send **Payload 1** (compact `@vocab` notations matching `core-context.jsonld` & Registry OpenAPI rejected by full-URI regexes). |
| **FAIL** | **FAIL** | **Both JSON Schema AND SHACL** | Send **both** — Payload 2 proves multilingual EU DPPs fail SHACL even after passing JSON Schema; Payload 1 proves JSON Schema rejects the `@vocab` compact form defined in the JSON-LD contexts. |
| **PASS** | **PASS** | Either semantic validation is not yet active, or both bugs were patched | Check whether intentionally malformed fields trigger `SEM-*` codes at all. |

> **Subgroup Note**: Both payloads use `industrialBattery` with `core/1.0.0` + `product/batteries/1.0.0` (matching EC's `tests/conforms/pub-batteries.json`). If a test endpoint requires a subgroup identifier in `contentSpecificationIds`, appending `"https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0"` preserves the exact same pass/fail matrix (`pub-ind` has no additional mandatory fields), though note that raw `ind-context.jsonld` also contains a 2-hop `@import` chain (`ind` → `batteries` → `core`) that strict W3C JSON-LD 1.1 processors reject.

---

## 3. Local Programmatic Verification

To verify both payloads locally against the raw, unrepaired EC v1.0.0 bundle (`docs/sensitive/ec-bundle/ec-semantics`):

```bash
node src/examples/ec-diagnostics/verify-ec-diagnostics.mjs
```
