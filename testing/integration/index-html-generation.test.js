import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_ROOT = path.resolve(process.cwd(), '..'); // We are in the testing directory
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');

describe('index.html generation', () => {
  it('should populate the file lists in index.html', async () => {
    const indexContent = await fs.readFile(INDEX_HTML_PATH, 'utf-8');

    // Check that the placeholders are no longer empty
    const contextsRegex = /<!-- CONTEXTS_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- CONTEXTS_LIST_END -->/;
    const ontologyCoreRegex = /<!-- ONTOLOGY_CORE_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- ONTOLOGY_CORE_LIST_END -->/;
    const ontologySectorsRegex = /<!-- ONTOLOGY_SECTORS_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- ONTOLOGY_SECTORS_LIST_END -->/;
    const examplesRegex = /<!-- EXAMPLES_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- EXAMPLES_LIST_END -->/;
    // const utilsRegex = /<!-- UTILITIES_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- UTILITIES_LIST_END -->/; // Removed in favor of dedicated SDK page
    const dppSchemaRegex = /<!-- DPP_SCHEMA_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- DPP_SCHEMA_LIST_END -->/;
    const contentSpecSchemasRegex = /<!-- CONTENT_SPEC_SCHEMAS_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- CONTENT_SPEC_SCHEMAS_LIST_END -->/;
    const auxSchemasRegex = /<!-- AUX_SCHEMAS_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- AUX_SCHEMAS_LIST_END -->/;
    const shaclShapesRegex = /<!-- SHACL_SHAPES_LIST_START -->[\s\S]*<li>.*<\/li>[\s\S]*<!-- SHACL_SHAPES_LIST_END -->/;

    expect(indexContent).toMatch(contextsRegex);
    expect(indexContent).toMatch(ontologyCoreRegex);
    expect(indexContent).toMatch(ontologySectorsRegex);
    expect(indexContent).toMatch(examplesRegex);
    // expect(indexContent).toMatch(utilsRegex);
    expect(indexContent).toMatch(dppSchemaRegex);
    expect(indexContent).toMatch(contentSpecSchemasRegex);
    expect(indexContent).toMatch(auxSchemasRegex);
    expect(indexContent).toMatch(shaclShapesRegex);

    // Verify new structure
    expect(indexContent).toContain('<h2>DPP Toolkit</h2>');
    expect(indexContent).toContain('<a href="wizard/">🚀 DPP Wizard</a>');
    expect(indexContent).toContain('<a href="validator/">✅ DPP Validator</a>');
    expect(indexContent).toContain('<a href="util/">📦 Developer SDKs</a>');

    // Also check for a specific file to be reasonably sure the content is correct
    expect(indexContent).toContain('<a href="spec/contexts/v1/dpp-core.context/index.html">Dpp Core Context</a>');
    // The ontology link should now point to the generated module index page.
    expect(indexContent).toContain('<a href="spec/ontology/v1/core/Product/index.html">Product</a>');
    // It should also contain a nested link to a class within that module.
    expect(indexContent).toContain('<a href="spec/ontology/v1/core/Product/Product.html">Product or Material</a>');
    expect(indexContent).toContain('<a href="spec/examples/sock-dpp-v1.json">Sock Dpp</a>');
    
    // Utilities are no longer listed directly in index.html, so we don't check for them here.
    // They are checked in the dedicated utility index test below.

    // Check Schemas
    expect(indexContent).toContain('Dpp Schema</a>'); 
    expect(indexContent).toContain('Battery Schema</a>'); 
    expect(indexContent).toContain('Related Resource Schema</a>');
    
    // Check SHACL
    expect(indexContent).toContain('Battery Shapes.Shacl</a>');
  });

  it('should generate a dedicated utility index at dist/util/index.html', async () => {
    const utilIndexPath = path.join(DIST_DIR, 'util', 'index.html');
    
    // Check if file exists
    try {
        await fs.access(utilIndexPath);
    } catch {
        throw new Error(`Utility index not found at ${utilIndexPath}`);
    }

    const content = await fs.readFile(utilIndexPath, 'utf-8');
    
    // Check title and header
    expect(content).toContain('<title>DPP Utilities</title>');
    expect(content).toContain('<h1>DPP Keystone Utilities</h1>');
    
    // Check for links (relative paths)
    // In dist/util/index.html, the link to js/client/dpp-adapter.js is just "js/client/dpp-adapter.js"
    expect(content).toContain('<a href="js/client/dpp-adapter.js">js/client/dpp-adapter.js</a>');
    expect(content).toContain('<a href="js/server/dpp-adapter.js">js/server/dpp-adapter.js</a>');
  });
});
