import { promises as fs } from 'fs';
import path from 'path';
import { generateSpecDocs } from '../../scripts/generate-spec-docs.mjs';
import { setupTestEnvironment } from './test-helpers.mjs';

describe('Context documentation page link generation', () => {

    let TEMP_DIR;
    let TEMP_DIST_SPEC_DIR;
    let FIXTURES_DIR;
    let content;

    beforeAll(async () => {
        const { tempDir, distSpecDir, fixturesDir } = await setupTestEnvironment('context-docs-links-dist');
        TEMP_DIR = tempDir;
        TEMP_DIST_SPEC_DIR = distSpecDir;
        FIXTURES_DIR = fixturesDir;
        
        await generateSpecDocs({ srcDir: FIXTURES_DIR, distDir: TEMP_DIST_SPEC_DIR });
        
        const indexPath = path.join(TEMP_DIST_SPEC_DIR, 'contexts', 'v1', 'mock-core.context', 'index.html');
        content = await fs.readFile(indexPath, 'utf-8');
    });

    afterAll(async () => {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
    });

    it('should link a Class term to its own page', async () => {
        const expectedLink = '../../../ontology/v1/core/mock-core/MockProduct.html';
        const expectedHtml = `<li><a href="${expectedLink}"><strong>mockProduct</strong></a> - <em>Represents a generic product for testing.</em></li>`;
        expect(content).toContain(expectedHtml);
    });

    it('should link a Property term to its parent Class page', async () => {
        const expectedLink = '../../../ontology/v1/core/mock-core/MockProduct.html';
        const expectedHtml = `<li><a href="${expectedLink}"><strong>mockProp</strong></a> - <em>A test property for the Mock Product.</em></li>`;
        expect(content).toContain(expectedHtml);
    });
});
