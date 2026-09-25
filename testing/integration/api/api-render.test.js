import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import { startTestServer } from '../../scripts/api-test-helper.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

describe('HTTP API - POST /v1/render/html (Integration Test)', () => {
    let testServer;
    let baseUrl;
    let validBatteryDpp;

    beforeAll(async () => {
        const distExample = path.join(PROJECT_ROOT, 'dist/spec/examples/battery-dpp-v1.json');
        const srcExample = path.join(PROJECT_ROOT, 'src/examples/battery-dpp-v1.json');
        const examplePath = existsSync(distExample) ? distExample : srcExample;
        const content = await fs.readFile(examplePath, 'utf-8');
        validBatteryDpp = jsoncParse(content, [], { allowComments: true, allowTrailingComma: true });

        testServer = await startTestServer();
        baseUrl = testServer.baseUrl;
    });

    afterAll(async () => {
        if (testServer) {
            await testServer.close();
        }
    });

    it('should return 200 OK with raw HTML on both /render/html and /v3/render/html for a valid DPP', async () => {
        const response1 = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/html'
            },
            body: JSON.stringify({
                dpp: validBatteryDpp,
                options: {
                    includeSchema: true,
                    language: 'en'
                }
            })
        });

        expect(response1.status).toBe(200);
        expect(response1.headers.get('content-type')).toContain('text/html');
        const html1 = await response1.text();
        expect(html1).toContain('<!DOCTYPE html>');
        expect(html1).toContain('Digital Product Passport');

        const response2 = await fetch(`${baseUrl}/v3/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dpp: validBatteryDpp
            })
        });

        expect(response2.status).toBe(200);
        expect(response2.headers.get('content-type')).toContain('text/html');
        const html2 = await response2.text();
        expect(html2).toContain('<!DOCTYPE html>');
    });

    it('should return 200 OK without Schema.org JSON-LD when options.includeSchema is false', async () => {
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dpp: validBatteryDpp,
                options: {
                    includeSchema: false
                }
            })
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');

        const html = await response.text();
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).not.toContain('<script type="application/ld+json">');
    });

    it('should return 422 Unprocessable Content when DPP fails schema/ontology validation', async () => {
        const invalidPayload = {
            ...validBatteryDpp,
            digitalProductPassportId: undefined // delete mandatory ID
        };
        delete invalidPayload.digitalProductPassportId;

        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                dpp: invalidPayload
            })
        });

        expect(response.status).toBe(422);
        expect(response.headers.get('content-type')).toContain('application/json');

        const json = await response.json();
        expect(json.error).toBeDefined();
        expect(json.code).toBe('VALIDATION_FAILED');
        expect(Array.isArray(json.errors)).toBe(true);
        expect(json.errors.length).toBeGreaterThan(0);
    });

    it('should return 400 Bad Request when request body is missing "dpp" field', async () => {
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                wrongField: {}
            })
        });

        expect(response.status).toBe(400);
        const json = await response.json();
        expect(json.code).toBe('INVALID_REQUEST');
    });

    it('should return 400 Bad Request when request body is malformed JSON', async () => {
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{ bad json'
        });

        expect(response.status).toBe(400);
    });

    it('should return 405 Method Not Allowed when requesting GET on /render/html or /v3/render/html', async () => {
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'GET'
        });

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toContain('POST');
    });

    it('should return localized German HTML when options.language is "de"', async () => {
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                dpp: validBatteryDpp,
                options: {
                    language: 'de'
                }
            })
        });

        expect(response.status).toBe(200);
        const html = await response.text();
        expect(html).toContain('Herstellungsort');
        expect(html).toContain('Batteriemasse');
    });

    it('should be lenient and render a DPP with additional unrecognized properties and external @context URLs without network calls', async () => {
        const extendedDpp = {
            ...validBatteryDpp,
            '@context': [
                'https://dpp-keystone.org/spec/contexts/v3/battery.jsonld',
                'https://ref.gs1.org/epcis/epcis-context.jsonld',
                'https://schema.org/'
            ],
            epcisEventHistory: [
                {
                    eventType: 'ObjectEvent',
                    action: 'OBSERVE',
                    eventTime: '2026-09-01T10:00:00Z',
                    bizStep: 'commissioning'
                }
            ],
            supplierCustomCode: 'EXT-CODE-9941',
            warrantyNotes: 'Extended 5-year commercial warranty.'
        };

        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dpp: extendedDpp })
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-security-policy')).toBeDefined();
        expect(response.headers.get('x-content-type-options')).toBe('nosniff');

        const html = await response.text();
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('EXT-CODE-9941');
        expect(html).toContain('Extended 5-year commercial warranty.');
    });

    it('should reject requests specifying an unsupported version in the URL or options with 400 Bad Request', async () => {
        const response1 = await fetch(`${baseUrl}/v999/render/html`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dpp: validBatteryDpp })
        });
        expect(response1.status).toBe(400);
        const json1 = await response1.json();
        expect(json1.code).toBe('INVALID_VERSION');

        const response2 = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dpp: validBatteryDpp,
                options: { version: 'v999' }
            })
        });
        expect(response2.status).toBe(400);
        const json2 = await response2.json();
        expect(json2.code).toBe('INVALID_VERSION');
    });
});
