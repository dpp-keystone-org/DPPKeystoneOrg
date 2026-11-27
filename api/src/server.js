import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { KEYSTONE_VERSION, KNOWN_VERSIONS } from '../../src/lib/keystone-version.js';
import { validateDppPayload } from './lib/dpp-validator-service.js';
import { generateDppHtml } from './lib/html-generator-server.js';
import { validateEcDppPayload, getEcEngineMetadata } from './lib/ec-validator-service.js';
import { adaptKeystoneToEcBattery } from './lib/ec-battery-adapter-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OPENAPI_SPEC_PATH = path.resolve(__dirname, '../../src/api/openapi.yml');

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB payload limit
const MAX_JSON_DEPTH = 32;
const MAX_JSON_ENTRIES = 15_000;

/**
 * Iteratively enforces maximum nesting depth and total container entry count
 * (object keys + array items) on a parsed JSON payload without recursion.
 */
function assertJsonComplexity(root) {
    if (root === null || typeof root !== 'object') {
        return;
    }

    let totalEntries = 0;
    const stack = [{ node: root, depth: 1 }];

    while (stack.length > 0) {
        const { node, depth } = stack.pop();
        if (depth > MAX_JSON_DEPTH) {
            const err = new Error(`Payload Too Complex: JSON nesting depth exceeds maximum limit of ${MAX_JSON_DEPTH}.`);
            err.statusCode = 413;
            err.code = 'PAYLOAD_TOO_COMPLEX';
            throw err;
        }

        if (Array.isArray(node)) {
            totalEntries += node.length;
            if (totalEntries > MAX_JSON_ENTRIES) {
                const err = new Error(`Payload Too Complex: JSON container entries exceed maximum limit of ${MAX_JSON_ENTRIES}.`);
                err.statusCode = 413;
                err.code = 'PAYLOAD_TOO_COMPLEX';
                throw err;
            }
            for (let i = 0; i < node.length; i++) {
                const item = node[i];
                if (item !== null && typeof item === 'object') {
                    stack.push({ node: item, depth: depth + 1 });
                }
            }
        } else {
            const keys = Object.keys(node);
            totalEntries += keys.length;
            if (totalEntries > MAX_JSON_ENTRIES) {
                const err = new Error(`Payload Too Complex: JSON container entries exceed maximum limit of ${MAX_JSON_ENTRIES}.`);
                err.statusCode = 413;
                err.code = 'PAYLOAD_TOO_COMPLEX';
                throw err;
            }
            for (let i = 0; i < keys.length; i++) {
                const val = node[keys[i]];
                if (val !== null && typeof val === 'object') {
                    stack.push({ node: val, depth: depth + 1 });
                }
            }
        }
    }
}

/**
 * Helper to write a JSON response with CORS headers.
 */
function sendJson(res, statusCode, data, extraHeaders = {}) {
    const jsonStr = JSON.stringify(data, null, 2);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
        ...extraHeaders
    });
    res.end(jsonStr);
}

/**
 * Helper to read and parse the JSON request body with a size guard.
 */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        let receivedBytes = 0;
        let isTooLarge = false;

        req.on('data', chunk => {
            if (isTooLarge) return;
            receivedBytes += chunk.length;
            if (receivedBytes > MAX_PAYLOAD_BYTES) {
                isTooLarge = true;
                const err = new Error('Payload Too Large: Maximum allowed size is 1MB.');
                err.statusCode = 413;
                err.code = 'PAYLOAD_TOO_LARGE';
                reject(err);
                return;
            }
            body += chunk;
        });

        req.on('end', () => {
            if (isTooLarge) return;
            if (!body.trim()) {
                resolve({});
                return;
            }
            try {
                const parsed = JSON.parse(body);
                assertJsonComplexity(parsed);
                resolve(parsed);
            } catch (e) {
                if (e && e.statusCode) {
                    reject(e);
                    return;
                }
                const err = new Error('Malformed JSON body: ' + e.message);
                err.statusCode = 400;
                err.code = 'INVALID_JSON';
                reject(err);
            }
        });

        req.on('error', err => {
            if (!isTooLarge) reject(err);
        });
    });
}

/**
 * Creates and returns the configured native HTTP server.
 * @returns {http.Server}
 */
export function createServer() {
    return http.createServer(async (req, res) => {
        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        const method = req.method.toUpperCase();

        // 1. Universal CORS Preflight Handling
        if (method === 'OPTIONS') {
            res.writeHead(204, {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
                'Access-Control-Max-Age': '86400'
            });
            res.end();
            return;
        }

        try {
            // 2. Health Probe
            if (pathname === '/health' && method === 'GET') {
                sendJson(res, 200, {
                    status: 'ok',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // 3. Version Probe (GET /version or GET /v3/version, /v1/version, etc.)
            const versionProbeMatch = pathname.match(/^\/(?:(v\d+)\/)?version$/);
            if (versionProbeMatch && method === 'GET') {
                const requestedVersion = versionProbeMatch[1] || KEYSTONE_VERSION;
                if (!KNOWN_VERSIONS.includes(requestedVersion)) {
                    sendJson(res, 400, {
                        error: `Invalid or unsupported specification version: '${requestedVersion}'. Allowed versions: ${KNOWN_VERSIONS.join(', ')}.`,
                        code: 'INVALID_VERSION'
                    });
                    return;
                }
                sendJson(res, 200, {
                    status: 'ok',
                    version: requestedVersion,
                    activeVersion: KEYSTONE_VERSION,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // 4. OpenAPI 3.1 Specification (GET /openapi.yml)
            if (pathname === '/openapi.yml' && method === 'GET') {
                const yamlContent = await fs.readFile(OPENAPI_SPEC_PATH, 'utf-8');
                res.writeHead(200, {
                    'Content-Type': 'application/yaml; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization'
                });
                res.end(yamlContent);
                return;
            }

            // 5. EC Specifications Discovery (GET /specifications or GET /v1/specifications)
            if ((pathname === '/specifications' || pathname === '/v1/specifications') && method === 'GET') {
                const target = url.searchParams.get('target') || 'patched';
                if (!['patched', 'raw'].includes(target)) {
                    sendJson(res, 400, {
                        error: `Invalid target '${target}'. Allowed values: 'patched', 'raw'.`,
                        code: 'INVALID_TARGET'
                    });
                    return;
                }
                const metadata = await getEcEngineMetadata(target);
                sendJson(res, 200, metadata);
                return;
            }

            // 5. EC Battery Validation (POST /validate or POST /v1/validate)
            if (pathname === '/validate' || pathname === '/v1/validate') {
                if (method !== 'POST') {
                    sendJson(res, 405, {
                        error: `Method ${method} Not Allowed`,
                        code: 'METHOD_NOT_ALLOWED'
                    }, { 'Allow': 'POST, OPTIONS' });
                    return;
                }

                const body = await readJsonBody(req);
                const isWrapped = body && typeof body === 'object' && !Array.isArray(body) && body.dpp && typeof body.dpp === 'object';
                const dppPayload = isWrapped ? body.dpp : body;
                const bodyOptions = (isWrapped && body.options && typeof body.options === 'object') ? body.options : {};

                if (!dppPayload || typeof dppPayload !== 'object' || Array.isArray(dppPayload) || Object.keys(dppPayload).length === 0) {
                    sendJson(res, 400, {
                        error: "Invalid request: Provide a DPP JSON object (either directly or wrapped in { 'dpp': { ... }, 'options': { ... } }).",
                        code: 'INVALID_REQUEST'
                    });
                    return;
                }

                const target = bodyOptions.target || url.searchParams.get('target') || 'patched';
                const mode = bodyOptions.mode || url.searchParams.get('mode') || 'strict';
                const subgroup = bodyOptions.subgroup || url.searchParams.get('subgroup') || undefined;
                const tiersParam = url.searchParams.get('tiers');
                const tiers = bodyOptions.tiers || (tiersParam ? tiersParam.split(',').map(s => s.trim()).filter(Boolean) : undefined);
                const requiredSpecs = bodyOptions.requiredSpecs || url.searchParams.getAll('requireSpecificationId');

                const result = await validateEcDppPayload(dppPayload, {
                    target,
                    mode,
                    subgroup,
                    tiers,
                    requiredSpecs
                });

                sendJson(res, result.valid ? 200 : 422, result);
                return;
            }

            // 6. Keystone -> EC Battery Adaptation (POST /adapt or POST /v1/adapt)
            if (pathname === '/adapt' || pathname === '/v1/adapt') {
                if (method !== 'POST') {
                    sendJson(res, 405, {
                        error: `Method ${method} Not Allowed`,
                        code: 'METHOD_NOT_ALLOWED'
                    }, { 'Allow': 'POST, OPTIONS' });
                    return;
                }

                const body = await readJsonBody(req);
                const isWrapped = body && typeof body === 'object' && !Array.isArray(body) && body.dpp && typeof body.dpp === 'object';
                const dppPayload = isWrapped ? body.dpp : body;
                const bodyOptions = (isWrapped && body.options && typeof body.options === 'object') ? body.options : {};

                if (!dppPayload || typeof dppPayload !== 'object' || Array.isArray(dppPayload) || Object.keys(dppPayload).length === 0) {
                    sendJson(res, 400, {
                        error: "Invalid request: Provide a Keystone Battery DPP JSON object (either directly or wrapped in { 'dpp': { ... }, 'options': { ... } }).",
                        code: 'INVALID_REQUEST'
                    });
                    return;
                }

                const target = bodyOptions.target || url.searchParams.get('target') || 'patched';
                const subgroup = bodyOptions.subgroup || url.searchParams.get('subgroup') || undefined;
                const sourceVersion = bodyOptions.sourceVersion || url.searchParams.get('sourceVersion') || undefined;
                const shouldValidate = bodyOptions.validate === true || url.searchParams.get('validate') === 'true';
                const validationMode = bodyOptions.mode || url.searchParams.get('mode') || 'strict';

                const adaptedResult = await adaptKeystoneToEcBattery(dppPayload, {
                    target,
                    subgroup,
                    sourceVersion
                });

                if (shouldValidate) {
                    adaptedResult.validation = await validateEcDppPayload(adaptedResult.adaptedDpp, {
                        target,
                        mode: validationMode,
                        subgroup: adaptedResult.subgroup
                    });
                }

                sendJson(res, 200, adaptedResult);
                return;
            }

            // 7. Render HTML (POST /render/html or POST /v3/render/html, /v2/render/html, etc.)
            const renderHtmlMatch = pathname.match(/^\/(?:(v\d+)\/)?render\/html$/);
            if (renderHtmlMatch) {
                if (method !== 'POST') {
                    sendJson(res, 405, {
                        error: `Method ${method} Not Allowed`,
                        code: 'METHOD_NOT_ALLOWED'
                    }, { 'Allow': 'POST, OPTIONS' });
                    return;
                }

                const targetVersion = renderHtmlMatch[1] || KEYSTONE_VERSION;
                if (!KNOWN_VERSIONS.includes(targetVersion)) {
                    sendJson(res, 400, {
                        error: `Invalid or unsupported specification version in URL: '${targetVersion}'. Allowed versions: ${KNOWN_VERSIONS.join(', ')}.`,
                        code: 'INVALID_VERSION'
                    });
                    return;
                }

                const body = await readJsonBody(req);

                if (!body.dpp || typeof body.dpp !== 'object') {
                    sendJson(res, 400, {
                        error: "Invalid request: Missing 'dpp' payload object.",
                        code: 'INVALID_REQUEST'
                    });
                    return;
                }

                if (body.options && body.options.version && !KNOWN_VERSIONS.includes(body.options.version)) {
                    sendJson(res, 400, {
                        error: `Invalid or unsupported specification version in options: '${body.options.version}'. Allowed versions: ${KNOWN_VERSIONS.join(', ')}.`,
                        code: 'INVALID_VERSION'
                    });
                    return;
                }

                const renderOptions = {
                    version: targetVersion,
                    ...(body.options || {})
                };

                // Step A: Validate the DPP payload first for the target version
                const validationResult = await validateDppPayload(body.dpp, renderOptions);

                if (!validationResult.valid) {
                    sendJson(res, 422, {
                        error: 'DPP validation failed',
                        code: 'VALIDATION_FAILED',
                        errors: validationResult.errors || []
                    });
                    return;
                }

                // Step B: Generate HTML for valid DPP
                const html = await generateDppHtml(body.dpp, renderOptions);

                // Step C: Send HTML Response with Security Headers
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline';",
                    'X-Content-Type-Options': 'nosniff'
                });
                res.end(html);
                return;
            }

            // 5. Fallthrough: Route Not Found
            sendJson(res, 404, {
                error: `Route '${pathname}' not found.`,
                code: 'NOT_FOUND'
            });

        } catch (err) {
            const statusCode = err.statusCode || 500;
            sendJson(res, statusCode, {
                error: err.message || 'Internal Server Error',
                code: err.code || 'INTERNAL_ERROR'
            });
        }
    });
}

// Start server if executed directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const port = parseInt(process.env.PORT || '8080', 10);
    const server = createServer();
    server.listen(port, '0.0.0.0', () => {
        console.log(`[DPP Keystone API] Listening on http://0.0.0.0:${port} (version: ${KEYSTONE_VERSION})`);
    });
}
