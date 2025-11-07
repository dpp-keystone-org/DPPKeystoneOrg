# Governance Model for the DPP Harmonizing Data Dictionary

This document outlines the governance framework for the maintenance,
evolution, and versioning of the DPP Harmonizing Data Dictionary (the
"Keystone" project). Our goal is to ensure stability, transparency, and
interoperability while remaining responsive to regulatory changes and industry
needs.

## 1. Guiding Principles

### Stability
Data definitions used in regulatory contexts must be stable. Once published,
definitions (URIs) must be persistent and their meaning must not change within
a major version.

### Interoperability
The primary goal is to harmonize existing standards. We prioritize the reuse and
mapping of established vocabularies (e.g., GS1, Schema.org, ISO) over creating
new terms.

### Transparency
All changes and decision-making processes are conducted openly via the GitHub
repository.

### Modularity
The dictionary is structured modularly (Core vs. Sectors) to allow
sector-specific evolution without disrupting the horizontal foundation.

## 2. Stakeholders and Roles

### Maintainers
A core group responsible for the day-to-day management of the repository,
reviewing Pull Requests, ensuring technical soundness (validation of
JSON-LD, RDFS/OWL), and managing releases.

### Contributors
Any individual or organization submitting changes, proposing new terms, or
participating in discussions (See `CONTRIBUTING.md`).

### Domain Experts / Working Groups
Sector-specific groups (e.g., Battery experts, Textile industry representatives)
that provide the necessary expertise for defining and validating sector-specific
ontologies.

### Advisory Board (Future Consideration)
A potential oversight body composed of representatives from the European
Commission, Standardization Bodies (SDOs), and key industry alliances to ensure
alignment with regulatory intent.

## 3. Decision-Making Process

### Minor Changes (Patches/Bug Fixes)
Fixes for typos, clarification of comments (`rdfs:comment`), or corrections to
erroneous mappings that do not change the semantic meaning of a term.

*   **Process:** Submitted via Pull Request (PR). Approved by at least one Maintainer.

### Semantic Enhancements (Minor Versions)
Addition of new terms, new classes, or new equivalency mappings. These changes
must be backward-compatible.

*   **Process:** Submitted via PR, often stemming from an Issue discussion.
    Requires review and approval by Maintainers and relevant Domain Experts. A
    review period of 14 days is recommended to allow community feedback.

### Breaking Changes (Major Versions)
Changes that alter the meaning of existing terms, remove terms, or significantly
restructure the ontology. These are strongly discouraged and only undertaken
when absolutely necessary (e.g., major regulatory overhaul).

*   **Process:** Requires extensive discussion via a formal Request for
    Comments (RFC) process (using GitHub Issues/Discussions). Requires
    consensus among Maintainers and approval from the Advisory Board (if
    established).

## 4. Versioning and Releases

We adhere to Semantic Versioning (SemVer) principles (MAJOR.MINOR.PATCH).

### Major Versions (e.g., v1.0.0 -> v2.0.0)

*   Indicate breaking changes.
*   A new directory structure will be created (e.g., `ontology/v2/`).
*   Previous major versions will be maintained and remain accessible indefinitely.

### Minor Versions (e.g., v1.0.0 -> v1.1.0)

*   Indicate backward-compatible additions of new terms or mappings.
*   DPPs created with v1.0.0 will remain valid under v1.1.0.

### Patches (e.g., v1.0.0 -> v1.0.1)

*   Indicate non-semantic fixes or documentation updates.

### Release Cycle
Releases will be tagged in the Git repository. We aim for a quarterly release
cycle for Minor Versions, while Patches may be released as needed.

## 5. Persistence and URIs

The stability of the namespace (`https://dpp-keystone.org/spec/v1/terms#`) is paramount.

*   URIs are intended to be persistent identifiers.
*   The repository infrastructure must ensure that these URIs resolve correctly to the definitions (potentially using content negotiation in the future).

## 6. Deprecation Policy

Terms may occasionally need to be deprecated (e.g., replaced by a more precise
term).

*   Deprecated terms will be marked using `owl:deprecated true` in the ontology file.
*   The term will remain in the ontology to ensure existing DPPs do not break.
*   The `rdfs:comment` will indicate the reason for deprecation and point to the replacement term (if any).
*   Deprecated terms may be removed only in a new Major Version release.
