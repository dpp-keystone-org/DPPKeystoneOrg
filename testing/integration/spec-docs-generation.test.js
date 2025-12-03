import {
    generateSpecDocs,
    parseOntologyMetadata,
    parseContextMetadata,
    generateOntologyHtml,
    generateContextHtml
} from '../../scripts/generate-spec-docs.mjs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FIXTURES_DIR = resolve(__dirname, '../fixtures/spec-docs');
const TEMP_OUTPUT_DIR = resolve(__dirname, '../tmp/spec-docs-output');
const TEMP_DIST_DIR = join(TEMP_OUTPUT_DIR, 'dist', 'spec');


describe('generate-spec-docs.mjs', () => {

    beforeEach(async () => {
        // Clean up the temporary output directory before each test
        await fs.rm(TEMP_OUTPUT_DIR, { recursive: true, force: true });
        await fs.mkdir(TEMP_DIST_DIR, { recursive: true });
        await fs.mkdir(join(TEMP_DIST_DIR, 'ontology', 'v1', 'core'), { recursive: true });
        await fs.mkdir(join(TEMP_DIST_DIR, 'ontology', 'v1', 'sectors'), { recursive: true });
        await fs.mkdir(join(TEMP_DIST_DIR, 'contexts', 'v1'), { recursive: true });

        // Copy mock files to the temp dist directory, simulating the build process
        await fs.copyFile(
            join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core.jsonld'),
            join(TEMP_DIST_DIR, 'ontology', 'v1', 'core', 'mock-core.jsonld')
        );
        await fs.copyFile(
            join(FIXTURES_DIR, 'contexts', 'v1', 'mock-core.context.jsonld'),
            join(TEMP_DIST_DIR, 'contexts', 'v1', 'mock-core.context.jsonld')
        );
    });

    afterAll(async () => {
        // Clean up after all tests are done
        await fs.rm(TEMP_OUTPUT_DIR, { recursive: true, force: true });
    });

    describe('Unit Tests', () => {
        it('should parse ontology metadata correctly', async () => {
            const content = await fs.readFile(join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core.jsonld'), 'utf-8');
            const { title, description, classes } = parseOntologyMetadata(content);

            expect(title).toBe('Mock Core Ontology');
            expect(description).toBe('A mock ontology for testing purposes.');
            expect(classes).toHaveLength(1);
            expect(classes[0].label).toBe('Mock Product');
            expect(classes[0].properties).toHaveLength(1);
            expect(classes[0].properties[0].label).toBe('Mock Property');
            expect(classes[0].properties[0].comment).toBe('A test property for the Mock Product.');
        });

        it('should parse context metadata correctly', async () => {
            const content = await fs.readFile(join(FIXTURES_DIR, 'contexts', 'v1', 'mock-core.context.jsonld'), 'utf-8');
            const mockTermDictionary = {
                "https://dpp-keystone.org/spec/v1/terms#mockProperty": {
                    description: "A test property for the Mock Product.",
                    module: "core",
                    fileName: "mock-core.jsonld"
                }
            };
            const { imports, localTerms } = parseContextMetadata(content, mockTermDictionary);

            expect(imports).toHaveLength(0);
            expect(localTerms).toHaveLength(2);
            expect(localTerms[1].term).toBe('mockProp');
            expect(localTerms[1].uri).toBe('https://dpp-keystone.org/spec/v1/terms#mockProperty');
            expect(localTerms[1].description).toBe('A test property for the Mock Product.');
        });
    });

    describe('Integration Test', () => {
        it('should generate spec docs in the temp directory', async () => {
            // Run the script with our test directories
            await generateSpecDocs({
                srcDir: FIXTURES_DIR,
                distDir: TEMP_DIST_DIR
            });

            // Check if ontology doc was created
            const ontologyDocPath = join(TEMP_DIST_DIR, 'ontology', 'v1', 'core', 'index.html');
            expect(fs.access(ontologyDocPath)).resolves.not.toThrow();

            // Check if context doc was created
            const contextDocPath = join(TEMP_DIST_DIR, 'contexts', 'v1', 'index.html');
            expect(fs.access(contextDocPath)).resolves.not.toThrow();

            // Check content of the generated ontology documentation
            const ontologyHtml = await fs.readFile(ontologyDocPath, 'utf-8');
            expect(ontologyHtml).toContain('<h1>Ontology Explorer</h1>');
            expect(ontologyHtml).toContain('<h3>Class: Mock Product');
            expect(ontologyHtml).toContain('<td>Mock Property');
            expect(ontologyHtml).toContain('<td>A test property for the Mock Product.</td>');
            
            // Check content of the generated context documentation
            const contextHtml = await fs.readFile(contextDocPath, 'utf-8');
            expect(contextHtml).toContain('<h1>Context Explorer</h1>');
            expect(contextHtml).toContain('<strong>mockProp</strong>');
            expect(contextHtml).toContain('<em>A test property for the Mock Product.</em>');
        });
    });
});
