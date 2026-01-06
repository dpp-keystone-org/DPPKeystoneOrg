import { promises as fs } from 'fs';
import path from 'path';
// Import the parser from the other script to read ontology files
import { parseOntologyMetadata, getFragment } from './generate-spec-docs.mjs';

const PROJECT_ROOT = process.cwd();
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const TEMPLATE_PATH = path.join(PROJECT_ROOT, 'index.html'); // Source template
const OUTPUT_PATH = path.join(DIST_DIR, 'index.html');      // Destination
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

/**
 * Generates an HTML list of links for files in a given directory.
 * @param {string} dirPath The path to the directory.
 * @param {string} baseHref The base href for the links.
 * @returns {Promise<string>} A promise that resolves to the HTML string.
 */
export async function generateFileList(dirPath, baseHref, options = {}, rootPath = dirPath) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  let listItems = [];

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory() && options.recursive) {
      // If recursive, call self and add the results to the list
      const subList = await generateFileList(fullPath, baseHref, options, rootPath);
      listItems = listItems.concat(subList);
    } else if (entry.isFile()) {
      // Process files
      let filteredOut = false;
      if (options.isUtil) {
        if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) {
          filteredOut = true;
        }
      } else {
        if (entry.name.startsWith('.') || (!entry.name.endsWith('.json') && !entry.name.endsWith('.jsonld')) || entry.name === 'ProductDetails.jsonld' || entry.name === 'desktop.ini') {
          filteredOut = true;
        }
      }

      if (!filteredOut) {
        const fileName = path.basename(entry.name, path.extname(entry.name));
        let linkText;
        
        // Use relative path for link text and href to show the structure
        const relativePath = path.relative(rootPath, fullPath).replace(/\\/g, '/');

        if (options.isUtil) {
          linkText = relativePath;
        } else {
          linkText = fileName
            .replace(/-/g, ' ')
            .replace(/\.context$/, ' Context')
            .replace(/\b\w/g, l => l.toUpperCase());
          if (options.removeV1) {
            linkText = linkText.replace(/ V1$/, '');
          }
        }

        if (options.isOntology) {
          const linkHref = `${baseHref}${fileName}/index.html`;
          const content = await fs.readFile(fullPath, 'utf-8');
          const { classes } = parseOntologyMetadata(content);

          if (classes.length > 0) {
            const classLinks = classes.map(c => {
              const classLinkHref = `${baseHref}${fileName}/${getFragment(c.id)}.html`;
              return `                                        <li><a href="${classLinkHref}">${c.label}</a></li>`;
            }).join('\n');
            listItems.push(`                            <li class="expandable"><details><summary><a href="${linkHref}">${linkText}</a></summary><ul>
${classLinks}
                                    </ul></details></li>`);
          } else {
            listItems.push(`                            <li><a href="${linkHref}">${linkText}</a></li>`);
          }
        } else if (options.isContext) {
          const linkHref = `${baseHref}${fileName}/index.html`;
          listItems.push(`                            <li><a href="${linkHref}">${linkText}</a></li>`);
        } else {
          // For examples and utils, the link is to the raw file
          const linkHref = `${baseHref}${relativePath}`;
          listItems.push(`                            <li><a href="${linkHref}">${linkText}</a></li>`);
        }
      }
    }
  }
  return listItems.join('\n');
}

/**
 * Categorizes and generates HTML lists for schemas.
 * @param {string} dirPath The path to the directory.
 * @param {string} baseHref The base href for the links.
 * @returns {Promise<{dppList: string, contentSpecList: string, auxList: string}>}
 */
async function generateSchemaLists(dirPath, baseHref) {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const dppSchemas = [];
  const contentSpecSchemas = [];
  const auxSchemas = [];

  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith('.json')) {
      const fullPath = path.join(dirPath, entry.name);
      try {
        const content = await fs.readFile(fullPath, 'utf-8');
        const json = JSON.parse(content);
        const fileName = entry.name;
        // Format link text: "battery.schema.json" -> "Battery Schema"
        // But the user requested "named links". Let's format nicely.
        // removing .schema.json and making Title Case
        const linkText = fileName
            .replace('.schema.json', '')
            .replace(/-/g, ' ')
            .replace(/\b\w/g, l => l.toUpperCase()) + ' Schema';
            
        const link = `<a href="${baseHref}${fileName}">${linkText}</a>`;
        const listItem = `                            <li>${link}</li>`;

        if (fileName === 'dpp.schema.json') {
          dppSchemas.push(listItem);
        } else if (json.if && json.if.properties && json.if.properties.contentSpecificationIds) {
          contentSpecSchemas.push(listItem);
        } else {
          auxSchemas.push(listItem);
        }
      } catch (err) {
        console.warn(`Skipping schema file ${entry.name} due to error: ${err.message}`);
      }
    }
  }

  // Sort lists alphabetically
  dppSchemas.sort();
  contentSpecSchemas.sort();
  auxSchemas.sort();

  return {
    dppList: dppSchemas.join('\n'),
    contentSpecList: contentSpecSchemas.join('\n'),
    auxList: auxSchemas.join('\n')
  };
}


export async function updateIndexHtml({
  srcDir = SRC_DIR,
  templatePath = TEMPLATE_PATH,
  outputPath = OUTPUT_PATH
} = {}) {
  console.log('Updating index.html with the latest file lists...');

  try {
    // Read from the template path now
    let indexContent = await fs.readFile(templatePath, 'utf-8');

    // Generate and inject contexts list (non-recursive)
    const contextsPath = path.join(srcDir, 'contexts', 'v1');
    const contextsList = await generateFileList(contextsPath, 'spec/contexts/v1/', { isContext: true });
    indexContent = indexContent.replace(
      /<!-- CONTEXTS_LIST_START -->[\s\S]*<!-- CONTEXTS_LIST_END -->/,
      '<!-- CONTEXTS_LIST_START -->\n' + contextsList + '\n                            <!-- CONTEXTS_LIST_END -->'
    );

    // Generate and inject ontology core list (non-recursive)
    const ontologyCorePath = path.join(srcDir, 'ontology', 'v1', 'core');
    const ontologyCoreList = await generateFileList(ontologyCorePath, 'spec/ontology/v1/core/', { isOntology: true });
    indexContent = indexContent.replace(
      /<!-- ONTOLOGY_CORE_LIST_START -->[\s\S]*<!-- ONTOLOGY_CORE_LIST_END -->/,
      '<!-- ONTOLOGY_CORE_LIST_START -->\n' + ontologyCoreList + '\n                                    <!-- ONTOLOGY_CORE_LIST_END -->'
    );

    // Generate and inject ontology sectors list (non-recursive)
    const ontologySectorsPath = path.join(srcDir, 'ontology', 'v1', 'sectors');
    const ontologySectorsList = await generateFileList(ontologySectorsPath, 'spec/ontology/v1/sectors/', { isOntology: true });
    indexContent = indexContent.replace(
      /<!-- ONTOLOGY_SECTORS_LIST_START -->[\s\S]*<!-- ONTOLOGY_SECTORS_LIST_END -->/,
      '<!-- ONTOLOGY_SECTORS_LIST_START -->\n' + ontologySectorsList + '\n                                    <!-- ONTOLOGY_SECTORS_LIST_END -->'
    );

    // Generate and inject schema lists
    const schemasPath = path.join(srcDir, 'validation', 'v1', 'json-schema');
    const { dppList, contentSpecList, auxList } = await generateSchemaLists(schemasPath, 'spec/validation/v1/json-schema/');
    
    indexContent = indexContent.replace(
        /<!-- DPP_SCHEMA_LIST_START -->[\s\S]*<!-- DPP_SCHEMA_LIST_END -->/,
        '<!-- DPP_SCHEMA_LIST_START -->\n' + dppList + '\n                            <!-- DPP_SCHEMA_LIST_END -->'
    );
    indexContent = indexContent.replace(
        /<!-- CONTENT_SPEC_SCHEMAS_LIST_START -->[\s\S]*<!-- CONTENT_SPEC_SCHEMAS_LIST_END -->/,
        '<!-- CONTENT_SPEC_SCHEMAS_LIST_START -->\n' + contentSpecList + '\n                            <!-- CONTENT_SPEC_SCHEMAS_LIST_END -->'
    );
    indexContent = indexContent.replace(
        /<!-- AUX_SCHEMAS_LIST_START -->[\s\S]*<!-- AUX_SCHEMAS_LIST_END -->/,
        '<!-- AUX_SCHEMAS_LIST_START -->\n' + auxList + '\n                            <!-- AUX_SCHEMAS_LIST_END -->'
    );

    // Generate and inject SHACL shapes list
    const shaclPath = path.join(srcDir, 'validation', 'v1', 'shacl');
    const shaclList = await generateFileList(shaclPath, 'spec/validation/v1/shacl/', { recursive: false });
    indexContent = indexContent.replace(
      /<!-- SHACL_SHAPES_LIST_START -->[\s\S]*<!-- SHACL_SHAPES_LIST_END -->/,
      '<!-- SHACL_SHAPES_LIST_START -->\n' + shaclList + '\n                    <!-- SHACL_SHAPES_LIST_END -->'
    );

    // Generate and inject examples list (non-recursive)
    const examplesPath = path.join(srcDir, 'examples');
    const examplesList = await generateFileList(examplesPath, 'spec/examples/', { recursive: false, removeV1: true });
    indexContent = indexContent.replace(
      /<!-- EXAMPLES_LIST_START -->[\s\S]*<!-- EXAMPLES_LIST_END -->/,
      '<!-- EXAMPLES_LIST_START -->\n' + examplesList + '\n                    <!-- EXAMPLES_LIST_END -->'
    );

    // Generate and inject utilities list (recursive)
    const utilsPath = path.join(srcDir, 'util', 'js');
    const utilsList = await generateFileList(utilsPath, 'spec/util/js/', { recursive: true, isUtil: true });
    indexContent = indexContent.replace(
      /<!-- UTILITIES_LIST_START -->[\s\S]*<!-- UTILITIES_LIST_END -->/,
      '<!-- UTILITIES_LIST_START -->\n' + utilsList + '\n                    <!-- UTILITIES_LIST_END -->'
    );

    // Write to the output path now
    await fs.writeFile(outputPath, indexContent, 'utf-8');
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