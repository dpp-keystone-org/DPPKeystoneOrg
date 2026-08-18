import { startTestServer } from '../../scripts/api-test-helper.mjs';

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

    it('GET /v1/version should return 200 OK with version info', async () => {
        const response = await fetch(`${baseUrl}/v1/version`);
        expect(response.status).toBe(200);

        const body = await response.json();
        expect(body.status).toBe('ok');
        expect(body.version).toBeDefined();
    });

    it('OPTIONS /v1/render/html should respond with CORS preflight headers', async () => {
        const response = await fetch(`${baseUrl}/v1/render/html`, {
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
        const response = await fetch(`${baseUrl}/v1/non-existent-endpoint`);
        expect(response.status).toBe(404);

        const body = await response.json();
        expect(body.error).toBeDefined();
    });

    it('POST with oversized payload (>1MB) should be rejected', async () => {
        // Generate a 1.2MB payload
        const hugeString = 'x'.repeat(1.2 * 1024 * 1024);
        const response = await fetch(`${baseUrl}/v1/render/html`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dpp: { dummy: hugeString } })
        });

        expect([400, 413]).toContain(response.status);
    });
});
