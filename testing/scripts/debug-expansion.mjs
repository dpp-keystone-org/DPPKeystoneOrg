import fs from 'fs';
import path from 'path';
import jsonld from 'jsonld';
import { PROJECT_ROOT, localFileDocumentLoader } from './shacl-helpers.mjs';

async function debugExpansion() {
    // We are hard-coding the file that is causing the error.
    const exampleFile = 'rail-dpp-v1.json';
    const exampleFilePath = path.join(PROJECT_ROOT, 'dist', 'examples', exampleFile);

    console.log(`--- Attempting to expand: ${exampleFilePath} ---`);

    try {
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // This is the exact operation that fails in the test suite.
        const expanded = await jsonld.expand(data, { documentLoader: localFileDocumentLoader });

        console.log('--- EXPANSION SUCCESSFUL ---');
        console.log(JSON.stringify(expanded, null, 2));
    } catch (error) {
        console.error('--- EXPANSION FAILED ---');
        console.error('Error Name:', error.name);
        console.error('Error Message:', error.message);
        // The 'details' property often contains the most specific information for jsonld errors.
        console.error('Error Details:', JSON.stringify(error.details, null, 2));
    }
}

debugExpansion();