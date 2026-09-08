# DPP Keystone API

This directory contains the stateless, zero-external-framework Node.js API service for DPP Keystone.
The API enables external platforms and supply chain stakeholders to use Keystone's core capabilities "as-a-service" without needing to implement the semantic stack or parse the raw ontologies themselves.

## Endpoints

### 1. `POST /v1/render/html` & `POST /{version}/render/html`
Validates a DPP JSON payload and generates a complete HTML product page if valid.
- `/v1/render/html` (Canonical): Uses the latest active Keystone specification release.
- `/{version}/render/html`: Pinned to a specific specification release (e.g., `/v2/render/html`).

**Request Body Example:**
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

**Responses:**
- `200 OK`: Validation Passed, HTML Rendered. Returns the complete standalone HTML document.
- `422 Unprocessable Content`: Schema or Ontology Validation Failed. Returns a structured JSON validation error report.
- `400 Bad Request`: Malformed Request or Syntax Error (e.g., missing 'dpp' payload, exceeds 1MB limit).
- `405 Method Not Allowed`: Used wrong HTTP method.

### 2. `GET /health` & `GET /v1/version`
Lightweight health and version probe for Cloud Run and monitoring.

**Response (`200 OK`):**
```json
{
  "status": "ok",
  "version": "v3",
  "uptime": 123.45,
  "timestamp": "2026-08-18T12:00:00Z"
}
```

## Architecture Details
- **Stateless:** The API handles logic exclusively in-memory, requiring no database or external storage.
- **Zero External Framework Dependencies:** It uses Node.js native `node:http` to ensure zero dependency drift, no framework CVEs, minimal memory footprint, and instant cold starts.
- **Validation Gate:** Every HTML render request first passes through a strict structural (JSON Schema) and semantic (Ontology) validation gate.

For deeper architectural details, please review the design document: `designs/2026-08-18-dpp-keystone-api.md`.
