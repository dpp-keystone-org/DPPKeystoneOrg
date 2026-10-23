# Utilities (`src/util`)

This directory contains standalone, reusable JavaScript modules intended for broad use-cases across both server and client environments.

## Architecture Guidelines for `src/util`

**CRITICAL RULE**: Code within `src/util` **MUST NOT** import or depend on code outside of `src/util` (e.g., it must not depend on `src/lib`, `src/wizard`, etc.).

The purpose of this directory is to house self-contained functions and packages (like the DPP HTML renderer or schema validators) that could theoretically be extracted into an independent, public `npm` package. 

By keeping these files completely decoupled from the specific implementation details of `keystone.org` (such as the server-specific ontology loading mechanics in `src/lib`), we ensure that:
1. They remain easily portable.
2. They can be safely bundled for client-side use without pulling in server-side dependencies.
3. Other developers can copy these files into their own codebases to parse, validate, or render DPPs out-of-the-box.

### Key Components

- **`js/common/rendering/dpp-html-renderer.js`**: Contains pure, self-contained functions to transform a generic JSON object into a formatted HTML string. It receives all necessary data context (like parsed ontology maps) via function arguments rather than fetching them itself.
