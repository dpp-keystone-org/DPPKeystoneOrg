import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename, dirname, resolve } from 'path';
import { parse as jsoncParse } from 'jsonc-parser';

const distDir = join(process.cwd(), 'dist', 'spec');
const ontologyDir = join(distDir, 'ontology', 'v1');
const contextDir = join(distDir, 'contexts', 'v1');

const ontologyDirsToProcess = ['core', 'sectors'];
const contextDirsToProcess = ['.']; // The root of the contexts/v1 dir

async function getJsonLdFiles(dir) {
    try {
        const dirents = await readdir(dir, { withFileTypes: true });
        return dirents
            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsonld'))
            .map(dirent => join(dir, dirent.name));
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`Directory not found: ${dir}. Skipping.`);
            return [];
        }
        throw error;
    }
}

async function getOntologyMetadata(filePath) {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    // The ontology info can be at the root or in the @graph
    const nodes = [data, ...(data['@graph'] || [])];
    const ontologyInfo = nodes.find(node => node && node['@type'] === 'owl:Ontology');
    
    let title = ontologyInfo?.['dcterms:title'] || ontologyInfo?.['dc:title'] || 'No title found';
    let description = ontologyInfo?.['dcterms:description'] || ontologyInfo?.['dc:description'] || 'No description found.';

    if (typeof title !== 'string') {
        title = title['@value'] || 'No title found';
    }
    if (typeof description !== 'string') {
        description = description['@value'] || 'No description found.';
    }

    const graph = data['@graph'] || [];
    const classes = graph.filter(node => node['@type'] === 'owl:Class').map(node => node['@id']);
        const properties = graph.filter(node => node['@type'] === 'owl:ObjectProperty' || node['@type'] === 'owl:DatatypeProperty').map(node => ({
        id: node['@id'],
        comment: node['rdfs:comment'] || ''
    }));


    return { title, description, classes, properties };
}

async function getContextMetadata(filePath, termDictionary) {
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    const contextValue = data['@context'];

    let imports = [];
    let localTermMap = {};

    if (Array.isArray(contextValue)) {
        for (const item of contextValue) {
            if (typeof item === 'string') {
                imports.push(item);
            } else if (typeof item === 'object' && item !== null) {
                Object.assign(localTermMap, item);
            }
        }
    } else if (typeof contextValue === 'object' && contextValue !== null) {
        Object.assign(localTermMap, contextValue);
    } else if (typeof contextValue === 'string') {
        imports.push(contextValue);
    }

    const localTerms = Object.entries(localTermMap).map(([term, uri]) => {
        // The URI can be an object with @id, so handle that case
        const termUri = (typeof uri === 'object' && uri !== null) ? uri['@id'] : uri;
        const definition = termDictionary[termUri] || {};
        return {
            term,
            uri: termUri,
            description: definition.description || '',
            module: definition.module || ''
        };
    });
    
    return { imports, localTerms };
}

function generateOntologyHtml(directoryName, files) {
    const listItems = files.map(file => `
        <li>
            <h3><a href="./${file.name}">${file.name}</a></h3>
            <p><strong>${file.title}</strong></p>
            <p>${file.description}</p>
            ${file.classes.length > 0 ? `<h4>Classes</h4><ul>\n${file.classes.map(c => `                <li id="${c}">${c}</li>`).join('\n')}\n            </ul>` : ''}
            ${file.properties.length > 0 ? `<h4>Properties</h4><ul>\n${file.properties.map(p => `                <li id="${p.id}">${p.id}${p.comment ? ` - <em>${p.comment}</em>` : ''}</li>`).join('\n')}\n            </ul>` : ''}
        </li>
    `).join('\n');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ontology Explorer: ${directoryName}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; margin: 2em; }
        h1, h2, h3, h4 { color: #333; }
        ul { list-style-type: none; padding-left: 0; }
        li { border: 1px solid #ddd; border-radius: 5px; padding: 1em; margin-bottom: 1em; }
        a { text-decoration: none; color: #007BFF; }
        a:hover { text-decoration: underline; }
        p { margin: 0.5em 0; }
        ul ul { padding-left: 1em; }
        ul ul li { border: none; padding: 0.2em 0; margin-bottom: 0;}
    </style>
</head>
<body>
    <h1>Ontology Explorer</h1>
    <h2>${directoryName}</h2>
    <ul>
        ${listItems}
    </ul>
</body>
</html>`;
}

function generateContextHtml(directoryName, files) {
    const listItems = files.map(file => {
        const importsList = file.imports.length > 0
            ? `<h4>Imports</h4><ul>\n${file.imports.map(i => `                <li>${i}</li>`).join('\n')}\n            </ul>`
            : '';

        const termsList = file.localTerms.length > 0
            ? `<h4>Locally Defined Terms</h4><ul>\n${file.localTerms.map(t => {
                const termName = `<strong>${t.term}</strong>`;
                const description = t.description ? ` - <em>${t.description}</em>` : '';
                if (t.module && t.uri) {
                    // Path from dist/spec/contexts/v1/ to dist/spec/ontology/v1/
                    const link = `../../ontology/v1/${t.module}/index.html#${t.uri}`;
                    return `                <li><a href="${link}">${termName}</a>${description}</li>`;
                }
                return `                <li>${termName}${description}</li>`;
            }).join('\n')}\n            </ul>`
            : '';

        return `
        <li>
            <h3><a href="./${file.name}">${file.name}</a></h3>
            ${importsList}
            ${termsList}
        </li>
    `}).join('\n');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Explorer: ${directoryName}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; margin: 2em; }
        h1, h2, h3, h4 { color: #333; }
        ul { list-style-type: none; padding-left: 0; }
        li { border: 1px solid #ddd; border-radius: 5px; padding: 1em; margin-bottom: 1em; }
        a { text-decoration: none; color: #007BFF; }
        a:hover { text-decoration: underline; }
        p { margin: 0.5em 0; }
        ul ul { padding-left: 1em; }
        ul ul li { border: none; padding: 0.2em 0; margin-bottom: 0;}
    </style>
</head>
<body>
    <h1>Context Explorer</h1>
    <h2>${directoryName}</h2>
    <ul>
        ${listItems}
    </ul>
</body>
</html>`;
}

async function buildTermDictionary() {
    const termMap = {};
    const sourceOntologyDir = join(process.cwd(), 'src', 'ontology', 'v1');
    const sourceOntologyDirs = ['core', 'sectors'];

    for (const dirSuffix of sourceOntologyDirs) {
        const fullPath = join(sourceOntologyDir, dirSuffix);
        // Using a modified getJsonLdFiles that reads from src, not dist
        try {
            const dirents = await readdir(fullPath, { withFileTypes: true });
            const files = dirents
                .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsonld'))
                .map(dirent => join(fullPath, dirent.name));

            for (const file of files) {
                const content = await readFile(file, 'utf-8');
                const data = jsoncParse(content);
                const graph = data['@graph'] || [];
                
                for (const node of graph) {
                    if (node['@id'] && node['rdfs:comment']) {
                        termMap[node['@id']] = {
                            description: node['rdfs:comment'],
                            module: dirSuffix // 'core' or 'sectors'
                        };
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                console.warn(`Directory not found during dictionary build: ${fullPath}. Skipping.`);
                continue;
            }
            throw error;
        }
    }
    return termMap;
}

async function main() {
    // 1. Build a dictionary of all term URIs and their descriptions from the ontology source.
    const termDictionary = await buildTermDictionary();

    // 2. Process Ontologies for HTML documentation
    for (const dirSuffix of ontologyDirsToProcess) {
        const fullPath = join(ontologyDir, dirSuffix);
        const directoryName = `ontology/v1/${dirSuffix}`;

        const files = await getJsonLdFiles(fullPath);
        if (files.length === 0) {
            continue;
        }

        const fileMetadata = await Promise.all(files.map(async (file) => {
            const { title, description, classes, properties } = await getOntologyMetadata(file);
            return {
                name: basename(file),
                title,
                description,
                classes,
                properties
            };
        }));
        
        const htmlContent = generateOntologyHtml(directoryName, fileMetadata);
        await writeFile(join(fullPath, 'index.html'), htmlContent);
        console.log(`Generated ontology index.html for ${fullPath}`);
    }

    // 3. Process Contexts for HTML documentation
    for (const dirSuffix of contextDirsToProcess) {
        const fullPath = join(contextDir, dirSuffix);
        const directoryName = `contexts/v1${dirSuffix === '.' ? '' : '/' + dirSuffix}`;

        const files = await getJsonLdFiles(fullPath);
        if (files.length === 0) {
            continue;
        }

        const fileMetadata = await Promise.all(files.map(async (file) => {
            // Pass the dictionary to the metadata function
            const { imports, localTerms } = await getContextMetadata(file, termDictionary);
            return {
                name: basename(file),
                imports,
                localTerms
            };
        }));
        
        const htmlContent = generateContextHtml(directoryName, fileMetadata);
        await writeFile(join(fullPath, 'index.html'), htmlContent);
        console.log(`Generated context index.html for ${fullPath}`);
    }
}

main().catch(console.error);