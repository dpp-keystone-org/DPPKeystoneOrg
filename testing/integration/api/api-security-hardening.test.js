import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import http from 'node:http';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import Ajv2020 from 'ajv/dist/2020.js';

import { startTestServer } from '../../scripts/api-test-helper.mjs';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';
import { validateDpp } from '../../../src/util/js/common/validation/schema-validator.js';
import { validateAgainstOntology } from '../../../src/util/js/common/validation/ontology-validator.js';
import { validateContextAwarePayload } from '../../../src/util/js/common/validation/context-semantic-validator.js';
import { renderProductPage, sanitizeUrl, getDisplayLabel } from '../../../src/util/js/common/rendering/dpp-html-renderer.js';
import { adaptKeystoneToEcBattery } from '../../../api/src/lib/ec-battery-adapter-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

async function loadKeystoneExample(filename) {
    const raw = await fs.readFile(path.join(PROJECT_ROOT, 'src/examples', filename), 'utf-8');
    return jsoncParse(raw.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION));
}

describe('HTTP API - Security Hardening Suite', () => {
    let testServer;
    let baseUrl;

    beforeAll(async () => {
        testServer = await startTestServer();
        baseUrl = testServer.baseUrl;
    });

    afterAll(async () => {
        if (testServer) {
            await testServer.close();
        }
    });

    describe('Feature 1: Document Loader Allowlist, Traversal Prevention & External Context Edge Cases', () => {
        it('must NOT load JSON-LD @context files outside contexts/ via .. or %2e%2e traversal on /adapt', async () => {
            const traversalUrls = [
                'https://dpp-keystone.org/spec/contexts/../../testing/fixtures/outside-context-fixture.json',
                'https://dpp-keystone.org/spec/contexts/%2e%2e/%2e%2e/testing/fixtures/outside-context-fixture.json'
            ];

            for (const badUrl of traversalUrls) {
                const dpp = await loadKeystoneExample('battery-dpp-v1.json');
                delete dpp.extinguishingAgent;
                dpp['@context'] = [
                    `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                    badUrl
                ];
                dpp.outsideMappedField = 'MAPPED_FROM_OUTSIDE_CONTEXTS_DIR';

                const resp = await fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp, options: { target: 'patched' } })
                });

                const body = await resp.json();
                expect(resp.status).toBe(200);
                expect(body.adaptedDpp.extinguishingAgent).not.toEqual({
                    en: 'MAPPED_FROM_OUTSIDE_CONTEXTS_DIR'
                });
            }
        });

        it('must NOT expose an arbitrary JSON file-existence oracle via .. traversal on /adapt or /render/html', async () => {
            const dppExisting = await loadKeystoneExample('battery-dpp-v1.json');
            dppExisting['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://dpp-keystone.org/spec/contexts/../../package.json'
            ];

            const dppMissing = await loadKeystoneExample('battery-dpp-v1.json');
            dppMissing['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://dpp-keystone.org/spec/contexts/../../definitely-does-not-exist-99999.json'
            ];

            const [adaptExisting, adaptMissing, renderExisting, renderMissing] = await Promise.all([
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppExisting, options: { target: 'patched' } })
                }),
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppMissing, options: { target: 'patched' } })
                }),
                fetch(`${baseUrl}/render/html`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppExisting })
                }),
                fetch(`${baseUrl}/render/html`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppMissing })
                })
            ]);

            expect(adaptExisting.status).toBe(200);
            expect(adaptExisting.status).toBe(adaptMissing.status);
            expect(renderExisting.status).toBe(200);
            expect(renderExisting.status).toBe(renderMissing.status);
        });

        it('must NOT dereference ontology files when a spec/ontology/ URL is placed in @context', async () => {
            // dpp-ontology.jsonld contains "@base" inside "@context", which throws `invalid remote context`
            // if documentLoader actually loads it from disk instead of treating it as an unrecognized context stub.
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            dpp['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                `https://dpp-keystone.org/spec/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`
            ];

            const resp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp, options: { target: 'patched' } })
            });

            expect(resp.status).toBe(200);
            const body = await resp.json();
            expect(body.adaptedDpp.batteryWeight).toBe(45.5);
        });

        it('supports both version-less ("latest") and /preview/<branch>/ Keystone @context URLs on /adapt', async () => {
            const dppLatest = await loadKeystoneExample('battery-dpp-v1.json');
            dppLatest['@context'] = 'https://dpp-keystone.org/spec/contexts/dpp-battery.context.jsonld';

            const dppPreview = await loadKeystoneExample('battery-dpp-v1.json');
            dppPreview['@context'] = `https://dpp-keystone.org/preview/my-feature-branch/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`;

            const [respLatest, respPreview] = await Promise.all([
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppLatest, options: { target: 'patched' } })
                }),
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppPreview, options: { target: 'patched' } })
                })
            ]);

            expect(respLatest.status).toBe(200);
            expect((await respLatest.json()).adaptedDpp.batteryWeight).toBe(45.5);

            expect(respPreview.status).toBe(200);
            expect((await respPreview.json()).adaptedDpp.batteryWeight).toBe(45.5);
        });

        it('passes through external @context URLs + inline-prefixed attributes cleanly in strict SHACL mode (with offline warning, no crash)', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            dpp['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://ref.gs1.org/epcis/epcis-context.jsonld',
                { gs1: 'https://ref.gs1.org/voc/' }
            ];
            dpp['gs1:packagingType'] = 'RETURNABLE_PALLET';

            const resp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp,
                    options: { target: 'patched', validate: true, mode: 'strict' }
                })
            });

            const body = await resp.json();
            expect(resp.status).toBe(200);
            expect(body.adaptedDpp['@context']).toContain('https://ref.gs1.org/epcis/epcis-context.jsonld');
            expect(body.adaptedDpp['gs1:packagingType']).toBe('RETURNABLE_PALLET');
            expect(body.validation.valid).toBe(true);
            expect(body.validation.findings).toEqual([]);
            expect(body.validation.warnings.some((w) => w.includes('https://ref.gs1.org/epcis/epcis-context.jsonld'))).toBe(true);
        });

        it('preserves unprefixed attributes relying on unfetched external @context URLs in adaptedDpp, passing schema mode and flagging SEM-COM-MSG-013 (not crashing) in strict mode', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            dpp['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://ref.gs1.org/epcis/epcis-context.jsonld'
            ];
            dpp.unprefixedExternalTerm = 'CUSTOM_VALUE_123';

            // 1. Schema mode: valid, external context + attribute preserved
            const schemaResp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp,
                    options: { target: 'patched', validate: true, mode: 'schema' }
                })
            });
            const schemaBody = await schemaResp.json();
            expect(schemaResp.status).toBe(200);
            expect(schemaBody.adaptedDpp['@context']).toContain('https://ref.gs1.org/epcis/epcis-context.jsonld');
            expect(schemaBody.adaptedDpp.unprefixedExternalTerm).toBe('CUSTOM_VALUE_123');
            expect(schemaBody.validation.valid).toBe(true);

            // 2. Strict mode: adaptedDpp STILL preserves the attribute & external context, while SHACL flags SEM-COM-MSG-013 cleanly
            const strictResp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp,
                    options: { target: 'patched', validate: true, mode: 'strict' }
                })
            });
            const strictBody = await strictResp.json();
            expect(strictResp.status).toBe(200);
            expect(strictBody.adaptedDpp.unprefixedExternalTerm).toBe('CUSTOM_VALUE_123');
            expect(strictBody.validation.valid).toBe(false);
            expect(strictBody.validation.findings.some((f) => f.code === 'SEM-COM-MSG-013')).toBe(true);
            expect(strictBody.validation.findings.some((f) => f.code === 'JSONLD_SHACL_ERROR')).toBe(false);
        });
    });

    describe('Feature 2: Ajv Validator Caching on Keystone Validation (/render/html CPU DoS Prevention)', () => {
        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('compiles Ajv schemas only once per schemaContext across repeated validateDpp calls and isolates returned error arrays', () => {
            const compileSpy = jest.spyOn(Ajv2020.prototype, 'compile');

            const schemaContext = {
                baseSchema: {
                    type: 'object',
                    properties: {
                        digitalProductPassportId: { type: 'string' },
                        count: { type: 'integer' }
                    },
                    required: ['digitalProductPassportId']
                },
                sectorSchemas: {
                    testSector: {
                        type: 'object',
                        properties: { sectorField: { type: 'string' } }
                    }
                },
                commonSchemas: []
            };

            // 1. Invalid call #1 (missing digitalProductPassportId)
            const invalidRes1 = validateDpp({ count: 1 }, schemaContext);
            expect(invalidRes1.valid).toBe(false);
            expect(invalidRes1.errors.length).toBeGreaterThan(0);
            const snapshotErrors1 = structuredClone(invalidRes1.errors);

            // 2. Valid calls #2, #3, #4
            expect(validateDpp({ digitalProductPassportId: 'urn:uuid:1', count: 5 }, schemaContext).valid).toBe(true);
            expect(validateDpp({ digitalProductPassportId: 'urn:uuid:2' }, schemaContext).valid).toBe(true);
            expect(validateDpp({ digitalProductPassportId: 'urn:uuid:3', sectorField: 'ok' }, schemaContext).valid).toBe(true);

            // 3. Invalid call #5 (wrong type on count)
            const invalidRes2 = validateDpp({ digitalProductPassportId: 'urn:uuid:4', count: 'not-an-int' }, schemaContext);
            expect(invalidRes2.valid).toBe(false);

            // Must have compiled only ONCE across all 5 calls!
            expect(compileSpy).toHaveBeenCalledTimes(1);

            // Previously returned errors array must NOT have been mutated or wiped by later calls
            expect(invalidRes1.errors).toEqual(snapshotErrors1);

            // 4. Mutating schemaContext in-place must safely invalidate cache and recompile
            schemaContext.sectorSchemas.addedSector = {
                type: 'object',
                required: ['mandatoryNewField'],
                properties: { mandatoryNewField: { type: 'string' } }
            };
            const afterMutationRes = validateDpp({ digitalProductPassportId: 'urn:uuid:5' }, schemaContext);
            expect(afterMutationRes.valid).toBe(false);
            expect(compileSpy).toHaveBeenCalledTimes(2);
        });

        it('reuses cached Ajv compilation across repeated POST /render/html requests', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');

            // Warm up once so serverSchemaContext is loaded
            const warmResp = await fetch(`${baseUrl}/render/html`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp, options: { includeSchema: false } })
            });
            expect(warmResp.status).toBe(200);

            const compileSpy = jest.spyOn(Ajv2020.prototype, 'compile');

            // Subsequent /render/html requests must trigger ZERO new Ajv schema compilations
            for (let i = 0; i < 3; i++) {
                const resp = await fetch(`${baseUrl}/render/html`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp, options: { includeSchema: false } })
                });
                expect(resp.status).toBe(200);
            }

            expect(compileSpy).toHaveBeenCalledTimes(0);
        });
    });

    describe('Feature 3: Input Structural Limits & JSON-LD / RDF Expansion Caps (413 PAYLOAD_TOO_COMPLEX)', () => {
        function buildNestedObject(depth, leafValue = 'leaf') {
            const root = {};
            let cursor = root;
            for (let i = 0; i < depth; i++) {
                cursor.nested = {};
                cursor = cursor.nested;
            }
            cursor.value = leafValue;
            return root;
        }

        it('rejects deeply nested JSON (> 32 levels) with 413 PAYLOAD_TOO_COMPLEX across /validate, /adapt, and /render/html', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            dpp.deepExtension = buildNestedObject(40);

            const endpoints = ['/validate', '/adapt', '/render/html'];
            for (const endpoint of endpoints) {
                const resp = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp })
                });
                const body = await resp.json();
                expect(resp.status).toBe(413);
                expect(body.code).toBe('PAYLOAD_TOO_COMPLEX');
            }
        });

        it('rejects ultra-dense JSON (> 15,000 container entries, well under 1 MiB) with 413 PAYLOAD_TOO_COMPLEX across /validate, /adapt, and /render/html', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            dpp.denseArray = Array.from({ length: 16_000 }, (_, i) => i);

            const serialized = JSON.stringify({ dpp });
            expect(Buffer.byteLength(serialized, 'utf-8')).toBeLessThan(200 * 1024);

            const endpoints = ['/validate', '/adapt', '/render/html'];
            for (const endpoint of endpoints) {
                const resp = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: serialized
                });
                const body = await resp.json();
                expect(resp.status).toBe(413);
                expect(body.code).toBe('PAYLOAD_TOO_COMPLEX');
            }
        });

        it('allows moderately nested voluntary extensions (e.g. depth 18) within structural bounds', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            dpp.moderateExtension = buildNestedObject(18);

            const [adaptResp, renderResp] = await Promise.all([
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp, options: { target: 'patched' } })
                }),
                fetch(`${baseUrl}/render/html`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp, options: { includeSchema: false } })
                })
            ]);

            expect(adaptResp.status).toBe(200);
            expect(renderResp.status).toBe(200);
        });

        it('rejects JSON-LD RDF quad amplification (> 20,000 RDF quads from < 15,000 JSON entries) with 413 PAYLOAD_TOO_COMPLEX on /validate and /adapt', async () => {
            // An 11,000-element JSON-LD @list stays well below 15,000 JSON entries (~11.2k entries, ~65 KB),
            // but expands into >22,000 RDF quads (rdf:first + rdf:rest per list node).
            const listAmplifierContext = {
                ex: 'https://example.org/ns#',
                orderedChain: { '@id': 'ex:orderedChain', '@container': '@list' }
            };
            const listItems = Array.from({ length: 11_000 }, (_, i) => i);

            // 1. POST /validate on a valid patched EVB DPP with @list quad amplification
            const evbFixturePath = path.join(
                PROJECT_ROOT,
                'ec-bundle/semantics/product/batteries/subgroup/evb/1.0.0/tests/conforms/pub-batteries-evb.json'
            );
            const evbDpp = JSON.parse(await fs.readFile(evbFixturePath, 'utf-8'));
            const existingEvbCtx = Array.isArray(evbDpp['@context']) ? evbDpp['@context'] : [evbDpp['@context']];
            evbDpp['@context'] = [...existingEvbCtx, listAmplifierContext];
            evbDpp.orderedChain = listItems;

            const validateResp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp: evbDpp, options: { target: 'patched', mode: 'strict' } })
            });
            const validateBody = await validateResp.json();
            expect(validateResp.status).toBe(413);
            expect(validateBody.code).toBe('PAYLOAD_TOO_COMPLEX');

            // 2. POST /adapt?validate=true on a Keystone Battery DPP with @list quad amplification
            const keystoneDpp = await loadKeystoneExample('battery-dpp-v1.json');
            keystoneDpp['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                listAmplifierContext
            ];
            keystoneDpp.orderedChain = listItems;

            const adaptResp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: keystoneDpp,
                    options: { target: 'patched', validate: true, mode: 'strict' }
                })
            });
            const adaptBody = await adaptResp.json();
            expect(adaptResp.status).toBe(413);
            expect(adaptBody.code).toBe('PAYLOAD_TOO_COMPLEX');
        });

        it('guards shared src/util recursive walkers against V8 call-stack overflow when invoked directly on deeply nested objects', async () => {
            const stackBomb = {
                '@context': { ex: 'https://example.org/ns#' },
                digitalProductPassportId: 'urn:uuid:stack-test',
                deep: buildNestedObject(12_000)
            };
            const dummyOntologyMap = new Map([['value', { range: 'string' }]]);
            const stubLoader = async (url) => ({ contextUrl: null, documentUrl: url, document: { '@context': {} } });

            // 1. validateAgainstOntology returns { valid: false } with maxDepth error (no RangeError)
            const ontoResult = validateAgainstOntology(stackBomb, dummyOntologyMap);
            expect(ontoResult.valid).toBe(false);
            expect(ontoResult.errors.some((e) => e.keyword === 'maxDepth')).toBe(true);

            // 2. validateContextAwarePayload returns { valid: false } with maxDepth error (no RangeError)
            const ctxResult = await validateContextAwarePayload(stackBomb, stubLoader);
            expect(ctxResult.valid).toBe(false);
            expect(ctxResult.errors.some((e) => e.keyword === 'maxDepth')).toBe(true);

            // 3. renderProductPage throws a deterministic nesting-depth error rather than V8 RangeError
            let thrownError = null;
            try {
                renderProductPage({ dppData: stackBomb });
            } catch (err) {
                thrownError = err;
            }
            expect(thrownError).not.toBeNull();
            expect(thrownError).not.toBeInstanceOf(RangeError);
            expect(thrownError.message).toMatch(/Maximum nesting depth/i);
        });
    });

    describe('Feature 4: HTTP Transport Hardening (413 Socket Teardown, Slowloris Timeouts & 415 Media Type)', () => {
        it('configures explicit Slowloris and keep-alive timeouts on createServer()', () => {
            expect(testServer.server.keepAliveTimeout).toBe(5_000);
            expect(testServer.server.headersTimeout).toBe(10_000);
            expect(testServer.server.requestTimeout).toBe(15_000);
        });

        it('rejects oversized Content-Length headers immediately with 413 PAYLOAD_TOO_LARGE and Connection: close without waiting for body chunks', async () => {
            const targetUrl = new URL(`${baseUrl}/adapt`);

            const result = await new Promise((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: targetUrl.hostname,
                        port: targetUrl.port,
                        path: targetUrl.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Content-Length': String(5 * 1024 * 1024) // Declare 5 MiB upfront
                        }
                    },
                    (res) => {
                        let raw = '';
                        res.setEncoding('utf-8');
                        res.on('data', (chunk) => {
                            raw += chunk;
                        });
                        res.on('end', () => {
                            req.destroy();
                            resolve({
                                statusCode: res.statusCode,
                                headers: res.headers,
                                body: raw ? JSON.parse(raw) : {}
                            });
                        });
                    }
                );

                req.setTimeout(400, () => {
                    req.destroy(new Error('Server waited for body upload instead of pre-checking Content-Length'));
                });
                req.on('error', (err) => {
                    // Ignore ECONNRESET after we already received the 413 response
                    reject(err);
                });

                // Write only 7 bytes so an unpatched server without a Content-Length pre-check stalls until timeout
                req.write('{"dpp":');
            });

            expect(result.statusCode).toBe(413);
            expect(result.body.code).toBe('PAYLOAD_TOO_LARGE');
            expect(result.headers.connection).toBe('close');
        });

        it('aborts mid-stream chunked uploads exceeding 1 MiB with 413 PAYLOAD_TOO_LARGE, Connection: close, and server-side socket teardown', async () => {
            const targetUrl = new URL(`${baseUrl}/validate`);
            const chunk = Buffer.alloc(128 * 1024, 'a'); // 128 KiB chunk

            let activeReq = null;
            try {
                const result = await new Promise((resolve, reject) => {
                    const req = http.request(
                        {
                            hostname: targetUrl.hostname,
                            port: targetUrl.port,
                            path: targetUrl.pathname,
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Transfer-Encoding': 'chunked'
                            }
                        },
                        (res) => {
                            let raw = '';
                            res.setEncoding('utf-8');
                            res.on('data', (c) => {
                                raw += c;
                            });
                            res.on('end', () => {
                                // Wait up to 250ms to verify the server actively destroys the unread socket
                                const socket = req.socket;
                                if (!socket || socket.destroyed) {
                                    resolve({
                                        statusCode: res.statusCode,
                                        headers: res.headers,
                                        body: raw ? JSON.parse(raw) : {},
                                        socketClosedByServer: true
                                    });
                                    return;
                                }
                                const timer = setTimeout(() => {
                                    resolve({
                                        statusCode: res.statusCode,
                                        headers: res.headers,
                                        body: raw ? JSON.parse(raw) : {},
                                        socketClosedByServer: socket.destroyed
                                    });
                                }, 250);
                                socket.once('close', () => {
                                    clearTimeout(timer);
                                    resolve({
                                        statusCode: res.statusCode,
                                        headers: res.headers,
                                        body: raw ? JSON.parse(raw) : {},
                                        socketClosedByServer: true
                                    });
                                });
                            });
                        }
                    );
                    activeReq = req;
                    req.on('error', (err) => {
                        if (err.code !== 'ECONNRESET' && err.code !== 'EPIPE') {
                            reject(err);
                        }
                    });

                    // Write 9 * 128 KiB = 1,152 KiB (> 1 MiB) WITHOUT calling req.end()
                    req.write('{"dpp":"');
                    for (let i = 0; i < 9; i++) {
                        req.write(chunk);
                    }
                });

                expect(result.statusCode).toBe(413);
                expect(result.body.code).toBe('PAYLOAD_TOO_LARGE');
                expect(result.headers.connection).toBe('close');
                expect(result.socketClosedByServer).toBe(true);
            } finally {
                if (activeReq && !activeReq.destroyed) {
                    activeReq.destroy();
                }
            }
        });

        it('preserves multi-byte UTF-8 characters when split mid-codepoint across separate TCP chunks', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            const utf8Marker = 'Price: €100 — Größer — 🚀';
            dpp.voluntaryUtf8Note = utf8Marker;

            const fullBuf = Buffer.from(JSON.stringify({ dpp, options: { target: 'patched' } }), 'utf-8');
            // Locate the 3-byte UTF-8 sequence for '€' (0xE2 0x82 0xAC) and split right after 0xE2!
            const euroStart = fullBuf.indexOf(Buffer.from([0xe2, 0x82, 0xac]));
            expect(euroStart).toBeGreaterThan(0);

            const part1 = fullBuf.subarray(0, euroStart + 1);
            const part2 = fullBuf.subarray(euroStart + 1);
            const targetUrl = new URL(`${baseUrl}/adapt`);

            const response = await new Promise((resolve, reject) => {
                const req = http.request(
                    {
                        hostname: targetUrl.hostname,
                        port: targetUrl.port,
                        path: targetUrl.pathname,
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            'Transfer-Encoding': 'chunked'
                        }
                    },
                    (res) => {
                        let raw = '';
                        res.setEncoding('utf-8');
                        res.on('data', (c) => {
                            raw += c;
                        });
                        res.on('end', () => {
                            resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
                        });
                    }
                );
                req.on('error', reject);
                req.write(part1);
                setTimeout(() => {
                    req.end(part2);
                }, 20);
            });

            expect(response.statusCode).toBe(200);
            expect(response.body.adaptedDpp.voluntaryUtf8Note).toBe(utf8Marker);
        });

        it('enforces 415 UNSUPPORTED_MEDIA_TYPE on POST endpoints while accepting application/json and application/ld+json', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            const payloadStr = JSON.stringify({ dpp, options: { target: 'patched' } });

            // 1. Rejects text/plain and application/x-www-form-urlencoded across all POST routes
            for (const endpoint of ['/validate', '/adapt', '/render/html']) {
                const textPlainResp = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain' },
                    body: payloadStr
                });
                const textPlainBody = await textPlainResp.json();
                expect(textPlainResp.status).toBe(415);
                expect(textPlainBody.code).toBe('UNSUPPORTED_MEDIA_TYPE');

                const formResp = await fetch(`${baseUrl}${endpoint}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: payloadStr
                });
                expect(formResp.status).toBe(415);
            }

            // 2. Accepts both application/json; charset=utf-8 and application/ld+json
            for (const validMime of ['application/json; charset=utf-8', 'application/ld+json']) {
                const okResp = await fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': validMime },
                    body: payloadStr
                });
                expect(okResp.status).toBe(200);
            }
        });
    });

    describe('Feature 5: HTML Renderer (/render/html) Sanitization & CSP Hardening', () => {
        it('restricts data: image URLs in sanitizeUrl() to base64 raster formats and blocks SVG data URIs', () => {
            // SVG data URIs (both utf8 and base64) can carry executable <script> payloads
            expect(sanitizeUrl('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')).toBe('');
            expect(sanitizeUrl('data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=')).toBe('');
            expect(sanitizeUrl('javascript:alert(1)')).toBe('');

            // Raster base64 data URIs and standard HTTPS URLs remain allowed
            const tinyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
            const tinyWebp = 'data:image/webp;base64,UklGRh4AAABXRUJQVlA4TBEAAAAvAAAAAAfQ//73v/+BiOh/AAA=';
            expect(sanitizeUrl(tinyPng)).toBe(tinyPng);
            expect(sanitizeUrl(tinyWebp)).toBe(tinyWebp);
            expect(sanitizeUrl('https://example.com/product.jpg')).toBe('https://example.com/product.jpg');
        });

        it('neutralizes </style> breakout sequences inside css passed to renderProductPage()', () => {
            const html = renderProductPage({
                dppData: { productName: 'Style Escape Test', id: 'urn:uuid:1' },
                css: 'body { color: black; } </style><script>window.__xss = 1;</script><style>'
            });

            expect(html).not.toContain('</style><script>');
        });

        it('does NOT render external <link rel="stylesheet"> tags from options.customCssUrl on POST /render/html', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');

            for (const attemptedCss of ['https://evil.example.com/redress.css', 'http://127.0.0.1:9222/probe.css']) {
                const resp = await fetch(`${baseUrl}/render/html`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        dpp,
                        options: {
                            includeSchema: false,
                            customCssUrl: attemptedCss
                        }
                    })
                });

                expect(resp.status).toBe(200);
                const html = await resp.text();
                expect(html).not.toContain('<link rel="stylesheet"');
                expect(html).not.toContain(attemptedCss);
            }
        });

        it('emits strict CSP without script-src unsafe-inline (script-src none for 0-1 images, nonce for multi-image carousel without inline onclick)', async () => {
            // 1. Single/no-image DPP -> script-src 'none' (JSON-LD data block still allowed)
            const singleDpp = await loadKeystoneExample('battery-dpp-v1.json');
            const singleResp = await fetch(`${baseUrl}/render/html`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp: singleDpp, options: { includeSchema: true } })
            });
            expect(singleResp.status).toBe(200);
            const singleCsp = singleResp.headers.get('content-security-policy') || '';
            expect(singleCsp).toContain("object-src 'none'");
            expect(singleCsp).toContain("base-uri 'none'");
            expect(singleCsp).toContain("frame-ancestors 'none'");
            expect(singleCsp).toContain("script-src 'none'");
            expect(singleCsp).not.toContain("script-src 'self' 'unsafe-inline'");
            expect(singleCsp).not.toMatch(/style-src[^;]*https:/);

            // 2. Multi-image DPP -> per-response cryptographic nonce on carousel <script>, zero inline onclick attributes
            const multiDpp = await loadKeystoneExample('battery-dpp-v1.json');
            multiDpp.image = [
                { url: 'https://example.com/view-1.png', resourceTitle: 'Front View' },
                { url: 'https://example.com/view-2.png', resourceTitle: 'Side View' }
            ];
            const multiResp = await fetch(`${baseUrl}/render/html`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp: multiDpp, options: { includeSchema: false } })
            });
            expect(multiResp.status).toBe(200);
            const multiCsp = multiResp.headers.get('content-security-policy') || '';
            const multiHtml = await multiResp.text();

            const nonceMatch = multiCsp.match(/script-src 'nonce-([A-Za-z0-9+/=_-]+)'/);
            expect(nonceMatch).not.toBeNull();
            const nonce = nonceMatch[1];
            expect(multiCsp).not.toContain("script-src 'self' 'unsafe-inline'");
            expect(multiHtml).toContain(`<script nonce="${nonce}">`);
            expect(multiHtml).not.toContain('onclick=');
            expect(multiHtml).toContain('dpp-carousel-container');
        });
    });

    describe('Feature 6: Prototype-Key Sanitization (__proto__, constructor, prototype) & language Validation', () => {
        it('strips __proto__, constructor, and prototype keys at the HTTP JSON boundary across /adapt, /validate, and /render/html', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            const baseDppJson = JSON.stringify(dpp);
            // Craft a raw JSON body containing literal "__proto__", "constructor", and "prototype" keys
            const rawMaliciousBody =
                `{"dpp": ${baseDppJson.slice(0, -1)}, ` +
                `"__proto__": {"pollutedMarker": "PROTO_POLLUTED"}, ` +
                `"constructor": {"prototype": {"pollutedCtor": true}}, ` +
                `"prototype": {"pollutedProtoProp": true}}, ` +
                `"options": {"target": "patched", "includeSchema": false}}`;

            const [adaptResp, renderResp, validateResp] = await Promise.all([
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: rawMaliciousBody
                }),
                fetch(`${baseUrl}/render/html`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: rawMaliciousBody
                }),
                fetch(`${baseUrl}/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: rawMaliciousBody
                })
            ]);

            expect(adaptResp.status).toBe(200);
            expect(renderResp.status).toBe(200);
            expect([200, 422]).toContain(validateResp.status);

            const adaptRawText = await adaptResp.text();
            const adaptBody = JSON.parse(adaptRawText);
            expect(Object.hasOwn(adaptBody.adaptedDpp, 'constructor')).toBe(false);
            expect(Object.hasOwn(adaptBody.adaptedDpp, 'prototype')).toBe(false);
            expect(adaptRawText).not.toContain('pollutedMarker');
            expect(adaptRawText).not.toContain('pollutedCtor');

            const renderHtml = await renderResp.text();
            expect(renderHtml).not.toContain('pollutedMarker');
            expect(renderHtml).not.toContain('pollutedCtor');
            expect(({}).pollutedMarker).toBeUndefined();
        });

        it('guards shared ec-battery transformation against prototype mutation when called directly on JSON.parse output', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            const rawJsonWithProto =
                `${JSON.stringify(dpp).slice(0, -1)}, ` +
                `"__proto__": {"injectedViaProto": "POLLUTED"}, ` +
                `"constructor": {"badCtor": 1}, ` +
                `"prototype": {"badProto": 2}}`;
            const parsedInput = JSON.parse(rawJsonWithProto);

            const result = await adaptKeystoneToEcBattery(parsedInput, { target: 'patched' });
            expect(Object.getPrototypeOf(result.adaptedDpp)).toBe(Object.prototype);
            expect(result.adaptedDpp.injectedViaProto).toBeUndefined();
            expect(Object.hasOwn(result.adaptedDpp, 'constructor')).toBe(false);
            expect(Object.hasOwn(result.adaptedDpp, 'prototype')).toBe(false);
        });

        it('prevents Object.prototype method leakage (e.g. toString / constructor) via options.language in HTML rendering', async () => {
            const ontologyMap = new Map([
                ['dppStatus', { label: { en: 'Passport Status', de: 'Pass-Status' } }]
            ]);

            // Direct helper calls
            expect(getDisplayLabel('dppStatus', ontologyMap, 'toString')).toBe('Passport Status');
            expect(getDisplayLabel('dppStatus', ontologyMap, 'constructor')).toBe('Passport Status');
            expect(getDisplayLabel('dppStatus', ontologyMap, 'de')).toBe('Pass-Status');

            // End-to-end POST /render/html calls
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            const badLangResp = await fetch(`${baseUrl}/render/html`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp,
                    options: { language: 'toString', includeSchema: false }
                })
            });
            expect(badLangResp.status).toBe(200);
            const badLangHtml = await badLangResp.text();
            expect(badLangHtml).not.toContain('function toString');
            expect(badLangHtml).not.toContain('[native code]');
            expect(badLangHtml).toContain('<html lang="en">');

            const deResp = await fetch(`${baseUrl}/render/html`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp,
                    options: { language: 'de', includeSchema: false }
                })
            });
            expect(deResp.status).toBe(200);
            const deHtml = await deResp.text();
            expect(deHtml).toContain('<html lang="de">');
        });
    });

    describe('Feature 7: 500 Error Logging, Host-Prefix Scrubbing & Optional HIDE_INTERNAL_ERRORS Toggle', () => {
        const originalHideEnv = process.env.HIDE_INTERNAL_ERRORS;

        afterEach(() => {
            if (originalHideEnv === undefined) {
                delete process.env.HIDE_INTERNAL_ERRORS;
            } else {
                process.env.HIDE_INTERNAL_ERRORS = originalHideEnv;
            }
            jest.restoreAllMocks();
        });

        it('logs 500 errors to console.error and scrubs PROJECT_ROOT to <app> while preserving diagnostic detail by default', async () => {
            delete process.env.HIDE_INTERNAL_ERRORS;
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const simulatedPath = path.join(PROJECT_ROOT, 'src/api/openapi.yml');
            jest.spyOn(fs, 'readFile').mockRejectedValueOnce(
                new Error(`ENOENT: no such file or directory, open '${simulatedPath}'`)
            );

            const resp = await fetch(`${baseUrl}/openapi.yml`);
            const body = await resp.json();

            expect(resp.status).toBe(500);
            expect(body.code).toBe('INTERNAL_ERROR');
            expect(errorSpy).toHaveBeenCalled();
            // Diagnostic error type/filename remain visible for remote debugging, with host PROJECT_ROOT scrubbed
            expect(body.error).toContain('ENOENT');
            expect(body.error).toContain('<app>/src/api/openapi.yml');
            expect(body.error).not.toContain(PROJECT_ROOT);
        });

        it('masks 500 error messages as generic Internal Server Error when HIDE_INTERNAL_ERRORS=true while keeping 4xx messages intact', async () => {
            process.env.HIDE_INTERNAL_ERRORS = 'true';
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const simulatedPath = path.join(PROJECT_ROOT, 'src/api/openapi.yml');
            jest.spyOn(fs, 'readFile').mockRejectedValueOnce(
                new Error(`ENOENT: no such file or directory, open '${simulatedPath}'`)
            );

            const resp500 = await fetch(`${baseUrl}/openapi.yml`);
            const body500 = await resp500.json();
            expect(resp500.status).toBe(500);
            expect(body500).toEqual({
                error: 'Internal Server Error',
                code: 'INTERNAL_ERROR'
            });
            expect(errorSpy).toHaveBeenCalled();

            // 4xx client errors must remain descriptive even when HIDE_INTERNAL_ERRORS=true
            const resp400 = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{ broken json'
            });
            const body400 = await resp400.json();
            expect(resp400.status).toBe(400);
            expect(body400.code).toBe('INVALID_JSON');
            expect(body400.error).toContain('Malformed JSON body');
        });
    });

    describe('Feature 8: Non-Test Runtime & Vendored Dependency Health Guard', () => {
        function parseStableSemver(ver) {
            const m = String(ver || '').trim().match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
            if (!m || m[4]) return null; // Ignore pre-releases
            return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
        }

        function compareSemver(a, b) {
            if (a.major !== b.major) return a.major - b.major;
            if (a.minor !== b.minor) return a.minor - b.minor;
            return a.patch - b.patch;
        }

        it('keeps root package.json and package-lock.json synchronized with swagger-ui-dist vendored', async () => {
            const pkgJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
            const lockJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'package-lock.json'), 'utf-8'));
            const rootLockEntry = lockJson.packages?.[''] || {};

            // swagger-ui-dist must be pinned via devDependencies for local vendoring
            expect(pkgJson.devDependencies?.['swagger-ui-dist']).toBeDefined();

            // Every root dependency & devDependency in package.json must be synced into package-lock.json
            const missingInLock = [];
            for (const dep of Object.keys(pkgJson.dependencies || {})) {
                if (!rootLockEntry.dependencies?.[dep]) {
                    missingInLock.push(`dependencies.${dep}`);
                }
            }
            for (const devDep of Object.keys(pkgJson.devDependencies || {})) {
                if (!rootLockEntry.devDependencies?.[devDep]) {
                    missingInLock.push(`devDependencies.${devDep}`);
                }
            }
            expect(missingInLock).toEqual([]);

            // Ensure package-lock.json never records corporate-internal mirror URLs (e.g. airlock-proxy.uplink.goog)
            // that would break `npm ci` in external GitHub Actions / Docker builds (ignoring local workspace path links)
            const internalMirrorPackages = Object.entries(lockJson.packages || {})
                .filter(
                    ([, meta]) =>
                        typeof meta?.resolved === 'string' &&
                        /^https?:\/\//i.test(meta.resolved) &&
                        !meta.resolved.startsWith('https://registry.npmjs.org/')
                )
                .map(([pkgPath, meta]) => `${pkgPath}: ${meta.resolved}`);
            expect(internalMirrorPackages).toEqual([]);
        });

        it('ensures runtime & vendored dependencies have zero moderate/high/critical npm advisories and are not >90 days outdated', async () => {
            const maxStaleDays = Number(process.env.MAX_STALE_DEPENDENCY_DAYS || 90);
            const pkgJson = JSON.parse(await fs.readFile(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));

            // Monitor all production/API runtime dependencies plus vendored browser UI packages (excluding test frameworks)
            const monitoredNames = [
                ...Object.keys(pkgJson.dependencies || {}),
                ...(pkgJson.devDependencies?.['swagger-ui-dist'] ? ['swagger-ui-dist'] : [])
            ];

            const installedVersions = {};
            for (const name of monitoredNames) {
                const depPkgPath = path.join(PROJECT_ROOT, 'node_modules', name, 'package.json');
                const depPkg = JSON.parse(await fs.readFile(depPkgPath, 'utf-8'));
                installedVersions[name] = depPkg.version;
            }

            // 1. 0-day check against npm's official bulk security advisory endpoint
            let advisoryResp;
            try {
                advisoryResp = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(Object.fromEntries(Object.entries(installedVersions).map(([k, v]) => [k, [v]]))),
                    signal: AbortSignal.timeout(8000)
                });
            } catch (netErr) {
                console.warn(`[Dependency Health Guard] Skipping live npm registry check (offline/unreachable: ${netErr.message}).`);
                return;
            }

            if (advisoryResp.ok) {
                const advisoriesByPkg = await advisoryResp.json();
                const blockingAdvisories = [];
                for (const [pkgName, list] of Object.entries(advisoriesByPkg || {})) {
                    for (const adv of list || []) {
                        if (['moderate', 'high', 'critical'].includes(String(adv.severity).toLowerCase())) {
                            blockingAdvisories.push(
                                `${pkgName}@${installedVersions[pkgName]} [${adv.severity}]: ${adv.title} (${adv.url || adv.id})`
                            );
                        }
                    }
                }
                expect(blockingAdvisories).toEqual([]);
            }

            // 2. 90-day staleness check against registry.npmjs.org dist-tags & publish timestamps
            const stalePackages = [];
            await Promise.all(
                Object.entries(installedVersions).map(async ([pkgName, currentVer]) => {
                    const currentParsed = parseStableSemver(currentVer);
                    if (!currentParsed) return;

                    const metaResp = await fetch(`https://registry.npmjs.org/${pkgName}`, {
                        headers: { Accept: 'application/json' },
                        signal: AbortSignal.timeout(8000)
                    });
                    if (!metaResp.ok) return;

                    const meta = await metaResp.json();
                    const latestVer = meta?.['dist-tags']?.latest;
                    const latestParsed = parseStableSemver(latestVer);
                    if (!latestParsed || compareSemver(latestParsed, currentParsed) <= 0) {
                        return; // Up to date!
                    }

                    // Measure age from the earliest missed stable version <= latest so rapid patch churn never resets the clock
                    const missedStable = Object.keys(meta.versions || {})
                        .map((v) => ({ raw: v, parsed: parseStableSemver(v) }))
                        .filter((x) => x.parsed && compareSemver(x.parsed, currentParsed) > 0 && compareSemver(x.parsed, latestParsed) <= 0)
                        .sort((a, b) => compareSemver(a.parsed, b.parsed));

                    const firstMissedVer = missedStable[0]?.raw || latestVer;
                    const publishedIso = meta.time?.[firstMissedVer] || meta.time?.[latestVer];
                    if (!publishedIso) return;

                    const daysBehind = Math.floor((Date.now() - Date.parse(publishedIso)) / (1000 * 60 * 60 * 24));
                    if (daysBehind > maxStaleDays) {
                        stalePackages.push(
                            `${pkgName}: installed ${currentVer} -> latest ${latestVer} (missed ${firstMissedVer} published ${daysBehind} days ago)`
                        );
                    }
                })
            );

            if (stalePackages.length > 0) {
                throw new Error(
                    `Outdated runtime/vendored dependencies (> ${maxStaleDays} days behind):\n  - ` +
                    stalePackages.sort().join('\n  - ')
                );
            }
        }, 20000);
    });
});
