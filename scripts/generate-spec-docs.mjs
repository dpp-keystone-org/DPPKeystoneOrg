import { readdir, readFile, writeFile } from 'fs/promises';
import { join, basename, dirname, resolve } from 'path';
import { parse as jsoncParse } from 'jsonc-parser';

async function getJsonLdFiles(dir) {
    try {
        const dirents = await readdir(dir, { withFileTypes: true });
        const files = dirents
            .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsonld'))
            .map(dirent => join(dir, dirent.name));
        return files;
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.warn(`[getJsonLdFiles] Directory not found: ${dir}. Skipping.`);
            return [];
        }
        throw error;
    }
}

export function parseOntologyMetadata(content) {
    const data = JSON.parse(content);
    const graph = data['@graph'] || [];

    const ontologyInfo = graph.find(node => node['@type'] === 'owl:Ontology');
    const title = ontologyInfo?.['dcterms:title'] || 'No title found';
    const description = ontologyInfo?.['dcterms:description'] || 'No description found.';

    const classes = graph
        .filter(node => node['@type'] === 'rdfs:Class')
        .map(node => {
            const classId = node['@id'];
            const properties = graph
                .filter(p => p.hasOwnProperty('rdfs:domain') && (p['rdfs:domain']['@id'] === classId || (Array.isArray(p['rdfs:domain']) && p['rdfs:domain'].some(d => d['@id'] === classId))))
                .map(p => {
                    let label = p['rdfs:label'];
                    if (Array.isArray(label)) {
                        const enLabel = label.find(l => l['@language'] === 'en');
                        if (enLabel) {
                            label = enLabel['@value'];
                        } else if (label.length > 0) {
                            label = label[0]['@value'] || p['@id'];
                        } else {
                            label = p['@id'];
                        }
                    } else if (typeof label === 'object' && label !== null) {
                        label = label['@value'] || p['@id'];
                    }

                    const annotations = {};
                    for (const key in p) {
                        if (key.startsWith('dppk:')) {
                            annotations[key] = p[key];
                        }
                    }

                    return {
                        id: p['@id'],
                        label: label,
                        comment: p['rdfs:comment'],
                        range: p['rdfs:range'] ? (p['rdfs:range']['@id'] || p['rdfs:range']) : '',
                        annotations: annotations
                    };
                });

            return {
                id: classId,
                label: node['rdfs:label'],
                comment: node['rdfs:comment'],
                properties
            };
        });

    return { title, description, classes };
}

async function getOntologyMetadata(filePath) {
    const content = await readFile(filePath, 'utf-8');
    return parseOntologyMetadata(content);
}

export function parseContextMetadata(content, termDictionary) {
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
            module: definition.module || '',
            fileName: definition.fileName || ''
        };
    });
    
    return { imports, localTerms };
}

async function getContextMetadata(filePath, termDictionary) {
    const content = await readFile(filePath, 'utf-8');
    return parseContextMetadata(content, termDictionary);
}

export function generateOntologyHtml(directoryName, files) {
    const fileSections = files.map(file => `
        <section>
            <h2><a href="./${file.name}">${file.name}</a></h2>
            <p><strong>${file.title}</strong></p>
            <p>${file.description}</p>
            ${file.classes.map(c => {
                const extraColumns = [...new Set(c.properties.flatMap(p => Object.keys(p.annotations)))];
                
                return `
                <div class="class-section">
                    <h3>Class: ${c.label} (${c.id})</h3>
                    <p>${c.comment}</p>
                    ${c.properties.length > 0 ? `
                        <h4>Properties</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Property</th>
                                    <th>Description</th>
                                    <th>Type</th>
                                    ${extraColumns.map(col => `<th>${col.replace('dppk:', '')}</th>`).join('')}
                                </tr>
                            </thead>
                            <tbody>
                                ${c.properties.map(p => `
                                    <tr>
                                        <td>${p.label} (${p.id})</td>
                                        <td>${p.comment || ''}</td>
                                        <td>${p.range || ''}</td>
                                        ${extraColumns.map(col => `<td>${p.annotations[col] || ''}</td>`).join('')}
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : ''}
                </div>
            `}).join('')}
        </section>
    `).join('');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ontology Explorer: ${directoryName}</title>
    <link rel="stylesheet" href="../../../branding/css/keystone-style.css">
    <style>
        table { width: 100%; border-collapse: collapse; margin-top: 1em; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .class-section { margin-top: 2em; border-top: 2px solid #ccc; padding-top: 1em; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <img src="../../../branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;">
            <div>
                <h1>Ontology Explorer</h1>
                <h2 style="margin: 0; color: var(--text-light);">${directoryName}</h2>
            </div>
        </header>
        <main>
            ${fileSections}
        </main>
        <footer>
            <p><small>Part of the <a href="/">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
</body>
</html>`;
}

export function generateContextHtml(directoryName, files) {
    const listItems = files.map(file => {
        const importsList = file.imports.length > 0
            ? `<h4>Imports</h4><ul>\n${file.imports.map(i => `                <li>${i}</li>`).join('\n')}\n            </ul>`
            : '';

        const termsList = file.localTerms.length > 0
            ? `<h4>Locally Defined Terms</h4><ul>\n${file.localTerms.map(t => {
                const termName = `<strong>${t.term}</strong>`;
                const description = t.description ? ` - <em>${t.description}</em>` : '';
                if (t.module && t.uri && t.fileName) {
                    // Path from dist/spec/contexts/v1/ to dist/spec/ontology/v1/
                    const link = `../../ontology/v1/${t.module}/${t.fileName}`;
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
    <link rel="stylesheet" href="../../branding/css/keystone-style.css">
</head>
<body>
    <div class="container">
        <header>
            <img src="../../branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;">
            <div>
                <h1>Context Explorer</h1>
                <h2 style="margin: 0; color: var(--text-light);">${directoryName}</h2>
            </div>
        </header>
        <main>
            <ul>
                ${listItems}
            </ul>
        </main>
        <footer>
            <p><small>Part of the <a href="/">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
</body>
</html>`;
}

async function buildTermDictionary(sourceOntologyDir = join(process.cwd(), 'src', 'ontology', 'v1')) {
    const termMap = {};
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
                            module: dirSuffix, // 'core' or 'sectors'
                            fileName: basename(file)
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

export async function generateSpecDocs({
    srcDir = join(process.cwd(), 'src'),
    distDir = join(process.cwd(), 'dist', 'spec')
} = {}) {
    const ontologyDir = join(distDir, 'ontology', 'v1');
    const contextDir = join(distDir, 'contexts', 'v1');
    const sourceOntologyDir = join(srcDir, 'ontology', 'v1');
    
    const ontologyDirsToProcess = ['core', 'sectors'];
    const contextDirsToProcess = ['.']; // The root of the contexts/v1 dir

    // 1. Build a dictionary of all term URIs and their descriptions from the ontology source.
    const termDictionary = await buildTermDictionary(sourceOntologyDir);

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
        const outputPath = join(fullPath, 'index.html');
        await writeFile(outputPath, htmlContent);
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
            const { imports, localTerms } = await getContextMetadata(file, termDictionary);
            return {
                name: basename(file),
                imports,
                localTerms
            };
        }));
        
        const htmlContent = generateContextHtml(directoryName, fileMetadata);
        const outputPath = join(fullPath, 'index.html');
        await writeFile(outputPath, htmlContent);
    }
}
