import { promises as fs } from 'fs';
import path from 'path';
import { generateSpecDocs } from '../../scripts/generate-spec-docs.mjs';
import { setupTestEnvironment } from './test-helpers.mjs';

describe('Context documentation page link generation', () => {

    let TEMP_DIR;
    let TEMP_DIST_SPEC_DIR;
    let FIXTURES_DIR;

    beforeAll(async () => {
        const { tempDir, distSpecDir, fixturesDir } = await setupTestEnvironment('context-docs-links-dist');
        TEMP_DIR = tempDir;
        TEMP_DIST_SPEC_DIR = distSpecDir;
        FIXTURES_DIR = fixturesDir;
        // Run the script to generate the docs
        await generateSpecDocs({ srcDir: FIXTURES_DIR, distDir: TEMP_DIST_SPEC_DIR });
    });

    afterAll(async () => {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
    });

    it('should contain a correct link to the class documentation', async () => {
        const indexPath = path.join(TEMP_DIST_SPEC_DIR, 'contexts', 'v1', 'mock-core.context', 'index.html');
        const content = await fs.readFile(indexPath, 'utf-8');
        
        // The link should go up three levels to escape spec/contexts/v1/context-name/
        const expectedLink = '../../../ontology/v1/core/mock-core/MockProduct.html';
        expect(content).toContain(`href="${expectedLink}"`);
    });
});
