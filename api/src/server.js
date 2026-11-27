import crypto from 'node:crypto';
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
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const OPENAPI_SPEC_PATH = path.join(PROJECT_ROOT, 'src/api/openapi.yml');

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB payload limit
const MAX_JSON_DEPTH = 32;
const MAX_JSON_ENTRIES = 15_000;
const KEEP_ALIVE_TIMEOUT_MS = 5_000;
const HEADERS_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RATE_LIMIT_IPS = 5_000;
const SELF_HOST_DOCS_URL = 'https://github.com/dpp-keystone-org/DPPKeystoneOrg/tree/main/api';
const DANGEROUS_PROTO_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function stripDangerousJsonKeys(key, value) {
    if (DANGEROUS_PROTO_KEYS.has(key)) {
        return undefined;
    }
    return value;
}

function scrubHostPaths(message) {
    if (!message || typeof message !== 'string') {
        return 'Internal Server Error';
    }
    return message.split(PROJECT_ROOT).join('<app>');
}

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
 * Parses an optional ALLOWED_ORIGINS list (array or comma-separated string).
 * Returns `null` when wildcard `*` access should be used (the CC0 default).
 */
function parseAllowedOrigins(rawAllowed) {
    if (Array.isArray(rawAllowed)) {
        const cleaned = rawAllowed.map((o) => String(o).trim()).filter(Boolean);
        if (cleaned.length === 0 || cleaned.includes('*')) return null;
        return new Set(cleaned);
    }
    if (typeof rawAllowed === 'string' && rawAllowed.trim() && rawAllowed.trim() !== '*') {
        const cleaned = rawAllowed.split(',').map((o) => o.trim()).filter(Boolean);
        if (cleaned.length > 0 && !cleaned.includes('*')) {
            return new Set(cleaned);
        }
    }
    return null;
}

function buildCorsHeaders(req, allowedOriginsSet, includeMethods = true) {
    const headers = {};
    if (!allowedOriginsSet) {
        headers['Access-Control-Allow-Origin'] = '*';
    } else {
        headers['Vary'] = 'Origin';
        const requestOrigin = req.headers.origin;
        if (requestOrigin && allowedOriginsSet.has(requestOrigin)) {
            headers['Access-Control-Allow-Origin'] = requestOrigin;
        }
    }
    if (includeMethods) {
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'Content-Type, Accept, Authorization';
    }
    return headers;
}

/**
 * Extracts the caller IP address. When `trustProxy` is true (Google Cloud Run),
 * uses the RIGHTMOST `X-Forwarded-For` entry appended by Google's edge load balancer
 * so client-supplied leftmost `X-Forwarded-For` values cannot spoof IP identity.
 */
function resolveClientIp(req, trustProxy) {
    if (trustProxy) {
        const xff = req.headers['x-forwarded-for'];
        const rawXff = Array.isArray(xff) ? xff[xff.length - 1] : xff;
        if (typeof rawXff === 'string' && rawXff.trim()) {
            const parts = rawXff.split(',').map((s) => s.trim()).filter(Boolean);
            if (parts.length > 0) {
                return parts[parts.length - 1];
            }
        }
    }
    return req.socket?.remoteAddress || 'unknown';
}

/**
 * Helper to write a JSON response with CORS headers.
 */
function sendJson(req, res, statusCode, data, allowedOriginsSet = null, extraHeaders = {}) {
    const jsonStr = JSON.stringify(data, null, 2);
    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        ...buildCorsHeaders(req, allowedOriginsSet, true),
        ...extraHeaders
    });
    res.end(jsonStr);
}

/**
 * Checks whether a Content-Type header represents JSON or a structured +json media type
 * (e.g. `application/json`, `application/json; charset=utf-8`, `application/ld+json`).
 */
function isJsonMediaType(contentTypeHeader) {
    if (!contentTypeHeader || typeof contentTypeHeader !== 'string') {
        return false;
    }
    const mediaType = contentTypeHeader.split(';')[0].trim().toLowerCase();
    return mediaType === 'application/json' || (mediaType.startsWith('application/') && mediaType.endsWith('+json'));
}

/**
 * Helper to read and parse the JSON request body with media-type, size, and structural guards.
 */
function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        if (!isJsonMediaType(req.headers['content-type'])) {
            const err = new Error("Unsupported Media Type: Content-Type must be 'application/json' or 'application/ld+json'.");
            err.statusCode = 415;
            err.code = 'UNSUPPORTED_MEDIA_TYPE';
            reject(err);
            return;
        }

        const contentLengthHeader = req.headers['content-length'];
        if (contentLengthHeader !== undefined) {
            const declaredLength = Number(contentLengthHeader);
            if (!Number.isFinite(declaredLength) || declaredLength < 0) {
                const err = new Error('Invalid Content-Length header.');
                err.statusCode = 400;
                err.code = 'INVALID_CONTENT_LENGTH';
                reject(err);
                return;
            }
            if (declaredLength > MAX_PAYLOAD_BYTES) {
                req.pause();
                const err = new Error('Payload Too Large: Maximum allowed size is 1MB.');
                err.statusCode = 413;
                err.code = 'PAYLOAD_TOO_LARGE';
                err.closeConnection = true;
                reject(err);
                return;
            }
        }

        const chunks = [];
        let receivedBytes = 0;
        let aborted = false;

        const onData = (chunk) => {
            if (aborted) return;
            const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
            receivedBytes += buf.length;
            if (receivedBytes > MAX_PAYLOAD_BYTES) {
                aborted = true;
                req.removeListener('data', onData);
                req.pause();
                chunks.length = 0;
                const err = new Error('Payload Too Large: Maximum allowed size is 1MB.');
                err.statusCode = 413;
                err.code = 'PAYLOAD_TOO_LARGE';
                err.closeConnection = true;
                reject(err);
                return;
            }
            chunks.push(buf);
        };

        req.on('data', onData);

        req.on('end', () => {
            if (aborted) return;
            const body = Buffer.concat(chunks).toString('utf-8');
            if (!body.trim()) {
                resolve({});
                return;
            }
            try {
                const parsed = JSON.parse(body, stripDangerousJsonKeys);
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

        req.on('error', (err) => {
            if (!aborted) {
                aborted = true;
                reject(err);
            }
        });
    });
}

/**
 * Creates and returns the configured native HTTP server.
 * @param {object} [serverOptions={}]
 * @returns {http.Server}
 */
export function createServer(serverOptions = {}) {
    const configuredRpm = serverOptions.rateLimitRpm !== undefined
        ? Number(serverOptions.rateLimitRpm)
        : Number(process.env.RATE_LIMIT_RPM || 0);
    const rateLimitRpm = Number.isFinite(configuredRpm) && configuredRpm > 0 ? configuredRpm : 0;
    const trustProxy = serverOptions.trustProxy !== undefined
        ? Boolean(serverOptions.trustProxy)
        : process.env.TRUST_PROXY === 'true';
    const allowedOriginsSet = parseAllowedOrigins(
        serverOptions.allowedOrigins !== undefined ? serverOptions.allowedOrigins : process.env.ALLOWED_ORIGINS
    );
    const ipBuckets = new Map();

    function checkRateLimit(req) {
        if (rateLimitRpm <= 0) {
            return null;
        }
        const clientIp = resolveClientIp(req, trustProxy);
        const now = Date.now();
        const tokensPerMs = rateLimitRpm / 60_000;
        let bucket = ipBuckets.get(clientIp);

        if (!bucket) {
            if (ipBuckets.size >= MAX_RATE_LIMIT_IPS) {
                const oldestKey = ipBuckets.keys().next().value;
                if (oldestKey !== undefined) ipBuckets.delete(oldestKey);
            }
            bucket = { tokens: rateLimitRpm, lastRefillMs: now };
        } else {
            const elapsed = Math.max(0, now - bucket.lastRefillMs);
            bucket.tokens = Math.min(rateLimitRpm, bucket.tokens + elapsed * tokensPerMs);
            bucket.lastRefillMs = now;
            ipBuckets.delete(clientIp);
        }

        if (bucket.tokens < 1) {
            ipBuckets.set(clientIp, bucket);
            const missingTokens = 1 - bucket.tokens;
            const retryAfterSeconds = Math.max(1, Math.ceil(missingTokens / (rateLimitRpm / 60)));
            return retryAfterSeconds;
        }

        bucket.tokens -= 1;
        ipBuckets.set(clientIp, bucket);
        return null;
    }

    const server = http.createServer(async (req, res) => {
        const replyJson = (statusCode, data, extraHeaders = {}) =>
            sendJson(req, res, statusCode, data, allowedOriginsSet, extraHeaders);

        const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
        const pathname = url.pathname;
        const method = req.method.toUpperCase();

        // 1. Universal CORS Preflight Handling
        if (method === 'OPTIONS') {
            res.writeHead(204, {
                ...buildCorsHeaders(req, allowedOriginsSet, true),
                'Access-Control-Max-Age': '86400'
            });
            res.end();
            return;
        }

        try {
            // 2. Health Probe (exempt from per-IP rate limiting)
            if (pathname === '/health' && method === 'GET') {
                replyJson(200, {
                    status: 'ok',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // 2b. Per-IP Rate Limiter (when RATE_LIMIT_RPM > 0)
            const retryAfterSeconds = checkRateLimit(req);
            if (retryAfterSeconds !== null) {
                replyJson(
                    429,
                    {
                        error:
                            `Rate limit exceeded on the shared public DPP Keystone service (${rateLimitRpm} requests/minute per IP). ` +
                            `Retry after ${retryAfterSeconds}s, or run the identical CC0 open-source API container locally with unlimited throughput: ` +
                            `git clone https://github.com/dpp-keystone-org/DPPKeystoneOrg.git && cd DPPKeystoneOrg && npm run docker:build && npm run docker:run`,
                        code: 'RATE_LIMITED',
                        retryAfterSeconds,
                        selfHostDocs: SELF_HOST_DOCS_URL
                    },
                    { 'Retry-After': String(retryAfterSeconds) }
                );
                return;
            }

            // 3. Version Probe (GET /version or GET /v3/version, /v1/version, etc.)
            const versionProbeMatch = pathname.match(/^\/(?:(v\d+)\/)?version$/);
            if (versionProbeMatch && method === 'GET') {
                const requestedVersion = versionProbeMatch[1] || KEYSTONE_VERSION;
                if (!KNOWN_VERSIONS.includes(requestedVersion)) {
                    replyJson(400, {
                        error: `Invalid or unsupported specification version: '${requestedVersion}'. Allowed versions: ${KNOWN_VERSIONS.join(', ')}.`,
                        code: 'INVALID_VERSION'
                    });
                    return;
                }
                replyJson(200, {
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
                    ...buildCorsHeaders(req, allowedOriginsSet, true)
                });
                res.end(yamlContent);
                return;
            }

            // 5. EC Specifications Discovery (GET /specifications or GET /v1/specifications)
            if ((pathname === '/specifications' || pathname === '/v1/specifications') && method === 'GET') {
                const target = url.searchParams.get('target') || 'patched';
                if (!['patched', 'raw'].includes(target)) {
                    replyJson(400, {
                        error: `Invalid target '${target}'. Allowed values: 'patched', 'raw'.`,
                        code: 'INVALID_TARGET'
                    });
                    return;
                }
                const metadata = await getEcEngineMetadata(target);
                replyJson(200, metadata);
                return;
            }

            // 5. EC Battery Validation (POST /validate or POST /v1/validate)
            if (pathname === '/validate' || pathname === '/v1/validate') {
                if (method !== 'POST') {
                    replyJson(405, {
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
                    replyJson(400, {
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

                replyJson(result.valid ? 200 : 422, result);
                return;
            }

            // 6. Keystone -> EC Battery Adaptation (POST /adapt or POST /v1/adapt)
            if (pathname === '/adapt' || pathname === '/v1/adapt') {
                if (method !== 'POST') {
                    replyJson(405, {
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
                    replyJson(400, {
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

                replyJson(200, adaptedResult);
                return;
            }

            // 7. Render HTML (POST /render/html or POST /v3/render/html, /v2/render/html, etc.)
            const renderHtmlMatch = pathname.match(/^\/(?:(v\d+)\/)?render\/html$/);
            if (renderHtmlMatch) {
                if (method !== 'POST') {
                    replyJson(405, {
                        error: `Method ${method} Not Allowed`,
                        code: 'METHOD_NOT_ALLOWED'
                    }, { 'Allow': 'POST, OPTIONS' });
                    return;
                }

                const targetVersion = renderHtmlMatch[1] || KEYSTONE_VERSION;
                if (!KNOWN_VERSIONS.includes(targetVersion)) {
                    replyJson(400, {
                        error: `Invalid or unsupported specification version in URL: '${targetVersion}'. Allowed versions: ${KNOWN_VERSIONS.join(', ')}.`,
                        code: 'INVALID_VERSION'
                    });
                    return;
                }

                const body = await readJsonBody(req);

                if (!body.dpp || typeof body.dpp !== 'object') {
                    replyJson(400, {
                        error: "Invalid request: Missing 'dpp' payload object.",
                        code: 'INVALID_REQUEST'
                    });
                    return;
                }

                if (body.options && body.options.version && !KNOWN_VERSIONS.includes(body.options.version)) {
                    replyJson(400, {
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
                    replyJson(422, {
                        error: 'DPP validation failed',
                        code: 'VALIDATION_FAILED',
                        errors: validationResult.errors || []
                    });
                    return;
                }

                // Step B: Generate HTML for valid DPP (with per-response CSP nonce for multi-image carousels)
                const cspNonce = crypto.randomBytes(16).toString('base64');
                const html = await generateDppHtml(body.dpp, {
                    ...renderOptions,
                    cspNonce
                });
                const scriptDirective = html.includes(`<script nonce="${cspNonce}">`)
                    ? `script-src 'nonce-${cspNonce}'`
                    : "script-src 'none'";

                // Step C: Send HTML Response with Hardened Security Headers
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    ...buildCorsHeaders(req, allowedOriginsSet, false),
                    'Content-Security-Policy': `default-src 'none'; style-src 'unsafe-inline'; img-src data: https:; ${scriptDirective}; object-src 'none'; base-uri 'none'; frame-ancestors 'none';`,
                    'X-Content-Type-Options': 'nosniff'
                });
                res.end(html);
                return;
            }

            // 5. Fallthrough: Route Not Found
            replyJson(404, {
                error: `Route '${pathname}' not found.`,
                code: 'NOT_FOUND'
            });

        } catch (err) {
            const statusCode = (err && err.statusCode) || 500;
            const isServerError = statusCode >= 500;
            if (isServerError) {
                console.error('[DPP Keystone API] Internal server error:', err);
            }

            const extraHeaders = err && err.closeConnection ? { 'Connection': 'close' } : {};
            if (err && err.closeConnection) {
                res.once('finish', () => {
                    const timer = setTimeout(() => {
                        if (req.socket && !req.socket.destroyed) {
                            req.socket.destroy();
                        }
                    }, 50);
                    timer.unref();
                });
            }

            const hideInternal = serverOptions.hideInternalErrors === true || process.env.HIDE_INTERNAL_ERRORS === 'true';
            const clientMessage = isServerError
                ? (hideInternal ? 'Internal Server Error' : scrubHostPaths(err && err.message))
                : scrubHostPaths((err && err.message) || 'Bad Request');

            replyJson(statusCode, {
                error: clientMessage,
                code: (err && err.code) || 'INTERNAL_ERROR'
            }, extraHeaders);
        }
    });

    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    server.requestTimeout = REQUEST_TIMEOUT_MS;

    return server;
}

// Start server if executed directly via CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
    const port = parseInt(process.env.PORT || '8080', 10);
    const server = createServer();
    server.listen(port, '0.0.0.0', () => {
        console.log(`[DPP Keystone API] Listening on http://0.0.0.0:${port} (version: ${KEYSTONE_VERSION})`);
    });
}
