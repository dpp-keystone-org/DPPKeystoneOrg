# AI Translation Workflow & Machine-Consensus

This project requires all terminology and UI elements to be translated into 24 languages. Due to the high risk of context corruption and "wobble" (arbitrary cyclical changes), we employ a strict multi-agent machine-consensus process for translations. 

## Process Overview

1. **Scope Definition:** The user and the root session determine which files or terms need translation. If the work involves more than 10 terms, it MUST be split among multiple worker sessions. A single worker cannot safely process more than a few hundred lines of JSON-LD output without risk of corruption.

2. **Worker Dispatch:** 
   The root session creates a prompt for each worker. The prompt must:
   * Instruct the worker to read the project's README files for context.
   * Provide the exact scope (specific terms or specific files) assigned to that worker.
   * Remind the worker to return to the parent with a precise summary of exactly what terms/files it translated.
   * **CRITICAL:** Instruct the worker to avoid running shell commands and to use built-ins only. Relying on shell commands forces the end-user to manually approve actions across multiple workers, which is cumbersome and error-prone.

3. **Execution & Wait:** The root session kicks off the translation workers and waits for them to return.

4. **Auditor Dispatch:** 
   As soon as a translation worker finishes and reports back, the root session kicks off an **Auditor worker** for the exact same file/terms. 
   The auditor prompt must:
   * Instruct the auditor to review the translations for the assigned scope.
   * Instruct it to fix clear errors or sub-optimal translations.
   * Warn it to avoid "wobble" (making arbitrary stylistic changes that the next auditor might revert).
   * Instruct it to return to the parent detailing exactly what problems it found and how it corrected them, or state if it was perfect.

5. **Consensus Loop:** 
   * If the Auditor reports that everything was **perfect** (no changes made), that chunk of work is complete.
   * If the Auditor reports **problems/improvements**, the root session MUST kick off **another Auditor** for the exact same scope with the exact same prompt.
   * This loop continues until an auditor returns saying the translations are perfect. *(Note: There have been cases where up to 10 consecutive runs were required to reach consensus on complex terms).*
