import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename, dirname, resolve, relative } from 'path';
import { parse as jsoncParse } from 'jsonc-parser';

export const getFragment = (id) => {
    if (id.includes('#')) {
        return id.substring(id.lastIndexOf('#') + 1);
    }
    const parts = id.split(':');
    if (parts.length > 1) {
        return parts[parts.length - 1];
    }
    return id.replace(/:/g, '_');
};

function getDisplayLabel(label, fallback) {
    if (typeof label === 'string') {
        return label;
    }
    if (Array.isArray(label)) {
        const enLabel = label.find(l => l['@language'] === 'en');
        if (enLabel) {
            return enLabel['@value'];
        }
        // Fallback to the first available language-tagged value
        if (label.length > 0 && label[0]['@value']) {
            return label[0]['@value'];
        }
    } else if (typeof label === 'object' && label !== null && label['@value']) {
        // Handle single language-tagged object
        return label['@value'];
    }
    // Fallback for other cases or if no suitable value is found
    return fallback || (label && label['@id']) || JSON.stringify(label);
}

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
    const data = jsoncParse(content);
    const context = data['@context'] || {};
    const graph = data['@graph'] || [];

    let ontologyInfo = graph.find(node => node['@type'] === 'owl:Ontology');
    
    // If not found in the graph, check if the root object is the ontology
    if (!ontologyInfo && data['@type'] === 'owl:Ontology') {
        ontologyInfo = data;
    }

    const title = ontologyInfo?.['dcterms:title'] || 'No title found';
    const description = ontologyInfo?.['dcterms:description'] || 'No description found.';

    const properties = graph
        .filter(p => p['@type'] && (p['@type'].includes('owl:ObjectProperty') || p['@type'].includes('owl:DatatypeProperty')))
        .map(p => {
            const label = getDisplayLabel(p['rdfs:label'], p['@id']);

            const annotations = {};
                                const annotationKeys = ['dppk:governedBy', 'owl:equivalentProperty', 'rdfs:subPropertyOf'];            for (const key of annotationKeys) {
                if (p[key]) {
                    annotations[key] = p[key];
                }
            }

            return {
                id: p['@id'],
                label: label,
                comment: p['rdfs:comment'],
                domain: p['rdfs:domain'],
                range: p['rdfs:range'] ? (p['rdfs:range']['@id'] || p['rdfs:range']) : '',
                annotations: annotations
            };
        });

    const classes = graph
        .filter(node => node['@type'] === 'rdfs:Class')
        .map(node => {
            const classId = node['@id'];
            
            const classAttributes = {};
            const allowedKeys = ['rdfs:subClassOf', 'owl:equivalentClass'];
            for (const key of allowedKeys) {
                if (node[key]) {
                    classAttributes[key] = node[key];
                }
            }
            
            // Find properties that have this class as a range
            const propertiesWithThisRange = graph.filter(p => p['rdfs:range'] && p['rdfs:range']['@id'] === classId);
            for (const p of propertiesWithThisRange) {
                if (p['dppk:governedBy']) {
                    if (!classAttributes['dppk:governedBy']) {
                        classAttributes['dppk:governedBy'] = [];
                    }
                    classAttributes['dppk:governedBy'].push(p['dppk:governedBy']);
                }
            }

            return {
                id: classId,
                label: getDisplayLabel(node['rdfs:label'], classId),
                comment: getDisplayLabel(node['rdfs:comment'], ''),
                // Find properties whose domain includes this class
                properties: properties.filter(p => p.domain && (p.domain['@id'] === classId || (Array.isArray(p.domain) && p.domain.some(d => d['@id'] === classId)))),
                attributes: classAttributes
            };
        });

    return { title, description, classes, properties, context };
}

async function getOntologyMetadata(filePath) {
    const content = await readFile(filePath, 'utf-8');
    return parseOntologyMetadata(content);
}

export function parseContextMetadata(content, termDictionary, prefixMap = {}) {
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

    const localTerms = Object.entries(localTermMap)
        .filter(([key, value]) => typeof value !== 'string' || (!value.endsWith('/') && !value.endsWith('#')))
        .map(([term, uri]) => {
            const termCurie = (typeof uri === 'object' && uri !== null) ? uri['@id'] : uri;
            const resolutionContext = { ...prefixMap, ...localTermMap };
            const expandedUri = expandCurie(termCurie, resolutionContext);
            const definition = termDictionary[expandedUri] || {};
            
            return {
                term,
                uri: expandedUri,
                description: definition.description || '',
                module: definition.module || '',
                fileName: definition.fileName || '',
                type: definition.type,
                domain: definition.domain
            };
    });
    
    return { imports, localTerms };
}

async function getContextMetadata(filePath, termDictionary, prefixMap) {
    const content = await readFile(filePath, 'utf-8');
    return parseContextMetadata(content, termDictionary, prefixMap);
}

function generateMermaidDiagram(c) {
    const className = getFragment(c.id);
    let diagram = `classDiagram\n  class ${className}\n`;

    if (c.attributes['rdfs:subClassOf']) {
        const subClassOf = Array.isArray(c.attributes['rdfs:subClassOf']) ? c.attributes['rdfs:subClassOf'] : [c.attributes['rdfs:subClassOf']];
        subClassOf.forEach(sc => {
            const superClassName = getFragment(sc['@id']);
            diagram += `  ${superClassName} <|-- ${className}\n`;
        });
    }

    c.properties.forEach(p => {
        const propName = getFragment(p.id);
        diagram += `  ${className} : +${propName}\n`;
        if (p.range && (p.range.startsWith('dppk:') || p.range.includes('#'))) {
            const rangeName = getFragment(p.range);
            diagram += `  ${className} --|> ${rangeName} : ${propName}\n`;
        }
    });

    return diagram;
}

const resolvePName = (pname, context) => {
    if (!pname.includes(':')) return pname;
    const [prefix, localPart] = pname.split(':');
    const base = context[prefix];
    if (base) {
        return `${base}${localPart}`;
    }
    return pname; // Return as is if prefix not in context
};

const processValue = (val, context, currentHtmlPath, ontologyDir, allMetadata) => {
    if (typeof val === 'object' && val !== null) {
        // If it has an @id, it's a link to another entity.
        if (val['@id']) {
            const id = val['@id'];
            if (id.startsWith('http')) {
                return `<a href="${id}">${id}</a>`;
            }

            // Try to resolve the link to a generated class page
            const definingModuleMeta = allMetadata.find(m => m.classes.some(c => c.id === id));
            if (definingModuleMeta && currentHtmlPath && ontologyDir) {
                const fragment = getFragment(id);
                const targetModuleDirName = basename(definingModuleMeta.name, '.jsonld');
                const targetPath = join(ontologyDir, definingModuleMeta.module, targetModuleDirName, `${fragment}.html`);
                const relativeLink = relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
                return `<a href="${relativeLink}">${id}</a>`;
            }

            // Fallback for other types of links
            if (id.includes(':')) {
                const href = resolvePName(id, context);
                return `<a href="${href}">${id}</a>`;
            }
            return `<a href="${getFragment(id)}.html">${id}</a>`; // Fallback for same-module links
        }
        // If it has a @value, it's a language-tagged string literal.
        if (val['@value']) {
            return val['@value'];
        }
        // If it's some other kind of object, stringify it.
        return JSON.stringify(val);
    }
    // It's a primitive (string, number, etc.)
    return val;
};


function generateIndividualClassPageHtml(c, fileMetadata, allMetadata, currentHtmlPath, ontologyDir, distDir) {
    const { title: moduleTitle, name: moduleFileName, context, module: moduleDirName } = fileMetadata;
    const extraColumns = [...new Set(c.properties.flatMap(p => Object.keys(p.annotations)))];
    const relativePathToRoot = relative(dirname(currentHtmlPath), join(distDir, '..')).replace(/\\/g, '/');

    const attributesHtml = Object.entries(c.attributes).map(([key, value]) => {
        let displayValue;
        if (Array.isArray(value)) {
            displayValue = value.map(val => processValue(val, context, currentHtmlPath, ontologyDir, allMetadata)).join(', ');
        } else {
            displayValue = processValue(value, context, currentHtmlPath, ontologyDir, allMetadata);
        }
        return `<p><strong>${key.replace('dppk:', '').replace('rdfs:', '').replace('owl:', '')}:</strong> ${displayValue}</p>`;
    }).join('');

    const mermaidDiagram = generateMermaidDiagram(c);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Class: ${c.label}</title>
    <link rel="stylesheet" href="${relativePathToRoot}/branding/css/keystone-style.css">
    <style>
        table { width: 100%; border-collapse: collapse; margin-top: 1em; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <a href="${relativePathToRoot}/index.html"><img src="${relativePathToRoot}/branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;"></a>
            <div>
                <h1><a href="../index.html">Ontology: ${moduleDirName}</a> / <a href="index.html">${moduleTitle}</a></h1>
                <h2 style="margin: 0; color: var(--text-light);">Class: ${c.label} (${c.id})</h2>
            </div>
        </header>
        <main>
            <div class="class-section" id="${getFragment(c.id)}">
                <h4>Visual Diagram</h4>
                <pre class="mermaid">
                    ${mermaidDiagram}
                </pre>

                <h4>Attributes</h4>
                <p>${c.comment}</p>
                ${attributesHtml}

                ${c.properties.length > 0 ? `
                    <h4>Properties</h4>
                    <table>
                        <thead>
                            <tr>
                                <th>Property</th>
                                <th>Description</th>
                                <th>Type</th>
                                ${extraColumns.map(col => `<th>${col.replace('dppk:', '').replace('owl:','').replace('rdfs:','')}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${c.properties.map(p => {
                                const annotationsHtml = extraColumns.map(col => {
                                    const values = Array.isArray(p.annotations[col]) ? p.annotations[col] : [p.annotations[col]];
                                    const renderedValues = values.map(val => processValue(val, context, currentHtmlPath, ontologyDir, allMetadata)).join(', ');
                                    return `<td>${renderedValues || ''}</td>`;
                                }).join('');

                                return `
                                <tr>
                                    <td>${p.label} (${p.id})</td>
                                    <td>${p.comment || ''}</td>
                                    <td>${p.range || ''}</td>
                                    ${annotationsHtml}
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                ` : ''}
            </div>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        mermaid.initialize({ startOnLoad: true });
    </script>
</body>
</html>`;
}

function generateIndividualContextPageHtml(fileMetadata, currentHtmlPath, ontologyDir, distDir, allMetadata) {
    const { name, imports, localTerms } = fileMetadata;
    const relativePathToRoot = relative(dirname(currentHtmlPath), join(distDir, '..')).replace(/\\/g, '/');

    const importsList = imports.length > 0
        ? `<h4>Imports</h4><ul>\n${imports.map(i => `                <li><a href="${i}">${i}</a></li>`).join('\n')}\n            </ul>`
        : '';

    const termsList = localTerms.length > 0
        ? `<h4>Locally Defined Terms</h4><ul>\n${localTerms.map(t => {
            const termName = `<strong>${t.term}</strong>`;
            const description = t.description ? ` - <em>${t.description}</em>` : '';
            let link = null;

            const isClass = Array.isArray(t.type) ? t.type.includes('rdfs:Class') : t.type === 'rdfs:Class';
            const isProperty = Array.isArray(t.type) ? t.type.some(type => type.includes('Property')) : (t.type && t.type.includes('Property'));

            if (isProperty && t.domain && t.domain['@id']) {
                // It's a property with a domain, find the parent class
                const domainClassId = t.domain['@id'];
                const domainModuleMeta = allMetadata.find(m => m.classes.some(c => c.id === domainClassId));
                if (domainModuleMeta) {
                    const domainModuleDirName = basename(domainModuleMeta.name, '.jsonld');
                    const targetPath = join(ontologyDir, domainModuleMeta.module, domainModuleDirName, `${getFragment(domainClassId)}.html`);
                    link = relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
                }
            } else if (isClass) {
                // It's a class, link to its own page.
                const targetPath = join(ontologyDir, t.module, basename(t.fileName, '.jsonld'), `${getFragment(t.uri)}.html`);
                link = relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
            }

            if (link) {
                return `                <li><a href="${link}">${termName}</a>${description}</li>`;
            }
            return `                <li>${termName}${description}</li>`; // Fallback for terms without links
        }).join('\n')}\n            </ul>`
        : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context: ${name}</title>
    <link rel="stylesheet" href="${relativePathToRoot}/branding/css/keystone-style.css">
</head>
<body>
    <div class="container">
        <header>
            <a href="${relativePathToRoot}/index.html"><img src="${relativePathToRoot}/branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;"></a>
            <div>
                <h1><a href="../index.html">Contexts</a> / ${name}</h1>
            </div>
        </header>
        <main>
            <p><strong>Source:</strong> <a href="../${name}">${name}</a></p>
            ${importsList}
            ${termsList}
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
</body>
</html>`;
}

export function generateModuleIndexHtml(fileMetadata, currentHtmlPath, distDir) {
    const { title, description, classes, properties, name: fileName, module: moduleDirName } = fileMetadata;
    const relativePathToRoot = relative(dirname(currentHtmlPath), join(distDir, '..')).replace(/\\/g, '/');
    
    // Link to the parent directory's index.html (e.g., from /core/Compliance/index.html to /core/index.html)
    const parentIndexLink = relative(dirname(currentHtmlPath), join(dirname(currentHtmlPath), '..', 'index.html')).replace(/\\/g, '/');
    
    // Link to the source file for this module (e.g., from /core/Compliance/index.html to ../Compliance.jsonld)
    const sourceFileLink = relative(dirname(currentHtmlPath), join(dirname(currentHtmlPath), '..', fileName)).replace(/\\/g, '/');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ontology Module: ${title}</title>
    <link rel="stylesheet" href="${relativePathToRoot}/branding/css/keystone-style.css">
</head>
<body>
    <div class="container">
        <header>
            <a href="${relativePathToRoot}/index.html"><img src="${relativePathToRoot}/branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;"></a>
            <div>
                <h1><a href="${parentIndexLink}">Ontology: ${moduleDirName}</a></h1>
                <h2 style="margin: 0; color: var(--text-light);">${title}</h2>
            </div>
        </header>
        <main>
            <p>${description}</p>
            <p><strong>Source:</strong> <a href="${sourceFileLink}">${fileName}</a></p>
            <h3>Classes</h3>
            <ul>
                ${classes.map(c => `<li><a href="${getFragment(c.id)}.html">${c.label}</a></li>`).join('')}
            </ul>
            <h3>Properties</h3>
            <ul>
                ${properties.map(p => `<li>${p.label} (${p.id})</li>`).join('')}
            </ul>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
</body>
</html>`;
}

export function generateOntologyHtml(directoryName, files, distDir, currentHtmlPath) {
    // This function is now effectively a directory index generator.
    // It will be replaced by more specific index generators.
    const fileLinks = files.map(file => {
        const moduleName = basename(file.name, '.jsonld');
        return `<li><a href="./${moduleName}/index.html">${file.title}</a></li>`;
    }).join('');

    const relativePathToRoot = relative(dirname(currentHtmlPath), join(distDir, '..')).replace(/\\/g, '/');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Ontology Explorer: ${directoryName}</title>
    <link rel="stylesheet" href="${relativePathToRoot}/branding/css/keystone-style.css">
</head>
<body>
    <div class="container">
        <h1>Ontology Modules in ${directoryName}</h1>
        <ul>${fileLinks}</ul>
    </div>
</body>
</html>`;
}

export function generateContextHtml(directoryName, files, distDir, currentHtmlPath) {
    const listItems = files.map(file => {
        const contextFileName = basename(file.name, '.jsonld');
        const link = `./${contextFileName}/index.html`;
        
        return `
        <li>
            <h3><a href="${link}">${file.name}</a></h3>
        </li>
    `}).join('\n');

    const relativePathToRoot = relative(dirname(currentHtmlPath), join(distDir, '..')).replace(/\\/g, '/');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Context Explorer: ${directoryName}</title>
    <link rel="stylesheet" href="${relativePathToRoot}/branding/css/keystone-style.css">
</head>
<body>
    <div class="container">
        <header>
            <img src="${relativePathToRoot}/branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;">
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
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
</body>
</html>`;
}

const expandCurie = (curie, context) => {
    if (typeof curie !== 'string' || !curie.includes(':')) return curie;
    const [prefix, localPart] = curie.split(':');
    const base = context[prefix];
    if (base) {
        return `${base}${localPart}`;
    }
    return curie;
};

export async function buildTermDictionary(sourceOntologyDir = join(process.cwd(), 'src', 'ontology', 'v1')) {
    const termMap = {};
    const sourceOntologyDirs = ['core', 'sectors'];

    for (const dirSuffix of sourceOntologyDirs) {
        const fullPath = join(sourceOntologyDir, dirSuffix);
        try {
            const dirents = await readdir(fullPath, { withFileTypes: true });
            const files = dirents
                .filter(dirent => dirent.isFile() && dirent.name.endsWith('.jsonld'))
                .map(dirent => join(fullPath, dirent.name));

            for (const file of files) {
                const content = await readFile(file, 'utf-8');
                const data = jsoncParse(content);
                const context = data['@context'] || {};
                const graph = data['@graph'] || [];
                
                for (const node of graph) {
                    if (node['@id'] && node['rdfs:comment']) {
                        const expandedId = expandCurie(node['@id'], context);
                        termMap[expandedId] = {
                            description: node['rdfs:comment'],
                            module: dirSuffix,
                            fileName: basename(file),
                            type: node['@type'],
                            domain: node['rdfs:domain'],
                        };
                    }
                }
            }
        } catch (error) {
            if (error.code === 'ENOENT') {
                if (process.env.NODE_ENV !== 'test') {
                    console.warn(`Directory not found during dictionary build: ${fullPath}. Skipping.`);
                }
                continue;
            }
            throw error;
        }
    }
    return termMap;
}

export async function buildPrefixMap(sourceContextDir) {
    const prefixMap = {};
    const files = await getJsonLdFiles(sourceContextDir);

    for (const file of files) {
        const content = await readFile(file, 'utf-8');
        const data = jsoncParse(content);
        const contextValue = data['@context'];

        let localContext = {};
        if (Array.isArray(contextValue)) {
            for (const item of contextValue) {
                if (typeof item === 'object' && item !== null) {
                    Object.assign(localContext, item);
                }
            }
        } else if (typeof contextValue === 'object' && contextValue !== null) {
            Object.assign(localContext, contextValue);
        }
        
        for (const [key, value] of Object.entries(localContext)) {
            if (typeof value === 'string' && (value.endsWith('/') || value.endsWith('#'))) {
                if (!prefixMap[key]) {
                    prefixMap[key] = value;
                }
            }
        }
    }
    return prefixMap;
}


export async function generateSpecDocs({
    srcDir = join(process.cwd(), 'src'),
    distDir = join(process.cwd(), 'dist', 'spec')
} = {}) {
    const ontologyDir = join(distDir, 'ontology', 'v1');
    const contextDir = join(distDir, 'contexts', 'v1');
    const sourceOntologyDir = join(srcDir, 'ontology', 'v1');
    const sourceContextDir = join(srcDir, 'contexts', 'v1');
    
    const ontologyDirsToProcess = ['core', 'sectors'];
    const contextDirsToProcess = ['.']; // The root of the contexts/v1 dir

    // 1. Build a dictionary of all term URIs and their descriptions from the ontology source.
    const termDictionary = await buildTermDictionary(sourceOntologyDir);

    // 1.5 Build a map of all context prefixes
    const prefixMap = await buildPrefixMap(sourceContextDir);

    const allMetadata = [];

    // 2. Process Ontologies for HTML documentation
    for (const dirSuffix of ontologyDirsToProcess) {
        const fullPath = join(ontologyDir, dirSuffix);
        const directoryName = `ontology/v1/${dirSuffix}`;

        const files = await getJsonLdFiles(fullPath);
        if (files.length === 0) {
            continue;
        }

        const fileMetadata = await Promise.all(files.map(async (file) => {
            const { title, description, classes, properties, context } = await getOntologyMetadata(file);
            const metadata = {
                name: basename(file),
                module: dirSuffix,
                title,
                description,
                classes,
                properties,
                context
            };
            allMetadata.push(metadata);
            return metadata;
        }));

        // Create main index for the directory (e.g., /core/index.html)
        const directoryIndexPath = join(fullPath, 'index.html');
        const directoryIndexHtml = generateOntologyHtml(directoryName, fileMetadata, distDir, directoryIndexPath);
        await writeFile(directoryIndexPath, directoryIndexHtml);
        
        // Loop through each file (module) and generate its own pages
        for (const metadata of fileMetadata) {
            const moduleName = basename(metadata.name, '.jsonld');
            const moduleDir = join(fullPath, moduleName);
            await mkdir(moduleDir, { recursive: true }); // Ensure dir exists

            // Generate index for the module
            const moduleIndexHtmlPath = join(moduleDir, 'index.html');
            const moduleIndexHtml = generateModuleIndexHtml(metadata, moduleIndexHtmlPath, distDir);
            await writeFile(moduleIndexHtmlPath, moduleIndexHtml);

            // Generate individual pages for each class
            for (const c of metadata.classes) {
                const classFileName = `${getFragment(c.id)}.html`;
                const currentHtmlPath = join(moduleDir, classFileName);
                const classPageHtml = generateIndividualClassPageHtml(c, metadata, allMetadata, currentHtmlPath, ontologyDir, distDir);
                await writeFile(currentHtmlPath, classPageHtml);
            }
        }
    }

    // 3. Generate Global Index
    const globalIndexContent = generateGlobalOntologyIndex(allMetadata);
    const globalIndexPath = join(ontologyDir, 'index.html');
    await writeFile(globalIndexPath, globalIndexContent);


    // 4. Process Contexts for HTML documentation
    for (const dirSuffix of contextDirsToProcess) {
        const fullPath = join(contextDir, dirSuffix);
        const directoryName = `contexts/v1${dirSuffix === '.' ? '' : '/' + dirSuffix}`;

        const files = await getJsonLdFiles(fullPath);
        if (files.length === 0) {
            continue;
        }

        const fileMetadata = await Promise.all(files.map(async (file) => {
            const { imports, localTerms } = await getContextMetadata(file, termDictionary, prefixMap);
            return {
                name: basename(file),
                imports,
                localTerms
            };
        }));
        
        const outputPath = join(fullPath, 'index.html');
        const htmlContent = generateContextHtml(directoryName, fileMetadata, distDir, outputPath);
        await writeFile(outputPath, htmlContent);

        // Now, generate individual pages for each context
        for (const metadata of fileMetadata) {
            const contextName = basename(metadata.name, '.jsonld');
            const contextPageDir = join(fullPath, contextName);
            await mkdir(contextPageDir, { recursive: true });

            const currentHtmlPath = join(contextPageDir, 'index.html');
            const contextPageHtml = generateIndividualContextPageHtml(metadata, currentHtmlPath, ontologyDir, distDir, allMetadata);
            await writeFile(currentHtmlPath, contextPageHtml);
        }
    }
}

function generateGlobalOntologyIndex(allMetadata) {
    const allClasses = allMetadata.flatMap(m => m.classes.map(c => ({ ...c, module: m.module, moduleName: basename(m.name, '.jsonld') })));
    const allProperties = allMetadata.flatMap(m => m.properties.map(p => ({ ...p, module: m.module, definedIn: m.name })));

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>DPP Keystone Ontology - Global Index</title>
    <link rel="stylesheet" href="../../branding/css/keystone-style.css">
    <style>
        table { width: 100%; border-collapse: collapse; margin-top: 1em; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        .index-section { margin-top: 2em; }
    </style>
</head>
<body>
    <div class="container">
        <header>
            <img src="../../branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;">
            <div>
                <h1>DPP Keystone Ontology</h1>
                <h2 style="margin: 0; color: var(--text-light);">Global Index</h2>
            </div>
        </header>
        <main>
            <div class="index-section">
                <h3>All Classes</h3>
                <ul>
                    ${allClasses.map(c => `<li><a href="./${c.module}/${c.moduleName}/${getFragment(c.id)}.html">${c.id}</a> (${c.label})</li>`).join('')}
                </ul>
            </div>
            <div class="index-section">
                <h3>All Properties</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Property</th>
                            <th>Description</th>
                            <th>Domain</th>
                            <th>Range</th>
                            <th>Defined In</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${allProperties.map(p => `
                            <tr>
                                <td>${p.label} (${p.id})</td>
                                <td>${p.comment || ''}</td>
                                <td>${p.domain ? (p.domain['@id'] || JSON.stringify(p.domain)) : ''}</td>
                                <td>${p.range || ''}</td>
                                <td>${p.definedIn}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </main>
        <footer>
            <p><small>Part of the <a href="/">DPP Keystone</a> project.</small></p>
        </footer>
    </div>
</body>
</html>`;
}

