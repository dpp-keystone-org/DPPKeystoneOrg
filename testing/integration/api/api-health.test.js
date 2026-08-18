import { startTestServer } from '../../scripts/api-test-helper.mjs';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';

describe('HTTP API - Health & Security (Integration Test)', () => {
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

    it('GET /health should return 200 OK with status and timestamp', async () => {
        const response = await fetch(`${baseUrl}/health`);
        expect(response.status).toBe(200);
        expect(response.headers.get('content-type')).toContain('application/json');

        const body = await response.json();
        expect(body.status).toBe('ok');
        expect(body.timestamp).toBeDefined();
    });

    it('GET /version, GET /v3/version, and legacy GET /v1/version should return 200 OK with accurate version info', async () => {
        const response1 = await fetch(`${baseUrl}/version`);
        expect(response1.status).toBe(200);
        const body1 = await response1.json();
        expect(body1.status).toBe('ok');
        expect(body1.version).toBe(KEYSTONE_VERSION);
        expect(body1.activeVersion).toBe(KEYSTONE_VERSION);

        const response2 = await fetch(`${baseUrl}/v3/version`);
        expect(response2.status).toBe(200);
        const body2 = await response2.json();
        expect(body2.status).toBe('ok');
        expect(body2.version).toBe('v3');
        expect(body2.activeVersion).toBe(KEYSTONE_VERSION);

        const response3 = await fetch(`${baseUrl}/v1/version`);
        expect(response3.status).toBe(200);
        const body3 = await response3.json();
        expect(body3.status).toBe('ok');
        expect(body3.version).toBe('v1');
        expect(body3.activeVersion).toBe(KEYSTONE_VERSION);
    });

    it('OPTIONS /render/html should respond with CORS preflight headers', async () => {
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://disco.example.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Accept'
            }
        });

        expect(response.status).toBe(204);
        expect(response.headers.get('access-control-allow-origin')).toBe('*');
        expect(response.headers.get('access-control-allow-methods')).toContain('POST');
        expect(response.headers.get('access-control-allow-headers')).toContain('Content-Type');
    });

    it('GET on unknown routes should return 404 Not Found', async () => {
        const response = await fetch(`${baseUrl}/non-existent-endpoint`);
        expect(response.status).toBe(404);

        const body = await response.json();
        expect(body.error).toBeDefined();
    });

    it('POST with oversized payload (>1MB) should be rejected', async () => {
        // Generate a 1.2MB payload
        const hugeString = 'x'.repeat(1.2 * 1024 * 1024);
        const response = await fetch(`${baseUrl}/render/html`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dpp: { dummy: hugeString } })
        });

        expect([400, 413]).toContain(response.status);
    });
});
