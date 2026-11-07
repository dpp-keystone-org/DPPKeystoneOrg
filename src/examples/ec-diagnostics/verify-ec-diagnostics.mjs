/**
 * @file verify-ec-diagnostics.mjs
 * @description Programmatically verifies the two diagnostic Public Battery DPP payloads against
 * the RAW, UNREPAIRED European Commission (EC) v1.0.0 semantic bundle under
 * `docs/sensitive/ec-bundle/ec-semantics`:
 *
 *   1. `pub-battery-valid-shacl-fails-schema.json`
 *      -> PASSES raw EC JSON-LD + SHACL (Core + all SPARQL SKOS/lang/unknown constraints)
 *      -> FAILS  raw EC JSON Schema (`core.schema.json` + `pub-batteries.schema.json`)
 *
 *   2. `pub-battery-valid-schema-fails-shacl.json`
 *      -> PASSES raw EC JSON Schema (`core.schema.json` + `pub-batteries.schema.json`)
 *      -> FAILS  raw EC JSON-LD + SHACL (`pub-batteries-shapes.ttl` `sh:maxCount 1` on `rdf:langString`)
 *
 * Usage:
 *   node src/examples/ec-diagnostics/verify-ec-diagnostics.mjs
 */

import { promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

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

const DEFAULT_RAW_EC_SEMANTICS = path.resolve(
    __dirname,
    '../../../docs/sensitive/ec-bundle/ec-semantics'
);
const RAW_EC_SEMANTICS = process.env.EC_SEMANTICS_DIR
    ? path.resolve(process.env.EC_SEMANTICS_DIR)
    : DEFAULT_RAW_EC_SEMANTICS;

const PAYLOAD_SHACL_ONLY = path.join(__dirname, 'pub-battery-valid-shacl-fails-schema.json');
const PAYLOAD_SCHEMA_ONLY = path.join(__dirname, 'pub-battery-valid-schema-fails-shacl.json');
const CONTROL_RAW_CONFORMS = path.join(
    RAW_EC_SEMANTICS,
    'product/batteries/1.0.0/tests/conforms/pub-batteries.json'
);

const factory = new Environment([
    DataFactory,
    DatasetFactory,
    N3Parser,
    ClownfaceFactory,
    NamespaceFactory
]);

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const SKOS_CONCEPT = 'http://www.w3.org/2004/02/skos/core#Concept';
const SKOS_IN_SCHEME = 'http://www.w3.org/2004/02/skos/core#inScheme';
const SH_SPARQL = 'http://www.w3.org/ns/shacl#sparql';

const EC_DPP_CLASS =
    'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#DigitalProductPassport';
const EC_UNKNOWN_NS = 'https://repository.product-passport.ec.europa.eu/unknown#';
const RAW_LANG_TAG_REGEX = /^[A-Za-z]{2}-[A-Za-z]{2}$/;

// All 6 SKOS ConceptScheme SPARQL checks in raw `core-shapes.ttl` & `pub-batteries-shapes.ttl`
const RAW_SKOS_SCHEME_CHECKS = [
    {
        predicate: 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#granularity',
        scheme: 'https://repository.product-passport.ec.europa.eu/core/vocabs/granularity-level',
        code: 'SEM-MSG-003'
    },
    {
        predicate: 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#dppStatus',
        scheme: 'https://repository.product-passport.ec.europa.eu/core/vocabs/instance-status',
        code: 'SEM-MSG-005'
    },
    {
        predicate: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-vocabulary#batteryCategory',
        scheme: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-category',
        code: 'SEM-BAT-MSG-009'
    },
    {
        predicate: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-vocabulary#batteryChemistry',
        scheme: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-chemistry',
        code: 'SEM-BAT-MSG-023'
    },
    {
        predicate: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-vocabulary#criticalRawMaterials',
        scheme: 'https://repository.product-passport.ec.europa.eu/core/vocabs/critical-raw-material',
        code: 'SEM-BAT-MSG-026'
    },
    {
        predicate: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-vocabulary#chemicalSymbol',
        scheme: 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-chemical-symbol',
        code: 'SEM-BAT-MSG-044'
    }
];

async function parseTurtleFile(filePath) {
    const content = await fs.readFile(filePath, 'utf-8');
    const blankNodePrefix = `${path.basename(filePath, '.ttl').replace(/[^a-zA-Z0-9_]/g, '_')}_`;
    const parser = new N3Parser({ factory, blankNodePrefix });
    const stream = parser.import(Readable.from([content]));
    const dataset = factory.dataset();
    return new Promise((resolve, reject) => {
        stream.on('data', (quad) => dataset.add(quad));
        stream.on('end', () => resolve(dataset));
        stream.on('error', (err) => reject(new Error(`${filePath}: ${err.message}`)));
    });
}

function mergeDatasets(datasets) {
    const merged = factory.dataset();
    for (const ds of datasets) {
        for (const q of ds) {
            merged.add(q);
        }
    }
    return merged;
}

function buildValidConceptIndex(vocabDataset) {
    const conceptsByScheme = new Map();
    const conceptNodes = new Set();

    for (const q of vocabDataset) {
        if (q.predicate.value === RDF_TYPE && q.object.value === SKOS_CONCEPT) {
            conceptNodes.add(q.subject.value);
        }
    }
    for (const q of vocabDataset) {
        if (q.predicate.value === SKOS_IN_SCHEME && conceptNodes.has(q.subject.value)) {
            const scheme = q.object.value;
            if (!conceptsByScheme.has(scheme)) {
                conceptsByScheme.set(scheme, new Set());
            }
            conceptsByScheme.get(scheme).add(q.subject.value);
        }
    }
    return conceptsByScheme;
}

/**
 * Expands a compact EC JSON DPP using the raw EC JSON-LD context files
 * (`core-context.jsonld` + `batteries-context.jsonld`, which store `"@type": "dpp:DigitalProductPassport"`
 * alongside `"@context"`), then evaluates:
 *   1. SHACL Core constraints via `rdf-validate-shacl` on the raw `.ttl` shapes
 *   2. All raw SHACL-SPARQL constraints (`SEM-COM-MSG-013` `unknown#`, `SEM-COM-MSG-012` `^[A-Za-z]{2}-[A-Za-z]{2}$`,
 *      and all `skos:inScheme` checks against the raw SKOS `.ttl` vocabularies).
 */
async function validateRawEcShacl(payload, { mergedRawContext, rootType, shapeDataset, conceptsByScheme, skosChecks }) {
    let dataDataset;
    try {
        const docWithRawContext = {
            '@context': structuredClone(mergedRawContext),
            '@type': rootType,
            ...structuredClone(payload)
        };
        const expanded = await jsonld.expand(docWithRawContext, { processingMode: 'json-ld-1.1' });
        const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
        const parser = new N3Parser({ factory });
        const stream = parser.import(Readable.from([nquads]));
        dataDataset = factory.dataset();
        await new Promise((resolve, reject) => {
            stream.on('data', (q) => dataDataset.add(q));
            stream.on('end', resolve);
            stream.on('error', reject);
        });
    } catch (err) {
        return { valid: false, errors: [`JSON-LD expansion error: ${err.message}`] };
    }

    const errors = [];
    let hasDppTarget = false;

    for (const q of dataDataset) {
        if (q.predicate.value === RDF_TYPE && q.object.value === EC_DPP_CLASS) {
            hasDppTarget = true;
        }
        // Raw common-shapes.ttl SPARQL: SEM-COM-MSG-013 (reject unknown# predicates)
        if (q.predicate.value.startsWith(EC_UNKNOWN_NS)) {
            errors.push(`SEM-COM-MSG-013: Unknown property expanded to ${q.predicate.value}`);
        }
        // Raw pub-batteries-shapes.ttl SPARQL: SEM-COM-MSG-012 (strict xx-YY language tag)
        if (q.object.termType === 'Literal' && q.object.datatype?.value === RDF_LANG_STRING) {
            if (!RAW_LANG_TAG_REGEX.test(q.object.language || '')) {
                errors.push(
                    `SEM-COM-MSG-012: Language tag "${q.object.language}" does not match ^[A-Za-z]{2}-[A-Za-z]{2}$ on ${q.predicate.value}`
                );
            }
        }
    }

    if (!hasDppTarget) {
        errors.push('No dpp:DigitalProductPassport target node produced by JSON-LD expansion');
    }

    // Raw core-shapes.ttl & pub-batteries-shapes.ttl SPARQL: skos:inScheme Concept checks
    for (const check of skosChecks) {
        const validSet = conceptsByScheme.get(check.scheme) || new Set();
        for (const q of dataDataset) {
            if (q.predicate.value === check.predicate) {
                if (q.object.termType !== 'NamedNode' || !validSet.has(q.object.value)) {
                    errors.push(
                        `${check.code}: Value "${q.object.value}" is not a skos:Concept in scheme <${check.scheme}>`
                    );
                }
            }
        }
    }

    // Strip sh:sparql triples for SHACL Core engine (`rdf-validate-shacl` throws on sh:sparql;
    // all raw sh:sparql constraints are evaluated directly above)
    const shaclCoreShapes = factory.dataset();
    for (const q of shapeDataset) {
        if (q.predicate.value !== SH_SPARQL) {
            shaclCoreShapes.add(q);
        }
    }

    const validator = new SHACLValidator(shaclCoreShapes, { factory });
    const report = await validator.validate(dataDataset);
    if (!report.conforms) {
        for (const r of report.results) {
            const msg =
                r.message?.map((m) => m.value).join('; ') ||
                r.sourceConstraintComponent?.value ||
                'SHACL violation';
            const prop = r.path?.value ? r.path.value.split('#').pop() : 'node';
            errors.push(`${msg} (property: ${prop})`);
        }
    }

    return { valid: errors.length === 0, errors };
}

function validateRawEcJsonSchema(ajv, schemaId, payload) {
    const validate = ajv.getSchema(schemaId);
    if (!validate) {
        throw new Error(`Schema not registered: ${schemaId}`);
    }
    const ok = validate(structuredClone(payload));
    const errors = (validate.errors || []).map(
        (e) => `${e.instancePath || '/'} ${e.message} (keyword: ${e.keyword})`
    );
    return { valid: Boolean(ok), errors };
}

async function main() {
    console.log('========================================================================');
    console.log(' EC v1.0.0 Raw Bundle Diagnostic Verification (SHACL vs. JSON Schema)');
    console.log('========================================================================');
    console.log(`Raw EC semantics root: ${RAW_EC_SEMANTICS}\n`);

    // 1. Load raw EC JSON Schemas
    const rawCommonSchema = JSON.parse(
        await fs.readFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/schemas/common.schema.json'), 'utf-8')
    );
    const rawCoreSchema = JSON.parse(
        await fs.readFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/schemas/core.schema.json'), 'utf-8')
    );
    const rawPubBatteriesSchema = JSON.parse(
        await fs.readFile(
            path.join(RAW_EC_SEMANTICS, 'product/batteries/1.0.0/schemas/pub-batteries.schema.json'),
            'utf-8'
        )
    );

    // Check that strict Draft 2020-12 compilation fails on raw EC schemas (missing root `"type": "object"` + custom `"message"` keyword),
    // then run Ajv with `strict: false` (matching standard non-strict schema validators) to evaluate payload validation rules.
    let strictCompileError = null;
    try {
        const strictAjv = new Ajv2020({ strict: true, allErrors: true });
        addFormats(strictAjv);
        strictAjv.addSchema(rawCommonSchema);
        strictAjv.addSchema(rawCoreSchema);
        strictAjv.addSchema(rawPubBatteriesSchema);
        strictAjv.getSchema(rawPubBatteriesSchema.$id);
    } catch (err) {
        strictCompileError = err.message;
    }
    if (strictCompileError) {
        console.log(`ℹ️  Note: Raw EC schemas fail strict Draft 2020-12 compilation (${strictCompileError}).`);
        console.log('   Proceeding with Ajv `strict: false` to evaluate the raw EC JSON Schema rules...\n');
    }

    const ajv = new Ajv2020({ strict: false, allErrors: true });
    addFormats(ajv);
    ajv.addSchema(rawCommonSchema);
    ajv.addSchema(rawCoreSchema);
    ajv.addSchema(rawPubBatteriesSchema);

    // 2. Load raw EC JSON-LD contexts
    const rawCoreContextFile = JSON.parse(
        await fs.readFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/contexts/core-context.jsonld'), 'utf-8')
    );
    const rawBatteriesContextFile = JSON.parse(
        await fs.readFile(
            path.join(RAW_EC_SEMANTICS, 'product/batteries/1.0.0/contexts/batteries-context.jsonld'),
            'utf-8'
        )
    );

    const mergedCoreOnlyContext = { ...rawCoreContextFile['@context'] };
    const mergedBatteriesContext = {
        ...rawCoreContextFile['@context'],
        ...rawBatteriesContextFile['@context']
    };
    delete mergedBatteriesContext['@import'];

    // 3. Load raw EC SHACL shapes & SKOS vocabularies
    const [commonShapes, coreShapes, pubBatteriesShapes] = await Promise.all([
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/shapes/common-shapes.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/shapes/core-shapes.ttl')),
        parseTurtleFile(
            path.join(RAW_EC_SEMANTICS, 'product/batteries/1.0.0/shapes/pub-batteries-shapes.ttl')
        )
    ]);

    const vocabDatasets = await Promise.all([
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/vocabs/granularity-level.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/vocabs/instance-status.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/vocabs/measurement-unit.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/vocabs/observed-characteristic.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'core/1.0.0/vocabs/critical-raw-material.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'product/batteries/1.0.0/vocabs/battery-category.ttl')),
        parseTurtleFile(path.join(RAW_EC_SEMANTICS, 'product/batteries/1.0.0/vocabs/battery-chemistry.ttl')),
        parseTurtleFile(
            path.join(RAW_EC_SEMANTICS, 'product/batteries/1.0.0/vocabs/battery-chemical-symbol.ttl')
        )
    ]);

    const conceptsByScheme = buildValidConceptIndex(mergeDatasets(vocabDatasets));
    const coreShapeGraph = mergeDatasets([commonShapes, coreShapes]);
    const fullPubBatteryShapeGraph = mergeDatasets([commonShapes, coreShapes, pubBatteriesShapes]);

    // 4. Load payloads
    const [controlPayload, shaclValidPayload, schemaValidPayload] = await Promise.all([
         fs.readFile(CONTROL_RAW_CONFORMS, 'utf-8').then(JSON.parse),
        fs.readFile(PAYLOAD_SHACL_ONLY, 'utf-8').then(JSON.parse),
        fs.readFile(PAYLOAD_SCHEMA_ONLY, 'utf-8').then(JSON.parse)
    ]);

    let failures = 0;
    const assertOutcome = (label, actual, expected) => {
        if (actual === expected) {
            console.log(`  ✅ ${label}: ${actual ? 'VALID (as expected)' : 'INVALID (as expected)'}`);
        } else {
            console.error(
                `  ❌ ${label}: got ${actual ? 'VALID' : 'INVALID'}, expected ${expected ? 'VALID' : 'INVALID'}`
            );
            failures++;
        }
    };

    // -------------------------------------------------------------------------
    // Check 0: Bare Core Header Isolation Check
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log('0. Bare Core Header Check (`core.schema.json` vs `core-shapes.ttl`)');
    console.log('------------------------------------------------------------------------');
    const bareHeaderCompact = {
        digitalProductPassportId: shaclValidPayload.digitalProductPassportId,
        uniqueProductIdentifier: shaclValidPayload.uniqueProductIdentifier,
        granularity: shaclValidPayload.granularity, // "item"
        dppStatus: shaclValidPayload.dppStatus, // "validStatus"
        lastUpdate: shaclValidPayload.lastUpdate,
        contentSpecificationIds: ['https://repository.product-passport.ec.europa.eu/core/1.0.0']
    };
    const bareSchemaRes = validateRawEcJsonSchema(ajv, rawCoreSchema.$id, bareHeaderCompact);
    const bareShaclRes = await validateRawEcShacl(bareHeaderCompact, {
        mergedRawContext: mergedCoreOnlyContext,
        rootType: rawCoreContextFile['@type'],
        shapeDataset: coreShapeGraph,
        conceptsByScheme,
        skosChecks: RAW_SKOS_SCHEME_CHECKS.slice(0, 2)
    });
    assertOutcome('Bare header (compact codes) -> Raw EC SHACL', bareShaclRes.valid, true);
    assertOutcome('Bare header (compact codes) -> Raw EC JSON Schema', bareSchemaRes.valid, false);
    console.log(`     Schema errors (${bareSchemaRes.errors.length}): ${bareSchemaRes.errors.join(' | ')}\n`);

    // -------------------------------------------------------------------------
    // Check 1: EC Reference Control (`tests/conforms/pub-batteries.json`)
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log('1. Control Baseline (`tests/conforms/pub-batteries.json`)');
    console.log('------------------------------------------------------------------------');
    const ctrlSchemaRes = validateRawEcJsonSchema(ajv, rawPubBatteriesSchema.$id, controlPayload);
    const ctrlShaclRes = await validateRawEcShacl(controlPayload, {
        mergedRawContext: mergedBatteriesContext,
        rootType: rawBatteriesContextFile['@type'],
        shapeDataset: fullPubBatteryShapeGraph,
        conceptsByScheme,
        skosChecks: RAW_SKOS_SCHEME_CHECKS
    });
    assertOutcome('EC Control -> Raw EC SHACL', ctrlShaclRes.valid, true);
    assertOutcome('EC Control -> Raw EC JSON Schema', ctrlSchemaRes.valid, true);
    console.log('');

    // -------------------------------------------------------------------------
    // Check 2: Payload 1 (`pub-battery-valid-shacl-fails-schema.json`)
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log('2. Payload 1: `pub-battery-valid-shacl-fails-schema.json`');
    console.log('------------------------------------------------------------------------');
    const p1SchemaRes = validateRawEcJsonSchema(ajv, rawPubBatteriesSchema.$id, shaclValidPayload);
    const p1ShaclRes = await validateRawEcShacl(shaclValidPayload, {
        mergedRawContext: mergedBatteriesContext,
        rootType: rawBatteriesContextFile['@type'],
        shapeDataset: fullPubBatteryShapeGraph,
        conceptsByScheme,
        skosChecks: RAW_SKOS_SCHEME_CHECKS
    });
    assertOutcome('Payload 1 -> Raw EC SHACL (Core + SPARQL SKOS/lang/unknown)', p1ShaclRes.valid, true);
    if (!p1ShaclRes.valid) {
        console.error(`     Unexpected SHACL errors: ${p1ShaclRes.errors.join(' | ')}`);
    }
    assertOutcome('Payload 1 -> Raw EC JSON Schema', p1SchemaRes.valid, false);
    console.log(`     Schema errors (${p1SchemaRes.errors.length} total, showing first 5):`);
    for (const err of p1SchemaRes.errors.slice(0, 5)) {
        console.log(`       - ${err}`);
    }
    console.log('');

    // -------------------------------------------------------------------------
    // Check 3: Payload 2 (`pub-battery-valid-schema-fails-shacl.json`)
    // -------------------------------------------------------------------------
    console.log('------------------------------------------------------------------------');
    console.log('3. Payload 2: `pub-battery-valid-schema-fails-shacl.json`');
    console.log('------------------------------------------------------------------------');
    const p2SchemaRes = validateRawEcJsonSchema(ajv, rawPubBatteriesSchema.$id, schemaValidPayload);
    const p2ShaclRes = await validateRawEcShacl(schemaValidPayload, {
        mergedRawContext: mergedBatteriesContext,
        rootType: rawBatteriesContextFile['@type'],
        shapeDataset: fullPubBatteryShapeGraph,
        conceptsByScheme,
        skosChecks: RAW_SKOS_SCHEME_CHECKS
    });
    assertOutcome('Payload 2 -> Raw EC JSON Schema', p2SchemaRes.valid, true);
    if (!p2SchemaRes.valid) {
        console.error(`     Unexpected Schema errors: ${p2SchemaRes.errors.join(' | ')}`);
    }
    assertOutcome('Payload 2 -> Raw EC SHACL (Core + SPARQL SKOS/lang/unknown)', p2ShaclRes.valid, false);
    console.log(`     SHACL violations (${p2ShaclRes.errors.length} total, showing first 5):`);
    for (const err of p2ShaclRes.errors.slice(0, 5)) {
        console.log(`       - ${err}`);
    }
    console.log('');

    console.log('========================================================================');
    if (failures === 0) {
        console.log(' ✅ ALL DIAGNOSTIC ASSERTIONS PASSED (2x2 Validator Fingerprint Proven)');
        console.log('========================================================================');
    } else {
        console.error(` ❌ ${failures} DIAGNOSTIC ASSERTION(S) FAILED`);
        console.log('========================================================================');
        process.exit(1);
    }
}

main().catch((err) => {
    console.error('Fatal error running EC diagnostic verification:', err);
    process.exit(1);
});
