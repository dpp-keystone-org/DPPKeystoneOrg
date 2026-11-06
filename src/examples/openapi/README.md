# Reference OpenAPI 3.1 Specification: Layered DPP Validation API

[`market-surveillance-validation-api.yml`](./market-surveillance-validation-api.yml) is a reference **OpenAPI 3.1** contract designed for **Market Surveillance Authorities (MSAs)**, **Customs systems**, **Notified Bodies**, and **DPP Service Providers**.

## Why This Exists

Under ESPR (Regulation (EU) 2024/1781) and EN 18223, the central EU DPP Registry only registers identifiers (`uniqueProductIdentifier`, `digitalProductPassportId`), while full Digital Product Passports are hosted decentrally and validated on demand.

To support cross-sector products, restricted access tiers (`pub`, `res1`, `res2`, `res3`), and federated industry ontologies without creating a separate API per product group, each sector/subgroup schema and SHACL graph is **decoupled** and **conditionally self-activating**:

1. **Core Envelope (`core.schema.json` / `core-shapes.ttl`)** — Always active on every DPP payload.
2. **Sector, Subgroup, & Access-Tier Schemas (`if` / `then` & SHACL `sh:or`)** — Layered together via `allOf` inside `#/components/schemas/LayeredDigitalProductPassport`. Each schema checks whether its unique `contentSpecificationId` is present in `contentSpecificationIds`:
   - If **absent**, the schema evaluates to `true` (stays inactive) with zero interference on other sectors or subgroups.
   - If **present**, the schema enforces its data points (and subgroup schemas also require their parent base-product tier ID).
3. **Inspection Policy Enforcement (`requireSpecificationId` query parameter)** — Allows an MSA inspector or Notified Body to assert which regulatory specification IDs *must* be declared and satisfied for a given inspection context (preventing an operator from omitting `res1` or `res2` specification IDs to skip restricted-tier checks).
