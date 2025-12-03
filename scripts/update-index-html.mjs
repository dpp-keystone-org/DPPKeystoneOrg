import { promises as fs } from 'fs';
import path from 'path';

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const INDEX_HTML_PATH = path.join(DIST_DIR, 'index.html');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

/**
 * Generates an HTML list of links for files in a given directory.
 * @param {string} dirPath The path to the directory.
 * @param {string} baseHref The base href for the links.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
async function generateFileList(dirPath, baseHref, options = {}) {
  const files = await fs.readdir(dirPath);
  return files
    .filter(file => !file.startsWith('.') && (file.endsWith('.json') || file.endsWith('.jsonld')))
    .map(file => {
      let fileName = path.basename(file, path.extname(file));
      if (options.removeV1) {
        fileName = fileName.replace(/-v1$/, '');
      }
      const linkText = fileName
        .replace(/-/g, ' ')
        .replace(/\.context$/, ' Context')
        .replace(/\b\w/g, l => l.toUpperCase());
      return `                            <li><a href="${baseHref}${file}">${linkText}</a></li>`;
    })
    .join('\n');
}


export async function updateIndexHtml() {
  console.log('Updating index.html with the latest file lists...');

  try {
    let indexContent = await fs.readFile(INDEX_HTML_PATH, 'utf-8');

    // Generate and inject contexts list
    const contextsPath = path.join(SRC_DIR, 'contexts', 'v1');
    const contextsList = await generateFileList(contextsPath, 'spec/contexts/v1/');
    indexContent = indexContent.replace(
      /<!-- CONTEXTS_LIST_START -->(.|\n)*<!-- CONTEXTS_LIST_END -->/,
      '<!-- CONTEXTS_LIST_START -->\n' + contextsList + '\n                            <!-- CONTEXTS_LIST_END -->'
    );

    // Generate and inject ontology core list
    const ontologyCorePath = path.join(SRC_DIR, 'ontology', 'v1', 'core');
    const ontologyCoreList = await generateFileList(ontologyCorePath, 'spec/ontology/v1/core/');
    indexContent = indexContent.replace(
      /<!-- ONTOLOGY_CORE_LIST_START -->(.|\n)*<!-- ONTOLOGY_CORE_LIST_END -->/,
      '<!-- ONTOLOGY_CORE_LIST_START -->\n' + ontologyCoreList + '\n                                    <!-- ONTOLOGY_CORE_LIST_END -->'
    );

    // Generate and inject ontology sectors list
    const ontologySectorsPath = path.join(SRC_DIR, 'ontology', 'v1', 'sectors');
    const ontologySectorsList = await generateFileList(ontologySectorsPath, 'spec/ontology/v1/sectors/');
    indexContent = indexContent.replace(
      /<!-- ONTOLOGY_SECTORS_LIST_START -->(.|\n)*<!-- ONTOLOGY_SECTORS_LIST_END -->/,
      '<!-- ONTOLOGY_SECTORS_LIST_START -->\n' + ontologySectorsList + '\n                                    <!-- ONTOLOGY_SECTORS_LIST_END -->'
    );

    // Generate and inject examples list
    const examplesPath = path.join(SRC_DIR, 'examples');
    const examplesList = await generateFileList(examplesPath, 'spec/examples/', { removeV1: true });
    indexContent = indexContent.replace(
      /<!-- EXAMPLES_LIST_START -->(.|\n)*<!-- EXAMPLES_LIST_END -->/,
      '<!-- EXAMPLES_LIST_START -->\n' + examplesList + '\n                    <!-- EXAMPLES_LIST_END -->'
    );

    await fs.writeFile(INDEX_HTML_PATH, indexContent, 'utf-8');
    console.log('Successfully updated index.html.');
  } catch (error) {
    console.error('Failed to update index.html:', error);
        process.exit(1);
      }
    }
    
    updateIndexHtml();
    