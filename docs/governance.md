# Governance Model for the DPP Harmonizing Data Dictionary

This document outlines the governance framework for the maintenance, evolution, and versioning of the DPP Harmonizing Data Dictionary (the "Keystone" project).

**STATUS: DRAFT & PRE-ADOPTION**

> This document outlines the formal governance model that the project aims to adopt as it matures and gains broader community adoption. During the current, rapid pre-adoption phase, development is led by a core team in direct collaboration with standardization bodies and early partners. As such, some formal processes (e.g., review periods) may be expedited.

---

## 1. Guiding Principles

This project adheres to a set of guiding principles to ensure it remains agile, useful, and aligned with its mission.

*   **Stability:** Data definitions used in regulatory contexts must be stable. Once published, URIs must be persistent, and their semantic meaning must not change within a major version.
*   **Interoperability:** The primary goal is to harmonize existing standards. We prioritize the reuse and mapping of established vocabularies (e.g., GS1, Schema.org, ISO) over creating new terms.
*   **Transparency:** All changes and decision-making processes are conducted openly via the GitHub repository.
*   **Pragmatism:** We prioritize practical utility that helps developers implement the DPP today. An imperfect but useful mapping is often better than no mapping at all, provided its status is clearly marked.
*   **Regulatory Alignment:** The project's core artifacts must be demonstrably aligned with official EU regulations and standards that define the Digital Product Passport.

## 2. Roles and Responsibilities

*   **Maintainers:** A core group responsible for the day-to-day management of the repository, reviewing Pull Requests, ensuring technical soundness (validation, testing), and managing releases.
*   **Contributors:** Any individual or organization submitting changes or participating in discussions (See [CONTRIBUTING.md](../CONTRIBUTING.md)).
*   **Domain Experts:** Sector-specific experts who provide the necessary knowledge for defining and validating vertical ontologies and schemas.
*   **Advisory Board (Future Consideration):** A potential oversight body composed of representatives from the European Commission, SDOs, and key industry alliances to ensure alignment with regulatory intent.

## 3. The Decision-Making Process

To balance agility with stability, the process for a change depends on the artifact being modified.

### 3.1 The Core DPP Schema (`dpp.schema.json`)

*   **Policy:** This artifact is considered **foundational**. It defines the mandatory data structure that all DPPs must share.
*   **Process:** Changes are **only** permitted to reflect verified updates in official European Commission standards or delegated acts. A change proposal must be filed as a GitHub Issue that quotes or links to the specific section of the source regulation.

### 3.2 Sector-Specific Schemas (e.g., `/sectors/`, `construction.schema.json`)

*   **Policy:** These artifacts have a two-stage lifecycle tied to the EU's legal process for delegated acts.
*   **Lifecycle & Process:**
    *   **Phase 1: `Draft` Status:** While the corresponding EU Delegated Act for a sector is in development, the artifacts are considered drafts and are open to community contribution via Pull Requests.
    *   **Phase 2: `Stable` Status:** Once a Delegated Act is legally finalized, the corresponding artifacts become "stable." At this point, their governance model becomes as strict as the Core Schema's—changes are only accepted to align with official amendments to the act.

### 3.3 Ontological Mappings (e.g., `owl:equivalentProperty`)

*   **Policy:** Changes to semantic mappings must be carefully tested and applied consistently across all relevant tools within the project. New mappings require thorough test coverage.
*   **Process:** A Pull Request proposing a mapping should identify it as one of the following:
    *   **`Authoritative Mapping`:** A mapping with clear, explicit backing in public standards documentation.
    *   **`Exploratory Mapping`:** A best-effort mapping added to fill known gaps in external standards or to support a specific, real-world use case. The PR must include a justification for the mapping. These mappings should be annotated with an `rdfs:comment` to clarify their non-authoritative status.

## 4. Versioning and Releases

We adhere to Semantic Versioning (SemVer) principles (MAJOR.MINOR.PATCH).

*   **MAJOR Versions (e.g., v1.x -> v2.0):** Indicate breaking changes. A new directory structure will be created (e.g., `/v2/`). Previous versions will be maintained indefinitely.
*   **MINOR Versions (e.g., v1.0 -> v1.1):** Indicate backward-compatible additions of new terms or mappings.
*   **PATCH Versions (e.g., v1.0.0 -> v1.0.1):** Indicate non-semantic fixes or documentation updates.

## 5. Deprecation Policy

*   Terms needing replacement will be marked using `owl:deprecated true`.
*   The term will remain in the ontology for backward compatibility. The `rdfs:comment` will indicate the reason for deprecation and point to the replacement term.
*   Deprecated terms may be removed only in a new MAJOR Version release.
