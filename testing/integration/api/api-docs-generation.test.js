import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

describe('API Documentation & OpenAPI 3.1 Build Artifacts', () => {
    const distApiIndexPath = path.join(PROJECT_ROOT, 'dist/api/index.html');
    const distOpenApiPath = path.join(PROJECT_ROOT, 'dist/api/openapi.yml');
    const distRootIndexPath = path.join(PROJECT_ROOT, 'dist/index.html');

    it('should build dist/api/index.html and dist/api/openapi.yml', () => {
        expect(existsSync(distApiIndexPath)).toBe(true);
        expect(existsSync(distOpenApiPath)).toBe(true);
    });

    it('should produce a valid OpenAPI 3.1 YAML document with core endpoints and schemas', async () => {
        const raw = await fs.readFile(distOpenApiPath, 'utf-8');
        const doc = yaml.load(raw);

        expect(doc).toBeDefined();
        expect(String(doc.openapi)).toMatch(/^3\.1\.\d+$/);
        expect(doc.info?.title).toBeTruthy();
        expect(Array.isArray(doc.servers) && doc.servers.length).toBeGreaterThan(0);

        // Verify core paths exist without coupling to exact internal schema fields
        for (const route of ['/adapt', '/validate', '/specifications', '/health', '/version', '/openapi.yml']) {
            expect(doc.paths?.[route]).toBeDefined();
        }

        expect(doc.components?.schemas?.DppPayload).toBeDefined();
        expect(doc.components?.schemas?.ValidationReport).toBeDefined();
        expect(doc.components?.schemas?.AdaptResponse).toBeDefined();
    });

    it('should include Keystone header, Swagger UI config, download link, and contrast-safe CSS in dist/api/index.html', async () => {
        const html = await fs.readFile(distApiIndexPath, 'utf-8');

        expect(html).toContain('id="dpp-header-container"');
        expect(html).toContain('id="swagger-ui"');
        expect(html).toContain('SwaggerUIBundle');
        expect(html).toContain('tryItOutEnabled: true');
        expect(html).toContain('href="./openapi.yml"');
        // Ensure CSS guards against keystone-style.css bleeding into Swagger UI
        expect(html).toContain('#swagger-ui pre code');
        expect(html).toContain('#swagger-ui section.models button');
        expect(html).toContain('#swagger-ui .json-schema-2020-12 button');
    });

    it('should link to api/ and include file-based curl examples on the main dist/index.html', async () => {
        const html = await fs.readFile(distRootIndexPath, 'utf-8');

        expect(html).toContain('id="ec-battery-adaptation"');
        expect(html).toContain('href="api/"');
        expect(html).toContain('--data-binary @');
    });
});
