# Design Doc 014: Stakeholder Enhancements & Educational Features

Based on stakeholder feedback, the DPP Keystone prototype needs to better visualize and explain the value of Linked Data, automation, and security to non-technical managers and users.

## Goals
1.  **Educate on Linked Data:** Make explicit why common vocabularies (SPO) are used.
2.  **Demonstrate Security:** Show how data exchange is secured via signatures.
3.  **Highlight Automation:** Explain the machine-readable nature of the output.

## Roadmap

### 14a. Knowledge Graph Visualization Links
- **Context:** Users don't see the "graph" behind the form. Even in research projects, the importance of explicit vocabularies is often missed.
- **Requirement:** Add links in the wizard (e.g., in the Ontology column) to a Knowledge Graph visualization (e.g., WebVOWL) for specific properties.
- **Implementation Plan:**
  - Update `ontology-loader.js` to support a new metadata field (e.g., `rdfs:seeAlso` or a custom `dppk:visualizationLink`) for properties.
  - Update `form-builder.js` to render a "Graph" icon/link if this metadata exists.

### 14b. JSON vs JSON-LD Toggle & Education
- **Context:** Managers don't understand the advantage of Linked Data / JSON-LD.
- **Requirement:** In the "Generate" / "Send" step, provide a choice between "JSON" and "JSON-LD" with an explanation of the advantages (e.g., "Machine Readable", "Automated Exchange").
- **Implementation Plan:**
  - Update `dpp-generator.js` to support generating a "Plain JSON" version (stripping `@context` and potentially `@type`/`@id` for demonstration purposes).
  - Update `wizard.js` UI to include a toggle or tab system in the output section.
  - Add explanatory text/tooltips describing the benefits of the JSON-LD format (interoperability, automation).

### 14c. Mocked Digital Signature
- **Context:** Data exchange must be secure and verifiable. Sustainable data has to be verifiable (no self-declaration).
- **Requirement:** Add a "Send DPP" button (or "Finalize") that includes a mocked signature.
- **Implementation Plan:**
  - Add a "Sign & Finalize" button to the UI.
  - When clicked, append a mock `proof` or `signature` object to the generated JSON-LD.
    ```json
    "proof": {
      "type": "Ed25519Signature2020",
      "created": "2025-01-01T00:00:00Z",
      "verificationMethod": "https://example.com/issuer/keys/1",
      "proofPurpose": "assertionMethod",
      "proofValue": "..."
    }
    ```
  - Display a visual confirmation (e.g., "Signed by [Company Name]") to demonstrate the concept of Verifiable Credentials.
