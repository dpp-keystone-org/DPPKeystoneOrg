import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import yaml from 'js-yaml';

import { startTestServer } from '../../scripts/api-test-helper.mjs';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

async function loadJson(relPath) {
    const raw = await fs.readFile(path.join(PROJECT_ROOT, relPath), 'utf-8');
    return jsoncParse(raw.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION));
}

describe('HTTP API - EC Battery Validation & Drift Detection (POST /validate)', () => {
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

    describe('GET /specifications & Bundle Drift Detection', () => {
        it('should load all patched EC schemas, shapes, and contexts from ec-bundle/', async () => {
            const resp = await fetch(`${baseUrl}/specifications?target=patched`);
            expect(resp.status).toBe(200);
            const body = await resp.json();
            expect(body.target).toBe('patched');
            expect(body.schemaCount).toBeGreaterThanOrEqual(18);
            expect(body.shapeCount).toBeGreaterThanOrEqual(18);
            expect(body.contextCount).toBeGreaterThanOrEqual(5);
            expect(body.recognizedSpecs.length).toBeGreaterThanOrEqual(17);
        });

        it('should load all raw EC schemas, shapes, and contexts from ec-bundle-raw/ without drift', async () => {
            const resp = await fetch(`${baseUrl}/specifications?target=raw`);
            expect(resp.status).toBe(200);
            const body = await resp.json();
            expect(body.target).toBe('raw');
            expect(body.schemaCount).toBeGreaterThanOrEqual(18);
            expect(body.shapeCount).toBeGreaterThanOrEqual(18);
            expect(body.contextCount).toBeGreaterThanOrEqual(5);
            expect(body.recognizedSpecs.length).toBeGreaterThanOrEqual(17);
        });

        it('should reject invalid target parameter with 400', async () => {
            const resp = await fetch(`${baseUrl}/specifications?target=unknown`);
            expect(resp.status).toBe(400);
            const body = await resp.json();
            expect(body.code).toBe('INVALID_TARGET');
        });

        it('GET /openapi.yml should return a valid, parseable OpenAPI 3.1 specification', async () => {
            const resp = await fetch(`${baseUrl}/openapi.yml`);
            expect(resp.status).toBe(200);
            expect(resp.headers.get('content-type')).toContain('application/yaml');
            const text = await resp.text();
            const parsed = yaml.load(text);
            expect(parsed.openapi).toBe('3.1.0');
            expect(parsed.paths['/validate']).toBeDefined();
            expect(parsed.paths['/adapt']).toBeDefined();
        });
    });

    describe('POST /validate (target: patched)', () => {
        let validPatchedEvb;

        beforeAll(async () => {
            // Use the patched EVB conformance fixture from ec-bundle
            const fixturePath = path.join(
                PROJECT_ROOT,
                'ec-bundle/semantics/product/batteries/subgroup/evb/1.0.0/tests/conforms/pub-batteries-evb.json'
            );
            validPatchedEvb = JSON.parse(await fs.readFile(fixturePath, 'utf-8'));
        });

        it('should pass strict validation (schema + shacl) for a valid patched EVB DPP', async () => {
            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: validPatchedEvb,
                    options: { target: 'patched', mode: 'strict' }
                })
            });
            const body = await resp.json();
            if (resp.status !== 200) {
                console.error('Patched strict validation failed:', JSON.stringify(body, null, 2));
            }
            expect(resp.status).toBe(200);
            expect(body.valid).toBe(true);
            expect(body.target).toBe('patched');
            expect(body.mode).toBe('strict');
            expect(body.schemaExecuted).toBe(true);
            expect(body.shaclExecuted).toBe(true);
            expect(body.findings).toEqual([]);
        });

        it('should support schema-only mode without running SHACL', async () => {
            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: validPatchedEvb,
                    options: { target: 'patched', mode: 'schema' }
                })
            });
            expect(resp.status).toBe(200);
            const body = await resp.json();
            expect(body.valid).toBe(true);
            expect(body.schemaExecuted).toBe(true);
            expect(body.shaclExecuted).toBe(false);
        });

        it('should support shacl-only mode without running JSON Schema', async () => {
            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: validPatchedEvb,
                    options: { target: 'patched', mode: 'shacl' }
                })
            });
            expect(resp.status).toBe(200);
            const body = await resp.json();
            expect(body.valid).toBe(true);
            expect(body.schemaExecuted).toBe(false);
            expect(body.shaclExecuted).toBe(true);
        });

        it('should return 422 when a required patched field is missing', async () => {
            const broken = structuredClone(validPatchedEvb);
            delete broken.batteryWeight;

            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: broken,
                    options: { target: 'patched', mode: 'strict' }
                })
            });
            expect(resp.status).toBe(422);
            const body = await resp.json();
            expect(body.valid).toBe(false);
            expect(body.findings.length).toBeGreaterThan(0);
            expect(body.findings.some((f) => f.stage === 'JSON_SCHEMA')).toBe(true);
            expect(body.findings.some((f) => f.stage === 'SHACL')).toBe(true);
        });

        it('should also accept raw DPP JSON body with query parameters', async () => {
            const resp = await fetch(`${baseUrl}/validate?target=patched&mode=schema`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(validPatchedEvb)
            });
            expect(resp.status).toBe(200);
            const body = await resp.json();
            expect(body.valid).toBe(true);
        });
    });

    describe('POST /validate (target: raw)', () => {
        let validRawEvb;

        beforeAll(async () => {
            // Adapt the Keystone EV battery example into raw EC format to test raw validation
            const keystoneEv = await loadJson('src/examples/battery-dpp-v1.json');
            const adaptResp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: keystoneEv,
                    options: { target: 'raw' }
                })
            });
            const adaptBody = await adaptResp.json();
            validRawEvb = adaptBody.adaptedDpp;
        });

        it('should validate a conforming raw EC EVB payload in schema mode', async () => {
            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: validRawEvb,
                    options: { target: 'raw', mode: 'schema' }
                })
            });
            const body = await resp.json();
            if (resp.status !== 200) {
                console.error('Raw schema validation failed:', JSON.stringify(body, null, 2));
            }
            expect(resp.status).toBe(200);
            expect(body.valid).toBe(true);
            expect(body.target).toBe('raw');
            expect(body.schemaExecuted).toBe(true);
            expect(body.shaclExecuted).toBe(false);
        });

        it('should reject a patched-format payload when validated against target: raw', async () => {
            const fixturePath = path.join(
                PROJECT_ROOT,
                'ec-bundle/semantics/product/batteries/subgroup/evb/1.0.0/tests/conforms/pub-batteries-evb.json'
            );
            const patchedDoc = JSON.parse(await fs.readFile(fixturePath, 'utf-8'));

            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: patchedDoc,
                    options: { target: 'raw', mode: 'schema' }
                })
            });
            expect(resp.status).toBe(422);
            const body = await resp.json();
            expect(body.valid).toBe(false);
            expect(body.findings.length).toBeGreaterThan(0);
        });

        it('should return warnings about raw context bugs when SHACL is executed on target: raw', async () => {
            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: validRawEvb,
                    options: { target: 'raw', mode: 'strict' }
                })
            });
            const body = await resp.json();
            expect(body.shaclExecuted).toBe(true);
            expect(body.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling', () => {
        it('should return 405 on GET /validate', async () => {
            const resp = await fetch(`${baseUrl}/validate`);
            expect(resp.status).toBe(405);
        });

        it('should return 400 on invalid mode', async () => {
            const resp = await fetch(`${baseUrl}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp: { a: 1 }, options: { mode: 'invalid' } })
            });
            expect(resp.status).toBe(400);
            const body = await resp.json();
            expect(body.code).toBe('INVALID_MODE');
        });
    });
});
