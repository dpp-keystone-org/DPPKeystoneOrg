# Design Documents

This directory contains design documents for features and changes in the DPP Keystone project.

## Guidelines for AI Agents and Developers

To ensure a productive, context-efficient, and hands-on collaboration between human developers and AI sessions, please adhere to the following rules when working with design documents:

1. **Use Design Docs over Internal Plans:**
   - Sessions should **not** rely on their internal "implementation plans".
   - Instead, write explicit design documents here in this directory.
   - This enables hands-on collaboration with the developer and allows a new session to easily pick up where an old one left off (e.g., in case of interruptions or when context windows become unmanageable).

2. **Highly Structured TODO Lists:**
   - Design docs do not need extensive conceptual descriptions.
   - They should be structured as highly detailed **TODO lists**.
   - At each `Step`, pause and work with the session/human to break it down into very small, individual sub-steps that both agree on.
   - These small steps must completely describe the process of implementing the step.
   - This ultra-detailed checklist approach is crucial because it allows the agent to safely delegate tasks to sub-agents (who operate with less overall context).

3. **Naming Conventions:**
   - New design documents should start with the date in `YYYY-MM-DD` format followed by a descriptive name. This helps with sorting and recognizing recent/in-progress work.
   - Example: `YYYY-MM-DD-descriptive-name.md`

4. **Completion:**
   - When all steps in a design document are complete, rename the file by appending `-COMPLETED` to the filename.
   - Example: `YYYY-MM-DD-descriptive-name-COMPLETED.md`

5. **Reference Examples:**
   - For an example of a well-structured, complex change, read the first few hundred lines of `2026-06-08-internationalization-COMPLETED.md` or `2026-05-12-textile-espr-update-COMPLETED.md`.
   - **Note to AI Agents:** Try to read only a snippet (a few hundred lines) of these examples to conserve your context window.
