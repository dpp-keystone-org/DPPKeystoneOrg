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
import { renderProductPage } from '../../../src/util/js/common/rendering/dpp-html-renderer.js';

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
});
