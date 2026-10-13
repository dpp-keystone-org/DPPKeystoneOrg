# Context Files (`src/contexts/`)

This directory contains the JSON-LD `@context` files that act as the bridge between the rigorous, namespaced ontology definitions and the simple, developer-friendly JSON payloads used by applications.

They map compact URIs (like `dppk:mtcYieldStrength`) to standard JSON keys (like `"yieldStrength"`).

## Key Design Patterns & Rules

When adding or modifying context files, you must adhere to the following conventions:

### 1. Scoped Contexts (Heavy Usage)
To keep JSON payloads clean and prevent term collisions across different domains, we heavily utilize **scoped contexts** (nested `@context` blocks). 
*   **Rule:** Nested objects should always use a scoped context to map generic keys to specific terms. 
*   **Example:** In the `mtc` context, the generic key `"nominalSize"` is mapped to `dppk:mtcNominalSize`, but *only* when it appears inside the `mtc` parent object. This allows different sectors to use the key `"nominalSize"` without conflicting with the Material Test Certificate's specific definition.

### 2. Dependency Management (The New Pattern)
*   **Legacy Pattern:** Older context files (like `dpp-iron-steel.context.jsonld`) use an array at the root to import dependencies like `dpp-core`.
*   **New Pattern (Closed Domains):** Newer context files (like `dpp-mtc.context.jsonld`) should strive to be closed and self-contained. Rather than importing a massive dependency tree at the root, rely on scoped contexts to avoid collisions. The associated ontology file should handle its own `owl:imports`.

### 3. Type Coercion & Containers
The context file is responsible for telling the JSON-LD parser how to interpret raw JSON values. You must specify types and containers where appropriate:
*   **Data Types:** Use `"@type": "xsd:double"`, `"xsd:date"`, etc., for numeric and date fields so they parse correctly.
*   **Object References:** Use `"@type": "@id"` for fields that contain URIs linking to other objects (e.g., `sourceDocument`).
*   **Arrays/Sets:** Use `"@container": "@set"` for properties that should always be treated as arrays of items (e.g., `substancesOfConcern`).

### 4. Version Placeholders
You will notice the `{{VERSION}}` placeholder in the `@id` and URL strings. **Leave these as-is.** The build scripts automatically replace these placeholders with the current `KEYSTONE_VERSION` during compilation.
