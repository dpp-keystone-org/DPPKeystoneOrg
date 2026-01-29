import {
    generateSpecDocs,
} from '../../scripts/generate-spec-docs.mjs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { setupTestEnvironment } from '../scripts/test-helpers.mjs';

describe('class-links', () => {

    let FIXTURES_DIR;
    let TEMP_DIR;
    let TEMP_DIST_DIR;

    beforeAll(async () => {
        const { fixturesDir, tempDir, distSpecDir } = await setupTestEnvironment('class-links-output');
        FIXTURES_DIR = fixturesDir;
        TEMP_DIR = tempDir;
        TEMP_DIST_DIR = distSpecDir;
    });

    afterAll(async () => {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
    });

    it('should generate class links without dppk_ prefix', async () => {
        // Run the script with our test directories
        await generateSpecDocs({
            srcDir: FIXTURES_DIR,
            distDir: TEMP_DIST_DIR
        });

        const moduleDirPath = join(TEMP_DIST_DIR, 'ontology', 'v1', 'core', 'mock-core');
        
        // Check that the module's own index was created
        const moduleIndex = join(moduleDirPath, 'index.html');
        await expect(fs.access(moduleIndex)).resolves.not.toThrow();
        const moduleIndexHtml = await fs.readFile(moduleIndex, 'utf-8');
        expect(moduleIndexHtml).toContain('<h3>Classes</h3>');
        // The link should NOT have the dppk_ prefix
        expect(moduleIndexHtml).toContain('<li><a href="MockProduct.html">Mock Product</a></li>');
        
        // Check for the individual class file, using the name derived from its ID without the prefix
        const classFilePath = join(moduleDirPath, 'MockProduct.html');
        await expect(fs.access(classFilePath)).resolves.not.toThrow();

        // Check if global index was created and contains the correct link
        const globalIndexDocPath = join(TEMP_DIST_DIR, 'ontology', 'v1', 'index.html');
        await expect(fs.access(globalIndexDocPath)).resolves.not.toThrow();
        const globalIndexHtml = await fs.readFile(globalIndexDocPath, 'utf-8');
        expect(globalIndexHtml).toContain('<h3>All Classes</h3>');
        // The link in the global index should also NOT have the prefix
        expect(globalIndexHtml).toContain('<a href="./core/mock-core/MockProduct.html">dppk:MockProduct</a>');
    });
});
