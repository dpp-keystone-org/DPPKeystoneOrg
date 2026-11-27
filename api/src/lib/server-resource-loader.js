import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import { KEYSTONE_VERSION, KNOWN_VERSIONS, normalizeSpecUrl } from '../../../src/lib/keystone-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

function getDir(distRel, srcRel) {
    const distPath = path.join(PROJECT_ROOT, distRel);
    if (existsSync(distPath)) return distPath;
    return path.join(PROJECT_ROOT, srcRel);
}

const SCHEMA_BASE_DIR = getDir(
    `dist/spec/validation/${KEYSTONE_VERSION}/json-schema`,
    `src/validation/${KEYSTONE_VERSION}/json-schema`
);
const ONTOLOGY_BASE_DIR = getDir(
    `dist/spec/ontology/${KEYSTONE_VERSION}`,
    `src/ontology/${KEYSTONE_VERSION}`
);
const CONTEXTS_BASE_DIR = getDir(
    `dist/spec/contexts/${KEYSTONE_VERSION}`,
    `src/contexts/${KEYSTONE_VERSION}`
);
const CSS_FILE_PATH = getDir(
    'dist/branding/css/dpp-product-page.css',
    'src/branding/css/dpp-product-page.css'
);

// In-Memory Caches
const cachedSchemaContexts = new Map();
let cachedCss = null;
const cachedOntologyMaps = new Map();
const cachedContextAllowlists = new Map();

/**
 * Safely reads and parses a JSON/JSONC file from disk with {{VERSION}} placeholder replacement.
 * @param {string} filePath 
 * @param {string} [version=KEYSTONE_VERSION]
 * @returns {Promise<any>}
 */
export async function readJsonFile(filePath, version = KEYSTONE_VERSION) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const replaced = raw.replace(/\{\{VERSION\}\}/g, version);
    let errors = [];
    return jsoncParse(replaced, errors, { allowTrailingComma: true, allowComments: true });
}

/**
 * Loads the complete schema context for Ajv validation on the server for a specific version.
 * Returns { baseSchema, sectorSchemas, commonSchemas }.
 * @param {string} [version=KEYSTONE_VERSION]
 */
export async function getServerSchemaContext(version = KEYSTONE_VERSION) {
    if (!KNOWN_VERSIONS.includes(version)) {
        throw new Error(`Unsupported specification version: '${version}'`);
    }

    if (cachedSchemaContexts.has(version)) {
        return cachedSchemaContexts.get(version);
    }

    let schemaDir = getDir(
        `dist/spec/validation/${version}/json-schema`,
        `src/validation/${version}/json-schema`
    );
    if (!existsSync(schemaDir)) {
        schemaDir = getDir(
            `dist/spec/validation/${KEYSTONE_VERSION}/json-schema`,
            `src/validation/${KEYSTONE_VERSION}/json-schema`
        );
    }

    const baseSchemaPath = path.join(schemaDir, 'dpp.schema.json');
    const baseSchema = await readJsonFile(baseSchemaPath, version);

    const commonSchemas = [];
    const sectorSchemas = {};

    // 1. Load shared schemas from disk
    const sharedDir = path.join(schemaDir, 'shared');
    if (existsSync(sharedDir)) {
        const sharedFiles = await fs.readdir(sharedDir);
        for (const file of sharedFiles) {
            if (file.endsWith('.schema.json')) {
                commonSchemas.push(await readJsonFile(path.join(sharedDir, file), version));
            }
        }
    }

    // 2. Recursively load sector schemas from disk
    const sectorDir = path.join(schemaDir, 'sector');
    if (existsSync(sectorDir)) {
        const loadSectorEntries = async (dirPath) => {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);
                if (entry.isDirectory()) {
                    await loadSectorEntries(fullPath);
                } else if (entry.name.endsWith('.schema.json')) {
                    const schema = await readJsonFile(fullPath, version);
                    sectorSchemas[entry.name] = schema;
                }
            }
        };
        await loadSectorEntries(sectorDir);
    }

    const context = {
        baseSchema,
        sectorSchemas,
        commonSchemas
    };

    cachedSchemaContexts.set(version, context);
    return context;
}

/**
 * Robustly extracts a single string value from an RDFS property.
 */
function getSingleRdfsValue(property) {
    if (!property) return '';
    if (typeof property === 'string') return property;

    if (Array.isArray(property)) {
        const enEntry = property.find(entry => entry['@language'] === 'en');
        if (enEntry && enEntry['@value']) return enEntry['@value'];
        if (property[0] && property[0]['@value']) return property[0]['@value'];
    }

    if (property['@value'] !== undefined) return property['@value'];
    
    if (property['@id']) {
        let idStr = property['@id'];
        if (idStr.includes('#')) return idStr.split('#').pop();
        if (idStr.includes(':')) return idStr.split(':').pop();
        return idStr;
    }

    return '';
}

/**
 * Parses an rdfs:label or rdfs:comment property and returns a language-keyed object.
 */
function parseLangTaggedProperty(property) {
    const langMap = {};
    if (!property) return langMap;

    if (typeof property === 'string') {
        langMap.en = property;
        return langMap;
    }

    if (Array.isArray(property)) {
        for (const entry of property) {
            if (entry['@language'] && entry['@value']) {
                langMap[entry['@language']] = entry['@value'];
            }
        }
    } else if (property['@value']) {
        const lang = property['@language'] || 'en';
        langMap[lang] = property['@value'];
    }

    return langMap;
}

/**
 * Recursively parses an ontology file and its imports on disk.
 */
async function loadAndParseOntologyFile(filePath, ontologyMap, loadedPaths) {
    const resolvedPath = path.resolve(filePath);
    if (loadedPaths.has(resolvedPath)) return;
    loadedPaths.add(resolvedPath);

    try {
        const ontology = await readJsonFile(resolvedPath);

        if (ontology['@graph']) {
            for (const term of ontology['@graph']) {
                let key = term['@id'];
                if (!key) continue;
                if (key.includes(':')) key = key.split(':')[1];

                const existing = ontologyMap.get(key) || {};

                const label = parseLangTaggedProperty(term['rdfs:label']);
                const comment = parseLangTaggedProperty(term['rdfs:comment']);
                const unit = getSingleRdfsValue(term['dppk:unit']);
                const unitSymbol = getSingleRdfsValue(term['dppk:unitSymbol']);
                const governedBy = getSingleRdfsValue(term['dppk:governedBy']);

                let range = term['rdfs:range'];
                if (range && range['@id']) range = range['@id'];
                else range = getSingleRdfsValue(range);
                if (range && typeof range === 'string' && range.includes(':')) {
                    range = range.split(':')[1];
                }

                const hasLabel = Object.keys(label).length > 0;
                const hasComment = Object.keys(comment).length > 0;
                const hasUnit = unit && unit.length > 0;
                const hasGov = governedBy && governedBy.length > 0;
                const hasRange = range && range.length > 0;
                const hasUnitSymbol = unitSymbol && unitSymbol.length > 0;

                if (hasLabel || hasComment || hasUnit || hasGov || hasRange || hasUnitSymbol) {
                    ontologyMap.set(key, {
                        ...existing,
                        label: hasLabel ? label : (existing.label || {}),
                        comment: hasComment ? comment : (existing.comment || {}),
                        unit: hasUnit ? unit : (existing.unit || ''),
                        governedBy: hasGov ? governedBy : (existing.governedBy || ''),
                        range: hasRange ? range : (existing.range || ''),
                        unitSymbol: hasUnitSymbol ? unitSymbol : (existing.unitSymbol || null)
                    });
                }
            }
        }

        // Process imports
        if (ontology['owl:imports']) {
            const imports = Array.isArray(ontology['owl:imports']) ? ontology['owl:imports'] : [ontology['owl:imports']];
            for (const importDef of imports) {
                const importUri = typeof importDef === 'string' ? importDef : importDef['@id'];
                if (!importUri) continue;

                // Map URI to file path
                let targetPath = null;
                const PROD_ONTOLOGY_PREFIX = 'https://dpp-keystone.org/spec/ontology/';
                if (importUri.startsWith(PROD_ONTOLOGY_PREFIX)) {
                    const relativeOntology = importUri.replace(PROD_ONTOLOGY_PREFIX, '');
                    targetPath = path.join(PROJECT_ROOT, 'src/ontology', relativeOntology.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION));
                } else if (importUri.startsWith('http://localhost') || importUri.startsWith('..')) {
                    targetPath = path.resolve(path.dirname(resolvedPath), importUri.replace(/.*ontology\/[^\/]+\//, ''));
                }

                if (targetPath && (await fs.stat(targetPath).catch(() => false))) {
                    await loadAndParseOntologyFile(targetPath, ontologyMap, loadedPaths);
                }
            }
        }
    } catch (err) {
        console.warn(`Warning loading ontology ${filePath}:`, err.message);
    }
}

/**
 * Returns an aggregated ontology metadata map for a sector (or 'dpp' core) for a specific version.
 * @param {string} [sector='dpp'] e.g. 'battery', 'textile', 'dpp'
 * @param {string} [version=KEYSTONE_VERSION]
 * @returns {Promise<Map<string, object>>}
 */
export async function getServerOntologyMap(sector = 'dpp', version = KEYSTONE_VERSION) {
    if (!KNOWN_VERSIONS.includes(version)) {
        throw new Error(`Unsupported specification version: '${version}'`);
    }

    const cacheKey = `${version}:${sector}`;
    if (cachedOntologyMaps.has(cacheKey)) {
        return cachedOntologyMaps.get(cacheKey);
    }

    let ontologyDir = getDir(
        `dist/spec/ontology/${version}`,
        `src/ontology/${version}`
    );
    if (!existsSync(ontologyDir)) {
        ontologyDir = getDir(
            `dist/spec/ontology/${KEYSTONE_VERSION}`,
            `src/ontology/${KEYSTONE_VERSION}`
        );
    }

    const ontologyMap = new Map();
    const loadedPaths = new Set();

    // Always load core dpp ontology from local disk (100% offline, no outbound network fallback)
    const corePath = path.join(ontologyDir, 'dpp-ontology.jsonld');
    if (existsSync(corePath)) {
        await loadAndParseOntologyFile(corePath, ontologyMap, loadedPaths);
    }

    // If a specific sector is requested, load the sector file
    if (sector && sector !== 'dpp') {
        const sectorPascal = sector.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        const sectorPath = path.join(ontologyDir, 'sectors', `${sectorPascal}.jsonld`);
        if (existsSync(sectorPath)) {
            await loadAndParseOntologyFile(sectorPath, ontologyMap, loadedPaths);
        }
    }

    // Resolve unit symbols
    for (const [key, term] of ontologyMap.entries()) {
        if (term.unit && typeof term.unit === 'string') {
            const unitTerm = ontologyMap.get(term.unit);
            if (unitTerm && unitTerm.unitSymbol) {
                term.unit = unitTerm.unitSymbol;
            }
        }
    }

    cachedOntologyMaps.set(cacheKey, ontologyMap);
    return ontologyMap;
}

/**
 * Returns the default DPP CSS string.
 */
export async function getProductPageCss() {
    if (cachedCss) return cachedCss;
    try {
        cachedCss = await fs.readFile(CSS_FILE_PATH, 'utf-8');
    } catch (e) {
        console.warn('Could not read DPP product page CSS, using fallback.', e.message);
        cachedCss = 'body { font-family: sans-serif; padding: 20px; }';
    }
    return cachedCss;
}

/**
 * Builds and caches an immutable in-memory allowlist Map<canonicalUrl, parsedContextDoc>
 * containing ONLY known `.jsonld` / `.json` context files for the target version.
 * Untrusted request URLs never touch `fs` or `path.join`, eliminating path traversal by construction.
 */
async function getContextAllowlistMap(version = KEYSTONE_VERSION) {
    if (cachedContextAllowlists.has(version)) {
        return cachedContextAllowlists.get(version);
    }

    const effectiveVersion = (
        existsSync(path.join(PROJECT_ROOT, `dist/spec/contexts/${version}`)) ||
        existsSync(path.join(PROJECT_ROOT, `src/contexts/${version}`))
    ) ? version : KEYSTONE_VERSION;

    const contextDir = getDir(
        `dist/spec/contexts/${effectiveVersion}`,
        `src/contexts/${effectiveVersion}`
    );

    const allowlist = new Map();
    if (existsSync(contextDir)) {
        const entries = await fs.readdir(contextDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            if (!entry.name.endsWith('.jsonld') && !entry.name.endsWith('.json')) continue;
            const fullPath = path.join(contextDir, entry.name);
            const parsedDoc = await readJsonFile(fullPath, effectiveVersion);

            // Register versioned URL(s) and version-less "latest" shadow URL
            allowlist.set(`https://dpp-keystone.org/spec/contexts/${version}/${entry.name}`, parsedDoc);
            allowlist.set(`https://dpp-keystone.org/spec/contexts/${effectiveVersion}/${entry.name}`, parsedDoc);
            allowlist.set(`https://dpp-keystone.org/spec/contexts/${entry.name}`, parsedDoc);
        }
    }

    cachedContextAllowlists.set(version, allowlist);
    return allowlist;
}

/**
 * Server-side JSON-LD document loader backed strictly by an in-memory allowlist of known
 * Keystone `.context.jsonld` files (no filesystem path construction from user URLs, no ontology
 * dereferencing via `@context`, and zero outbound network requests).
 * @param {string} [version=KEYSTONE_VERSION]
 */
export function createServerDocumentLoader(version = KEYSTONE_VERSION) {
    if (!KNOWN_VERSIONS.includes(version)) {
        throw new Error(`Unsupported specification version: '${version}'`);
    }

    return async (url) => {
        if (typeof url === 'string') {
            const allowlist = await getContextAllowlistMap(version);
            const normalizedUrl = normalizeSpecUrl(url).replace(/\{\{VERSION\}\}/g, version);
            if (allowlist.has(normalizedUrl)) {
                return {
                    contextUrl: null,
                    documentUrl: url,
                    document: structuredClone(allowlist.get(normalizedUrl))
                };
            }
        }

        // For any external, ontology, or unrecognized URLs, return a safe empty context stub
        // rather than touching disk or making outbound network requests.
        return {
            contextUrl: null,
            documentUrl: url,
            document: { '@context': {} }
        };
    };
}
