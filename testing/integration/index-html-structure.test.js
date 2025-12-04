import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import { generateFileList } from '../../scripts/update-index-html.mjs';
import * as specDocs from '../../scripts/generate-spec-docs.mjs';


describe('generateFileList for ontologies', () => {

    let readdirSpy;
    let readFileSpy;

    beforeEach(() => {
        // Spy on file system methods to avoid actual file access
        readdirSpy = jest.spyOn(fs, 'readdir');
        readFileSpy = jest.spyOn(fs, 'readFile');
    });

    afterEach(() => {
        // Restore original implementations
        readdirSpy.mockRestore();
        readFileSpy.mockRestore();
    });


    const mockOntologyContentWithClass = JSON.stringify({
        "@graph": [{
            "@id": "dppk:MockClass",
            "@type": "rdfs:Class",
            "rdfs:label": "Mock Class Label"
        }]
    });

    test('should generate a details element wrapping the summary and list for ontologies with classes and exclude specified files', async () => {
        // Arrange
        readdirSpy.mockResolvedValue(['mock-ontology.jsonld', 'ProductDetails.jsonld']);
        readFileSpy.mockResolvedValue(mockOntologyContentWithClass);


        const dirPath = '/fake/dir/ontology/v1/core';
        const baseHref = 'spec/ontology/v1/core/';

        // Act
        const htmlList = await generateFileList(dirPath, baseHref, { isOntology: true }, fs);

        // Assert
        const expectedSummary = `<summary><a href="spec/ontology/v1/core/mock-ontology/index.html">Mock Ontology</a></summary>`;
        const expectedClassLink = `<li><a href="spec/ontology/v1/core/mock-ontology/dppk_MockClass.html">Mock Class Label</a></li>`;
        const unexpectedText = `<details><summary>Classes</summary>`;

        expect(htmlList).toContain(expectedSummary);
        expect(htmlList).toContain(expectedClassLink);
        expect(htmlList).not.toContain(unexpectedText);
        expect(htmlList).not.toContain('ProductDetails');
        // Specifically check that the li wraps the details element
        expect(htmlList.trim().startsWith('<li class="expandable"><details>')).toBe(true);
    });
});
