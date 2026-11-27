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

describe('HTTP API - Keystone to EC Battery Adaptation (POST /adapt)', () => {
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

    const batteryExamples = [
        { file: 'battery-dpp-v1.json', expectedSubgroup: 'evb' },
        { file: 'battery-lmv-dpp-v1.json', expectedSubgroup: 'lmt' },
        { file: 'battery-industrial-dpp-v1.json', expectedSubgroup: 'ind' }
    ];

    test.each(batteryExamples)(
        'adapts $file to patched EC Battery DPP and passes strict validation',
        async ({ file, expectedSubgroup }) => {
            const keystoneDpp = await loadKeystoneExample(file);

            const resp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: keystoneDpp,
                    options: {
                        target: 'patched',
                        validate: true,
                        mode: 'strict'
                    }
                })
            });

            const body = await resp.json();
            if (!body.validation?.valid) {
                console.error(`Patched adaptation validation failed for ${file}:`, JSON.stringify(body.validation, null, 2));
            }
            expect(resp.status).toBe(200);
            expect(body.target).toBe('patched');
            expect(body.subgroup).toBe(expectedSubgroup);
            expect(body.adaptedDpp).toBeDefined();
            expect(typeof body.adaptedDpp.batteryWeight).toBe('number');
            expect(body.validation).toBeDefined();
            expect(body.validation.valid).toBe(true);
            expect(body.validation.findings).toEqual([]);
        }
    );

    test.each(batteryExamples)(
        'adapts $file to raw EC Battery DPP (ec-bundle-raw/) and passes raw JSON Schema validation',
        async ({ file, expectedSubgroup }) => {
            const keystoneDpp = await loadKeystoneExample(file);

            const resp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dpp: keystoneDpp,
                    options: {
                        target: 'raw',
                        validate: true,
                        mode: 'schema'
                    }
                })
            });

            const body = await resp.json();
            if (!body.validation?.valid) {
                console.error(`Raw adaptation validation failed for ${file}:`, JSON.stringify(body.validation, null, 2));
            }
            expect(resp.status).toBe(200);
            expect(body.target).toBe('raw');
            expect(body.subgroup).toBe(expectedSubgroup);
            expect(body.adaptedDpp).toBeDefined();
            // Raw EC v1.0.0 wraps batteryWeight in { value, unit }
            expect(body.adaptedDpp.batteryWeight).toEqual(
                expect.objectContaining({
                    value: expect.any(Number),
                    unit: 'https://repository.product-passport.ec.europa.eu/core/vocabs/measurement-unit#kilogram'
                })
            );
            // Raw EC v1.0.0 requires full URI for granularity
            expect(body.adaptedDpp.granularity).toMatch(
                /^https:\/\/repository\.product-passport\.ec\.europa\.eu\/core\/vocabs\/granularity-level#/
            );
            // Raw EC v1.0.0 requires xx-YY language tags
            expect(Object.keys(body.adaptedDpp.extinguishingAgent)[0]).toMatch(/^[A-Za-z]{2}-[A-Za-z]{2}$/);
            expect(body.validation).toBeDefined();
            expect(body.validation.valid).toBe(true);
            expect(body.validation.findings).toEqual([]);
        }
    );

    it('gracefully adapts a legacy Keystone v1 battery DPP payload', async () => {
        const legacyDpp = await loadKeystoneExample('battery-dpp-v1.json');
        legacyDpp['@context'] = 'https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld';
        legacyDpp.contentSpecificationIds = ['draft_battery_specification_id'];

        const resp = await fetch(`${baseUrl}/adapt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dpp: legacyDpp,
                options: { target: 'patched', validate: true, mode: 'strict' }
            })
        });

        const body = await resp.json();
        expect(resp.status).toBe(200);
        expect(body.sourceVersion).toBe('v1');
        expect(body.validation.valid).toBe(true);
    });

    it('returns 405 on GET /adapt and 400 on invalid target', async () => {
        const getResp = await fetch(`${baseUrl}/adapt`);
        expect(getResp.status).toBe(405);

        const badResp = await fetch(`${baseUrl}/adapt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dpp: { batteryCategory: 'EVBattery' }, options: { target: 'bogus' } })
        });
        expect(badResp.status).toBe(400);
        const badBody = await badResp.json();
        expect(badBody.code).toBe('INVALID_TARGET');
    });

    it('preserves voluntary and untransformed attributes when adapting to patched EC Battery DPP', async () => {
        const keystoneDpp = await loadKeystoneExample('battery-dpp-v1.json');
        keystoneDpp['@context'] = [
            keystoneDpp['@context'],
            {
                ex: 'https://example.org/voc#',
                customWarrantyCode: 'ex:customWarrantyCode'
            }
        ];
        keystoneDpp.hsCode = '85076000';
        keystoneDpp.customWarrantyCode = 'EXT-5Y-EU';
        keystoneDpp.voluntaryNotes = { recyclingPartner: 'GreenCycle GmbH' };

        const resp = await fetch(`${baseUrl}/adapt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dpp: keystoneDpp,
                options: {
                    target: 'patched',
                    validate: true,
                    mode: 'schema'
                }
            })
        });

        const body = await resp.json();
        expect(resp.status).toBe(200);
        expect(body.validation.valid).toBe(true);
        expect(body.adaptedDpp.hsCode).toBe('85076000');
        expect(body.adaptedDpp.customWarrantyCode).toBe('EXT-5Y-EU');
        expect(body.adaptedDpp.voluntaryNotes).toEqual({ recyclingPartner: 'GreenCycle GmbH' });
    });

    it('preserves context-mapped voluntary attributes and passes strict SHACL validation on patched EC Battery DPP', async () => {
        const keystoneDpp = await loadKeystoneExample('battery-dpp-v1.json');
        keystoneDpp['@context'] = [
            keystoneDpp['@context'],
            {
                ex: 'https://example.org/voc#',
                customWarrantyCode: 'ex:customWarrantyCode'
            }
        ];
        keystoneDpp.hsCode = '85076000';
        keystoneDpp.customWarrantyCode = 'EXT-5Y-EU';

        const resp = await fetch(`${baseUrl}/adapt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dpp: keystoneDpp,
                options: {
                    target: 'patched',
                    validate: true,
                    mode: 'strict'
                }
            })
        });

        const body = await resp.json();
        expect(resp.status).toBe(200);
        expect(body.adaptedDpp.hsCode).toBe('85076000');
        expect(body.adaptedDpp.customWarrantyCode).toBe('EXT-5Y-EU');
        expect(body.validation.valid).toBe(true);
        expect(body.validation.findings).toEqual([]);
    });

    it('strips all non-EC voluntary/custom attributes into droppedFields when adapting to target: raw so raw strict validation passes', async () => {
        const keystoneDpp = await loadKeystoneExample('battery-dpp-v1.json');
        keystoneDpp['@context'] = [
            keystoneDpp['@context'],
            'https://ref.gs1.org/epcis/epcis-context.jsonld',
            { ex: 'https://example.org/voc#', customWarrantyCode: 'ex:customWarrantyCode' }
        ];
        keystoneDpp.hsCode = '85076000';
        keystoneDpp.customWarrantyCode = 'EXT-5Y-EU';
        keystoneDpp.voluntaryNotes = { recyclingPartner: 'GreenCycle GmbH' };

        const resp = await fetch(`${baseUrl}/adapt`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dpp: keystoneDpp,
                options: {
                    target: 'raw',
                    validate: true,
                    mode: 'strict'
                }
            })
        });

        const body = await resp.json();
        expect(resp.status).toBe(200);
        expect(body.adaptedDpp.hsCode).toBeUndefined();
        expect(body.adaptedDpp.customWarrantyCode).toBeUndefined();
        expect(body.adaptedDpp.voluntaryNotes).toBeUndefined();
        expect(body.droppedFields).toEqual(expect.arrayContaining(['hsCode', 'customWarrantyCode', 'voluntaryNotes']));
        expect(body.validation.valid).toBe(true);
        expect(body.validation.findings).toEqual([]);
    });
});
