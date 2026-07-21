import { promises as fs } from 'fs';
import path from 'path';
import { generateSpecDocs } from '../../scripts/generate-spec-docs.mjs';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import { setupTestEnvironment } from '../scripts/test-helpers.mjs';

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
        
        const indexPath = path.join(TEMP_DIST_SPEC_DIR, 'contexts', KEYSTONE_VERSION, 'mock-core.context', 'index.html');
        content = await fs.readFile(indexPath, 'utf-8');
    });

    afterAll(async () => {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
    });

    it('should link a Class term to its own page', async () => {
        const expectedLink = `../../../ontology/${KEYSTONE_VERSION}/core/mock-core/MockProduct.html`;
        const expectedHtml = `<li><a href="${expectedLink}"><strong>mockProduct</strong></a> - <em><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Represents a generic product for testing.&quot;}]">Represents a generic product for testing.</span></em></li>`;
        expect(content).toContain(expectedHtml);
    });

    it('should link a Property term to its parent Class page', async () => {
        const expectedLink = `../../../ontology/${KEYSTONE_VERSION}/core/mock-core/MockProduct.html`;
        const expectedHtml = `<li><a href="${expectedLink}"><strong>mockProp</strong></a> - <em><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;A test property for the Mock Product.&quot;}]">A test property for the Mock Product.</span></em></li>`;
        expect(content).toContain(expectedHtml);
    });

    it('should link a Class term to its own page from a nested context', async () => {
        const indexPath = path.join(TEMP_DIST_SPEC_DIR, 'contexts', KEYSTONE_VERSION, 'cement', 'mock-cement.context', 'index.html');
        const nestedContent = await fs.readFile(indexPath, 'utf-8').catch(() => '');
        
        const expectedLink = `../../../../ontology/${KEYSTONE_VERSION}/sectors/cement/mock-cement/MockCementProduct.html`;
        expect(nestedContent).toContain(expectedLink);
    });
});
