import { promises as fs } from 'fs';
import path from 'path';
import { generateSpecDocs } from '../../scripts/generate-spec-docs.mjs';
import { setupTestEnvironment } from './test-helpers.mjs';

describe('Context documentation page generation', () => {

    let TEMP_DIR;
    let TEMP_DIST_SPEC_DIR;

    beforeAll(async () => {
        const { tempDir, distSpecDir } = await setupTestEnvironment('context-docs-dist');
        TEMP_DIR = tempDir;
        TEMP_DIST_SPEC_DIR = distSpecDir;
        // Run the script to generate the docs
        await generateSpecDocs({ srcDir: path.resolve(process.cwd(), 'fixtures', 'spec-docs'), distDir: TEMP_DIST_SPEC_DIR });
    });

    afterAll(async () => {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
    });

    it('should create a directory for the context file', async () => {
        const contextDir = path.join(TEMP_DIST_SPEC_DIR, 'contexts', 'v1', 'mock-core.context');
        const stats = await fs.stat(contextDir);
        expect(stats.isDirectory()).toBe(true);
    });

    it('should create an index.html file in the context directory', async () => {
        const indexPath = path.join(TEMP_DIST_SPEC_DIR, 'contexts', 'v1', 'mock-core.context', 'index.html');
        const stats = await fs.stat(indexPath);
        expect(stats.isFile()).toBe(true);
    });

    it('should contain a link to the raw jsonld file and display term information', async () => {
        const indexPath = path.join(TEMP_DIST_SPEC_DIR, 'contexts', 'v1', 'mock-core.context', 'index.html');
        const content = await fs.readFile(indexPath, 'utf-8');
        
        // Check for the link to the raw file
        expect(content).toContain('<a href="../mock-core.context.jsonld">mock-core.context.jsonld</a>');

        // Check for imported contexts
        expect(content).toContain('<h4>Imports</h4>');
        expect(content).toContain('<li>https://dpp-keystone.org/spec/v1/contexts/dpp-core.context.jsonld</li>');

        // Check for locally defined terms
        expect(content).toContain('<h4>Locally Defined Terms</h4>');
    });
});
