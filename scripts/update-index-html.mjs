import { promises as fs } from 'fs';
import path from 'path';
// Import the parser from the other script to read ontology files
import { parseOntologyMetadata, getFragment } from './generate-spec-docs.mjs';

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
export async function generateFileList(dirPath, baseHref, options = {}, fs) {
  const files = await fs.readdir(dirPath);
  
  let filteredFiles;
  if (options.isUtil) {
    filteredFiles = files.filter(file => file.endsWith('.js') && !file.endsWith('.test.js'));
  } else {
    filteredFiles = files.filter(file => !file.startsWith('.') && (file.endsWith('.json') || file.endsWith('.jsonld')) && file !== 'ProductDetails.jsonld');
  }

  const listItems = await Promise.all(filteredFiles.map(async (file) => {
    const fileName = path.basename(file, path.extname(file));

    let linkText = fileName;
    if (options.removeV1) {
      linkText = linkText.replace(/-v1$/, '');
    }

    if (options.isUtil) {
      linkText = file; // For utils, use the full filename
    } else {
      linkText = linkText
        .replace(/-/g, ' ')
        .replace(/\.context$/, ' Context')
        .replace(/\b\w/g, l => l.toUpperCase());
    }

    if (options.isOntology) {
      const linkHref = `${baseHref}${fileName}/index.html`;
      
      const filePath = path.join(dirPath, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const { classes } = parseOntologyMetadata(content);

      if (classes.length > 0) {
        const classLinks = classes.map(c => {
          const classLinkHref = `${baseHref}${fileName}/${getFragment(c.id)}.html`;
          return `                                        <li><a href="${classLinkHref}">${c.label}</a></li>`;
        }).join('\n');
        return `                            <li class="expandable"><details><summary><a href="${linkHref}">${linkText}</a></summary><ul>
${classLinks}
                                    </ul></details></li>`;
      } else {
        return `                            <li><a href="${linkHref}">${linkText}</a></li>`;
      }
    } else if (options.isContext) {
      const linkHref = `${baseHref}${fileName}/index.html`;
      return `                            <li><a href="${linkHref}">${linkText}</a></li>`;
    } else {
      const linkHref = `${baseHref}${file}`;
      return `                            <li><a href="${linkHref}">${linkText}</a></li>`;
    }
  }));

  return listItems.join('\n');
}


export async function updateIndexHtml({
  srcDir = SRC_DIR,
  indexHtmlPath = INDEX_HTML_PATH
} = {}) {
  console.log('Updating index.html with the latest file lists...');

  try {
    let indexContent = await fs.readFile(indexHtmlPath, 'utf-8');

    // Generate and inject contexts list
    const contextsPath = path.join(srcDir, 'contexts', 'v1');
    const contextsList = await generateFileList(contextsPath, 'spec/contexts/v1/', { isContext: true }, fs);
    indexContent = indexContent.replace(
      /<!-- CONTEXTS_LIST_START -->(.|\n)*<!-- CONTEXTS_LIST_END -->/,
      '<!-- CONTEXTS_LIST_START -->\n' + contextsList + '\n                            <!-- CONTEXTS_LIST_END -->'
    );

    // Generate and inject ontology core list
    const ontologyCorePath = path.join(srcDir, 'ontology', 'v1', 'core');
    const ontologyCoreList = await generateFileList(ontologyCorePath, 'spec/ontology/v1/core/', { isOntology: true }, fs);
    indexContent = indexContent.replace(
      /<!-- ONTOLOGY_CORE_LIST_START -->(.|\n)*<!-- ONTOLOGY_CORE_LIST_END -->/,
      '<!-- ONTOLOGY_CORE_LIST_START -->\n' + ontologyCoreList + '\n                                    <!-- ONTOLOGY_CORE_LIST_END -->'
    );

    // Generate and inject ontology sectors list
    const ontologySectorsPath = path.join(srcDir, 'ontology', 'v1', 'sectors');
    const ontologySectorsList = await generateFileList(ontologySectorsPath, 'spec/ontology/v1/sectors/', { isOntology: true }, fs);
    indexContent = indexContent.replace(
      /<!-- ONTOLOGY_SECTORS_LIST_START -->(.|\n)*<!-- ONTOLOGY_SECTORS_LIST_END -->/,
      '<!-- ONTOLOGY_SECTORS_LIST_START -->\n' + ontologySectorsList + '\n                                    <!-- ONTOLOGY_SECTORS_LIST_END -->'
    );

    // Generate and inject examples list
    const examplesPath = path.join(srcDir, 'examples');
    const examplesList = await generateFileList(examplesPath, 'spec/examples/', { removeV1: true }, fs);
    indexContent = indexContent.replace(
      /<!-- EXAMPLES_LIST_START -->(.|\n)*<!-- EXAMPLES_LIST_END -->/,
      '<!-- EXAMPLES_LIST_START -->\n' + examplesList + '\n                    <!-- EXAMPLES_LIST_END -->'
    );

    // Generate and inject utilities list
    const utilsPath = path.join(srcDir, 'util', 'js');
    const utilsList = await generateFileList(utilsPath, 'spec/util/js/', { isUtil: true }, fs);
    indexContent = indexContent.replace(
      /<!-- UTILITIES_LIST_START -->(.|\n)*<!-- UTILITIES_LIST_END -->/,
      '<!-- UTILITIES_LIST_START -->\n' + utilsList + '\n                    <!-- UTILITIES_LIST_END -->'
    );

    await fs.writeFile(indexHtmlPath, indexContent, 'utf-8');
    console.log('Successfully updated index.html.');
  } catch (error) {
    console.error('Failed to update index.html:', error);
        process.exit(1);
      }
    }
    
// This allows the script to be executed directly, but also to be imported without executing.
if (import.meta.url.startsWith('file:') && process.argv[1] === path.resolve(process.cwd(), 'scripts', 'update-index-html.mjs')) {
    updateIndexHtml();
}