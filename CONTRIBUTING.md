# Contributing to the DPP Harmonizing Data Dictionary

We welcome contributions from industry experts, standardization bodies (SDOs),
developers, and data modelers. This project aims to build a truly interoperable
foundation for the Digital Product Passport (DPP), and collaboration is key to
its success.

## Code of Conduct

This project adheres to a standard [Code of Conduct](LINK_TO_CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. (Note: A separate Code of Conduct file should be added, e.g., Contributor Covenant).

## How You Can Contribute

There are several ways to contribute:

1.  **Reporting Issues:** Use the GitHub Issue Tracker to report bugs, suggest enhancements, or ask questions about the data models.
2.  **Proposing New Terms:** If a required DPP attribute is missing from the dictionary, propose its addition.
3.  **Defining Equivalencies:** Help identify and map semantic equivalencies between the core dictionary and external standards (e.g., ISO, IEC, specific industry vocabularies).
4.  **Sector Expansion:** Contribute expertise to develop or refine sector-specific ontologies (e.g., Automotive, Chemicals).
5.  **Improving Documentation:** Enhance the `docs/` or examples to clarify the usage of the dictionary.

## Contribution Workflow (Pull Requests)

We use a standard GitHub Flow for contributions:

1.  **Fork the repository** to your own GitHub account.
2.  **Clone your fork** locally.
3.  **Create a new branch** for your changes (e.g., `feature/add-term-xyz` or `fix/context-mapping-error`).
4.  **Make your changes.** Ensure you adhere to the Style and Definition Guidelines below.
5.  **Commit your changes** with a clear and descriptive commit message.
6.  **Push the branch** to your fork.
7.  **Open a Pull Request (PR)** against the `main` branch of this repository.
    *   Clearly describe the purpose of the PR.
    *   Reference any related issues (e.g., "Closes #123").
    *   Ensure all automated checks (CI/CD validation) pass.

## Style and Definition Guidelines

To maintain consistency and semantic rigor, please adhere to the following
guidelines:

### 1. Directory Structure

All source files are located in the `src/` directory. **Please make all edits here.** The build process will automatically clean these files and place them in the correct location for deployment.

*   **Ontology Definitions (`src/ontology/`):** The semantic source of truth. Contains core and sector-specific definitions.
*   **Context Files (`src/contexts/`):** The implementation vocabularies that map ontology terms to developer-friendly JSON keys.
*   **Validation Artifacts (`src/validation/`):** Contains the JSON Schema and SHACL shape files for data validation.
*   **Examples (`src/examples/`):** Example DPP JSON-LD documents.

### 2. JSON-LD and Ontology Standards

*   We use JSON-LD as the primary serialization format.
*   The definitions utilize RDFS (Resource Description Framework Schema) and OWL (Web Ontology Language) for semantic modeling.
*   All definitions must be machine-readable and valid JSON-LD.

### 3. Naming Conventions

*   **Namespaces:** All core terms must use the `https://dpp-keystone.org/spec/v1/terms#` namespace.
*   **Classes:** Use `UpperCamelCase` (e.g., `dppk:DigitalProductPassport`).
*   **Properties:** Use `lowerCamelCase` (e.g., `dppk:organizationName`),
    *except* for the normative DPP Header fields which use `PascalCase` (e.g.,
    `dppk:DPPID`) for alignment with the minimalist schema.

### 4. Defining New Terms

When proposing a new term (Property or Class):

1.  **Check for Existing Terms:** First, verify if the concept already exists in the core dictionary or in widely adopted external standards (Schema.org, GS1 Web Vocabulary).
2.  **Prefer Reuse and Mapping:** If the concept exists externally, prioritize mapping it using `owl:equivalentProperty` or `owl:equivalentClass`.
3.  **Provide Clear Definitions:** If a new `jtc24` term is necessary, provide:
    *   A clear `rdfs:label` (human-readable name).
    *   A precise `rdfs:comment` (definition).
    *   Appropriate `rdfs:domain` (which Class the property applies to) and `rdfs:range` (the expected value type, e.g., `xsd:string`, `xsd:dateTime`, or another Class).
    *   An `rdfs:term_status` of `"unstable"` for all new terms. The status will be updated to `"stable"` through the governance process.
4.  **Specify Property Type:** Define whether it is an `owl:DatatypeProperty` (links to a literal value) or an `owl:ObjectProperty` (links to another resource/object).

## Getting Help

If you have questions about the modeling approach or the contribution process,
please open an issue or start a discussion in the GitHub Discussions tab.

Thank you for contributing to a harmonized DPP ecosystem!
