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

    it('should return 200 OK with raw HTML when Accept: text/html is requested for a valid DPP', async () => {
        const response = await fetch(`${baseUrl}/v1/render/html`, {
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

        if (response.status !== 200) {
            const errText = await response.text();
            console.error(`POST /v1/render/html returned status ${response.status}:`, errText);
        }
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('text/html');
        
        const html = await response.text();
        expect(html).toContain('<!DOCTYPE html>');
        expect(html).toContain('<html lang="en">');
        expect(html).toContain('Digital Product Passport');
        expect(html).toContain('<script type="application/ld+json">');
    });

    it('should return 200 OK with JSON { valid: true, html: "..." } when Accept: application/json is requested', async () => {
        const response = await fetch(`${baseUrl}/v1/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                dpp: validBatteryDpp,
                options: {
                    includeSchema: false
                }
            })
        });

        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');

        const json = await response.json();
        expect(json.valid).toBe(true);
        expect(typeof json.html).toBe('string');
        expect(json.html).toContain('<!DOCTYPE html>');
    });

    it('should return 422 Unprocessable Content when DPP fails schema/ontology validation', async () => {
        const invalidPayload = {
            ...validBatteryDpp,
            digitalProductPassportId: undefined // delete mandatory ID
        };
        delete invalidPayload.digitalProductPassportId;

        const response = await fetch(`${baseUrl}/v1/render/html`, {
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
        const response = await fetch(`${baseUrl}/v1/render/html`, {
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
        const response = await fetch(`${baseUrl}/v1/render/html`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: '{ bad json'
        });

        expect(response.status).toBe(400);
    });

    it('should return 405 Method Not Allowed when requesting GET on /v1/render/html', async () => {
        const response = await fetch(`${baseUrl}/v1/render/html`, {
            method: 'GET'
        });

        expect(response.status).toBe(405);
        expect(response.headers.get('allow')).toContain('POST');
    });
});
