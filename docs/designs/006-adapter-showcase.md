# Design Doc 006: Interactive Adapter Showcase & Documentation

This document outlines the sub-roadmap for Task #6, the creation of a rich, interactive documentation page that serves as a live demonstration and development tool for the DPP adapter.

---

- **[PENDING] 6. Interactive Adapter Showcase & Documentation:** Create a rich, interactive documentation page (`utils/index.html`) that not only explains the adapter but also serves as a live demonstration and a development tool.
  - **[PENDING] 6a. Build Interactive Showcase UI:** Develop a user interface with the following components:
    - An example selector: A dropdown menu to load any of our standard DPP examples (e.g., battery, textile, rail).
    - A profile selector: A dropdown to select the target transformation profile (`schema.org`, `gs1`, etc., as they are completed).
    - A "Transform" button to trigger the process.
  - **[PENDING] 6b. Implement Live Transformation:** Hook the UI to the actual client-side `dpp-adapter.js` script. On "Transform", the script should execute the transformation live in the browser.
  - **[PENDING] 6c. Create Code Display Panes:** Add a pane to display the raw source DPP JSON of the selected example, and a second pane to display the resulting transformed JSON-LD output, both with syntax highlighting, so developers can directly compare input and output.
  - **[PENDING] 6d. Create HTML Generation Library:** Develop and test a library function that takes a DPP JSON object and returns a rendered HTML string representation, including the embedded `schema.org` JSON-LD transformation.
  - **[PENDING] 6e. Integrate HTML Preview into the wizard:** Use the new HTML generation library to offer users of the wizard a way to preview or download their created DPP as a standalone HTML file.
  - **[PENDING] 6f. Provide "How-To" Guides and Snippets:** Below the interactive tool, write clear, developer-focused documentation explaining the adapter's API (`transform` function, parameters, profiles). Provide copy-paste-ready code snippets for common use cases, such as how to include the script and how to embed the final JSON-LD output within a `<script type="application/ld+json">` tag.
