import { promises as fs } from 'fs';
import path from 'path';

const DIST_DIR = path.resolve(process.cwd(), '..', 'dist');

describe('Latest Contexts Generation', () => {
    const versionedContextsPath = path.join(DIST_DIR, 'spec', 'contexts', 'v1');
    const latestContextsPath = path.join(DIST_DIR, 'spec', 'contexts');

    test('should create shadow copies of context files in the top-level contexts directory', async () => {
        const versionedFiles = await fs.readdir(versionedContextsPath);
        const latestFiles = await fs.readdir(latestContextsPath);

        // Filter to only compare the actual context files, ignoring generated HTML docs/folders.
        const versionedJsonLdFiles = versionedFiles.filter(f => f.endsWith('.jsonld'));
        const latestJsonLdFiles = latestFiles.filter(f => f.endsWith('.jsonld'));

        expect(latestJsonLdFiles.length).toBeGreaterThan(0);
        expect(latestJsonLdFiles).toEqual(expect.arrayContaining(versionedJsonLdFiles));
        expect(versionedJsonLdFiles).toEqual(expect.arrayContaining(latestJsonLdFiles));
    });

    test('should generate an index.html for the latest contexts directory', async () => {
        const indexPath = path.join(latestContextsPath, 'index.html');
        let stats;
        try {
            stats = await fs.stat(indexPath);
        } catch (e) {
            stats = null;
        }

        expect(stats).not.toBeNull();
        expect(stats.isFile()).toBe(true);
        
        const content = await fs.readFile(indexPath, 'utf-8');
        expect(content).toContain('<h1>Context Explorer</h1>');
        expect(content).toContain('<h2 style="margin: 0; color: var(--text-light);">Latest Contexts</h2>');
    });

    test('main index.html should link to the latest contexts', async () => {
        const mainIndexPath = path.join(DIST_DIR, 'index.html');
        const content = await fs.readFile(mainIndexPath, 'utf-8');

        // Check for the new "Latest" section
        expect(content).toContain('<h4>Contexts (Implementation Vocabularies)</h4>');
        expect(content).toContain('<li><a href="spec/contexts/index.html">Index of "Latest" Context Files</a></li>');

        // Check that the "Latest" list is populated
        const latestListRegex = /<!-- LATEST_CONTEXTS_LIST_START -->([\s\S]*)<!-- LATEST_CONTEXTS_LIST_END -->/;
        const match = content.match(latestListRegex);
        
        expect(match).not.toBeNull();
        // Check that there is content between the placeholders, but not just whitespace
        expect(match[1].trim()).not.toBe('');
        expect(match[1]).toContain('<li><a href="spec/contexts/dpp-core.context.jsonld">Dpp Core Context</a></li>');
    });
});
