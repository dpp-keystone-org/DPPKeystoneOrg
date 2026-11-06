import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

import yaml from 'js-yaml';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import jsonld from 'jsonld';
import SHACLValidator from 'rdf-validate-shacl';
import Environment from '@rdfjs/environment';
import N3Parser from '@rdfjs/parser-n3';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import DataFactory from '@rdfjs/data-model/Factory.js';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const BUNDLE_ROOT = __dirname;
export const SEMANTICS_ROOT = path.join(BUNDLE_ROOT, 'semantics');
export const OPENAPI_ROOT = path.join(BUNDLE_ROOT, 'openapi');

const factory = new Environment([
    DataFactory,
    DatasetFactory,
    N3Parser,
    ClownfaceFactory,
    NamespaceFactory
]);

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const EC_DPP_CLASS = 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#DigitalProductPassport';
const EC_UNKNOWN_NS = 'https://repository.product-passport.ec.europa.eu/unknown#';
const BCP47_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

// Standalone local JSON-LD Document Loader mapping EC repository URLs to local bundle files
export const CONTEXT_MAP = {
    'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld':
        path.join(SEMANTICS_ROOT, 'core/1.0.0/contexts/core-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld':
        path.join(SEMANTICS_ROOT, 'product/batteries/1.0.0/contexts/batteries-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld':
        path.join(SEMANTICS_ROOT, 'product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld':
        path.join(SEMANTICS_ROOT, 'product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld':
        path.join(SEMANTICS_ROOT, 'product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld'),
    // Also support /releases/1.0.0 aliases
    'https://repository.product-passport.ec.europa.eu/core/releases/1.0.0/contexts/core-context.jsonld':
        path.join(SEMANTICS_ROOT, 'core/1.0.0/contexts/core-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/releases/1.0.0/contexts/batteries-context.jsonld':
        path.join(SEMANTICS_ROOT, 'product/batteries/1.0.0/contexts/batteries-context.jsonld')
};

export async function documentLoader(url) {
    const localPath = CONTEXT_MAP[url];
    if (!localPath) {
        throw new Error(`Unmapped remote JSON-LD context URL: ${url}`);
    }
    const content = await fs.readFile(localPath, 'utf-8');
    return {
        contextUrl: null,
        documentUrl: url,
        document: JSON.parse(content)
    };
}

async function walkFiles(dir, ext) {
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

export async function parseTurtleFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const blankNodePrefix = `${path.basename(filePath, '.ttl').replace(/[^a-zA-Z0-9_]/g, '_')}_`;
    const parser = new N3Parser({ factory, blankNodePrefix });
    const stream = parser.import(Readable.from([content]));
    const dataset = factory.dataset();
    return new Promise((resolve, reject) => {
        stream.on('data', (quad) => dataset.add(quad));
        stream.on('end', () => resolve(dataset));
        stream.on('error', (err) => reject(new Error(`${path.relative(BUNDLE_ROOT, filePath)}: ${err.message}`)));
    });
}

export function mergeDatasets(datasets) {
    const merged = factory.dataset();
    for (const ds of datasets) {
        for (const quad of ds) {
            merged.add(quad);
        }
    }
    return merged;
}

export async function expandJsonLdToDataset(doc) {
    const expanded = await jsonld.expand(structuredClone(doc), {
        documentLoader,
        processingMode: 'json-ld-1.1'
    });
    const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
    const parser = new N3Parser({ factory });
    const stream = parser.import(Readable.from([nquads]));
    const dataset = factory.dataset();
    await new Promise((resolve, reject) => {
        stream.on('data', (quad) => dataset.add(quad));
        stream.on('end', resolve);
        stream.on('error', reject);
    });
    return { expanded, dataset };
}

/**
 * Evaluates SHACL Core via `rdf-validate-shacl` PLUS the two SHACL-SPARQL rules
 * (`SEM-COM-MSG-013` unknown# predicates and `SEM-COM-MSG-012` BCP 47 language tags)
 * that SHACL-Core-only JS validators do not execute.
 */
export async function validateShaclEndToEnd(doc, shapeDatasets, { requireDppNode = true } = {}) {
    let dataDataset;
    try {
        ({ dataset: dataDataset } = await expandJsonLdToDataset(doc));
    } catch (err) {
        return { valid: false, errors: [`JSON-LD expansion error: ${err.message}`] };
    }

    const errors = [];

    // Guard against vacuous SHACL pass when no dpp:DigitalProductPassport target node exists
    let hasDppNode = false;
    for (const quad of dataDataset) {
        if (quad.predicate.value === RDF_TYPE && quad.object.value === EC_DPP_CLASS) {
            hasDppNode = true;
        }
        // SEM-COM-MSG-013: reject predicates under unknown#
        if (quad.predicate.value.startsWith(EC_UNKNOWN_NS)) {
            errors.push(`SEM-COM-MSG-013: Unknown predicate ${quad.predicate.value}`);
        }
        // SEM-COM-MSG-012: check BCP 47 language tag on rdf:langString literals
        if (quad.object.termType === 'Literal' && quad.object.datatype?.value === RDF_LANG_STRING) {
            if (!BCP47_REGEX.test(quad.object.language || '')) {
                errors.push(`SEM-COM-MSG-012: Invalid language tag "${quad.object.language}" on ${quad.predicate.value}`);
            }
        }
    }

    if (requireDppNode && !hasDppNode) {
        errors.push('Vacuous graph: no rdf:type dpp:DigitalProductPassport node produced after JSON-LD expansion');
    }

    const combinedShapes = mergeDatasets(shapeDatasets);
    // rdf-validate-shacl only supports SHACL Core and throws on sh:sparql;
    // the only two sh:sparql constraints (SEM-COM-MSG-013 & SEM-COM-MSG-012) are evaluated directly above.
    const shaclCoreShapes = factory.dataset();
    const SH_SPARQL = 'http://www.w3.org/ns/shacl#sparql';
    for (const q of combinedShapes) {
        if (q.predicate.value !== SH_SPARQL) {
            shaclCoreShapes.add(q);
        }
    }
    const validator = new SHACLValidator(shaclCoreShapes, { factory });
    const report = await validator.validate(dataDataset);
    if (!report.conforms) {
        for (const r of report.results) {
            const msgs = r.message?.map((m) => m.value).join('; ') || r.sourceConstraintComponent?.value || 'SHACL violation';
            errors.push(`${msgs} (path: ${r.path?.value || 'node'})`);
        }
    }

    return { valid: errors.length === 0, errors };
}

function validateAjvSchemas(ajv, schemaIds, doc) {
    const errors = [];
    for (const id of schemaIds) {
        const validate = ajv.getSchema(id);
        if (!validate) {
            throw new Error(`Schema $id not registered in Ajv: ${id}`);
        }
        const ok = validate(structuredClone(doc));
        if (!ok && validate.errors) {
            for (const e of validate.errors) {
                errors.push(`[${path.basename(id)}] ${e.instancePath || '/'} ${e.message}`);
            }
        }
    }
    return { valid: errors.length === 0, errors };
}

async function main() {
    let totalFailures = 0;
    const fail = (msg) => {
        console.error(`  ❌ ${msg}`);
        totalFailures++;
    };
    const pass = (msg) => {
        console.log(`  ✅ ${msg}`);
    };

    console.log('====================================================================');
    console.log(' 1. Syntax & Strict Draft 2020-12 Compilation Across All Bundle Files');
    console.log('====================================================================');

    const ttlFiles = await walkFiles(SEMANTICS_ROOT, '.ttl');
    const shapeCache = new Map();
    for (const f of ttlFiles) {
        try {
            const ds = await parseTurtleFile(f);
            if (f.includes(`${path.sep}shapes${path.sep}`)) {
                shapeCache.set(path.relative(SEMANTICS_ROOT, f).replace(/\\/g, '/'), ds);
            }
        } catch (err) {
            fail(`Turtle parse failed: ${err.message}`);
        }
    }
    if (totalFailures === 0) {
        pass(`Parsed all ${ttlFiles.length} Turtle (.ttl) files cleanly (${shapeCache.size} SHACL files + ${ttlFiles.length - shapeCache.size} SKOS vocabularies).`);
    }

    const contextFiles = await walkFiles(SEMANTICS_ROOT, '.jsonld');
    for (const f of contextFiles) {
        const rel = path.relative(SEMANTICS_ROOT, f);
        try {
            const parsed = JSON.parse(await fs.readFile(f, 'utf-8'));
            if ('@type' in parsed) {
                fail(`${rel}: invalid top-level "@type" outside "@context"`);
            }
            if (parsed['@context'] && typeof parsed['@context'] === 'object' && !Array.isArray(parsed['@context'])) {
                if ('@base' in parsed['@context']) {
                    fail(`${rel}: forbidden "@base" inside remote "@context"`);
                }
                if ('@import' in parsed['@context']) {
                    fail(`${rel}: chained "@import" still present inside "@context"`);
                }
                if (parsed['@context']['@protected'] === true) {
                    fail(`${rel}: "@protected": true still present inside "@context"`);
                }
            }
        } catch (err) {
            fail(`${rel}: JSON parse failed: ${err.message}`);
        }
    }
    if (totalFailures === 0) {
        pass(`Validated all ${contextFiles.length} JSON-LD context files (no @base, no @import, no @protected, no stray root @type).`);
    }

    const ajv = new Ajv2020({
        strict: true,
        allowUnionTypes: true,
        allErrors: true
    });
    addFormats(ajv);

    const schemaFiles = await walkFiles(SEMANTICS_ROOT, '.schema.json');
    const schemasByRel = new Map();
    for (const f of schemaFiles) {
        const rel = path.relative(SEMANTICS_ROOT, f).replace(/\\/g, '/');
        const raw = await fs.readFile(f, 'utf-8');
        const parsed = JSON.parse(raw);
        if (raw.includes('"message"')) {
            fail(`${rel}: non-standard "message" keyword still present`);
        }
        if (parsed.type !== 'object') {
            fail(`${rel}: missing root "type": "object"`);
        }
        schemasByRel.set(rel, parsed);
        ajv.addSchema(parsed);
    }

    for (const [rel, schema] of schemasByRel.entries()) {
        try {
            ajv.getSchema(schema.$id);
        } catch (err) {
            fail(`Strict Ajv compilation failed for ${rel} (${schema.$id}): ${err.message}`);
        }
    }
    if (totalFailures === 0) {
        pass(`Compiled all ${schemaFiles.length} JSON Schemas in Ajv strict Draft 2020-12 mode with zero warnings or errors.`);
    }

    console.log('\n====================================================================');
    console.log(' 1b. Mechanical Schema <> SHACL Pair Comparison (All 17 Targeted Pairs)');
    console.log('====================================================================');

    const SH_NS = 'http://www.w3.org/ns/shacl#';
    const SH_TARGET_CLASS = `${SH_NS}targetClass`;
    const SH_PROPERTY = `${SH_NS}property`;
    const SH_PATH = `${SH_NS}path`;
    const SH_MIN_COUNT = `${SH_NS}minCount`;
    const SH_MAX_COUNT = `${SH_NS}maxCount`;
    const SH_QUALIFIED_MIN = `${SH_NS}qualifiedMinCount`;
    const SH_OR = `${SH_NS}or`;
    const SH_NOT = `${SH_NS}not`;
    const SH_HAS_VALUE = `${SH_NS}hasValue`;
    const RDF_FIRST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#first';
    const RDF_REST = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#rest';
    const RDF_NIL = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil';
    const EC_CONTENT_SPEC_IDS_IRI = 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#contentSpecificationIds';

    const collectRdfList = (quads, head) => {
        const items = [];
        let cur = head;
        while (cur && cur.value !== RDF_NIL) {
            const firstQ = quads.find((q) => q.subject.equals(cur) && q.predicate.value === RDF_FIRST);
            const restQ = quads.find((q) => q.subject.equals(cur) && q.predicate.value === RDF_REST);
            if (firstQ) items.push(firstQ.object);
            cur = restQ ? restQ.object : null;
        }
        return items;
    };

    const mechanicalPairs = [
        ['core/1.0.0/schemas/core.schema.json', 'core/1.0.0/shapes/core-shapes.ttl'],
        ['product/batteries/1.0.0/schemas/pub-batteries.schema.json', 'product/batteries/1.0.0/shapes/pub-batteries-shapes.ttl'],
        ['product/batteries/1.0.0/schemas/res1-batteries.schema.json', 'product/batteries/1.0.0/shapes/res1-batteries-shapes.ttl'],
        ['product/batteries/1.0.0/schemas/res2-batteries.schema.json', 'product/batteries/1.0.0/shapes/res2-batteries-shapes.ttl'],
        ['product/batteries/1.0.0/schemas/res3-batteries.schema.json', 'product/batteries/1.0.0/shapes/res3-batteries-shapes.ttl']
    ];
    for (const sub of ['evb', 'ind', 'lmt']) {
        for (const tier of ['pub', 'res1', 'res2', 'res3']) {
            mechanicalPairs.push([
                `product/batteries/subgroup/${sub}/1.0.0/schemas/${tier}-${sub}.schema.json`,
                `product/batteries/subgroup/${sub}/1.0.0/shapes/${tier}-${sub}-shapes.ttl`
            ]);
        }
    }

    let mechMismatches = 0;
    for (const [schemaRel, shapeRel] of mechanicalPairs) {
        const schema = schemasByRel.get(schemaRel);
        const shapeDs = shapeCache.get(shapeRel);
        const isCore = schemaRel === 'core/1.0.0/schemas/core.schema.json';
        const jsonLdKeywords = new Set(['@context', 'id', 'type', '@id', '@type']);

        let constraintBlock = schema;
        let schemaTriggerId = null;

        if (!isCore) {
            if (schema.allOf) {
                mechMismatches++;
                fail(`${path.basename(schemaRel)}: still contains hardcoded "allOf" inheritance instead of decoupled conditional validation`);
            }
            if (!schema.if || !schema.then) {
                mechMismatches++;
                fail(`${path.basename(schemaRel)}: missing conditional "if"/"then" blocks`);
            }
            schemaTriggerId = schema.if?.properties?.contentSpecificationIds?.contains?.const;
            if (!schemaTriggerId) {
                mechMismatches++;
                fail(`${path.basename(schemaRel)}: missing contentSpecificationIds contains.const trigger in "if"`);
            }
            constraintBlock = schema.then || {};
            if (constraintBlock.properties?.contentSpecificationIds?.contains?.const === schemaTriggerId) {
                mechMismatches++;
                fail(`${path.basename(schemaRel)}: redundant self-ID check (${schemaTriggerId}) inside "then"`);
            }
        }

        const schemaProps = new Set(
            Object.keys(constraintBlock.properties || {}).filter((k) => !jsonLdKeywords.has(k))
        );
        const schemaReq = new Set(
            (constraintBlock.required || []).filter((k) => !jsonLdKeywords.has(k))
        );
        const schemaForbidden = new Set(
            Object.entries(constraintBlock.properties || {})
                .filter(([, v]) => v === false)
                .map(([k]) => k)
        );

        const quads = [...shapeDs];
        const targetShapeNodes = quads
            .filter((q) => q.predicate.value === SH_TARGET_CLASS && q.object.value === EC_DPP_CLASS)
            .map((q) => q.subject);

        const constraintShapes = new Set();
        if (isCore) {
            for (const ts of targetShapeNodes) constraintShapes.add(ts.value);
        } else {
            for (const ts of targetShapeNodes) {
                const directProps = quads.filter((q) => q.subject.equals(ts) && q.predicate.value === SH_PROPERTY);
                if (directProps.length > 0) {
                    mechMismatches++;
                    fail(`${path.basename(shapeRel)}: target shape ${ts.value} has unconditional sh:property constraints`);
                }
                const orQ = quads.find((q) => q.subject.equals(ts) && q.predicate.value === SH_OR);
                if (!orQ) {
                    mechMismatches++;
                    fail(`${path.basename(shapeRel)}: target shape ${ts.value} is missing conditional sh:or`);
                    continue;
                }
                const branches = collectRdfList(quads, orQ.object);
                let shaclTriggerId = null;
                for (const br of branches) {
                    const notQ = quads.find((q) => q.subject.equals(br) && q.predicate.value === SH_NOT);
                    if (notQ) {
                        const propQ = quads.find((q) => q.subject.equals(notQ.object) && q.predicate.value === SH_PROPERTY);
                        if (propQ) {
                            const pathQ = quads.find((q) => q.subject.equals(propQ.object) && q.predicate.value === SH_PATH);
                            const hvQ = quads.find((q) => q.subject.equals(propQ.object) && q.predicate.value === SH_HAS_VALUE);
                            if (pathQ?.object.value === EC_CONTENT_SPEC_IDS_IRI && hvQ) {
                                shaclTriggerId = hvQ.object.value;
                            }
                        }
                    } else if (br.termType === 'NamedNode') {
                        constraintShapes.add(br.value);
                    }
                }
                if (shaclTriggerId !== schemaTriggerId) {
                    mechMismatches++;
                    fail(
                        `Trigger ID mismatch in ${path.basename(schemaRel)} (${schemaTriggerId}) vs ${path.basename(shapeRel)} (${shaclTriggerId})`
                    );
                }
            }
        }

        const propNodes = quads
            .filter((q) => constraintShapes.has(q.subject.value) && q.predicate.value === SH_PROPERTY)
            .map((q) => q.object);

        const shaclProps = new Set();
        const shaclReq = new Set();
        const shaclForbidden = new Set();

        for (const pn of propNodes) {
            const pQuads = quads.filter((q) => q.subject.equals(pn));
            const pathQ = pQuads.find((q) => q.predicate.value === SH_PATH && q.object.termType === 'NamedNode');
            if (!pathQ) continue;
            const localName = pathQ.object.value.split('#').pop();
            shaclProps.add(localName);

            if (!isCore && pathQ.object.value === EC_CONTENT_SPEC_IDS_IRI) {
                const hvQ = pQuads.find((q) => q.predicate.value === SH_HAS_VALUE);
                if (hvQ?.object.value === schemaTriggerId) {
                    mechMismatches++;
                    fail(`${path.basename(shapeRel)}: redundant self-ID sh:hasValue (${schemaTriggerId}) inside constraints shape`);
                }
            }

            const minQ = pQuads.find((q) => q.predicate.value === SH_MIN_COUNT);
            const qMinQ = pQuads.find((q) => q.predicate.value === SH_QUALIFIED_MIN);
            if ((minQ && Number(minQ.object.value) >= 1) || (qMinQ && Number(qMinQ.object.value) >= 1)) {
                shaclReq.add(localName);
            }
            const maxQ = pQuads.find((q) => q.predicate.value === SH_MAX_COUNT);
            if (maxQ && Number(maxQ.object.value) === 0) {
                shaclForbidden.add(localName);
            }
        }

        const setDiff = (a, b) => [...a].filter((x) => !b.has(x));
        const onlyJsonProps = setDiff(schemaProps, shaclProps);
        const onlyShaclProps = setDiff(shaclProps, schemaProps);
        const onlyJsonReq = setDiff(schemaReq, shaclReq);
        const onlyShaclReq = setDiff(shaclReq, schemaReq);
        const onlyJsonForb = setDiff(schemaForbidden, shaclForbidden);
        const onlyShaclForb = setDiff(shaclForbidden, schemaForbidden);

        if (
            onlyJsonProps.length ||
            onlyShaclProps.length ||
            onlyJsonReq.length ||
            onlyShaclReq.length ||
            onlyJsonForb.length ||
            onlyShaclForb.length
        ) {
            mechMismatches++;
            fail(
                `Mechanical drift in ${path.basename(schemaRel)} <> ${path.basename(shapeRel)}: ` +
                JSON.stringify({ onlyJsonProps, onlyShaclProps, onlyJsonReq, onlyShaclReq, onlyJsonForb, onlyShaclForb })
            );
        }
    }
    if (mechMismatches === 0) {
        pass(`All ${mechanicalPairs.length} targeted JSON Schema <> SHACL pairs have 100% identical conditional triggers, property sets, required sets, and forbidden sets.`);
    }

    console.log('\n====================================================================');
    console.log(' 2. Conformance Test Suite (All 20 tests/conforms/*.json Layered End-to-End)');
    console.log('====================================================================');

    const getShapes = (...rels) => rels.map((r) => {
        const ds = shapeCache.get(r);
        if (!ds) throw new Error(`Missing cached shape: ${r}`);
        return ds;
    });
    const getSchemaId = (rel) => {
        const s = schemasByRel.get(rel);
        if (!s) throw new Error(`Missing cached schema: ${rel}`);
        return s.$id;
    };

    const CORE_SCHEMA = 'core/1.0.0/schemas/core.schema.json';
    const ALL_16_SECTOR_SCHEMAS = [
        'product/batteries/1.0.0/schemas/pub-batteries.schema.json',
        'product/batteries/1.0.0/schemas/res1-batteries.schema.json',
        'product/batteries/1.0.0/schemas/res2-batteries.schema.json',
        'product/batteries/1.0.0/schemas/res3-batteries.schema.json',
        ...['evb', 'ind', 'lmt'].flatMap((sub) =>
            ['pub', 'res1', 'res2', 'res3'].map(
                (tier) => `product/batteries/subgroup/${sub}/1.0.0/schemas/${tier}-${sub}.schema.json`
            )
        )
    ];
    const FULL_LAYERED_SCHEMAS = [CORE_SCHEMA, ...ALL_16_SECTOR_SCHEMAS];

    const COMMON_SHAPES = 'core/1.0.0/shapes/common-shapes.ttl';
    const CORE_SHAPES = 'core/1.0.0/shapes/core-shapes.ttl';
    const ALL_16_SECTOR_SHAPES = [
        'product/batteries/1.0.0/shapes/pub-batteries-shapes.ttl',
        'product/batteries/1.0.0/shapes/res1-batteries-shapes.ttl',
        'product/batteries/1.0.0/shapes/res2-batteries-shapes.ttl',
        'product/batteries/1.0.0/shapes/res3-batteries-shapes.ttl',
        ...['evb', 'ind', 'lmt'].flatMap((sub) =>
            ['pub', 'res1', 'res2', 'res3'].map(
                (tier) => `product/batteries/subgroup/${sub}/1.0.0/shapes/${tier}-${sub}-shapes.ttl`
            )
        )
    ];
    const FULL_LAYERED_SHAPES = [COMMON_SHAPES, CORE_SHAPES, ...ALL_16_SECTOR_SHAPES];
    const SLICE_LAYERED_SHAPES = [COMMON_SHAPES, ...ALL_16_SECTOR_SHAPES];

    // Full DPPs validate against all 17 schemas & all 18 SHACL shape files simultaneously;
    // standalone restricted slices (which omit Core header fields) validate against all 16 sector schemas & shapes.
    const conformanceMatrix = [
        {
            file: 'core/1.0.0/tests/conforms/core.json',
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            file: 'product/batteries/1.0.0/tests/conforms/pub-batteries.json',
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            file: 'product/batteries/1.0.0/tests/conforms/res1-batteries.json',
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            file: 'product/batteries/1.0.0/tests/conforms/res2-batteries.json',
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            file: 'product/batteries/1.0.0/tests/conforms/res3-batteries.json',
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        }
    ];

    for (const sub of ['evb', 'ind', 'lmt']) {
        conformanceMatrix.push(
            {
                file: `product/batteries/subgroup/${sub}/1.0.0/tests/conforms/pub-batteries-${sub}.json`,
                schemas: FULL_LAYERED_SCHEMAS,
                shapes: FULL_LAYERED_SHAPES
            },
            {
                file: `product/batteries/subgroup/${sub}/1.0.0/tests/conforms/res1-batteries-${sub}.json`,
                schemas: ALL_16_SECTOR_SCHEMAS,
                shapes: SLICE_LAYERED_SHAPES
            },
            {
                file: `product/batteries/subgroup/${sub}/1.0.0/tests/conforms/res2-batteries-${sub}.json`,
                schemas: ALL_16_SECTOR_SCHEMAS,
                shapes: SLICE_LAYERED_SHAPES
            },
            {
                file: `product/batteries/subgroup/${sub}/1.0.0/tests/conforms/res3-batteries-${sub}.json`,
                schemas: ALL_16_SECTOR_SCHEMAS,
                shapes: SLICE_LAYERED_SHAPES
            },
            {
                file: `product/batteries/subgroup/${sub}/1.0.0/tests/conforms/batteries-${sub}.json`,
                schemas: FULL_LAYERED_SCHEMAS,
                shapes: FULL_LAYERED_SHAPES
            }
        );
    }

    for (const entry of conformanceMatrix) {
        const fullPath = path.join(SEMANTICS_ROOT, entry.file);
        const doc = JSON.parse(await fs.readFile(fullPath, 'utf-8'));
        const ajvRes = validateAjvSchemas(ajv, entry.schemas.map(getSchemaId), doc);
        const shaclRes = await validateShaclEndToEnd(doc, getShapes(...entry.shapes));

        // Also check JSON-LD compaction round-trip preserves array containers!
        let roundTripOk = true;
        let roundTripErr = '';
        try {
            const expanded = await jsonld.expand(structuredClone(doc), { documentLoader, processingMode: 'json-ld-1.1' });
            const compacted = await jsonld.compact(expanded, doc['@context'], { documentLoader, processingMode: 'json-ld-1.1' });
            const rtAjv = validateAjvSchemas(ajv, entry.schemas.map(getSchemaId), compacted);
            if (!rtAjv.valid) {
                roundTripOk = false;
                roundTripErr = `Compaction round-trip failed Ajv: ${rtAjv.errors.join(' | ')}`;
            }
        } catch (err) {
            roundTripOk = false;
            roundTripErr = `Compaction round-trip threw: ${err.message}`;
        }

        if (ajvRes.valid && shaclRes.valid && roundTripOk) {
            pass(`${entry.file}: Ajv (${entry.schemas.length} layered) PASS | JSON-LD + SHACL (${entry.shapes.length} layered) PASS | Compact Round-Trip PASS`);
        } else {
            if (!ajvRes.valid) fail(`${entry.file} failed Ajv: ${ajvRes.errors.join(' | ')}`);
            if (!shaclRes.valid) fail(`${entry.file} failed SHACL: ${shaclRes.errors.join(' | ')}`);
            if (!roundTripOk) fail(`${entry.file} ${roundTripErr}`);
        }
    }

    console.log('\n====================================================================');
    console.log(' 3. SHACL <> JSON Schema Parity Test Bench (C1a-C25 Mutation Matrix)');
    console.log('====================================================================');

    const loadConforms = async (rel) => JSON.parse(await fs.readFile(path.join(SEMANTICS_ROOT, rel), 'utf-8'));
    const baseCore = await loadConforms('core/1.0.0/tests/conforms/core.json');
    const basePubBat = await loadConforms('product/batteries/1.0.0/tests/conforms/pub-batteries.json');
    const baseFullEvb = await loadConforms('product/batteries/subgroup/evb/1.0.0/tests/conforms/batteries-evb.json');
    const basePubInd = await loadConforms('product/batteries/subgroup/ind/1.0.0/tests/conforms/pub-batteries-ind.json');
    const baseRes3Ind = await loadConforms('product/batteries/subgroup/ind/1.0.0/tests/conforms/res3-batteries-ind.json');
    const baseRes3Evb = await loadConforms('product/batteries/subgroup/evb/1.0.0/tests/conforms/res3-batteries-evb.json');

    const mutate = (base, fn) => {
        const clone = structuredClone(base);
        const res = fn(clone);
        return res !== undefined ? res : clone;
    };

    const parityCases = [
        {
            id: 'C1a',
            desc: 'contentSpecificationIds: [] with @context present (optional when @context supplied)',
            expected: true,
            doc: mutate(baseCore, (d) => { d.contentSpecificationIds = []; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C1b',
            desc: 'Missing both @context and contentSpecificationIds (neither context nor spec ID)',
            expected: false,
            doc: mutate(baseCore, (d) => {
                delete d['@context'];
                d.contentSpecificationIds = [];
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C1c',
            desc: 'Federated non-EC contentSpecificationIds on core + additionalProductIdentifiers: []',
            expected: true,
            doc: mutate(baseCore, (d) => {
                d.contentSpecificationIds = ['urn:dpp-keystone:v3:sector:textile'];
                d.additionalProductIdentifiers = [];
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C1d',
            desc: 'Conditional inactivation: non-battery spec ID keeps all 16 battery schemas/shapes inactive',
            expected: true,
            doc: mutate(basePubBat, (d) => {
                d.contentSpecificationIds = ['urn:dpp-keystone:v3:sector:textile'];
                d.batteryWeight = 'not-a-number';
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C1e',
            desc: 'Conditional activation: claiming batteries/1.0.0/pub on Core-only DPP enforces battery rules',
            expected: false,
            doc: mutate(baseCore, (d) => {
                d.contentSpecificationIds = [
                    'https://repository.product-passport.ec.europa.eu/core/1.0.0',
                    'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/pub'
                ];
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C1f',
            desc: 'Subgroup parent requirement: claiming subgroup/ind/1.0.0/pub without parent batteries/1.0.0/pub fails',
            expected: false,
            doc: mutate(basePubInd, (d) => {
                d.contentSpecificationIds = [
                    'https://repository.product-passport.ec.europa.eu/core/1.0.0',
                    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0/pub'
                ];
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C2',
            desc: 'granularity = "bogus" (invalid controlled vocab code)',
            expected: false,
            doc: mutate(baseCore, (d) => { d.granularity = 'bogus'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C3',
            desc: 'lastUpdate = "2026-11-03T10:00:00" (missing timezone offset)',
            expected: false,
            doc: mutate(baseCore, (d) => { d.lastUpdate = '2026-11-03T10:00:00'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C4',
            desc: 'batteryWeight = "450" (string instead of scalar number)',
            expected: false,
            doc: mutate(basePubBat, (d) => { d.batteryWeight = '450'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C5',
            desc: 'Federated extra key (mapped to external IRI) inside manufacturerIdentification',
            expected: true,
            doc: mutate(basePubBat, (d) => {
                d['@context'] = [
                    { taxID: 'https://dpp-keystone.org/spec/v3/terms#taxID' },
                    ...d['@context']
                ];
                d.manufacturerIdentification.taxID = 'DE123456789';
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C6',
            desc: 'commercialWarrantyPeriod = -1 (negative integer)',
            expected: false,
            doc: mutate(basePubBat, (d) => { d.commercialWarrantyPeriod = -1; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C7',
            desc: 'nominalVoltageMinTemp provided without nominalVoltageMaxTemp (unpaired temp bound)',
            expected: false,
            doc: mutate(basePubBat, (d) => {
                d.nominalVoltageMinTemp = -20;
                delete d.nominalVoltageMaxTemp;
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C8',
            desc: 'batteryCategory = "bogusCategory" (invalid controlled vocab code)',
            expected: false,
            doc: mutate(basePubBat, (d) => { d.batteryCategory = 'bogusCategory'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C9a',
            desc: 'granularity = "model" on public battery passport (allowed)',
            expected: true,
            doc: mutate(basePubBat, (d) => { d.granularity = 'model'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C9b',
            desc: 'granularity = "model" on full EVB passport with res3 (must be item)',
            expected: false,
            doc: mutate(baseFullEvb, (d) => { d.granularity = 'model'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C10',
            desc: 'extinguishingAgent = "CO2" (plain string instead of multiLanguage object)',
            expected: false,
            doc: mutate(basePubBat, (d) => { d.extinguishingAgent = 'CO2'; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C11',
            desc: '2+ languages ("en" and "de-DE") on wasteBatteryPreventionManagementInfo & detailedComposition',
            expected: true,
            doc: mutate(baseFullEvb, (d) => {
                d.wasteBatteryPreventionManagementInfo.endUserRoleInWastePrevention = {
                    en: 'Use certified chargers.',
                    'de-DE': 'Zertifizierte Ladegeräte verwenden.'
                };
                d.detailedComposition = {
                    en: 'NMC811 cathode, graphite anode, LiPF6 electrolyte',
                    'fr-FR': 'Cathode NMC811, anode graphite, électrolyte LiPF6'
                };
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C12',
            desc: 'Non-object primitive ("hello") on layered sector schemas',
            expected: false,
            doc: 'hello',
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C13',
            desc: 'Clean battery with empty hazardousSubstances: [] and criticalRawMaterials: []',
            expected: true,
            doc: mutate(basePubBat, (d) => {
                d.hazardousSubstances = [];
                d.criticalRawMaterials = [];
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C14',
            desc: 'Empty batteryChemistry: [] (must have >= 1 chemistry)',
            expected: false,
            doc: mutate(basePubBat, (d) => { d.batteryChemistry = []; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C15',
            desc: 'Forbidden capacityExhaustionThreshold on pub-ind',
            expected: false,
            doc: mutate(basePubInd, (d) => { d.capacityExhaustionThreshold = 80; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C16',
            desc: 'Forbidden stateOfCertifiedEnergy on res3-ind',
            expected: false,
            doc: mutate(baseRes3Ind, (d) => { d.stateOfCertifiedEnergy = 95; }),
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C17',
            desc: 'Forbidden remainingCapacity on res3-evb',
            expected: false,
            doc: mutate(baseRes3Evb, (d) => { d.remainingCapacity = 100; }),
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C18',
            desc: 'expectedLifetimeCyclesRest = 0 (depleted battery) on res3-evb',
            expected: true,
            doc: mutate(baseRes3Evb, (d) => { d.expectedLifetimeCyclesRest = 0; }),
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C19',
            desc: 'expectedLifetimeCyclesRest = -1 on res3-evb',
            expected: false,
            doc: mutate(baseRes3Evb, (d) => { d.expectedLifetimeCyclesRest = -1; }),
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C20',
            desc: 'manufacturerEmail = "mailto:info@example.com" (URI instead of email)',
            expected: false,
            doc: mutate(basePubBat, (d) => {
                d.manufacturerContactDetails = { manufacturerEmail: 'mailto:info@example.com' };
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C21',
            desc: 'manufacturerEmail = "info@example.com" (plain RFC email)',
            expected: true,
            doc: mutate(basePubBat, (d) => {
                d.manufacturerContactDetails = { manufacturerEmail: 'info@example.com' };
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C22a',
            desc: 'numberOfChargingCycles = 42 (scalar integer)',
            expected: true,
            doc: mutate(baseRes3Evb, (d) => { d.numberOfChargingCycles = 42; }),
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C22b',
            desc: 'numberOfChargingCycles = [42, 43] (multi-item array instead of scalar integer)',
            expected: false,
            doc: mutate(baseRes3Evb, (d) => { d.numberOfChargingCycles = [42, 43]; }),
            schemas: ALL_16_SECTOR_SCHEMAS,
            shapes: SLICE_LAYERED_SHAPES
        },
        {
            id: 'C23',
            desc: 'Multiple RelatedResource items on euDeclarationOfConformity',
            expected: true,
            doc: mutate(basePubBat, (d) => {
                d.euDeclarationOfConformity = [
                    { contentType: 'application/pdf', url: 'https://example.com/doc-en.pdf', language: 'en' },
                    { contentType: 'application/pdf', url: 'https://example.com/doc-de.pdf', language: 'de-DE' }
                ];
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C24',
            desc: 'Federated contentSpecificationIds (EC batteries/1.0.0/pub URI + Keystone URN) + EN 18223 Core fields',
            expected: true,
            doc: mutate(basePubBat, (d) => {
                d.contentSpecificationIds = [
                    'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/pub',
                    'urn:dpp-keystone:v3:sector:battery-ev'
                ];
                d.additionalProductIdentifiers = ['https://id.gs1.org/01/09506000134369'];
                d.dppSchemaVersion = '1.0.0';
                d.economicOperatorId = 'urn:eori:DE123456789';
                d.productName = { en: 'Keystone Traction Pack 75 kWh' };
            }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        },
        {
            id: 'C25',
            desc: 'Invalid BCP 47 language tag "1234-bad" in multiLanguage map',
            expected: false,
            doc: mutate(basePubBat, (d) => { d.extinguishingAgent = { '1234-bad': 'Water mist' }; }),
            schemas: FULL_LAYERED_SCHEMAS,
            shapes: FULL_LAYERED_SHAPES
        }
    ];

    console.log('\n| Case | Description | Expected | JSON Schema (Ajv) | JSON-LD + SHACL | Agreement |');
    console.log('| :--- | :--- | :---: | :---: | :---: | :---: |');

    for (const tc of parityCases) {
        const ajvRes = validateAjvSchemas(ajv, tc.schemas.map(getSchemaId), tc.doc);
        const shaclRes = typeof tc.doc === 'object' && tc.doc !== null
            ? await validateShaclEndToEnd(tc.doc, getShapes(...tc.shapes))
            : { valid: false, errors: ['Non-object JSON root cannot expand to DigitalProductPassport'] };

        const expLabel = tc.expected ? 'PASS' : 'FAIL';
        const ajvLabel = ajvRes.valid ? 'PASS' : 'FAIL';
        const shaclLabel = shaclRes.valid ? 'PASS' : 'FAIL';
        const match = ajvRes.valid === tc.expected && shaclRes.valid === tc.expected;

        console.log(`| ${tc.id} | ${tc.desc} | ${expLabel} | ${ajvLabel} | ${shaclLabel} | ${match ? '✅ MATCH' : '❌ MISMATCH'} |`);
        if (!match) {
            fail(`${tc.id} (${tc.desc}): expected ${expLabel}, got Ajv=${ajvLabel} (${ajvRes.errors.join('; ')}) / SHACL=${shaclLabel} (${shaclRes.errors.join('; ')})`);
        }
    }

    console.log('\n====================================================================');
    console.log(' 4. OpenAPI 3.1 Contracts Check (ec-bundle/openapi/*.yml)');
    console.log('====================================================================');

    const commonYml = await fs.readFile(path.join(OPENAPI_ROOT, 'openapi-dpp-common-public.yml'), 'utf-8');
    const registryYml = await fs.readFile(path.join(OPENAPI_ROOT, 'openapi-dpp-registry-public.yml'), 'utf-8');
    const dashboardYml = await fs.readFile(path.join(OPENAPI_ROOT, 'openapi-dpp-dashboard-public.yml'), 'utf-8');

    if (registryYml.includes('BatteriesSubmission')) {
        fail('openapi-dpp-registry-public.yml still contains sector-specific BatteriesSubmission* schemas');
    } else {
        pass('openapi-dpp-registry-public.yml is generic (zero BatteriesSubmission* hardcoding).');
    }
    if (!registryYml.includes('digitalProductPassportId')) {
        fail('openapi-dpp-registry-public.yml SubmissionItem is missing optional digitalProductPassportId');
    } else {
        pass('openapi-dpp-registry-public.yml separates uniqueProductIdentifier and optional digitalProductPassportId.');
    }
    const constMatches = dashboardYml.match(/const:\s*(DPP_REGISTRATION|ORGANISATION_VERIFICATION_DECLARATION_GENERATION|ORGANISATION_VERIFICATION_SUBMISSION)/g) || [];
    if (constMatches.length < 6) {
        fail(`openapi-dpp-dashboard-public.yml has only ${constMatches.length}/6 taskType const discriminators on oneOf branches`);
    } else {
        pass(`openapi-dpp-dashboard-public.yml constrains taskType const across all ${constMatches.length} oneOf variants.`);
    }
    if (dashboardYml.includes('granularityLevel')) {
        fail('openapi-dpp-dashboard-public.yml still uses mismatched "granularityLevel" instead of "granularity"');
    } else {
        pass('openapi-dpp-dashboard-public.yml uses "granularity" consistently.');
    }
    const pageMetaBlock = commonYml.split('PageMetadata:')[1]?.split('AcceptedAsyncOperation:')[0] || '';
    const sizeOnlyBlock = pageMetaBlock.split('size:')[1]?.split('totalElements:')[0] || '';
    if (!/minimum:\s*1\b/.test(sizeOnlyBlock) || !/maximum:\s*100\b/.test(sizeOnlyBlock)) {
        fail('openapi-dpp-common-public.yml PageMetadata.size does not specify minimum: 1 and maximum: 100');
    } else {
        pass('openapi-dpp-common-public.yml PageMetadata.size specifies minimum: 1, maximum: 100.');
    }

    const oasResult = await validateOpenApi31Suite(
        [
            {
                label: 'openapi-dpp-common-public.yml',
                filePath: path.join(OPENAPI_ROOT, 'openapi-dpp-common-public.yml'),
                docUri: 'https://openapi.local/ec-bundle/openapi-dpp-common-public.yml'
            },
            {
                label: 'openapi-dpp-registry-public.yml',
                filePath: path.join(OPENAPI_ROOT, 'openapi-dpp-registry-public.yml'),
                docUri: 'https://openapi.local/ec-bundle/openapi-dpp-registry-public.yml'
            },
            {
                label: 'openapi-dpp-dashboard-public.yml',
                filePath: path.join(OPENAPI_ROOT, 'openapi-dpp-dashboard-public.yml'),
                docUri: 'https://openapi.local/ec-bundle/openapi-dpp-dashboard-public.yml'
            }
        ],
        [...schemasByRel.values()]
    );
    if (oasResult.errors.length > 0) {
        for (const err of oasResult.errors) {
            fail(`OpenAPI 3.1 validation error: ${err}`);
        }
    } else {
        pass(
            `Parsed all 3 OpenAPI 3.1 YAML contracts, resolved ${oasResult.resolvedRefs} $refs, compiled ${oasResult.compiledSchemas} schemas in Ajv 2020-12, and validated ${oasResult.validatedExamples} inline examples.`
        );
    }

    console.log('\n====================================================================');
    if (totalFailures === 0) {
        console.log(' 🎉 ALL EC BUNDLE CHECKS & SHACL <> JSON SCHEMA PARITY TESTS PASSED!');
        console.log('====================================================================');
    } else {
        console.error(` ❌ COMPLETED WITH ${totalFailures} FAILURE(S).`);
        console.log('====================================================================');
        process.exit(1);
    }
}

function qualifySchemaRefs(node, docUri) {
    if (!node || typeof node !== 'object') return node;
    if (Array.isArray(node)) return node.map((item) => qualifySchemaRefs(item, docUri));
    const out = {};
    for (const [k, v] of Object.entries(node)) {
        if (k === '$ref' && typeof v === 'string' && !/^https?:\/\//.test(v)) {
            out[k] = new URL(v, docUri).href;
        } else {
            out[k] = qualifySchemaRefs(v, docUri);
        }
    }
    return out;
}

function resolveJsonPointer(rootObj, pointer) {
    const clean = pointer.startsWith('#') ? pointer.slice(1) : pointer;
    if (!clean || clean === '/') return rootObj;
    const parts = clean
        .split('/')
        .slice(1)
        .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'));
    let cur = rootObj;
    for (const part of parts) {
        if (cur === null || cur === undefined || typeof cur !== 'object' || !(part in cur)) {
            return undefined;
        }
        cur = cur[part];
    }
    return cur;
}

/**
 * Parses OpenAPI 3.1 YAML files, verifies structural rules and cross-file/external $refs,
 * compiles every component and inline schema in Ajv Draft 2020-12, and validates all inline
 * OpenAPI and JSON Schema examples against their compiled schemas.
 */
export async function validateOpenApi31Suite(specEntries, externalSchemas = []) {
    const errors = [];
    let resolvedRefs = 0;
    let compiledSchemas = 0;
    let validatedExamples = 0;

    const docsByUri = new Map();
    const parsedEntries = [];

    for (const entry of specEntries) {
        let doc;
        try {
            const raw = await fs.readFile(entry.filePath, 'utf-8');
            doc = yaml.load(raw);
        } catch (err) {
            errors.push(`${entry.label}: YAML parse failed: ${err.message}`);
            continue;
        }
        if (!doc || typeof doc !== 'object') {
            errors.push(`${entry.label}: Root YAML document must be an object`);
            continue;
        }
        if (!/^3\.1\.\d+$/.test(String(doc.openapi || ''))) {
            errors.push(`${entry.label}: Expected openapi 3.1.x, got "${doc.openapi}"`);
        }
        if (typeof doc.info?.title !== 'string' || !doc.info.title.trim()) {
            errors.push(`${entry.label}: Missing info.title`);
        }
        if (typeof doc.info?.version !== 'string' || !doc.info.version.trim()) {
            errors.push(`${entry.label}: Missing info.version`);
        }
        if (!doc.paths && !doc.components) {
            errors.push(`${entry.label}: Must define at least paths or components`);
        }
        docsByUri.set(entry.docUri, doc);
        parsedEntries.push({ ...entry, doc });
    }

    const oasAjv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
    addFormats(oasAjv);
    oasAjv.addKeyword('components');
    oasAjv.addKeyword('discriminator');

    for (const extSchema of externalSchemas) {
        if (extSchema?.$id && !oasAjv.getSchema(extSchema.$id)) {
            oasAjv.addSchema(extSchema);
        }
    }

    for (const { label, docUri, doc } of parsedEntries) {
        try {
            oasAjv.addSchema({
                $id: docUri,
                components: {
                    schemas: qualifySchemaRefs(doc.components?.schemas || {}, docUri)
                }
            });
        } catch (err) {
            errors.push(`${label}: Failed to register components.schemas in Ajv: ${err.message}`);
        }
    }

    const resolveOasNode = (node, docUri, contextLabel) => {
        let cur = node;
        let curUri = docUri;
        let depth = 0;
        while (cur && typeof cur === 'object' && typeof cur.$ref === 'string') {
            if (++depth > 16) {
                errors.push(`${contextLabel}: Circular $ref "${cur.$ref}"`);
                return { node: null, docUri: curUri };
            }
            const fullHref = new URL(cur.$ref, curUri).href;
            const [baseUri, hash = ''] = fullHref.split('#');
            if (!docsByUri.has(baseUri)) {
                errors.push(`${contextLabel}: Unresolvable OpenAPI $ref "${cur.$ref}"`);
                return { node: null, docUri: curUri };
            }
            cur = resolveJsonPointer(docsByUri.get(baseUri), hash ? `#${hash}` : '');
            curUri = baseUri;
            if (cur === undefined) {
                errors.push(`${contextLabel}: Broken JSON pointer in $ref "${fullHref}"`);
                return { node: null, docUri: curUri };
            }
        }
        return { node: cur, docUri: curUri };
    };

    const verifyRefsRecursive = (node, docUri, label, trail = '') => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) {
            node.forEach((item, idx) => verifyRefsRecursive(item, docUri, label, `${trail}[${idx}]`));
            return;
        }
        if (typeof node.$ref === 'string') {
            resolvedRefs++;
            const fullHref = new URL(node.$ref, docUri).href;
            const [baseUri, hash = ''] = fullHref.split('#');
            if (docsByUri.has(baseUri)) {
                if (resolveJsonPointer(docsByUri.get(baseUri), hash ? `#${hash}` : '') === undefined) {
                    errors.push(`${label}${trail}: Broken $ref "${node.$ref}"`);
                }
            } else if (!oasAjv.getSchema(fullHref)) {
                errors.push(`${label}${trail}: Unresolved external schema $ref "${node.$ref}"`);
            }
        }
        if (node.discriminator && typeof node.discriminator === 'object' && !Array.isArray(node.discriminator)) {
            if (typeof node.discriminator.propertyName !== 'string' || !node.discriminator.propertyName) {
                errors.push(`${label}${trail}.discriminator: Missing propertyName`);
            }
            for (const [discVal, targetRef] of Object.entries(node.discriminator.mapping || {})) {
                resolvedRefs++;
                const fullHref = new URL(targetRef, docUri).href;
                const [baseUri, hash = ''] = fullHref.split('#');
                if (docsByUri.has(baseUri)) {
                    if (resolveJsonPointer(docsByUri.get(baseUri), hash ? `#${hash}` : '') === undefined) {
                        errors.push(`${label}${trail}.discriminator.mapping.${discVal}: Broken target "${targetRef}"`);
                    }
                } else if (!oasAjv.getSchema(fullHref)) {
                    errors.push(`${label}${trail}.discriminator.mapping.${discVal}: Unresolved target "${targetRef}"`);
                }
            }
        }
        for (const [k, v] of Object.entries(node)) {
            if (k !== '$ref') verifyRefsRecursive(v, docUri, label, `${trail}.${k}`);
        }
    };

    const checkExampleValue = (validateFn, val, exLabel) => {
        validatedExamples++;
        const ok = validateFn(structuredClone(val));
        if (!ok) {
            const msg = (validateFn.errors || []).map((e) => `${e.instancePath || '/'} ${e.message}`).join('; ');
            errors.push(`${exLabel}: Example failed schema validation: ${msg}`);
        }
    };

    const compileAndCheckLeaf = (leafObj, leafDocUri, leafLabel) => {
        if (!leafObj?.schema) return;
        const qualified = qualifySchemaRefs(leafObj.schema, leafDocUri);
        const { $id: _ignoredId, ...anonSchema } = qualified;
        let validateFn;
        try {
            validateFn = oasAjv.compile(anonSchema);
            compiledSchemas++;
        } catch (err) {
            errors.push(`${leafLabel}: Schema compilation failed: ${err.message}`);
            return;
        }
        if (Array.isArray(leafObj.schema.examples)) {
            leafObj.schema.examples.forEach((ex, i) => checkExampleValue(validateFn, ex, `${leafLabel}.schema.examples[${i}]`));
        }
        if (leafObj.example !== undefined) {
            checkExampleValue(validateFn, leafObj.example, `${leafLabel}.example`);
        }
        if (leafObj.examples && typeof leafObj.examples === 'object' && !Array.isArray(leafObj.examples)) {
            for (const [exName, rawEx] of Object.entries(leafObj.examples)) {
                const { node: exObj } = resolveOasNode(rawEx, leafDocUri, `${leafLabel}.examples.${exName}`);
                if (exObj && Object.prototype.hasOwnProperty.call(exObj, 'value')) {
                    checkExampleValue(validateFn, exObj.value, `${leafLabel}.examples.${exName}`);
                }
            }
        }
    };

    const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];

    for (const { label, docUri, doc } of parsedEntries) {
        verifyRefsRecursive(doc, docUri, label);

        // 1. Compile every components.schemas.* and validate schema-level & property-level examples
        for (const [schemaName, schemaObj] of Object.entries(doc.components?.schemas || {})) {
            const schemaLabel = `${label}#/components/schemas/${schemaName}`;
            let validateFn;
            try {
                validateFn = oasAjv.getSchema(`${docUri}#/components/schemas/${schemaName}`);
                if (!validateFn) throw new Error('Schema not found after registration');
                compiledSchemas++;
            } catch (err) {
                errors.push(`${schemaLabel}: Compilation failed: ${err.message}`);
                continue;
            }
            if (Array.isArray(schemaObj?.examples)) {
                schemaObj.examples.forEach((ex, i) => checkExampleValue(validateFn, ex, `${schemaLabel}.examples[${i}]`));
            }
            for (const [propName, propSchema] of Object.entries(schemaObj?.properties || {})) {
                if (Array.isArray(propSchema?.examples)) {
                    compileAndCheckLeaf({ schema: propSchema }, docUri, `${schemaLabel}.properties.${propName}`);
                }
            }
        }

        // 2. Compile components.parameters, components.headers, components.responses
        for (const [pName, pObj] of Object.entries(doc.components?.parameters || {})) {
            const { node, docUri: u } = resolveOasNode(pObj, docUri, `${label}#/components/parameters/${pName}`);
            if (node) compileAndCheckLeaf(node, u, `${label}#/components/parameters/${pName}`);
        }
        for (const [hName, hObj] of Object.entries(doc.components?.headers || {})) {
            const { node, docUri: u } = resolveOasNode(hObj, docUri, `${label}#/components/headers/${hName}`);
            if (node) compileAndCheckLeaf(node, u, `${label}#/components/headers/${hName}`);
        }
        for (const [rName, rObj] of Object.entries(doc.components?.responses || {})) {
            const { node, docUri: u } = resolveOasNode(rObj, docUri, `${label}#/components/responses/${rName}`);
            for (const [mt, mtObj] of Object.entries(node?.content || {})) {
                compileAndCheckLeaf(mtObj, u, `${label}#/components/responses/${rName}.content[${mt}]`);
            }
        }

        // 3. Validate paths, operations, parameters, requestBodies, and responses
        const seenOperationIds = new Set();
        for (const [routePath, pathItem] of Object.entries(doc.paths || {})) {
            const templateParams = [...routePath.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
            const pathLevelParams = (pathItem?.parameters || [])
                .map((p, i) => resolveOasNode(p, docUri, `${label}.paths[${routePath}].parameters[${i}]`).node)
                .filter(Boolean);

            for (const method of HTTP_METHODS) {
                const op = pathItem?.[method];
                if (!op) continue;
                const opLabel = `${label} ${method.toUpperCase()} ${routePath}`;

                if (op.operationId) {
                    if (seenOperationIds.has(op.operationId)) {
                        errors.push(`${opLabel}: Duplicate operationId "${op.operationId}"`);
                    }
                    seenOperationIds.add(op.operationId);
                }

                const opParams = [];
                for (const [i, rawParam] of (op.parameters || []).entries()) {
                    const { node: pNode, docUri: pUri } = resolveOasNode(rawParam, docUri, `${opLabel}.parameters[${i}]`);
                    if (pNode) {
                        opParams.push(pNode);
                        compileAndCheckLeaf(pNode, pUri, `${opLabel}.parameters[${pNode.name || i}]`);
                    }
                }

                const combinedParams = [...pathLevelParams, ...opParams];
                for (const tplParam of templateParams) {
                    const found = combinedParams.find((p) => p.in === 'path' && p.name === tplParam && p.required === true);
                    if (!found) {
                        errors.push(`${opLabel}: Missing required path parameter definition for "{${tplParam}}"`);
                    }
                }

                if (op.requestBody) {
                    const { node: rbNode, docUri: rbUri } = resolveOasNode(op.requestBody, docUri, `${opLabel}.requestBody`);
                    for (const [mt, mtObj] of Object.entries(rbNode?.content || {})) {
                        compileAndCheckLeaf(mtObj, rbUri, `${opLabel}.requestBody.content[${mt}]`);
                    }
                }

                for (const [statusCode, rawResp] of Object.entries(op.responses || {})) {
                    const { node: respNode, docUri: respUri } = resolveOasNode(rawResp, docUri, `${opLabel}.responses[${statusCode}]`);
                    for (const [mt, mtObj] of Object.entries(respNode?.content || {})) {
                        compileAndCheckLeaf(mtObj, respUri, `${opLabel}.responses[${statusCode}].content[${mt}]`);
                    }
                    for (const [hName, rawHeader] of Object.entries(respNode?.headers || {})) {
                        const { node: hNode, docUri: hUri } = resolveOasNode(rawHeader, respUri, `${opLabel}.responses[${statusCode}].headers[${hName}]`);
                        if (hNode) compileAndCheckLeaf(hNode, hUri, `${opLabel}.responses[${statusCode}].headers[${hName}]`);
                    }
                }
            }
        }
    }

    return { errors, resolvedRefs, compiledSchemas, validatedExamples };
}

if (path.resolve(process.argv[1] || '') === path.resolve(__filename)) {
    main().catch((err) => {
        console.error('Fatal error in verify-semantic-integrity.mjs:', err);
        process.exit(1);
    });
}
