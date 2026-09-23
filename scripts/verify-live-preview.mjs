/**
 * @file verify-live-preview.mjs
 * @description Manually-invoked live integration test script that targets the deployed website
 * (preview branch or main) over the real public internet (HTTPS).
 * 
 * Verifies:
 * 1. Live HTTP 200 resolution of all contexts, ontologies, and schemas.
 * 2. Live HTTP dereferencing of all vocabulary term namespaces (meta-refresh redirects).
 * 3. Live end-to-end JSON-LD expansion over real network HTTP (no local file intercepts).
 * 4. Live SHACL validation of expanded example DPPs against deployed SHACL shapes.
 * 
 * Usage:
 *   node scripts/verify-live-preview.mjs                # Uses current git branch
 *   node scripts/verify-live-preview.mjs main           # Validates live production (main)
 *   node scripts/verify-live-preview.mjs feature/foo    # Validates specific preview branch
 *   npm run test:live-preview
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import jsonld from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import { KEYSTONE_VERSION, rewriteSpecUrls } from '../src/lib/keystone-version.js';
import { getPreviewBranch } from './branch-helper.mjs';
import { toRdfDataset } from '../testing/scripts/shacl-helpers.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// 1. Determine target branch and base URLs
let targetBranch = process.argv[2] !== undefined
    ? process.argv[2]
    : (process.env.PREVIEW_BRANCH !== undefined ? process.env.PREVIEW_BRANCH : getPreviewBranch());

const isProduction = !targetBranch || targetBranch === 'main' || targetBranch === 'master';
const previewChunk = isProduction ? '' : (targetBranch.startsWith('/preview/') ? targetBranch : `/preview/${targetBranch}`);
const siteDomain = 'https://dpp-keystone.org';
const baseSpecUrl = `${siteDomain}${previewChunk}/spec/`;

console.log('='.repeat(75));
console.log('🌐 DPP Keystone Live Website Verification');
console.log(`Environment: ${isProduction ? 'PRODUCTION (main)' : `PREVIEW BRANCH (${targetBranch})`}`);
console.log(`Base Spec:   ${baseSpecUrl}`);
console.log(`Version:     ${KEYSTONE_VERSION}`);
console.log('='.repeat(75));

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function reportPass(message) {
    totalChecks++;
    passedChecks++;
    console.log(`  ✅ [PASS] ${message}`);
}

function reportFail(message, details = '') {
    totalChecks++;
    failedChecks++;
    console.error(`  ❌ [FAIL] ${message}`);
    if (details) {
        console.error(`       Detail: ${details}`);
    }
}

/**
 * Fetch a URL with a timeout and user-agent.
 */
async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
            headers: {
                'User-Agent': 'DPP-Keystone-Live-Verifier/1.0',
                ...(options.headers || {})
            }
        });
        return response;
    } finally {
        clearTimeout(timer);
    }
}

// =============================================================================
// Step 1: Live HTTP Resolution of Spec Documents
// =============================================================================
console.log('\n🔍 Step 1: Checking Live HTTP Resolution of Core Specification Files...');

const coreEndpoints = [
    `contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-general-product.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-construction.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-textile.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-electronics.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-cement.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-cement-dopc.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-iron-steel.context.jsonld`,
    `contexts/${KEYSTONE_VERSION}/dpp-epd.context.jsonld`,
    `ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`,
    `validation/${KEYSTONE_VERSION}/json-schema/dpp.schema.json`
];

for (const relPath of coreEndpoints) {
    const fullUrl = `${baseSpecUrl}${relPath}`;
    try {
        const res = await fetchWithTimeout(fullUrl, { method: 'HEAD' });
        if (res.ok) {
            reportPass(`${relPath} (HTTP ${res.status})`);
        } else {
            reportFail(`${relPath} returned HTTP ${res.status}`, fullUrl);
        }
    } catch (err) {
        reportFail(`${relPath} request failed`, `${err.message} (${fullUrl})`);
    }
}

// =============================================================================
// Step 2: Live Vocabulary Term Dereferencing & Meta-Refresh Redirects
// =============================================================================
console.log('\n🔍 Step 2: Testing Live Term Namespace Dereferencing & Redirects...');

const termNamespaces = [
    { subpath: `terms/`, desc: 'Core dppk: terms root' },
    { subpath: `terms/cement-dopc/`, desc: 'dppk-cement-dopc: terms' },
    { subpath: `terms/cement/`, desc: 'dppk-cement: terms' },
    { subpath: `terms/epd/`, desc: 'dppk-epd: terms' },
    { subpath: `terms/signature/`, desc: 'dppk-signature: terms' },
    { subpath: `terms/unit/`, desc: 'dppk-unit: terms' },
    { subpath: `terms/dopc/`, desc: 'dppk-dopc: terms' }
];

for (const ns of termNamespaces) {
    const termUrl = `${baseSpecUrl}${KEYSTONE_VERSION}/${ns.subpath}`;
    try {
        const res = await fetchWithTimeout(termUrl);
        if (!res.ok) {
            reportFail(`Namespace '${ns.desc}' returned HTTP ${res.status}`, termUrl);
            continue;
        }

        const html = await res.text();
        const refreshMatch = html.match(/content="0;\s*url=([^"]+)"/i);
        if (!refreshMatch) {
            reportFail(`Namespace '${ns.desc}' missing meta-refresh redirect`, termUrl);
            continue;
        }

        const targetRelativeUrl = refreshMatch[1];
        const targetFullUrl = targetRelativeUrl.startsWith('http')
            ? targetRelativeUrl
            : `${siteDomain}${targetRelativeUrl}`;

        // Verify the target ontology file responds with 200 OK
        const targetRes = await fetchWithTimeout(targetFullUrl, { method: 'HEAD' });
        if (targetRes.ok) {
            reportPass(`Namespace '${ns.desc}' -> ${path.basename(targetFullUrl)} (HTTP 200)`);
        } else {
            reportFail(`Namespace '${ns.desc}' redirect target failed (HTTP ${targetRes.status})`, targetFullUrl);
        }
    } catch (err) {
        reportFail(`Namespace '${ns.desc}' error`, `${err.message} (${termUrl})`);
    }
}

// =============================================================================
// Step 3: End-to-End JSON-LD Expansion Over Live Public Network
// =============================================================================
console.log('\n🔍 Step 3: Testing Live JSON-LD Network Expansion (Pure Node HTTP Loader)...');

const exampleFiles = [
    'cement-dpp-v3.json',
    'sock-dpp-v2.json',
    'drill-dpp-v1.json',
    'battery-dpp-v1.json',
    'construction-product-dpp-v1.json',
    'iron-steel-dpp-v1.json'
];

// Configure pure network document loader (NO local file intercepts)
const networkDocumentLoader = jsonld.documentLoaders.node();

const expandedExamples = new Map();

for (const exampleFileName of exampleFiles) {
    const localExamplePath = path.join(PROJECT_ROOT, 'src', 'examples', exampleFileName);
    if (!fs.existsSync(localExamplePath)) {
        continue;
    }

    try {
        const rawContent = fs.readFileSync(localExamplePath, 'utf-8');
        // Adapt example URLs to target environment
        const adaptedContent = rewriteSpecUrls(rawContent, previewChunk);
        const exampleData = JSON.parse(adaptedContent);

        // Perform pure network expansion over real HTTPS
        const expanded = await jsonld.expand(exampleData, {
            documentLoader: networkDocumentLoader
        });

        if (Array.isArray(expanded) && expanded.length > 0) {
            const quadCount = (await toRdfDataset(expanded)).size;
            expandedExamples.set(exampleFileName, { data: exampleData, expanded });
            reportPass(`Expanded '${exampleFileName}' via live HTTP (${quadCount} RDF quads)`);
        } else {
            reportFail(`Expanded '${exampleFileName}' produced empty RDF graph`);
        }
    } catch (err) {
        reportFail(`Failed to expand '${exampleFileName}' over live network`, err.message);
    }
}

// =============================================================================
// Step 4: Live SHACL Validation Against Deployed Shapes
// =============================================================================
console.log('\n🔍 Step 4: Validating Live Expanded DPPs Against Deployed SHACL Shapes...');

const sectorToShapes = [
    {
        example: 'construction-product-dpp-v1.json',
        shapesPath: `validation/${KEYSTONE_VERSION}/shacl/construction-shapes.shacl.jsonld`
    },
    {
        example: 'drill-dpp-v1.json',
        shapesPath: `validation/${KEYSTONE_VERSION}/shacl/electronics-shapes.shacl.jsonld`
    },
    {
        example: 'sock-dpp-v2.json',
        shapesPath: `validation/${KEYSTONE_VERSION}/shacl/textile-shapes.shacl.jsonld`
    },
    {
        example: 'iron-steel-dpp-v1.json',
        shapesPath: `validation/${KEYSTONE_VERSION}/shacl/iron-steel-shapes.shacl.jsonld`
    }
];

for (const { example, shapesPath } of sectorToShapes) {
    const exampleEntry = expandedExamples.get(example);
    if (!exampleEntry) continue;

    const shapesFullUrl = `${baseSpecUrl}${shapesPath}`;
    try {
        const shapesRes = await fetchWithTimeout(shapesFullUrl);
        if (!shapesRes.ok) {
            reportFail(`Could not fetch live SHACL shape ${shapesPath} (HTTP ${shapesRes.status})`);
            continue;
        }

        const shapesJson = await shapesRes.json();
        const expandedShapes = await jsonld.expand(shapesJson, {
            documentLoader: networkDocumentLoader
        });
        const shapesDataset = await toRdfDataset(expandedShapes);
        const dataDataset = await toRdfDataset(exampleEntry.expanded);

        const validator = new SHACLValidator(shapesDataset);
        const report = validator.validate(dataDataset);

        if (report.conforms) {
            reportPass(`SHACL Validation conforms for '${example}' using live shapes`);
        } else {
            const errors = report.results.map(r => r.message && r.message[0] ? r.message[0].value : 'Violation').join('; ');
            reportFail(`SHACL Validation failed for '${example}'`, errors);
        }
    } catch (err) {
        reportFail(`SHACL Validation error for '${example}'`, err.message);
    }
}

// =============================================================================
// Summary Report
// =============================================================================
console.log('\n' + '='.repeat(75));
console.log(`Live Verification Summary: ${passedChecks}/${totalChecks} checks passed`);
if (failedChecks > 0) {
    console.error(`❌ FAILED: ${failedChecks} checks failed.`);
    process.exit(1);
} else {
    console.log(`✅ SUCCESS: All live network checks passed!`);
    process.exit(0);
}
