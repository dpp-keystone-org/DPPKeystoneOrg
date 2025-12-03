import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '..'); // We are in the testing directory
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

describe('index.html generation', () => {
  beforeAll(() => {
    // Run the build script to generate the dist directory and update index.html
    // The main test script already runs clean and build, so this might be redundant,
    // but it ensures the test is self-contained.
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'inherit' });
  });

  it('should populate the file lists in index.html', async () => {
    const indexContent = await fs.readFile(INDEX_HTML_PATH, 'utf-8');

    // Check that the placeholders are no longer empty
    const contextsRegex = /<!-- CONTEXTS_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- CONTEXTS_LIST_END -->/;
    const ontologyCoreRegex = /<!-- ONTOLOGY_CORE_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- ONTOLOGY_CORE_LIST_END -->/;
    const ontologySectorsRegex = /<!-- ONTOLOGY_SECTORS_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- ONTOLOGY_SECTORS_LIST_END -->/;
    const examplesRegex = /<!-- EXAMPLES_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- EXAMPLES_LIST_END -->/;

    expect(indexContent).toMatch(contextsRegex);
    expect(indexContent).toMatch(ontologyCoreRegex);
    expect(indexContent).toMatch(ontologySectorsRegex);
    expect(indexContent).toMatch(examplesRegex);

    // Also check for a specific file to be reasonably sure the content is correct
    expect(indexContent).toContain('<a href="spec/contexts/v1/dpp-core.context.jsonld">Dpp Core Context</a>');
    expect(indexContent).toContain('<a href="spec/ontology/v1/core/Product.jsonld">Product</a>');
    expect(indexContent).toContain('<a href="spec/examples/sock-dpp-v1.json">Sock Dpp</a>');
  });
});
