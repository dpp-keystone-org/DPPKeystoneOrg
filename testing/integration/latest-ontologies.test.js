import { promises as fs } from 'fs';
import path from 'path';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';

const DIST_DIR = path.resolve(process.cwd(), '..', 'dist');

describe('Latest Ontologies Generation', () => {
    const versionedOntologyPath = path.join(DIST_DIR, 'spec', 'ontology', KEYSTONE_VERSION);
    const latestOntologyPath = path.join(DIST_DIR, 'spec', 'ontology');

    test('should create shadow copies of ontology files in the top-level ontology directory', async () => {
        const versionedOntologyExists = await fs.access(versionedOntologyPath).then(() => true).catch(() => false);
        const latestOntologyExists = await fs.access(latestOntologyPath).then(() => true).catch(() => false);

        expect(versionedOntologyExists).toBe(true);
        expect(latestOntologyExists).toBe(true);

        // Recursively get all .jsonld files in a directory
        async function getJsonLdFiles(dir, recursive = true) {
            const exists = await fs.access(dir).then(() => true).catch(() => false);
            if (!exists) return [];

            const entries = await fs.readdir(dir, { withFileTypes: true });
            const files = await Promise.all(entries.map((entry) => {
                const res = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    return recursive ? getJsonLdFiles(res, true) : null;
                }
                return entry.name.endsWith('.jsonld') ? res : null;
            }));
            return files.flat().filter(Boolean);
        }

        const versionedFiles = [
            ...(await getJsonLdFiles(versionedOntologyPath, false)),
            ...(await getJsonLdFiles(path.join(versionedOntologyPath, 'core'), true)),
            ...(await getJsonLdFiles(path.join(versionedOntologyPath, 'sectors'), true)),
        ];

        const latestFiles = [
            ...(await getJsonLdFiles(latestOntologyPath, false)),
            ...(await getJsonLdFiles(path.join(latestOntologyPath, 'core'), true)),
            ...(await getJsonLdFiles(path.join(latestOntologyPath, 'sectors'), true)),
        ];

        const relativeVersioned = versionedFiles.map(f => path.relative(versionedOntologyPath, f));
        const relativeLatest = latestFiles.map(f => path.relative(latestOntologyPath, f));

        expect(relativeLatest.length).toBeGreaterThan(0);
        expect(relativeLatest).toEqual(expect.arrayContaining(relativeVersioned));
        expect(relativeVersioned).toEqual(expect.arrayContaining(relativeLatest));
    });
});
