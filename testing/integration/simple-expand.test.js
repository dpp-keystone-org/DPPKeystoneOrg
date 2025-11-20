import { promises as fs } from 'fs';
import path from 'path';
import jsonld from 'jsonld';
import {
    PROJECT_ROOT,
    localFileDocumentLoader
} from './shacl-helpers.mjs';

describe('Simple DPP Expansion', () => {
    test('should correctly expand rail-dpp-v1.json using local contexts', async () => {
        const exampleFileName = 'rail-dpp-v1.json';
        const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'examples', exampleFileName);
        const fileContent = await fs.readFile(exampleFilePath, 'utf-8');
        const dppJson = JSON.parse(fileContent);

        // The core test: ensure contexts are wired correctly for expansion.
        const expanded = await jsonld.expand(dppJson, { documentLoader: localFileDocumentLoader });

        // A basic but effective assertion: expansion should produce a non-empty graph.
        expect(Array.isArray(expanded)).toBe(true);
        expect(expanded.length).toBeGreaterThan(0);
    });
});
