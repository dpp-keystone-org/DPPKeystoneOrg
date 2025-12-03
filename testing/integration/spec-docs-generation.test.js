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
            const { title, description, classes, properties } = parseOntologyMetadata(content);

            expect(title).toBe('Mock Core Ontology');
            expect(description).toBe('A mock ontology for testing purposes.');
            expect(classes).toHaveLength(3);
            expect(properties).toHaveLength(3);

            const mockProduct = classes.find(c => c.label === 'Mock Product');
            expect(mockProduct).toBeDefined();
            expect(mockProduct.properties).toHaveLength(1);
            expect(mockProduct.properties[0].label).toBe('Mock Property');
            expect(mockProduct.properties[0].annotations['owl:equivalentProperty']['@id']).toBe('schema:name');
            expect(mockProduct.properties[0].annotations['rdfs:subPropertyOf']['@id']).toBe('dppk:genericIndicator');
            expect(mockProduct.attributes['rdfs:subClassOf']).toHaveLength(2);
            expect(mockProduct.attributes['owl:equivalentClass']).toHaveLength(2);
            expect(mockProduct.attributes['dppk:governedBy']).toEqual(['ISO 9001']);

            const mockBase = classes.find(c => c.label === 'Mock Base');
            expect(mockBase).toBeDefined();

            const mockThing = classes.find(c => c.label === 'Mock Thing');
            expect(mockThing).toBeDefined();
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

            // Class assertions for MockProduct
            expect(ontologyHtml).toContain('<div class="class-section" id="dppk_MockProduct">');
            expect(ontologyHtml).toContain('<h3>Class: Mock Product (dppk:MockProduct)</h3>');
            expect(ontologyHtml).toContain('<p><strong>subClassOf:</strong> <a href="#dppk_MockBase">dppk:MockBase</a>, <a href="#dppk_MockThing">dppk:MockThing</a></p>');
            expect(ontologyHtml).toContain('<p><strong>equivalentClass:</strong> <a href="https://schema.org/Product">schema:Product</a>, <a href="https://ref.gs1.org/voc/Product">gs1:Product</a></p>');
            expect(ontologyHtml).toContain('<p><strong>governedBy:</strong> ISO 9001</p>');

            // Property table assertions
            expect(ontologyHtml).toContain('<th>equivalentProperty</th>');
            expect(ontologyHtml).toContain('<th>subPropertyOf</th>');
            expect(ontologyHtml).toContain('<td><a href="https://schema.org/name">schema:name</a></td>');
            expect(ontologyHtml).toContain('<td><a href="#dppk_genericIndicator">dppk:genericIndicator</a></td>');
            
            // Diagram and other assertions
            expect(ontologyHtml).toContain('<pre class="mermaid">');
            expect(ontologyHtml).toContain('dppk_MockBase <|-- dppk_MockProduct');
            expect(ontologyHtml).toContain('dppk_MockThing <|-- dppk_MockProduct');
            expect(ontologyHtml).toContain('</html>');
            
            // Check if global index was created
            const globalIndexDocPath = join(TEMP_DIST_DIR, 'ontology', 'v1', 'index.html');
            expect(fs.access(globalIndexDocPath)).resolves.not.toThrow();
            const globalIndexHtml = await fs.readFile(globalIndexDocPath, 'utf-8');
            expect(globalIndexHtml).toContain('<h3>All Classes</h3>');
            expect(globalIndexHtml).toContain('<h3>All Properties</h3>');
            expect(globalIndexHtml).toContain('<a href="./core/index.html#dppk_MockProduct">dppk:MockProduct</a>');

            // Check content of the generated context documentation
            const contextHtml = await fs.readFile(contextDocPath, 'utf-8');
            expect(contextHtml).toContain('<h1>Context Explorer</h1>');
            expect(contextHtml).toContain('<strong>mockProp</strong>');
            expect(contextHtml).toContain('<em>A test property for the Mock Product.</em>');
            expect(contextHtml).toContain('</html>');
        });
    });
});
