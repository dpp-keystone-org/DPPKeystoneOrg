import {
    generateSpecDocs,
    parseOntologyMetadata,
    parseContextMetadata,
} from '../../scripts/generate-spec-docs.mjs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { setupTestEnvironment } from './test-helpers.mjs';

describe('generate-spec-docs.mjs', () => {

    let FIXTURES_DIR;
    let TEMP_DIR;
    let TEMP_DIST_DIR;

    beforeAll(async () => {
        const { fixturesDir, tempDir, distSpecDir } = await setupTestEnvironment('spec-docs-output');
        FIXTURES_DIR = fixturesDir;
        TEMP_DIR = tempDir;
        TEMP_DIST_DIR = distSpecDir;
    });

    afterAll(async () => {
        await fs.rm(TEMP_DIR, { recursive: true, force: true });
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

            expect(imports).toHaveLength(1);
            expect(imports[0]).toBe('https://dpp-keystone.org/spec/v1/contexts/dpp-core.context.jsonld');
            expect(localTerms).toHaveLength(2);
            expect(localTerms[1].term).toBe('mockProp');
            expect(localTerms[1].uri).toBe('https://dpp-keystone.org/spec/v1/terms#mockProperty');
            expect(localTerms[1].description).toBe('A test property for the Mock Product.');
        });

        it('should parse ontology metadata from the top level', async () => {
            const content = await fs.readFile(join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core-toplevel.jsonld'), 'utf-8');
            const { title, description } = parseOntologyMetadata(content);

            expect(title).toBe('Mock Toplevel Title');
            expect(description).toBe('Mock Toplevel Description.');
        });
    });

   describe('Integration Test', () => {
        it('should generate correct module and global index files', async () => {
            // Run the script with our test directories
            await generateSpecDocs({
                srcDir: FIXTURES_DIR,
                distDir: TEMP_DIST_DIR
            });

            // Check if the main directory index for 'core' was created
            const ontologyDocPath = join(TEMP_DIST_DIR, 'ontology', 'v1', 'core', 'index.html');
            await expect(fs.access(ontologyDocPath)).resolves.not.toThrow();

            // Check that the directory index now links to the module index
            const ontologyHtml = await fs.readFile(ontologyDocPath, 'utf-8');
            expect(ontologyHtml).toContain('<h1>Ontology Modules in ontology/v1/core</h1>');
            expect(ontologyHtml).toContain('<li><a href="./mock-core/index.html">Mock Core Ontology</a></li>');

            // Check if the context doc was created (this part of the generator hasn't changed)
            const contextDocPath = join(TEMP_DIST_DIR, 'contexts', 'v1', 'index.html');
            await expect(fs.access(contextDocPath)).resolves.not.toThrow();
            
            // Check if global index was created and contains the correct link
            const globalIndexDocPath = join(TEMP_DIST_DIR, 'ontology', 'v1', 'index.html');
            await expect(fs.access(globalIndexDocPath)).resolves.not.toThrow();
            const globalIndexHtml = await fs.readFile(globalIndexDocPath, 'utf-8');
            expect(globalIndexHtml).toContain('<h3>All Classes</h3>');
            expect(globalIndexHtml).toContain('<a href="./core/mock-core/MockProduct.html">dppk:MockProduct</a>');
        });

        it('should generate an individual HTML file for each class', async () => {
            // This test defines the new desired behavior.
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
            expect(moduleIndexHtml).toContain('<li><a href="MockProduct.html">Mock Product</a></li>');
            
            // Check that the title and description are correctly displayed
            expect(moduleIndexHtml).toContain('<h2 style="margin: 0; color: var(--text-light);">Mock Core Ontology</h2>');
            expect(moduleIndexHtml).toContain('<p>A mock ontology for testing purposes.</p>');


            // Check for the individual class file, using the name derived from its ID
            const classFilePath = join(moduleDirPath, 'MockProduct.html');
            await expect(fs.access(classFilePath)).resolves.not.toThrow();

            // Check for key content in the class file
            const classHtml = await fs.readFile(classFilePath, 'utf-8');
            expect(classHtml).toContain('<h2 style="margin: 0; color: var(--text-light);">Class: Mock Product (dppk:MockProduct)</h2>');
            expect(classHtml).toContain('<p>Represents a generic product for testing.</p>');
            expect(classHtml).toContain('<p><strong>subClassOf:</strong> <a href="MockBase.html">dppk:MockBase</a>, <a href="MockThing.html">dppk:MockThing</a></p>')
            
            // Check for correct CSS path
            expect(classHtml).toContain('<link rel="stylesheet" href="../../../../branding/css/keystone-style.css">');
        });
    });
});
