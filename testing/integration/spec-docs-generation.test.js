import {
    generateSpecDocs,
    parseOntologyMetadata,
    parseContextMetadata,
    buildTermDictionary,
    getI18nData,
    renderI18nSpan
} from '../../scripts/generate-spec-docs.mjs';
import { join } from 'path';
import { promises as fs } from 'fs';
import { setupTestEnvironment, PROJECT_ROOT } from '../scripts/test-helpers.mjs';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';

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
            const content = await fs.readFile(join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-core.jsonld'), 'utf-8');
            const { title, description, classes, properties } = parseOntologyMetadata(content);

            expect(title.text).toBe('Mock Core Ontology');
            expect(description.text).toBe('A mock ontology for testing purposes.');
            expect(classes).toHaveLength(5);
            expect(properties).toHaveLength(4);

            const mockProduct = classes.find(c => c.label.text === 'Mock Product');
            expect(mockProduct).toBeDefined();
            // Mock Product has 'Mock Property' (explicit domain), 'Generic Indicator' (no domain), and 'Domain Includes Property'
            expect(mockProduct.properties).toHaveLength(3);
            
            const mockProperty = mockProduct.properties.find(p => p.label.text === 'Mock Property');
            expect(mockProperty).toBeDefined();
            expect(mockProperty.annotations['owl:equivalentProperty']['@id']).toBe('schema:name');
            expect(mockProperty.annotations['rdfs:subPropertyOf']['@id']).toBe('dppk:genericIndicator');
            expect(mockProperty.comment.text).toBe('A test property for the Mock Product.');

            const genericIndicator = mockProduct.properties.find(p => p.label.text === 'Generic Indicator');
            expect(genericIndicator).toBeDefined();
            expect(genericIndicator.comment.text).toBe('A generic indicator for testing sub-property relationships.');

            const domainIncludesProperty = mockProduct.properties.find(p => p.label.text === 'Domain Includes Property');
            expect(domainIncludesProperty).toBeDefined();
            expect(domainIncludesProperty.comment.text).toBe('A test property using schema:domainIncludes.');

            expect(mockProduct.attributes['rdfs:subClassOf']).toHaveLength(2);
            expect(mockProduct.attributes['owl:equivalentClass']).toHaveLength(2);
            expect(mockProduct.attributes['dppk:governedBy']).toEqual(['ISO 9001']);

            const mockBase = classes.find(c => c.label.text === 'Mock Base');
            expect(mockBase).toBeDefined();
            // Mock Base should inherit the domain-less 'Generic Indicator'
            expect(mockBase.properties).toHaveLength(1);
            expect(mockBase.properties[0].label.text).toBe('Generic Indicator');

            const mockThing = classes.find(c => c.label.text === 'Mock Thing');
            expect(mockThing).toBeDefined();
            // Mock Thing should inherit the domain-less 'Generic Indicator'
            expect(mockThing.properties).toHaveLength(1);
            expect(mockThing.properties[0].label.text).toBe('Generic Indicator');

            // Check for enum and concepts
            const mockEnumCat = classes.find(c => c.label.text === 'Mock Enum Category');
            expect(mockEnumCat).toBeDefined();
            expect(mockEnumCat.attributes['owl:oneOf']).toEqual([{ "@id": "dppk:MockEnumValue1" }]);

            const mockEnumValue1 = classes.find(c => c.label.text === 'Mock Enum Value 1');
            expect(mockEnumValue1).toBeDefined();
            expect(mockEnumValue1.attributes['type']).toBe('dppk:MockEnumCategory');
            expect(mockEnumValue1.comment.text).toBe('The first mock enum value.');
        });

        it('should parse context metadata correctly', async () => {
            const content = await fs.readFile(join(FIXTURES_DIR, 'contexts', KEYSTONE_VERSION, 'mock-core.context.jsonld'), 'utf-8');
            const mockTermDictionary = {
                ['https://dpp-keystone.org/spec/{{VERSION}}/terms#mockProperty']: {
                    description: { text: "A test property for the Mock Product." },
                    module: "core",
                    fileName: "mock-core.jsonld"
                }
            };
            const { imports, localTerms } = parseContextMetadata(content, mockTermDictionary);

            expect(imports).toHaveLength(1);
            expect(imports[0]).toBe('https://dpp-keystone.org/spec/{{VERSION}}/contexts/dpp-core.context.jsonld');
            expect(localTerms).toHaveLength(2);
            expect(localTerms[1].term).toBe('mockProp');
            expect(localTerms[1].uri).toBe('https://dpp-keystone.org/spec/{{VERSION}}/terms#mockProperty');
            expect(localTerms[1].description.text).toBe('A test property for the Mock Product.');
        });

        it('should parse ontology metadata from the top level', async () => {
            const content = await fs.readFile(join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-core-toplevel.jsonld'), 'utf-8');
            const { title, description } = parseOntologyMetadata(content);

            expect(title.text).toBe('Mock Toplevel Title');
            expect(description.text).toBe('Mock Toplevel Description.');
        });

        it('should build a term dictionary with type and domain', async () => {
            const sourceOntologyDir = join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION);
            const termDict = await buildTermDictionary(sourceOntologyDir);
            
            const mockProperty = termDict['https://dpp-keystone.org/spec/{{VERSION}}/terms#mockProperty'];
            expect(mockProperty).toBeDefined();
            expect(mockProperty.type).toContain('owl:DatatypeProperty');
            expect(mockProperty.domain['@id']).toBe('dppk:MockProduct');
        });

        it('should handle complex rdfs:comment values in term dictionary', async () => {
            const sourceOntologyDir = join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION);
            const termDict = await buildTermDictionary(sourceOntologyDir);

            const complexTerm = termDict['https://dpp-keystone.org/spec/{{VERSION}}/terms#ComplexTerm'];
            expect(complexTerm).toBeDefined();
            expect(complexTerm.description.text).toBe('This is a complex comment.');
        });

        it('should handle complex rdfs:comment values in parseOntologyMetadata', async () => {
            const content = await fs.readFile(join(FIXTURES_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-complex-comment.jsonld'), 'utf-8');
            const { properties } = parseOntologyMetadata(content);

            expect(properties).toHaveLength(1);
            expect(properties[0].id).toBe('dppk:ComplexTerm');
            expect(properties[0].comment.text).toBe('This is a complex comment.');
        });

        describe('i18n helpers', () => {
            it('should extract plain string correctly', () => {
                const result = getI18nData('Plain English');
                expect(result.text).toBe('Plain English');
                expect(result.raw).toEqual([{ "@language": "en", "@value": "Plain English" }]);
            });

            it('should extract single language object correctly', () => {
                const label = { "@language": "de", "@value": "Farbe" };
                const result = getI18nData(label);
                expect(result.text).toBe('Farbe');
                expect(result.raw).toEqual([{ "@language": "de", "@value": "Farbe" }]);
            });

            it('should extract array and fallback to English text correctly', () => {
                const label = [
                    { "@language": "de", "@value": "Farbe" },
                    { "@language": "en", "@value": "Color" }
                ];
                const result = getI18nData(label);
                expect(result.text).toBe('Color');
                expect(result.raw).toEqual(label); // should preserve full array
            });

            it('should render HTML span with escaped JSON', () => {
                const data = {
                    text: 'Color',
                    raw: [
                        { "@language": "de", "@value": "Farbe" },
                        { "@language": "en", "@value": "Color" }
                    ]
                };
                const html = renderI18nSpan(data);
                expect(html).toBe('<span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;de&quot;,&quot;@value&quot;:&quot;Farbe&quot;},{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Color&quot;}]">Color</span>');
            });
        });
    });

    describe('Nested Subdirectory Support', () => {
        beforeAll(async () => {
            await generateSpecDocs({
                srcDir: FIXTURES_DIR,
                distDir: TEMP_DIST_DIR
            });
        });

        it('should generate class pages for ontologies in nested subdirectories', async () => {
            const classHtmlPath = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'sectors', 'cement', 'mock-cement', 'MockCementProduct.html');
            const stats = await fs.stat(classHtmlPath).catch(() => null);
            expect(stats).toBeTruthy();
            expect(stats.isFile()).toBe(true);
        });

        it('should correctly cross-link properties from nested ontologies', async () => {
            const classHtmlPath = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'sectors', 'cement', 'mock-cement', 'MockCementProduct.html');
            const content = await fs.readFile(classHtmlPath, 'utf-8').catch(() => '');
            expect(content).toContain('mockCementProp');
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
            const ontologyDocPath = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'index.html');
            await expect(fs.access(ontologyDocPath)).resolves.not.toThrow();

            // Check that the directory index now links to the module index
            const ontologyHtml = await fs.readFile(ontologyDocPath, 'utf-8');
            expect(ontologyHtml).toContain(`<h2 style="margin: 0; color: var(--text-light);">ontology/${KEYSTONE_VERSION}/core</h2>`);
            expect(ontologyHtml).toContain('<li><a href="./mock-core/index.html"><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Mock Core Ontology&quot;}]">Mock Core Ontology</span></a></li>');

            // Check if the context doc was created (this part of the generator hasn't changed)
            const contextDocPath = join(TEMP_DIST_DIR, 'contexts', KEYSTONE_VERSION, 'index.html');
            await expect(fs.access(contextDocPath)).resolves.not.toThrow();
            
            // Check if global index was created and contains the correct link
            const globalIndexDocPath = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'index.html');
            await expect(fs.access(globalIndexDocPath)).resolves.not.toThrow();
            const globalIndexHtml = await fs.readFile(globalIndexDocPath, 'utf-8');
            expect(globalIndexHtml).toContain('<h3><span data-i18n-key="classes-and-concepts">All Classes &amp; Concepts</span></h3>');
            expect(globalIndexHtml).toContain('<a href="./core/mock-core/MockProduct.html">dppk:MockProduct</a>');
        });

        it('should generate an individual HTML file for each class', async () => {
            // This test defines the new desired behavior.
            await generateSpecDocs({
                srcDir: FIXTURES_DIR,
                distDir: TEMP_DIST_DIR
            });

            const moduleDirPath = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-core');
            
            // Check that the module's own index was created
            const moduleIndex = join(moduleDirPath, 'index.html');
            await expect(fs.access(moduleIndex)).resolves.not.toThrow();
            const moduleIndexHtml = await fs.readFile(moduleIndex, 'utf-8');
            expect(moduleIndexHtml).toContain('<h3><span data-i18n-key="classes-and-concepts">Classes &amp; Concepts</span></h3>');
            expect(moduleIndexHtml).toContain('<li><a href="MockProduct.html"><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Mock Product&quot;}]">Mock Product</span></a></li>');
            
            // Check that the title and description are correctly displayed
            expect(moduleIndexHtml).toContain('<h2 style="margin: 0; color: var(--text-light);"><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Mock Core Ontology&quot;}]">Mock Core Ontology</span></h2>');
            expect(moduleIndexHtml).toContain('<p><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;A mock ontology for testing purposes.&quot;}]">A mock ontology for testing purposes.</span></p>');


            // Check for the individual class file, using the name derived from its ID
            const classFilePath = join(moduleDirPath, 'MockProduct.html');
            await expect(fs.access(classFilePath)).resolves.not.toThrow();

            // Check for key content in the class file
            const classHtml = await fs.readFile(classFilePath, 'utf-8');
            expect(classHtml).toContain('<h2 style="margin: 0; color: var(--text-light);">Class: <span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Mock Product&quot;}]">Mock Product</span> (dppk:MockProduct)</h2>');
            expect(classHtml).toContain('<p><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Represents a generic product for testing.&quot;}]">Represents a generic product for testing.</span></p>');
            expect(classHtml).toContain('<p><strong>subClassOf:</strong> <a href="MockBase.html">dppk:MockBase</a>, <a href="MockThing.html">dppk:MockThing</a></p>')
            
            // Check for properties
            expect(classHtml).toContain('<a href="index.html#mockProperty"><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Mock Property&quot;}]">Mock Property</span></a> (dppk:mockProperty)');
            expect(classHtml).toContain('<a href="index.html#genericIndicator"><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Generic Indicator&quot;}]">Generic Indicator</span></a> (dppk:genericIndicator)');

            // Check for correct CSS path
            expect(classHtml).toContain('<link rel="stylesheet" href="../../../../../branding/css/keystone-style.css">');

            // Check for enum table generation
            const enumHtmlPath = join(moduleDirPath, 'MockEnumCategory.html');
            await expect(fs.access(enumHtmlPath)).resolves.not.toThrow();
            const enumHtml = await fs.readFile(enumHtmlPath, 'utf-8');
            expect(enumHtml).toContain('<h4>Enum Values (oneOf)</h4>');
            expect(enumHtml).toContain('<th>Value ID</th><th>Label</th>');
            expect(enumHtml).toContain('<td><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Mock Enum Value 1&quot;}]">Mock Enum Value 1</span></td>');
        });

        it('should include properties defined in other modules in the class documentation', async () => {
            // Setup: Create two files, one with a class, one with a property for that class
            // generateSpecDocs reads from 'dist' for generation, and 'src' for term dictionary.
            // We need to ensure files exist in both or are copied.
            
            const srcOntologyDir = join(TEMP_DIST_DIR, '..', '..', 'src', 'ontology', KEYSTONE_VERSION, 'core');
            const distOntologyDir = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'core');
            
            await fs.mkdir(srcOntologyDir, { recursive: true });
            await fs.mkdir(distOntologyDir, { recursive: true });

            const mainClassContent = JSON.stringify({
                "@context": { "dppk": `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`, "rdfs": "http://www.w3.org/2000/01/rdf-schema#" },
                "@graph": [{
                    "@id": "dppk:MainClass",
                    "@type": "rdfs:Class",
                    "rdfs:label": "Main Class"
                }]
            });

            const subPropContent = JSON.stringify({
                "@context": { "dppk": `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`, "rdfs": "http://www.w3.org/2000/01/rdf-schema#" },
                "@graph": [{
                    "@id": "dppk:subProperty",
                    "@type": "owl:DatatypeProperty",
                    "rdfs:label": "Sub Property",
                    "rdfs:domain": { "@id": "dppk:MainClass" },
                    "rdfs:range": "xsd:string"
                }]
            });

            await fs.writeFile(join(srcOntologyDir, 'mock-main.jsonld'), mainClassContent);
            await fs.writeFile(join(distOntologyDir, 'mock-main.jsonld'), mainClassContent);

            await fs.writeFile(join(srcOntologyDir, 'mock-sub.jsonld'), subPropContent);
            await fs.writeFile(join(distOntologyDir, 'mock-sub.jsonld'), subPropContent);

            // Ensure contexts directory exists to avoid console warning
            await fs.mkdir(join(TEMP_DIST_DIR, '..', '..', 'src', 'contexts', KEYSTONE_VERSION), { recursive: true });

            // Run generation
            await generateSpecDocs({
                srcDir: join(TEMP_DIST_DIR, '..', '..', 'src'),
                distDir: TEMP_DIST_DIR
            });

            // Verify
            const mainClassHtmlPath = join(TEMP_DIST_DIR, 'ontology', KEYSTONE_VERSION, 'core', 'mock-main', 'MainClass.html');
            await expect(fs.access(mainClassHtmlPath)).resolves.not.toThrow();
            
            const html = await fs.readFile(mainClassHtmlPath, 'utf-8');
            expect(html).toContain('Main Class');
            // 'Sub Property' is defined in 'mock-sub.jsonld' but shown on 'MainClass' page.
            // It should be linked back to the mock-sub module index.
            expect(html).toContain('<a href="../mock-sub/index.html#subProperty"><span class="i18n-text" data-i18n="[{&quot;@language&quot;:&quot;en&quot;,&quot;@value&quot;:&quot;Sub Property&quot;}]">Sub Property</span></a>');
        });

        it('should successfully generate documentation for the full real project', async () => {
            // Since tests run after the project is built, we can just verify the generated files directly in dist/spec
            const outputDir = join(PROJECT_ROOT, 'dist', 'spec');

            // Verify EPD module index exists
            const epdIndexHtml = join(outputDir, 'ontology', KEYSTONE_VERSION, 'core', 'EPD', 'index.html');
            await expect(fs.access(epdIndexHtml)).resolves.not.toThrow();

            // Verify DoPC module index exists
            const dopcIndexHtml = join(outputDir, 'ontology', KEYSTONE_VERSION, 'core', 'DoPC', 'index.html');
            await expect(fs.access(dopcIndexHtml)).resolves.not.toThrow();

            // Verify Unit module index exists
            const unitIndexHtml = join(outputDir, 'ontology', KEYSTONE_VERSION, 'core', 'Unit', 'index.html');
            await expect(fs.access(unitIndexHtml)).resolves.not.toThrow();
            
            // Verify an individual unit page exists
            const kilogramHtml = join(outputDir, 'ontology', KEYSTONE_VERSION, 'core', 'Unit', 'Kilogram.html');
            await expect(fs.access(kilogramHtml)).resolves.not.toThrow();
        });
    });
});
