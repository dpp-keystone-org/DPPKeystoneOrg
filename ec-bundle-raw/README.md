# Unmodified Official EC Battery DPP Bundle (`ec-bundle-raw/`)

This directory contains the **unmodified** official European Commission (EC) v1.0.0 Digital Product Passport (DPP) semantic assets (`ec-semantics/`) and OpenAPI 3.1 service specifications (`ec-openapi/`) for batteries, as published by the EC (verified unchanged as of October 30, 2026).

## Purpose
* Serves as the offline reference bundle for `api.dpp-keystone.org` when callers request `target: "raw"` on `POST /validate` or `POST /adapt`.
* Paired with the patched bundle in [`../ec-bundle/`](../ec-bundle/), which fixes the W3C JSON-LD 1.1, JSON Schema Draft 2020-12, SHACL, and OpenAPI bugs present in this official release.
* Guarded by automated integration tests in `testing/integration/api/` so that if this directory is updated to a newer EC release, tests will fail if the API or Keystone → EC adapter requires corresponding updates.

**Do not edit files inside `ec-semantics/` or `ec-openapi/` manually.** Replace them only when syncing a new official release from the European Commission.
