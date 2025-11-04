# Infrastructure and Content Negotiation

This directory contains configuration examples for ensuring the persistent URIs defined in the ontology resolve correctly to the definition files hosted in this repository.

## The Goal: Resolvable URIs

We must ensure that the base namespace URI (the Identifier) redirects to the main ontology entry file (the Location).

*   **Identifier (URI):** `https://dpp-keystone.org/v1/terms`
*   **Location (URL):** `https://dpp-keystone.org/ontology/v1/dpp-ontology.jsonld`

When the Identifier URI is requested, the server should respond with an **HTTP 303 See Other** redirect to the Location URL.

## Why `owl:imports`?

This repository uses a modular structure (separate files for Header, Product, Battery, etc.) for maintainability. Instead of complex server rules to map every single term (`#DPPID`) to its specific file (`Header.jsonld`), we use the standard `owl:imports` mechanism.

The main entry file (`dpp-ontology.jsonld`) imports all the modules. Semantic software understands `owl:imports` and will automatically fetch the linked modules.

## Configuration Examples

The configuration method depends on your hosting environment. If you use GitHub Pages, you will likely need a service like Netlify or Cloudflare in front of it to manage these redirects.

### 1. Netlify

See `example_redirects` in this directory. This file should be placed in the root of your deployment directory.

### 2. Apache Server

See `example.htaccess` in this directory. This requires `mod_rewrite` to be enabled on the server.

### 3. Cloudflare

Use Cloudflare Page Rules or Workers to implement the 303 redirect from the Identifier URI to the Location URL.
