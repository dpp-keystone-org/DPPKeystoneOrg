import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';

import { startTestServer } from '../../scripts/api-test-helper.mjs';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';

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
});
