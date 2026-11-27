import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { parse as jsoncParse } from 'jsonc-parser';
import jsonld from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import Environment from '@rdfjs/environment';
import N3Parser from '@rdfjs/parser-n3';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import DataFactory from '@rdfjs/data-model/Factory.js';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';

import { KEYSTONE_VERSION, normalizeSpecUrl } from '../../../src/lib/keystone-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

export const EC_PATCHED_SEMANTICS_ROOT = path.join(PROJECT_ROOT, 'ec-bundle', 'semantics');
export const EC_RAW_SEMANTICS_ROOT = path.join(PROJECT_ROOT, 'ec-bundle-raw', 'ec-semantics');

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const SH_SPARQL = 'http://www.w3.org/ns/shacl#sparql';
const EC_DPP_CLASS = 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#DigitalProductPassport';
const EC_UNKNOWN_NS = 'https://repository.product-passport.ec.europa.eu/unknown#';
const BCP47_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;
const RAW_LANG_REGEX = /^[A-Za-z]{2}-[A-Za-z]{2}$/;
const VERSION_PLACEHOLDER_RE = /\{\{VERSION\}\}/g;

const EC_CORE_SPEC_ID = 'https://repository.product-passport.ec.europa.eu/core/1.0.0';
const EC_BATTERIES_BASE = 'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0';

const factory = new Environment([
    DataFactory,
    DatasetFactory,
    N3Parser,
    ClownfaceFactory,
    NamespaceFactory
]);

const engineCache = new Map();

async function walkFiles(dir, ext) {
    if (!existsSync(dir)) return [];
    const out = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            out.push(...(await walkFiles(full, ext)));
        } else if (entry.name.endsWith(ext)) {
            out.push(full);
        }
    }
    return out.sort();
}

async function parseTurtleFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const blankNodePrefix = `${path.basename(filePath, '.ttl').replace(/[^a-zA-Z0-9_]/g, '_')}_`;
    const parser = new N3Parser({ factory, blankNodePrefix });
    const stream = parser.import(Readable.from([content]));
    const dataset = factory.dataset();
    return new Promise((resolve, reject) => {
        stream.on('data', (quad) => dataset.add(quad));
        stream.on('end', () => resolve(dataset));
        stream.on('error', reject);
    });
}

function buildContextMap(semanticsRoot) {
    return {
        'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld':
            path.join(semanticsRoot, 'core/1.0.0/contexts/core-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld':
            path.join(semanticsRoot, 'product/batteries/1.0.0/contexts/batteries-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld':
            path.join(semanticsRoot, 'product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld':
            path.join(semanticsRoot, 'product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld':
            path.join(semanticsRoot, 'product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld'),
        // Support /releases/1.0.0 aliases used by some EC examples
        'https://repository.product-passport.ec.europa.eu/core/releases/1.0.0/contexts/core-context.jsonld':
            path.join(semanticsRoot, 'core/1.0.0/contexts/core-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/releases/1.0.0/contexts/batteries-context.jsonld':
            path.join(semanticsRoot, 'product/batteries/1.0.0/contexts/batteries-context.jsonld')
    };
}

async function addKeystoneContexts(contextMap) {
    const keystoneContextDir = path.join(PROJECT_ROOT, 'src', 'contexts', KEYSTONE_VERSION);
    if (!existsSync(keystoneContextDir)) return;
    for (const entry of await fs.readdir(keystoneContextDir)) {
        if (entry.endsWith('.context.jsonld')) {
            const diskPath = path.join(keystoneContextDir, entry);
            contextMap[`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/${entry}`] = diskPath;
            contextMap[`https://dpp-keystone.org/spec/contexts/${entry}`] = diskPath;
        }
    }
}

/**
 * Recursively flattens a raw EC JSON-LD context file in-memory to work around
 * EC v1.0.0 W3C JSON-LD 1.1 bugs (@base, @protected, chained @import, stray top-level @type).
 */
async function loadFlattenedRawContext(filePath, visited = new Set()) {
    const resolved = path.resolve(filePath);
    if (visited.has(resolved)) return {};
    visited.add(resolved);

    const rawDoc = JSON.parse(await fs.readFile(resolved, 'utf-8'));
    const ctx = rawDoc['@context'];
    if (!ctx || typeof ctx !== 'object') return {};

    let merged = {};
    if (typeof ctx['@import'] === 'string') {
        // Resolve relative @import against the file's directory; raw EC uses ../../../../1.0.0/... which may need adjustment
        let importPath = path.resolve(path.dirname(resolved), ctx['@import']);
        if (!existsSync(importPath)) {
            // Fallback: resolve by filename within EC_RAW_SEMANTICS_ROOT
            const baseName = path.basename(ctx['@import']);
            if (baseName === 'core-context.jsonld') {
                importPath = path.join(EC_RAW_SEMANTICS_ROOT, 'core/1.0.0/contexts/core-context.jsonld');
            } else if (baseName === 'batteries-context.jsonld') {
                importPath = path.join(EC_RAW_SEMANTICS_ROOT, 'product/batteries/1.0.0/contexts/batteries-context.jsonld');
            }
        }
        if (existsSync(importPath)) {
            merged = await loadFlattenedRawContext(importPath, visited);
        }
    }

    for (const [k, v] of Object.entries(ctx)) {
        if (k === '@import' || k === '@base' || k === '@protected') continue;
        merged[k] = v;
    }

    return merged;
}

/**
 * Builds and caches the patched EC validator engine (`ec-bundle/semantics/`).
 */
async function getPatchedEngine() {
    if (engineCache.has('patched')) return engineCache.get('patched');

    const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
    addFormats(ajv);

    const recognizedSpecs = [];
    const specById = new Map();

    const schemaFiles = await walkFiles(EC_PATCHED_SEMANTICS_ROOT, '.schema.json');
    for (const file of schemaFiles) {
        const parsed = JSON.parse(await fs.readFile(file, 'utf-8'));
        ajv.addSchema(parsed);

        if (file.endsWith('common.schema.json')) continue;
        if (file.endsWith('core.schema.json')) {
            const entry = {
                contentSpecificationId: EC_CORE_SPEC_ID,
                title: parsed.title || 'EU DPP Core Envelope',
                authority: 'European Commission (Patched by DPP Keystone)',
                accessTier: 'core',
                jsonSchemaId: parsed.$id
            };
            recognizedSpecs.push(entry);
            specById.set(entry.contentSpecificationId, entry);
            continue;
        }

        const triggerId = parsed.if?.properties?.contentSpecificationIds?.contains?.const;
        if (triggerId) {
            const tierMatch = triggerId.match(/\/(pub|res1|res2|res3)$/);
            const parentId = parsed.then?.properties?.contentSpecificationIds?.contains?.const;
            const entry = {
                contentSpecificationId: triggerId,
                title: parsed.title || path.basename(file),
                authority: 'European Commission (Patched by DPP Keystone)',
                ...(tierMatch ? { accessTier: tierMatch[1] } : {}),
                ...(parentId ? { parentSpecificationId: parentId } : {}),
                jsonSchemaId: parsed.$id
            };
            recognizedSpecs.push(entry);
            specById.set(triggerId, entry);
        }
    }

    const contextMap = buildContextMap(EC_PATCHED_SEMANTICS_ROOT);
    await addKeystoneContexts(contextMap);
    const parsedContexts = new Map();
    for (const [ctxUrl, localPath] of Object.entries(contextMap)) {
        if (existsSync(localPath)) {
            const content = (await fs.readFile(localPath, 'utf-8')).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
            parsedContexts.set(ctxUrl, jsoncParse(content));
        }
    }

    async function documentLoader(url, stubbedUrls = null) {
        const normalized = normalizeSpecUrl(String(url)).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
        if (parsedContexts.has(normalized)) {
            return {
                contextUrl: null,
                documentUrl: url,
                document: structuredClone(parsedContexts.get(normalized))
            };
        }
        if (stubbedUrls) stubbedUrls.add(url);
        return {
            contextUrl: null,
            documentUrl: url,
            document: { '@context': {} }
        };
    }

    const ttlFiles = await walkFiles(EC_PATCHED_SEMANTICS_ROOT, '.ttl');
    const shapeFiles = ttlFiles.filter((f) => f.includes(`${path.sep}shapes${path.sep}`));
    const mergedShaclShapes = factory.dataset();
    for (const shapeFile of shapeFiles) {
        const ds = await parseTurtleFile(shapeFile);
        for (const quad of ds) {
            if (quad.predicate.value !== SH_SPARQL) {
                mergedShaclShapes.add(quad);
            }
        }
    }
    const shaclValidator = new SHACLValidator(mergedShaclShapes, { factory });

    const engine = {
        target: 'patched',
        ajv,
        recognizedSpecs,
        specById,
        documentLoader,
        shaclValidator,
        knownContextUrls: new Set(parsedContexts.keys()),
        schemaCount: schemaFiles.length,
        shapeCount: shapeFiles.length,
        contextCount: Object.keys(contextMap).filter((u) => u.includes('ec.europa.eu') && !u.includes('/releases/')).length
    };

    engineCache.set('patched', engine);
    return engine;
}

/**
 * Builds and caches the raw EC validator engine (`ec-bundle-raw/ec-semantics/`).
 */
async function getRawEngine() {
    if (engineCache.has('raw')) return engineCache.get('raw');

    // Non-strict mode required because official EC v1.0.0 schemas use non-standard "message" keywords
    // and anyOf branches without declaring properties.
    const ajv = new Ajv2020({ strict: false, allowUnionTypes: true, allErrors: true });
    addFormats(ajv);

    const schemaFiles = await walkFiles(EC_RAW_SEMANTICS_ROOT, '.schema.json');
    const schemasByBasename = new Map();
    const recognizedSpecs = [];

    for (const file of schemaFiles) {
        const parsed = JSON.parse(await fs.readFile(file, 'utf-8'));
        const base = path.basename(file);
        schemasByBasename.set(base, parsed);
        ajv.addSchema(parsed);

        if (base === 'common.schema.json') continue;
        recognizedSpecs.push({
            schemaFile: base,
            title: parsed.title || base,
            authority: 'European Commission (Unmodified Official Release)',
            jsonSchemaId: parsed.$id
        });
    }

    const contextMap = buildContextMap(EC_RAW_SEMANTICS_ROOT);
    await addKeystoneContexts(contextMap);
    const parsedRawContexts = new Map();
    for (const [ctxUrl, localPath] of Object.entries(contextMap)) {
        if (!existsSync(localPath)) continue;
        if (ctxUrl.includes('ec.europa.eu')) {
            const flattenedCtx = await loadFlattenedRawContext(localPath);
            parsedRawContexts.set(ctxUrl, { '@context': flattenedCtx });
        } else {
            const content = (await fs.readFile(localPath, 'utf-8')).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
            parsedRawContexts.set(ctxUrl, jsoncParse(content));
        }
    }

    async function documentLoader(url, stubbedUrls = null) {
        const normalized = normalizeSpecUrl(String(url)).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
        if (parsedRawContexts.has(normalized)) {
            return {
                contextUrl: null,
                documentUrl: url,
                document: structuredClone(parsedRawContexts.get(normalized))
            };
        }
        if (stubbedUrls) stubbedUrls.add(url);
        return {
            contextUrl: null,
            documentUrl: url,
            document: { '@context': {} }
        };
    }

    const ttlFiles = await walkFiles(EC_RAW_SEMANTICS_ROOT, '.ttl');
    const shapeFiles = ttlFiles.filter((f) => f.includes(`${path.sep}shapes${path.sep}`));
    const shapesByBasename = new Map();
    for (const shapeFile of shapeFiles) {
        const ds = await parseTurtleFile(shapeFile);
        const filtered = factory.dataset();
        let skippedSparql = 0;
        for (const quad of ds) {
            if (quad.predicate.value === SH_SPARQL) {
                skippedSparql++;
            } else {
                filtered.add(quad);
            }
        }
        shapesByBasename.set(path.basename(shapeFile), { dataset: filtered, skippedSparql });
    }

    const engine = {
        target: 'raw',
        ajv,
        schemasByBasename,
        recognizedSpecs,
        documentLoader,
        shapesByBasename,
        shaclValidatorCache: new Map(),
        knownContextUrls: new Set(parsedRawContexts.keys()),
        schemaCount: schemaFiles.length,
        shapeCount: shapeFiles.length,
        contextCount: Object.keys(contextMap).filter((u) => u.includes('ec.europa.eu') && !u.includes('/releases/')).length
    };

    engineCache.set('raw', engine);
    return engine;
}

function detectRawSubgroup(payload, options) {
    if (options.subgroup && ['evb', 'ind', 'lmt'].includes(options.subgroup)) {
        return options.subgroup;
    }
    const specs = Array.isArray(payload.contentSpecificationIds) ? payload.contentSpecificationIds : [];
    for (const id of specs) {
        if (typeof id !== 'string') continue;
        if (id.includes('/subgroup/evb/')) return 'evb';
        if (id.includes('/subgroup/ind/')) return 'ind';
        if (id.includes('/subgroup/lmt/')) return 'lmt';
    }
    const cat = String(payload.batteryCategory || '').toLowerCase();
    if (cat.includes('electricvehicle')) return 'evb';
    if (cat.includes('industrial')) return 'ind';
    if (cat.includes('lightmeansoftransport')) return 'lmt';
    return null;
}

function detectRawTiers(payload, options) {
    if (Array.isArray(options.tiers) && options.tiers.length > 0) {
        return options.tiers.filter((t) => ['pub', 'res1', 'res2', 'res3'].includes(t));
    }
    const tiers = [];
    const specs = Array.isArray(payload.contentSpecificationIds) ? payload.contentSpecificationIds : [];
    const hasBatterySpec = specs.some((s) => typeof s === 'string' && s.includes('/product/batteries/'));
    if (hasBatterySpec || payload.batteryCategory || payload.batteryWeight !== undefined) {
        tiers.push('pub');
    }
    if (
        payload.detailedComposition !== undefined ||
        payload.sparePartReplacementDetails !== undefined ||
        payload.dismantlingInformation !== undefined ||
        payload.safetyMeasures !== undefined
    ) {
        tiers.push('res1');
    }
    if (payload.complianceTestReportResults !== undefined) {
        tiers.push('res2');
    }
    if (payload.batteryStatus !== undefined) {
        tiers.push('res3');
    }
    return tiers;
}

async function expandToRdfDataset(payload, engine, warnings) {
    const stubbedUrls = new Set();
    const ctxEntries = Array.isArray(payload['@context']) ? payload['@context'] : [payload['@context']];
    for (const entry of ctxEntries) {
        if (typeof entry === 'string') {
            const normalized = normalizeSpecUrl(entry).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
            if (!engine.knownContextUrls.has(normalized)) {
                stubbedUrls.add(entry);
            }
        }
    }

    const expanded = await jsonld.expand(structuredClone(payload), {
        documentLoader: (url) => engine.documentLoader(url, stubbedUrls),
        processingMode: 'json-ld-1.1'
    });

    for (const stubUrl of stubbedUrls) {
        warnings.push(
            `External or unrecognized @context URL "${stubUrl}" was not fetched offline; stubbed as empty context.`
        );
    }

    const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
    const parser = new N3Parser({ factory });
    const stream = parser.import(Readable.from([nquads]));
    const dataDataset = factory.dataset();
    await new Promise((resolve, reject) => {
        stream.on('data', (quad) => dataDataset.add(quad));
        stream.on('end', resolve);
        stream.on('error', reject);
    });
    return dataDataset;
}

/**
 * Returns metadata about the loaded EC bundle (`patched` or `raw`).
 * @param {'patched' | 'raw'} [target='patched']
 */
export async function getEcEngineMetadata(target = 'patched') {
    const engine = target === 'raw' ? await getRawEngine() : await getPatchedEngine();
    return {
        target: engine.target,
        schemaCount: engine.schemaCount,
        shapeCount: engine.shapeCount,
        contextCount: engine.contextCount,
        recognizedSpecs: engine.recognizedSpecs
    };
}

/**
 * Validates a DPP payload against either the patched (`ec-bundle/`) or unmodified official
 * (`ec-bundle-raw/`) EC Battery semantic bundle.
 *
 * @param {object} payload - The DPP JSON / JSON-LD payload.
 * @param {object} [options={}]
 * @param {'patched' | 'raw'} [options.target='patched']
 * @param {'strict' | 'schema' | 'shacl'} [options.mode='strict']
 * @param {string[]} [options.requiredSpecs=[]]
 * @param {'evb' | 'ind' | 'lmt'} [options.subgroup]
 * @param {string[]} [options.tiers]
 */
export async function validateEcDppPayload(payload, options = {}) {
    const target = options.target || 'patched';
    const mode = options.mode || 'strict';
    const requiredSpecs = Array.isArray(options.requiredSpecs) ? options.requiredSpecs : [];

    if (!['patched', 'raw'].includes(target)) {
        throw Object.assign(new Error(`Invalid target '${target}'. Allowed values: 'patched', 'raw'.`), {
            statusCode: 400,
            code: 'INVALID_TARGET'
        });
    }
    if (!['strict', 'schema', 'shacl'].includes(mode)) {
        throw Object.assign(new Error(`Invalid validation mode '${mode}'. Allowed values: 'strict', 'schema', 'shacl'.`), {
            statusCode: 400,
            code: 'INVALID_MODE'
        });
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {
            valid: false,
            target,
            mode,
            activatedSpecifications: [],
            unrecognizedSpecifications: [],
            schemaExecuted: false,
            shaclExecuted: false,
            findings: [{
                stage: 'INPUT',
                code: 'INVALID_PAYLOAD',
                path: '/',
                message: 'DPP payload must be a non-null JSON object.'
            }],
            warnings: []
        };
    }

    const runSchema = mode === 'strict' || mode === 'schema';
    const runShacl = mode === 'strict' || mode === 'shacl';
    const findings = [];
    const warnings = [];
    const claimedSpecs = Array.isArray(payload.contentSpecificationIds)
        ? payload.contentSpecificationIds.filter((s) => typeof s === 'string')
        : [];

    for (const reqSpec of requiredSpecs) {
        if (!claimedSpecs.includes(reqSpec)) {
            findings.push({
                stage: 'REQUIRED_SPECIFICATION_POLICY',
                specificationId: reqSpec,
                code: 'REQ-SPEC-MISSING',
                path: '/contentSpecificationIds',
                message: `Policy requires contentSpecificationId "${reqSpec}" to be declared.`
            });
        }
    }

    if (target === 'patched') {
        const engine = await getPatchedEngine();
        const activatedSpecifications = [
            EC_CORE_SPEC_ID,
            ...claimedSpecs.filter((id) => id !== EC_CORE_SPEC_ID && engine.specById.has(id))
        ];
        const unrecognizedSpecifications = claimedSpecs.filter((id) => !engine.specById.has(id));

        if (runSchema) {
            for (const specId of activatedSpecifications) {
                const specEntry = engine.specById.get(specId);
                if (!specEntry) continue;
                const validateFn = engine.ajv.getSchema(specEntry.jsonSchemaId);
                if (!validateFn) continue;
                const ok = validateFn(structuredClone(payload));
                if (!ok && validateFn.errors) {
                    for (const err of validateFn.errors) {
                        if (err.keyword === 'if') continue;
                        findings.push({
                            stage: 'JSON_SCHEMA',
                            specificationId: specId,
                            schemaId: specEntry.jsonSchemaId,
                            path: err.instancePath || '/',
                            message: `${err.instancePath || '/'} ${err.message}`.trim()
                        });
                    }
                }
            }
        }

        let shaclExecuted = false;
        if (runShacl) {
            if (payload['@context'] === undefined) {
                findings.push({
                    stage: 'SHACL',
                    code: 'MISSING_CONTEXT',
                    path: '/@context',
                    message: 'SHACL validation requires a JSON-LD "@context" property on the DPP payload.'
                });
            } else {
                shaclExecuted = true;
                try {
                    const dataDataset = await expandToRdfDataset(payload, engine, warnings);
                    let hasEcDppNode = false;
                    for (const quad of dataDataset) {
                        if (quad.predicate.value === RDF_TYPE && quad.object.value === EC_DPP_CLASS) {
                            hasEcDppNode = true;
                        }
                        if (quad.predicate.value.startsWith(EC_UNKNOWN_NS)) {
                            findings.push({
                                stage: 'SHACL',
                                code: 'SEM-COM-MSG-013',
                                path: quad.predicate.value,
                                message: `Unknown unmapped JSON-LD predicate: ${quad.predicate.value}`
                            });
                        }
                        if (quad.object.termType === 'Literal' && quad.object.datatype?.value === RDF_LANG_STRING) {
                            if (!BCP47_REGEX.test(quad.object.language || '')) {
                                findings.push({
                                    stage: 'SHACL',
                                    code: 'SEM-COM-MSG-012',
                                    path: quad.predicate.value,
                                    message: `Invalid BCP 47 language tag "${quad.object.language}".`
                                });
                            }
                        }
                    }

                    const usesEcSpec = claimedSpecs.some((id) => id.startsWith('https://repository.product-passport.ec.europa.eu/'));
                    if (usesEcSpec && !hasEcDppNode) {
                        findings.push({
                            stage: 'SHACL',
                            code: 'SEM-CORE-TYPE-MISSING',
                            path: '/type',
                            message: 'No rdf:type dpp:DigitalProductPassport node produced after JSON-LD expansion.'
                        });
                    }

                    const report = await engine.shaclValidator.validate(dataDataset);
                    if (!report.conforms) {
                        for (const r of report.results) {
                            findings.push({
                                stage: 'SHACL',
                                path: r.path?.value || '/',
                                message: r.message?.map((m) => m.value).join('; ') || 'SHACL constraint violation'
                            });
                        }
                    }
                } catch (err) {
                    findings.push({
                        stage: 'SHACL',
                        code: 'JSONLD_SHACL_ERROR',
                        path: '/',
                        message: err.message
                    });
                }
            }
        }

        return {
            valid: findings.length === 0,
            target,
            mode,
            activatedSpecifications,
            unrecognizedSpecifications,
            schemaExecuted: runSchema,
            shaclExecuted,
            findings,
            warnings
        };
    }

    // --- target === 'raw' (`ec-bundle-raw/ec-semantics/`) ---
    const engine = await getRawEngine();
    const subgroup = detectRawSubgroup(payload, options);
    const activeTiers = detectRawTiers(payload, options);
    const schemaNamesToRun = ['core.schema.json'];
    for (const tier of activeTiers) {
        const subFile = subgroup ? `${tier}-${subgroup}.schema.json` : null;
        if (subFile && engine.schemasByBasename.has(subFile)) {
            schemaNamesToRun.push(subFile);
        } else if (engine.schemasByBasename.has(`${tier}-batteries.schema.json`)) {
            schemaNamesToRun.push(`${tier}-batteries.schema.json`);
        }
    }

    // Deduplicate while preserving order; if pub-* is running, it already includes core via allOf
    const uniqueSchemas = [...new Set(schemaNamesToRun)];
    const activatedSpecifications = uniqueSchemas.map((name) => engine.schemasByBasename.get(name)?.$id || name);

    if (runSchema) {
        for (const schemaName of uniqueSchemas) {
            const schemaObj = engine.schemasByBasename.get(schemaName);
            if (!schemaObj) continue;
            const validateFn = engine.ajv.getSchema(schemaObj.$id);
            if (!validateFn) continue;
            const ok = validateFn(structuredClone(payload));
            if (!ok && validateFn.errors) {
                for (const err of validateFn.errors) {
                    findings.push({
                        stage: 'JSON_SCHEMA',
                        specificationId: schemaObj.$id,
                        schemaId: schemaObj.$id,
                        path: err.instancePath || '/',
                        message: `${err.instancePath || '/'} ${err.message}`.trim()
                    });
                }
            }
        }
    }

    let shaclExecuted = false;
    if (runShacl) {
        if (payload['@context'] === undefined) {
            findings.push({
                stage: 'SHACL',
                code: 'MISSING_CONTEXT',
                path: '/@context',
                message: 'SHACL validation requires a JSON-LD "@context" property on the DPP payload.'
            });
        } else {
            shaclExecuted = true;
            warnings.push(
                'Raw EC v1.0.0 JSON-LD contexts contain W3C JSON-LD 1.1 errors (@base, @protected, chained @import); contexts were flattened in-memory to enable SHACL evaluation.'
            );

            try {
                const dataDataset = await expandToRdfDataset(payload, engine, warnings);
                for (const quad of dataDataset) {
                    if (quad.predicate.value.startsWith(EC_UNKNOWN_NS)) {
                        findings.push({
                            stage: 'SHACL',
                            code: 'SEM-COM-MSG-013',
                            path: quad.predicate.value,
                            message: `Unknown unmapped JSON-LD predicate: ${quad.predicate.value}`
                        });
                    }
                    if (quad.object.termType === 'Literal' && quad.object.datatype?.value === RDF_LANG_STRING) {
                        if (!RAW_LANG_REGEX.test(quad.object.language || '')) {
                            findings.push({
                                stage: 'SHACL',
                                code: 'SEM-COM-MSG-012',
                                path: quad.predicate.value,
                                message: `Raw EC v1.0.0 requires xx-YY language tags; got "${quad.object.language}".`
                            });
                        }
                    }
                }

                // Cache merged raw SHACLValidator per (subgroup, activeTiers) combination
                const cacheKey = `${subgroup || 'none'}:${activeTiers.join(',')}`;
                let cachedShacl = engine.shaclValidatorCache.get(cacheKey);
                if (!cachedShacl) {
                    const shapeNames = ['common-shapes.ttl', 'core-shapes.ttl'];
                    for (const tier of activeTiers) {
                        if (engine.shapesByBasename.has(`${tier}-batteries-shapes.ttl`)) {
                            shapeNames.push(`${tier}-batteries-shapes.ttl`);
                        }
                        if (subgroup && engine.shapesByBasename.has(`${tier}-${subgroup}-shapes.ttl`)) {
                            shapeNames.push(`${tier}-${subgroup}-shapes.ttl`);
                        }
                    }

                    const mergedShapes = factory.dataset();
                    let totalSkippedSparql = 0;
                    for (const sName of shapeNames) {
                        const entry = engine.shapesByBasename.get(sName);
                        if (!entry) continue;
                        totalSkippedSparql += entry.skippedSparql;
                        for (const quad of entry.dataset) {
                            mergedShapes.add(quad);
                        }
                    }
                    cachedShacl = {
                        validator: new SHACLValidator(mergedShapes, { factory }),
                        totalSkippedSparql
                    };
                    engine.shaclValidatorCache.set(cacheKey, cachedShacl);
                }

                if (cachedShacl.totalSkippedSparql > 0) {
                    warnings.push(
                        `Skipped ${cachedShacl.totalSkippedSparql} non-portable sh:sparql constraint(s) in raw EC v1.0.0 SHACL shapes (not executable by SHACL Core engines).`
                    );
                }

                const report = await cachedShacl.validator.validate(dataDataset);
                if (!report.conforms) {
                    for (const r of report.results) {
                        findings.push({
                            stage: 'SHACL',
                            path: r.path?.value || '/',
                            message: r.message?.map((m) => m.value).join('; ') || 'SHACL constraint violation'
                        });
                    }
                }
            } catch (err) {
                findings.push({
                    stage: 'SHACL',
                    code: 'JSONLD_SHACL_ERROR',
                    path: '/',
                    message: err.message
                });
            }
        }
    }

    return {
        valid: findings.length === 0,
        target,
        mode,
        activatedSpecifications,
        unrecognizedSpecifications: [],
        schemaExecuted: runSchema,
        shaclExecuted,
        findings,
        warnings
    };
}
