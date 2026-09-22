import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import { KEYSTONE_VERSION } from './keystone-version.js?v=1790088520762';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

const SCHEMA_BASE_DIR = path.join(PROJECT_ROOT, 'src/validation', KEYSTONE_VERSION, 'json-schema');
const ONTOLOGY_BASE_DIR = path.join(PROJECT_ROOT, 'src/ontology', KEYSTONE_VERSION);
const CONTEXTS_BASE_DIR = path.join(PROJECT_ROOT, 'src/contexts', KEYSTONE_VERSION);
const CSS_FILE_PATH = path.join(PROJECT_ROOT, 'src/branding/css/dpp-product-page.css');

// Common schemas that must be loaded for $ref resolution
const COMMON_SCHEMA_FILES = [
    'shared/certification.schema.json',
    'shared/component.schema.json',
    'shared/dopc.schema.json',
    'shared/epd.schema.json',
    'shared/general-product.schema.json',
    'shared/mtc.schema.json',
    'shared/organization.schema.json',
    'shared/packaging.schema.json',
    'shared/postal-address.schema.json',
    'shared/product-characteristic.schema.json',
    'shared/related-resource.schema.json'
];

const SECTOR_SCHEMA_FILES = {
    'draft_battery_specification_id': 'sector/battery.schema.json',
    'battery-product-dpp': 'sector/battery.schema.json',
    'draft_construction_specification_id': 'sector/construction.schema.json',
    'construction-product-dpp': 'sector/construction.schema.json',
    'draft_electronics_specification_id': 'sector/electronics.schema.json',
    'electronics-product-dpp': 'sector/electronics.schema.json',
    'draft_iron_and_steel_specification_id': 'sector/iron-steel.schema.json',
    'iron-steel-product-dpp': 'sector/iron-steel.schema.json',
    'draft_textile_espr_specification_id': 'sector/textile.schema.json',
    'textile-product-dpp': 'sector/textile.schema.json'
};

// In-Memory Caches
let cachedSchemaContext = null;
let cachedCss = null;
const cachedOntologyMaps = new Map();

/**
 * Safely reads and parses a JSON/JSONC file from disk with v3 placeholder replacement.
 * @param {string} filePath 
 * @returns {Promise<any>}
 */
export async function readJsonFile(filePath) {
    const raw = await fs.readFile(filePath, 'utf-8');
    const replaced = raw.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
    return jsoncParse(replaced);
}

/**
 * Loads the complete schema context for Ajv validation on the server.
 * Returns { baseSchema, sectorSchemas, commonSchemas }.
 */
export async function getServerSchemaContext() {
    if (cachedSchemaContext) {
        return cachedSchemaContext;
    }

    const baseSchemaPath = path.join(SCHEMA_BASE_DIR, 'dpp.schema.json');
    const baseSchema = await readJsonFile(baseSchemaPath);

    const commonSchemas = await Promise.all(
        COMMON_SCHEMA_FILES.map(relPath => readJsonFile(path.join(SCHEMA_BASE_DIR, relPath)))
    );

    const sectorSchemas = {};
    for (const [id, relPath] of Object.entries(SECTOR_SCHEMA_FILES)) {
        const fullPath = path.join(SCHEMA_BASE_DIR, relPath);
        try {
            const schema = await readJsonFile(fullPath);
            sectorSchemas[id] = schema;
        } catch (e) {
            console.warn(`Could not load sector schema ${fullPath}:`, e.message);
        }
    }

    cachedSchemaContext = {
        baseSchema,
        sectorSchemas,
        commonSchemas
    };

    return cachedSchemaContext;
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
 * Returns an aggregated ontology metadata map for a sector (or 'dpp' core).
 * @param {string} sector e.g. 'battery', 'textile', 'dpp'
 * @returns {Promise<Map<string, object>>}
 */
export async function getServerOntologyMap(sector = 'dpp') {
    if (cachedOntologyMaps.has(sector)) {
        return cachedOntologyMaps.get(sector);
    }

    const ontologyMap = new Map();
    const loadedPaths = new Set();

    // Always load core dpp ontology first
    const corePath = path.join(ONTOLOGY_BASE_DIR, 'dpp-ontology.jsonld');
    await loadAndParseOntologyFile(corePath, ontologyMap, loadedPaths);

    // If a specific sector is requested, load the sector file
    if (sector && sector !== 'dpp') {
        const sectorPascal = sector.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
        const sectorPath = path.join(ONTOLOGY_BASE_DIR, 'sectors', `${sectorPascal}.jsonld`);
        if (await fs.stat(sectorPath).catch(() => false)) {
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

    cachedOntologyMaps.set(sector, ontologyMap);
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
 * Server-side JSON-LD document loader that intercepts dpp-keystone.org URIs and resolves locally from disk.
 */
export function createServerDocumentLoader() {
    return async (url) => {
        const CONTEXT_PREFIX = 'https://dpp-keystone.org/spec/contexts/';
        const ONTOLOGY_PREFIX = 'https://dpp-keystone.org/spec/ontology/';

        if (url.startsWith(CONTEXT_PREFIX)) {
            const rel = url.replace(CONTEXT_PREFIX, '').replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
            const diskPath = path.join(PROJECT_ROOT, 'src/contexts', rel.includes('/') ? rel : `${KEYSTONE_VERSION}/${rel}`);
            try {
                const doc = await readJsonFile(diskPath);
                return { contextUrl: null, documentUrl: url, document: doc };
            } catch (e) {
                // fall through to network/error
            }
        }

        if (url.startsWith(ONTOLOGY_PREFIX)) {
            const rel = url.replace(ONTOLOGY_PREFIX, '').replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
            const diskPath = path.join(PROJECT_ROOT, 'src/ontology', rel.includes('/') ? rel : `${KEYSTONE_VERSION}/${rel}`);
            try {
                const doc = await readJsonFile(diskPath);
                return { contextUrl: null, documentUrl: url, document: doc };
            } catch (e) {
                // fall through
            }
        }

        // Fallback fetch for external schemas (like schema.org)
        const response = await fetch(url, { headers: { 'Accept': 'application/ld+json, application/json' } });
        if (!response.ok) throw new Error(`HTTP ${response.status} loading ${url}`);
        return {
            contextUrl: null,
            documentUrl: url,
            document: await response.json()
        };
    };
}
