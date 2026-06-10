import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, basename, dirname, resolve, relative } from 'path';
import { parse as jsoncParse } from 'jsonc-parser';
import { KEYSTONE_VERSION } from '../src/lib/keystone-version.js';

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

export function getI18nData(label, fallback) {
    let text = fallback || (label && label['@id']) || (typeof label === 'string' ? label : JSON.stringify(label));
    let raw = null;

    if (typeof label === 'string') {
        text = label;
        raw = [{ "@language": "en", "@value": label }];
    } else if (Array.isArray(label)) {
        raw = label;
        const enLabel = label.find(l => l['@language'] === 'en');
        if (enLabel) {
            text = enLabel['@value'];
        } else if (label.length > 0 && label[0]['@value']) {
            text = label[0]['@value'];
        }
    } else if (typeof label === 'object' && label !== null && label['@value']) {
        text = label['@value'];
        raw = [label];
    }
    return { text, raw };
}

export function renderI18nSpan(i18nData) {
    if (!i18nData) return '';
    if (typeof i18nData === 'string') return i18nData; // Fallback
    if (!i18nData.raw) return i18nData.text || '';
    
    // Escape quotes for data attribute
    const jsonStr = JSON.stringify(i18nData.raw).replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<span class="i18n-text" data-i18n="${jsonStr}">${i18nData.text}</span>`;
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

    const title = getI18nData(ontologyInfo?.['dcterms:title'], 'No title found');
    const description = getI18nData(ontologyInfo?.['dcterms:description'], 'No description found.');

    const properties = graph
        .filter(p => p['@type'] && (p['@type'].includes('owl:ObjectProperty') || p['@type'].includes('owl:DatatypeProperty')))
        .map(p => {
            const label = getI18nData(p['rdfs:label'], p['@id']);

            const annotations = {};
            const annotationKeys = ['dppk:governedBy', 'owl:equivalentProperty', 'rdfs:subPropertyOf'];
            for (const key of annotationKeys) {
                if (p[key]) {
                    annotations[key] = p[key];
                }
            }
            
            // Collect all domains from rdfs:domain and schema:domainIncludes
            const domains = [];
            const domainSources = ['rdfs:domain', 'schema:domainIncludes'];
            for (const source of domainSources) {
                if (p[source]) {
                    if (Array.isArray(p[source])) {
                        domains.push(...p[source].map(d => d['@id']));
                    } else if (p[source]['@id']) {
                        domains.push(p[source]['@id']);
                    }
                }
            }

            return {
                id: p['@id'],
                label: label,
                comment: getI18nData(p['rdfs:comment'], ''),
                domains: [...new Set(domains)], // Ensure uniqueness
                range: p['rdfs:range'] ? (p['rdfs:range']['@id'] || p['rdfs:range']) : '',
                annotations: annotations
            };
        });

    const classes = graph
        .filter(node => {
            const t = node['@type'];
            if (!t) return false;
            if (t === 'rdfs:Class' || t === 'owl:NamedIndividual') return true;
            if (typeof t === 'string' && t.startsWith('dppk:') && t !== 'dppk:governedBy') return true;
            return false;
        })
        .map(node => {
            const classId = node['@id'];
            
            const classAttributes = {};
            const allowedKeys = ['rdfs:subClassOf', 'owl:equivalentClass', 'owl:oneOf'];
            
            if (node['@type'] && node['@type'] !== 'rdfs:Class') {
                classAttributes['type'] = node['@type'];
            }

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
                label: getI18nData(node['rdfs:label'], classId),
                comment: getI18nData(node['rdfs:comment'], ''),
                type: node['@type'],
                // Find properties whose domain includes this class OR properties with NO domain (assumed to belong to the module/class)
                properties: properties.filter(p => {
                    if (p.domains.length === 0) return true;
                    return p.domains.includes(classId);
                }),
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
    let fullContextMap = { ...prefixMap };

    // Pass 1: Collect imports and build a full map for resolution (flattened view)
    function collectTerms(ctx) {
        if (Array.isArray(ctx)) {
            for (const item of ctx) {
                collectTerms(item);
            }
        } else if (typeof ctx === 'object' && ctx !== null) {
            for (const [key, value] of Object.entries(ctx)) {
                if (key === '@import') continue;
                
                if (typeof value === 'string') {
                     fullContextMap[key] = value;
                } else if (typeof value === 'object' && value !== null) {
                     if (value['@id']) {
                         fullContextMap[key] = value['@id'];
                     }
                     if (value['@context']) {
                         collectTerms(value['@context']);
                     }
                }
            }
        } else if (typeof ctx === 'string') {
            imports.push(ctx);
        }
    }
    
    collectTerms(contextValue);

    // Pass 2: Build the tree
    function buildTree(ctx, depth = 0) {
        let terms = [];
        if (Array.isArray(ctx)) {
            for (const item of ctx) {
                if (typeof item === 'object') {
                    terms.push(...buildTree(item, depth));
                }
            }
        } else if (typeof ctx === 'object' && ctx !== null) {
            for (const [key, value] of Object.entries(ctx)) {
                if (key === '@import') continue;
                
                let isPrefix = false;
                let uri = null;
                let nestedContext = null;

                if (typeof value === 'string') {
                    if (value.endsWith('/') || value.endsWith('#')) isPrefix = true;
                    uri = value;
                } else if (typeof value === 'object' && value !== null) {
                    if (value['@id']) {
                        uri = value['@id'];
                        if (uri.endsWith('/') || uri.endsWith('#')) isPrefix = true;
                    }
                    nestedContext = value['@context'];
                }

                if (isPrefix) continue;
                if (!uri && !nestedContext) continue;

                let termData = {
                    term: key,
                    uri: uri ? expandCurie(uri, fullContextMap) : null,
                    children: []
                };

                if (termData.uri) {
                    const definition = termDictionary[termData.uri] || {};
                    termData.description = definition.description || '';
                    termData.module = definition.module || '';
                    termData.fileName = definition.fileName || '';
                    termData.type = definition.type;
                    termData.domain = definition.domain;
                }

                if (nestedContext) {
                    termData.children = buildTree(nestedContext, depth + 1);
                }

                terms.push(termData);
            }
        }
        return terms;
    }

    const localTerms = buildTree(contextValue);
    
    return { imports, localTerms };
}

async function getContextMetadata(filePath, termDictionary, prefixMap) {
    const content = await readFile(filePath, 'utf-8');
    return parseContextMetadata(content, termDictionary, prefixMap);
}

export function generateMermaidDiagram(c, allMetadata, currentHtmlPath, ontologyDir) {
    const className = getFragment(c.id);
    let diagram = `classDiagram\n  class ${className}\n`;
    const linkedClasses = new Set();

    if (c.attributes['rdfs:subClassOf']) {
        const subClassOf = Array.isArray(c.attributes['rdfs:subClassOf']) ? c.attributes['rdfs:subClassOf'] : [c.attributes['rdfs:subClassOf']];
        subClassOf.forEach(sc => {
            const superClassName = getFragment(sc['@id']);
            diagram += `  ${superClassName} <|-- ${className}\n`;
            linkedClasses.add(sc['@id']);
        });
    }

    c.properties.forEach(p => {
        const propName = getFragment(p.id);
        diagram += `  ${className} : +${propName}\n`;
        if (p.range && (p.range.startsWith('dppk:') || p.range.includes('#'))) {
            const rangeName = getFragment(p.range);
            diagram += `  ${className} --|> ${rangeName} : ${propName}\n`;
            if (p.range !== c.id) {
                linkedClasses.add(p.range);
            }
        }
    });
    
    // Add interactions
    if (allMetadata && currentHtmlPath && ontologyDir) {
        linkedClasses.forEach(classId => {
            const url = resolveClassUrl(classId, allMetadata, currentHtmlPath, ontologyDir);
            if (url) {
                const fragment = getFragment(classId);
                diagram += `  click ${fragment} href "${url}" "${classId}"\n`;
                diagram += `  style ${fragment} stroke:#2962ff,color:#2962ff\n`;
            }
        });
    }

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

function resolveClassUrl(classId, allMetadata, currentHtmlPath, ontologyDir) {
    const definingModuleMeta = allMetadata.find(m => m.classes.some(c => c.id === classId));
    if (definingModuleMeta && currentHtmlPath && ontologyDir) {
        const fragment = getFragment(classId);
        const targetModuleDirName = basename(definingModuleMeta.name, '.jsonld');
        const targetPath = join(ontologyDir, definingModuleMeta.module, targetModuleDirName, `${fragment}.html`);
        return relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
    }
    return null;
}

const processValue = (val, context, currentHtmlPath, ontologyDir, allMetadata) => {
    if (val == null) return '';
    if (Array.isArray(val)) {
        if (val.length > 0 && val[0]['@language']) {
            return renderI18nSpan(getI18nData(val));
        }
        return val.map(v => processValue(v, context, currentHtmlPath, ontologyDir, allMetadata)).join(', ');
    }
    if (typeof val === 'object' && val !== null) {
        // If it has an @id, it's a link to another entity.
        if (val['@id']) {
            const id = val['@id'];
            if (id.startsWith('http')) {
                return `<a href="${id}">${id}</a>`;
            }

            // Try to resolve the link to a generated class page
            const relativeLink = resolveClassUrl(id, allMetadata, currentHtmlPath, ontologyDir);
            if (relativeLink) {
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
            return renderI18nSpan(getI18nData(val));
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
        if (key === 'owl:oneOf' && Array.isArray(value)) {
            const tableRows = value.map(val => {
                const id = val['@id'] || val;
                const link = processValue(val, context, currentHtmlPath, ontologyDir, allMetadata);
                let label = '';
                if (typeof id === 'string') {
                    for (const m of allMetadata) {
                        const entity = m.classes.find(e => e.id === id);
                        if (entity && entity.label) {
                            label = renderI18nSpan(entity.label);
                            break;
                        }
                    }
                }
                return `<tr><td>${link}</td><td>${label}</td></tr>`;
            }).join('');
            
            return `
                <h4>Enum Values (oneOf)</h4>
                <table>
                    <thead><tr><th>Value ID</th><th>Label</th></tr></thead>
                    <tbody>${tableRows}</tbody>
                </table>
            `;
        }

        const displayValue = processValue(value, context, currentHtmlPath, ontologyDir, allMetadata);
        return `<p><strong>${key.replace('dppk:', '').replace('rdfs:', '').replace('owl:', '')}:</strong> ${displayValue}</p>`;
    }).join('');

    const mermaidDiagram = generateMermaidDiagram(c, allMetadata, currentHtmlPath, ontologyDir);

    const rawType = Array.isArray(c.type) ? c.type[0] : (c.type || 'Concept');
    const displayType = rawType.replace('rdfs:', '').replace('owl:', '').replace('dppk:', '');

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${displayType}: ${c.label.text || c.label}</title>
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
                <h1><a href="../index.html">Ontology: ${moduleDirName}</a> / <a href="index.html">${renderI18nSpan(moduleTitle)}</a></h1>
                <h2 style="margin: 0; color: var(--text-light);">${displayType}: ${renderI18nSpan(c.label)} (${c.id})</h2>
            </div>
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <div class="class-section" id="${getFragment(c.id)}">
                <h4>Visual Diagram</h4>
                <pre class="mermaid">
                    ${mermaidDiagram}
                </pre>

                <h4><span data-i18n-key="description-column">Description</span></h4>
                <p>${renderI18nSpan(c.comment)}</p>
                ${attributesHtml}

                ${c.properties.length > 0 ? `
                    <h4><span data-i18n-key="properties-header">Properties</span></h4>
                    <table>
                        <thead>
                            <tr>
                                <th><span data-i18n-key="property-column">Property</span></th>
                                <th><span data-i18n-key="description-column">Description</span></th>
                                <th>Type</th>
                                ${extraColumns.map(col => `<th>${col.replace('dppk:', '').replace('owl:','').replace('rdfs:','')}</th>`).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${c.properties.map(p => {
                                const annotationsHtml = extraColumns.map(col => {
                                    const renderedValues = processValue(p.annotations[col], context, currentHtmlPath, ontologyDir, allMetadata) || '';
                                    return `<td>${renderedValues}</td>`;
                                }).join('');

                                const targetPath = join(ontologyDir, p.definedInModule, p.definedInDirName, 'index.html');
                                const relativeLink = relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
                                const link = `${relativeLink}#${getFragment(p.id)}`;
                                const propLabelHtml = `<a href="${link}">${renderI18nSpan(p.label)}</a> (${p.id})`;

                                return `
                                <tr>
                                    <td>${propLabelHtml}</td>
                                    <td>${renderI18nSpan(p.comment)}</td>
                                    <td>${p.range ? processValue({"@id": p.range}, context, currentHtmlPath, ontologyDir, allMetadata) : ''}</td>
                                    ${annotationsHtml}
                                </tr>
                            `}).join('')}
                        </tbody>
                    </table>
                ` : ''}
            </div>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project. | <a href="${relativePathToRoot}/impressum.html">Impressum / Legal Notice</a></small></p>
        </footer>
    </div>

    <script type="module">
        import mermaid from 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';
        import { LanguageManager } from '${relativePathToRoot}/lib/language-manager.js';
        mermaid.initialize({ startOnLoad: true });

        LanguageManager.init('${relativePathToRoot}/index.i18n.json');
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

    function renderTerms(terms, level=0) {
        if (!terms || terms.length === 0) return '';
        return `<ul>\n${terms.map(t => {
            const termName = `<strong>${t.term}</strong>`;
            const description = t.description ? ` - <em>${renderI18nSpan(t.description)}</em>` : '';
            let link = null;

            if (t.uri) {
                const isClass = Array.isArray(t.type) ? t.type.includes('rdfs:Class') : t.type === 'rdfs:Class';
                const isProperty = Array.isArray(t.type) ? t.type.some(type => type.includes('Property')) : (t.type && t.type.includes('Property'));

                if (isProperty && t.domain && t.domain['@id']) {
                    const domainClassId = t.domain['@id'];
                    const domainModuleMeta = allMetadata.find(m => m.classes.some(c => c.id === domainClassId));
                    if (domainModuleMeta) {
                        const domainModuleDirName = basename(domainModuleMeta.name, '.jsonld');
                        const targetPath = join(ontologyDir, domainModuleMeta.module, domainModuleDirName, `${getFragment(domainClassId)}.html`);
                        link = relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
                    }
                } else if (isClass) {
                    const targetPath = join(ontologyDir, t.module, basename(t.fileName, '.jsonld'), `${getFragment(t.uri)}.html`);
                    link = relative(dirname(currentHtmlPath), targetPath).replace(/\\/g, '/');
                }
            }

            let content = link ? `<a href="${link}">${termName}</a>${description}` : `${termName}${description}`;
            
            if (t.children && t.children.length > 0) {
                content += renderTerms(t.children);
            }
            
            return `<li>${content}</li>`;
        }).join('\n')}\n</ul>`;
    }

    const termsList = localTerms.length > 0
        ? `<h4>Locally Defined Terms</h4>\n${renderTerms(localTerms)}`
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
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <p><strong>Source:</strong> <a href="../${name}">${name}</a></p>
            ${importsList}
            ${termsList}
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project. | <a href="${relativePathToRoot}/impressum.html">Impressum / Legal Notice</a></small></p>
        </footer>
    </div>
    <script type="module">
        import { LanguageManager } from '${relativePathToRoot}/lib/language-manager.js';
        LanguageManager.init('${relativePathToRoot}/index.i18n.json');
    </script>
</body>
</html>`;
}

export function generateModuleIndexHtml(fileMetadata, currentHtmlPath, distDir, allMetadata, ontologyDir) {
    const { title, description, classes, properties, name: fileName, module: moduleDirName, context } = fileMetadata;
    const relativePathToRoot = relative(dirname(currentHtmlPath), join(distDir, '..')).replace(/\\/g, '/');
    const extraColumns = [...new Set(properties.flatMap(p => Object.keys(p.annotations)))];
    
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
    <title>Ontology Module: ${title.text || title}</title>
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
                <h1><a href="${parentIndexLink}">Ontology: ${moduleDirName}</a></h1>
                <h2 style="margin: 0; color: var(--text-light);">${renderI18nSpan(title)}</h2>
            </div>
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <p>${renderI18nSpan(description)}</p>
            <p><strong>Source:</strong> <a href="${sourceFileLink}">${fileName}</a></p>
            <h3><span data-i18n-key="classes-and-concepts">Classes &amp; Concepts</span></h3>
            <ul>
                ${classes.map(c => `<li><a href="${getFragment(c.id)}.html">${renderI18nSpan(c.label)}</a></li>`).join('')}
            </ul>
            <h3><span data-i18n-key="properties-header">Properties</span></h3>
            <table>
                <thead>
                    <tr>
                        <th><span data-i18n-key="property-column">Property</span></th>
                        <th><span data-i18n-key="description-column">Description</span></th>
                        <th>Domain</th>
                        <th>Range</th>
                        ${extraColumns.map(col => `<th>${col.replace('dppk:', '').replace('owl:','').replace('rdfs:','')}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${properties.map(p => {
                        const annotationsHtml = extraColumns.map(col => {
                            const renderedValues = processValue(p.annotations[col], context, currentHtmlPath, ontologyDir, allMetadata) || '';
                            return `<td>${renderedValues}</td>`;
                        }).join('');

                        return `
                        <tr>
                            <td id="${getFragment(p.id)}"><strong>${renderI18nSpan(p.label)}</strong> (${p.id})</td>
                            <td>${renderI18nSpan(p.comment)}</td>
                            <td>${p.domains ? p.domains.map(d => processValue({"@id": d}, context, currentHtmlPath, ontologyDir, allMetadata)).join(', ') : ''}</td>
                            <td>${p.range ? processValue({"@id": p.range}, context, currentHtmlPath, ontologyDir, allMetadata) : ''}</td>
                            ${annotationsHtml}
                        </tr>
                    `}).join('')}
                </tbody>
            </table>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project. | <a href="${relativePathToRoot}/impressum.html">Impressum / Legal Notice</a></small></p>
        </footer>
    </div>
    <script type="module">
        import { LanguageManager } from '${relativePathToRoot}/lib/language-manager.js';
        LanguageManager.init('${relativePathToRoot}/index.i18n.json');
    </script>
</body>
</html>`;
}

export function generateOntologyHtml(directoryName, files, distDir, currentHtmlPath) {
    // This function is now effectively a directory index generator.
    // It will be replaced by more specific index generators.
    const fileLinks = files.map(file => {
        const moduleName = basename(file.name, '.jsonld');
        return `<li><a href="./${moduleName}/index.html">${renderI18nSpan(file.title)}</a></li>`;
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
        <header>
            <a href="${relativePathToRoot}/index.html"><img src="${relativePathToRoot}/branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;"></a>
            <div>
                <h1>Ontology Explorer</h1>
                <h2 style="margin: 0; color: var(--text-light);">${directoryName}</h2>
            </div>
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <ul>${fileLinks}</ul>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project. | <a href="${relativePathToRoot}/impressum.html">Impressum / Legal Notice</a></small></p>
        </footer>
    </div>
    <script type="module">
        import { LanguageManager } from '${relativePathToRoot}/lib/language-manager.js';
        LanguageManager.init('${relativePathToRoot}/index.i18n.json');
    </script>
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
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <ul>
                ${listItems}
            </ul>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project. | <a href="${relativePathToRoot}/impressum.html">Impressum / Legal Notice</a></small></p>
        </footer>
    </div>
    <script type="module">
        import { LanguageManager } from '${relativePathToRoot}/lib/language-manager.js';
        LanguageManager.init('${relativePathToRoot}/index.i18n.json');
    </script>
</body>
</html>`;
}

function generateTopLevelContextIndexHtml(directoryName, files, distDir, currentHtmlPath) {
    const listItems = files.map(file => {
        const link = `./${file.name}`; // Direct link to the file
        
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
            <a href="${relativePathToRoot}/index.html"><img src="${relativePathToRoot}/branding/images/keystone_logo.png" alt="DPP Keystone Logo" style="height: 60px;"></a>
            <div>
                <h1>Context Explorer</h1>
                <h2 style="margin: 0; color: var(--text-light);">${directoryName}</h2>
            </div>
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <p>These context files point to the latest version of the DPP Keystone contexts.</p>
            <ul>
                ${listItems}
            </ul>
        </main>
        <footer>
            <p><small>Part of the <a href="${relativePathToRoot}/index.html">DPP Keystone</a> project. | <a href="${relativePathToRoot}/impressum.html">Impressum / Legal Notice</a></small></p>
        </footer>
    </div>
    <script type="module">
        import { LanguageManager } from '${relativePathToRoot}/lib/language-manager.js';
        LanguageManager.init('${relativePathToRoot}/index.i18n.json');
    </script>
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

export async function buildTermDictionary(sourceOntologyDir = join(process.cwd(), 'src', 'ontology', KEYSTONE_VERSION)) {
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
                            description: getI18nData(node['rdfs:comment'], ''),
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
    const ontologyDir = join(distDir, 'ontology', KEYSTONE_VERSION);
    const contextDir = join(distDir, 'contexts', KEYSTONE_VERSION);
    const sourceOntologyDir = join(srcDir, 'ontology', KEYSTONE_VERSION);
    const sourceContextDir = join(srcDir, 'contexts', KEYSTONE_VERSION);
    
    const ontologyDirsToProcess = ['core', 'sectors'];
    const contextDirsToProcess = ['.']; // The root of the contexts/v1 dir

    // 1. Build a dictionary of all term URIs and their descriptions from the ontology source.
    const termDictionary = await buildTermDictionary(sourceOntologyDir);

    // 1.5 Build a map of all context prefixes
    const prefixMap = await buildPrefixMap(sourceContextDir);

    const allMetadata = [];

    // Phase 1: Parse all ontology metadata
    for (const dirSuffix of ontologyDirsToProcess) {
        const fullPath = join(ontologyDir, dirSuffix);
        const files = await getJsonLdFiles(fullPath);
        if (files.length === 0) continue;

        await Promise.all(files.map(async (file) => {
            const { title, description, classes, properties, context } = await getOntologyMetadata(file);
            const dirName = basename(file, '.jsonld');
            
            // Tag properties with their source location for cross-linking
            properties.forEach(p => {
                p.definedInModule = dirSuffix;
                p.definedInDirName = dirName;
                p.definedInFile = basename(file);
            });

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
        }));
    }

    // Phase 2: Cross-link properties to their domain classes across modules
    for (const metadata of allMetadata) {
        for (const property of metadata.properties) {
            if (property.domains.length > 0) {
                for (const domainClassId of property.domains) {
                    // Find the class definition in our metadata (could be in any module)
                    for (const targetModule of allMetadata) {
                        const targetClass = targetModule.classes.find(c => c.id === domainClassId);
                        if (targetClass) {
                            // Found the class! Check if it already lists this property
                            const alreadyExists = targetClass.properties.some(p => p.id === property.id);
                            if (!alreadyExists) {
                                targetClass.properties.push(property);
                            }
                            // We don't break here because a property can belong to classes in different modules
                        }
                    }
                }
            }
        }
    }

    // Phase 3: Generate HTML documentation
    // Group metadata by module/directory for index generation
    const metadataByDir = {};
    for (const m of allMetadata) {
        if (!metadataByDir[m.module]) metadataByDir[m.module] = [];
        metadataByDir[m.module].push(m);
    }

    for (const [dirSuffix, fileMetadataList] of Object.entries(metadataByDir)) {
        const fullPath = join(ontologyDir, dirSuffix);
        const directoryName = `ontology/${KEYSTONE_VERSION}/${dirSuffix}`;
        
        // Create main index for the directory (e.g., /core/index.html)
        const directoryIndexPath = join(fullPath, 'index.html');
        const directoryIndexHtml = generateOntologyHtml(directoryName, fileMetadataList, distDir, directoryIndexPath);
        await writeFile(directoryIndexPath, directoryIndexHtml);
        
        // Loop through each file (module) and generate its own pages
        for (const metadata of fileMetadataList) {
            const moduleName = basename(metadata.name, '.jsonld');
            const moduleDir = join(fullPath, moduleName);
            await mkdir(moduleDir, { recursive: true }); // Ensure dir exists

            // Generate index for the module
            const moduleIndexHtmlPath = join(moduleDir, 'index.html');
            const moduleIndexHtml = generateModuleIndexHtml(metadata, moduleIndexHtmlPath, distDir, allMetadata, ontologyDir);
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
    const globalIndexPath = join(ontologyDir, 'index.html');
    const globalIndexContent = generateGlobalOntologyIndex(allMetadata, globalIndexPath, ontologyDir);
    await writeFile(globalIndexPath, globalIndexContent);


    // 4. Process Contexts for HTML documentation
    for (const dirSuffix of contextDirsToProcess) {
        const fullPath = join(contextDir, dirSuffix);
        const directoryName = `contexts/${KEYSTONE_VERSION}${dirSuffix === '.' ? '' : '/' + dirSuffix}`;

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

    // 5. Generate Top-Level Context Index for "latest"
    const topLevelContextDir = join(distDir, 'contexts');
    const topLevelContextFiles = await getJsonLdFiles(topLevelContextDir);
    if (topLevelContextFiles.length > 0) {
        const fileMetadata = topLevelContextFiles.map(file => ({ name: basename(file) }));
        const outputPath = join(topLevelContextDir, 'index.html');
        const htmlContent = generateTopLevelContextIndexHtml('Latest Contexts', fileMetadata, distDir, outputPath);
        await writeFile(outputPath, htmlContent);
        console.log(`Generated latest contexts index at: ${outputPath}`);
    }
}

function generateGlobalOntologyIndex(allMetadata, currentHtmlPath, ontologyDir) {
    const allClasses = allMetadata.flatMap(m => m.classes.map(c => ({ ...c, module: m.module, moduleName: basename(m.name, '.jsonld') })));
    const allProperties = allMetadata.flatMap(m => m.properties.map(p => ({ ...p, module: m.module, definedIn: m.name, context: m.context })));

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
            <div id="language-widget-wrapper" style="margin-left: auto;"></div>
        </header>
        <main>
            <div class="index-section">
                <h3><span data-i18n-key="classes-and-concepts">All Classes &amp; Concepts</span></h3>
                <ul>
                    ${allClasses.map(c => `<li><a href="./${c.module}/${c.moduleName}/${getFragment(c.id)}.html">${c.id}</a> (${c.label})</li>`).join('')}
                </ul>
            </div>
            <div class="index-section">
                <h3><span data-i18n-key="properties-header">All Properties</span></h3>
                <table>
                    <thead>
                        <tr>
                            <th><span data-i18n-key="property-column">Property</span></th>
                            <th><span data-i18n-key="description-column">Description</span></th>
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
                                <td>${p.domains ? p.domains.map(d => processValue({"@id": d}, p.context, currentHtmlPath, ontologyDir, allMetadata)).join(', ') : ''}</td>
                                <td>${p.range ? processValue({"@id": p.range}, p.context, currentHtmlPath, ontologyDir, allMetadata) : ''}</td>
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
    <script type="module">
        import { LanguageManager } from '../../lib/language-manager.js';
        LanguageManager.init('../../index.i18n.json');
    </script>
</body>
</html>`;
}

