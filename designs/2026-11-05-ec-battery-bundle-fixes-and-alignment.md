# Design Doc: 2026-11-05 EC Battery Semantic Bundle Fixes & Keystone Alignment

## Summary
Audit the European Commission's (EC) newly released battery semantic resource bundle alongside our previously submitted standards-body feedback and follow-up complaint, apply agreed-upon fixes directly to a working copy of the EC bundle for return delivery as a `.zip` package, and evaluate targeted tweaks or adapters in Keystone to demonstrate seamless interoperability/validation between Keystone battery DPPs and the fixed EC battery specification.

## Implementation Plan

### [ ] Step 1: Ingest & Review EC Bundle, Prior Feedback, and Keystone Battery Assets
*   Plan: Create a local-only git branch, commit the unmodified EC bundle into a root-level `ec-bundle/` directory for clean `git diff` tracking without interfering with `src/` or `docs/` build scripts, and map all artifacts against Keystone's v3 battery architecture.
*   [ ] **Step 1.1: Stage Materials on a Local Git Branch**
    *   [ ] Create a local git branch (do **not** push to GitHub) and commit the unmodified EC battery semantics bundle into `ec-bundle/` at the repository root so git tracks every fix cleanly against the original baseline.
    *   [ ] Provide the previously sent feedback summaries and the additional complaint email (e.g., in `ec-bundle/` / `docs/sensitive/` or directly in chat).
*   [ ] **Step 1.2: Inspect EC Bundle & Feedback**
    *   [ ] Inventory all files in `ec-bundle/` (ontologies, JSON-LD `@context` files, JSON Schemas, SHACL shapes, examples, documentation).
    *   [ ] Read the feedback summaries and additional complaint email to catalog every already-reported issue.
*   [ ] **Step 1.3: Cross-Reference with Keystone Battery Implementation**
    *   [ ] Compare `ec-bundle/` against Keystone's stripped battery/core ontologies (`src/ontology/v3_stripped/`), battery context (`src/contexts/`), category-specific schemas (`battery-ev`, `battery-lmv`, `battery-industrial`), and examples (`src/examples/`).
    *   [ ] Note where Keystone's patterns (scoped contexts, `component.schema.json`, `related-resource`, QUDT unit mappings, `contentSpecificationIds`, SHACL alignment) inform or refine fixes to the EC bundle.

### [ ] Step 2: Reconcile Flaw List & Detail Fix Plan
*   Plan: Align with the user on the exact scope of fixes before modifying the EC bundle, breaking Step 3 down into granular, per-issue TODO items.
*   [ ] **Step 2.1: Synthesize Complete Issue Matrix**
    *   [ ] Present a concise breakdown of: (a) flaws from the prior feedback summaries, (b) the additional email complaint, and (c) any newly spotted technical issues uncovered via comparison with Keystone.
*   [ ] **Step 2.2: User Review & Sign-Off on Fix Scope**
    *   [ ] Confirm which exact flaws to fix (and how to resolve any design trade-offs) so changes stay focused and defensible for the EC / standards body.
    *   [ ] Expand Step 3 below into small, explicit sub-steps—one per agreed fix.

### [ ] Step 3: Fix the EC Bundle, Verify, and Package `.zip` Deliverable
*   Plan: Apply the agreed fixes directly in `ec-bundle/`, review via `git diff`, verify structural and semantic validity, and prepare the return archive.
*   [ ] **Step 3.1: Apply Agreed Fixes in `ec-bundle/`**
    *   [ ] *(To be populated with granular per-flaw sub-tasks in Step 2.2.)*
*   [ ] **Step 3.2: Validate Fixed EC Bundle**
    *   [ ] Ask user to run validation checks on `ec-bundle/` (JSON/JSON-LD syntax, JSON Schema validation, JSON-LD expansion, SHACL conformance).
    *   [ ] Review `git diff` against the initial baseline commit of `ec-bundle/` to verify every change is intentional, clean, and minimal.
*   [ ] **Step 3.3: Prepare Return Package**
    *   [ ] Draft a concise summary of changes / release notes accompanying the fixed bundle (generated directly from our git commits/diff).
    *   [ ] Ask user to package `ec-bundle/` into a clean `.zip` archive (excluding any non-bundle notes) for delivery.

### [ ] Step 4: Evaluate & Implement Keystone Interoperability / Alignment Tweaks
*   Plan: Determine how Keystone can best align with or adapt to the fixed EC battery bundle so a Keystone battery DPP can either validate directly as an EC battery DPP or transform cleanly via an adapter.
*   [ ] **Step 4.1: Gap Analysis (Keystone <-> Fixed EC Bundle)**
    *   [ ] Compare Keystone's battery ontology terms (`owl:equivalentProperty` / ` owl:equivalentClass` / `skos:*Match`), JSON-LD context keys, and JSON Schema structures against the fixed EC bundle.
    *   [ ] Decide with the user between direct schema/context alignment tweaks, ontology equivalency mappings, a lightweight JS adapter utility in `src/util/`, or a combination.
*   [ ] **Step 4.2: Implement Agreed Keystone Updates**
    *   [ ] *(To be populated with granular sub-tasks once Step 4.1 decisions are made, including 24-language consensus workflow if any ontology labels/comments change, `generate-spec-docs.mjs` / `test-helpers.mjs` checks if new files/mappings are added, and activation/inactivation tests.)*
*   [ ] **Step 4.3: End-to-End Verification**
    *   [ ] Demonstrate a Keystone battery DPP example validating (directly or via adapter) against the fixed EC battery schemas/SHACL shapes.
    *   [ ] Ask user to run `npm run build` and `npm test` to confirm full Keystone suite integrity.
