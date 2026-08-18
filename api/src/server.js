import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import { validateDppPayload } from './lib/dpp-validator-service.js';
import { generateDppHtml } from './lib/html-generator-server.js';

const MAX_PAYLOAD_BYTES = 1024 * 1024; // 1MB payload limit

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
                resolve(parsed);
            } catch (e) {
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
                sendJson(res, 200, {
                    status: 'ok',
                    version: requestedVersion,
                    activeVersion: KEYSTONE_VERSION,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // 4. Render HTML (POST /render/html or POST /v3/render/html, /v2/render/html, etc.)
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
                const body = await readJsonBody(req);

                if (!body.dpp || typeof body.dpp !== 'object') {
                    sendJson(res, 400, {
                        error: "Invalid request: Missing 'dpp' payload object.",
                        code: 'INVALID_REQUEST'
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

                // Step C: Send HTML Response
                res.writeHead(200, {
                    'Content-Type': 'text/html; charset=utf-8',
                    'Access-Control-Allow-Origin': '*'
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
