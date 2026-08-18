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

        req.on('data', chunk => {
            receivedBytes += chunk.length;
            if (receivedBytes > MAX_PAYLOAD_BYTES) {
                const err = new Error('Payload Too Large');
                err.statusCode = 413;
                reject(err);
                req.destroy();
                return;
            }
            body += chunk;
        });

        req.on('end', () => {
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
            reject(err);
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
            // 2. Health & Version Probes
            if (pathname === '/health' && method === 'GET') {
                sendJson(res, 200, {
                    status: 'ok',
                    timestamp: new Date().toISOString()
                });
                return;
            }

            if ((pathname === '/v1/version' || pathname === '/version') && method === 'GET') {
                sendJson(res, 200, {
                    status: 'ok',
                    version: KEYSTONE_VERSION,
                    timestamp: new Date().toISOString()
                });
                return;
            }

            // 3. POST /v1/render/html
            if (pathname === '/v1/render/html') {
                if (method !== 'POST') {
                    sendJson(res, 405, {
                        error: `Method ${method} Not Allowed`,
                        code: 'METHOD_NOT_ALLOWED'
                    }, { 'Allow': 'POST, OPTIONS' });
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

                // Step A: Validate the DPP payload first
                const validationResult = await validateDppPayload(body.dpp);

                if (!validationResult.valid) {
                    sendJson(res, 422, {
                        error: 'DPP validation failed',
                        code: 'VALIDATION_FAILED',
                        errors: validationResult.errors || []
                    });
                    return;
                }

                // Step B: Generate HTML for valid DPP
                const html = await generateDppHtml(body.dpp, body.options || {});

                // Step C: Content Negotiation
                const acceptHeader = (req.headers['accept'] || '').toLowerCase();
                if (acceptHeader.includes('application/json')) {
                    sendJson(res, 200, {
                        valid: true,
                        html: html
                    });
                } else {
                    res.writeHead(200, {
                        'Content-Type': 'text/html; charset=utf-8',
                        'Access-Control-Allow-Origin': '*'
                    });
                    res.end(html);
                }
                return;
            }

            // 4. Fallthrough: Route Not Found
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
