import { promises as fs, existsSync } from 'fs';
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

import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import { transform } from '../../dist/util/js/common/transformation/dpp-schema-logic.js';
import { createValidationEngine, validateOpenApi31Suite } from '../../src/examples/openapi/serve-validation-api.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const EC_SEMANTICS_ROOT = path.join(PROJECT_ROOT, 'ec-bundle', 'semantics');
const HAS_EC_BUNDLE = existsSync(EC_SEMANTICS_ROOT);

const EC_CORE_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#';
const EC_BATTERY_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-vocabulary#';
const EC_BATTERY_CATEGORY_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-category#';
const EC_BATTERY_CHEMISTRY_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-chemistry#';
const EC_BATTERY_STATUS_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-status#';
const EC_GRANULARITY_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/core/vocabs/granularity-level#';
const EC_INSTANCE_STATUS_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/core/vocabs/instance-status#';
const KEYSTONE_TERMS_NS = `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`;

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const EC_DPP_CLASS = `${EC_CORE_VOCAB_NS}DigitalProductPassport`;
const EC_UNKNOWN_NS = 'https://repository.product-passport.ec.europa.eu/unknown#';
const BCP47_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const factory = new Environment([
    DataFactory,
    DatasetFactory,
    N3Parser,
    ClownfaceFactory,
    NamespaceFactory
]);

const CONTEXT_MAP = {
    'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'core/1.0.0/contexts/core-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'product/batteries/1.0.0/contexts/batteries-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/core/releases/1.0.0/contexts/core-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'core/1.0.0/contexts/core-context.jsonld'),
    'https://repository.product-passport.ec.europa.eu/product/batteries/releases/1.0.0/contexts/batteries-context.jsonld':
        path.join(EC_SEMANTICS_ROOT, 'product/batteries/1.0.0/contexts/batteries-context.jsonld'),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-general-product.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-general-product.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-packaging.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-packaging.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-epd.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-epd.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-dopc.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-dopc.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-mtc.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-mtc.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-ec-to-keystone.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-ec-to-keystone.context.jsonld`),
    [`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-keystone-to-ec.context.jsonld`]:
        path.join(PROJECT_ROOT, `src/contexts/${KEYSTONE_VERSION}/dpp-keystone-to-ec.context.jsonld`)
};

async function documentLoader(url) {
    const normalizedUrl = url.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
    const localPath = CONTEXT_MAP[normalizedUrl];
    if (!localPath) {
        throw new Error(`Unmapped remote JSON-LD context URL: ${url}`);
    }
    const content = (await fs.readFile(localPath, 'utf-8')).replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
    return {
        contextUrl: null,
        documentUrl: normalizedUrl,
        document: jsoncParse(content)
    };
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
        stream.on('error', (err) => reject(new Error(`${path.relative(PROJECT_ROOT, filePath)}: ${err.message}`)));
    });
}

async function expandJsonLdToDataset(doc) {
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

async function validateShaclEndToEnd(doc, shapeDatasets) {
    let dataDataset;
    try {
        ({ dataset: dataDataset } = await expandJsonLdToDataset(doc));
    } catch (err) {
        return { valid: false, errors: [`JSON-LD expansion error: ${err.message}`] };
    }

    const errors = [];
    let hasDppNode = false;
    for (const quad of dataDataset) {
        if (quad.predicate.value === RDF_TYPE && quad.object.value === EC_DPP_CLASS) {
            hasDppNode = true;
        }
        if (quad.predicate.value.startsWith(EC_UNKNOWN_NS)) {
            errors.push(`SEM-COM-MSG-013: Unknown predicate ${quad.predicate.value}`);
        }
        if (quad.object.termType === 'Literal' && quad.object.datatype?.value === RDF_LANG_STRING) {
            if (!BCP47_REGEX.test(quad.object.language || '')) {
                errors.push(`SEM-COM-MSG-012: Invalid language tag "${quad.object.language}" on ${quad.predicate.value}`);
            }
        }
    }

    if (!hasDppNode) {
        errors.push('Vacuous graph: no rdf:type dpp:DigitalProductPassport node produced after JSON-LD expansion');
    }

    const shaclCoreShapes = factory.dataset();
    const SH_SPARQL = 'http://www.w3.org/ns/shacl#sparql';
    for (const ds of shapeDatasets) {
        for (const q of ds) {
            if (q.predicate.value !== SH_SPARQL) {
                shaclCoreShapes.add(q);
            }
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

async function readKeystoneJson(relPath) {
    const raw = await fs.readFile(path.join(PROJECT_ROOT, relPath), 'utf-8');
    return jsoncParse(raw.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION));
}

const testIfEcBundle = HAS_EC_BUNDLE ? test : test.skip;

describe('EC Battery Interoperability Deliverables (Goals 2, 3, 4 & 5)', () => {
    let ajv;
    let allLayeredSchemaIds = [];
    let allLayeredShapes = [];
    const shapesCache = new Map();

    async function getShape(relPath) {
        if (!shapesCache.has(relPath)) {
            shapesCache.set(relPath, await parseTurtleFile(path.join(EC_SEMANTICS_ROOT, relPath)));
        }
        return shapesCache.get(relPath);
    }

    function validateSchemas(doc, schemaIds) {
        const errors = [];
        for (const id of schemaIds) {
            const validate = ajv.getSchema(id);
            if (!validate) throw new Error(`Missing compiled EC schema: ${id}`);
            const ok = validate(structuredClone(doc));
            if (!ok && validate.errors) {
                for (const e of validate.errors) {
                    errors.push(`[${path.basename(id)}] ${e.instancePath || '/'} ${e.message}`);
                }
            }
        }
        return errors;
    }

    beforeAll(async () => {
        if (!HAS_EC_BUNDLE) return;
        ajv = new Ajv2020({ strict: true, allErrors: true });
        addFormats(ajv);
        const schemaFiles = await walkFiles(EC_SEMANTICS_ROOT, '.schema.json');
        allLayeredSchemaIds = [];
        for (const f of schemaFiles) {
            const parsed = JSON.parse(await fs.readFile(f, 'utf-8'));
            ajv.addSchema(parsed);
            if (!f.endsWith('common.schema.json')) {
                allLayeredSchemaIds.push(parsed.$id);
            }
        }

        const ttlFiles = await walkFiles(EC_SEMANTICS_ROOT, '.ttl');
        const shapeRelPaths = ttlFiles
            .filter((f) => f.includes(`${path.sep}shapes${path.sep}`))
            .map((f) => path.relative(EC_SEMANTICS_ROOT, f).replace(/\\/g, '/'));
        allLayeredShapes = await Promise.all(shapeRelPaths.map(getShape));
    });

    testIfEcBundle('Goal 2 (Step 4.1): battery-dpp-ec-aligned-v1.json passes all 17 layered EC JSON Schemas + all 18 SHACL files and preserves Keystone federated triples', async () => {
        const alignedExample = await readKeystoneJson('src/examples/battery-dpp-ec-aligned-v1.json');

        expect(allLayeredSchemaIds).toHaveLength(17);
        expect(allLayeredShapes).toHaveLength(18);
        expect(validateSchemas(alignedExample, allLayeredSchemaIds)).toEqual([]);

        const shaclRes = await validateShaclEndToEnd(alignedExample, allLayeredShapes);
        expect(shaclRes.errors).toEqual([]);
        expect(shaclRes.valid).toBe(true);

        const { dataset } = await expandJsonLdToDataset(alignedExample);
        const predicates = new Set([...dataset].map(q => q.predicate.value));

        // EC Core & Battery predicates
        expect(predicates.has(`${EC_CORE_VOCAB_NS}digitalProductPassportId`)).toBe(true);
        expect(predicates.has(`${EC_BATTERY_VOCAB_NS}batteryWeight`)).toBe(true);
        expect(predicates.has(`${EC_BATTERY_VOCAB_NS}stateOfCertifiedEnergy`)).toBe(true);

        // Federated Keystone predicates preserved without collision
        expect(predicates.has(`${KEYSTONE_TERMS_NS}serviceDate`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}batteryCarbonFootprintClass`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}carbonFootprintAbsolute`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}carbonFootprintStudy`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}dueDiligenceReport`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}materialComposition`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}preConsumerRecycledMaterialComposition`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}postConsumerRecycledMaterialComposition`)).toBe(true);
        expect(predicates.has(`${KEYSTONE_TERMS_NS}image`)).toBe(true);
    });

    testIfEcBundle('Goal 3 (Step 4.2): dpp-ec-to-keystone.context.jsonld maps EC Battery terms & @nest wrappers to Keystone dppk: ontology IRIs', async () => {
        const ecSampleRaw = await fs.readFile(
            path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/evb/1.0.0/tests/conforms/batteries-evb.json'),
            'utf-8'
        );
        const ecPayload = JSON.parse(ecSampleRaw);
        ecPayload['@context'] = `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-ec-to-keystone.context.jsonld`;

        const expanded = await jsonld.expand(ecPayload, {
            documentLoader,
            processingMode: 'json-ld-1.1'
        });
        expect(expanded.length).toBeGreaterThan(0);
        const root = expanded[0];

        expect(root['@type']).toContain(`${KEYSTONE_TERMS_NS}DigitalProductPassport`);
        expect(root[`${KEYSTONE_TERMS_NS}digitalProductPassportId`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}uniqueProductIdentifier`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}granularity`]?.[0]?.['@id']).toBe(`${KEYSTONE_TERMS_NS}Item`);
        expect(root[`${KEYSTONE_TERMS_NS}batteryMass`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}ratedCapacity`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}voltageNominal`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}soce`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}expectedLifetimeCycles`]).toBeDefined();

        // @nest-flattened EC wrapper properties mapped directly onto root node
        expect(root[`${KEYSTONE_TERMS_NS}model`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}labelMeaning`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}hazardousSubstancesImpact`]).toBeDefined();

        // Scoped notInUseTemperatureRange -> dppk:temperature
        const tempNode = root[`${KEYSTONE_TERMS_NS}temperature`]?.[0];
        expect(tempNode?.[`${KEYSTONE_TERMS_NS}temperatureIdleLower`]?.[0]?.['@value']).toBe(-20);
        expect(tempNode?.[`${KEYSTONE_TERMS_NS}temperatureIdleUpper`]?.[0]?.['@value']).toBe(50);
    });

    test('Goal 4 (Step 4.3): dpp-keystone-to-ec.context.jsonld maps Keystone Battery schemas to EC dpp:/bat: IRIs while keeping dppk: fallbacks', async () => {
        const keystoneEv = await readKeystoneJson('src/examples/battery-dpp-v1.json');
        keystoneEv['@context'] = `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-keystone-to-ec.context.jsonld`;
        keystoneEv['@type'] = ['DigitalProductPassport', 'BatteryProduct'];

        const expanded = await jsonld.expand(keystoneEv, {
            documentLoader,
            processingMode: 'json-ld-1.1'
        });
        expect(expanded.length).toBeGreaterThan(0);
        const root = expanded[0];

        // Core + Battery terms mapped to EC vocabulary & SKOS concept IRIs
        expect(root['@type']).toContain(`${EC_CORE_VOCAB_NS}DigitalProductPassport`);
        expect(root[`${EC_CORE_VOCAB_NS}digitalProductPassportId`]).toBeDefined();
        expect(root[`${EC_CORE_VOCAB_NS}granularity`]?.[0]?.['@id']).toBe(`${EC_GRANULARITY_VOCAB_NS}item`);
        expect(root[`${EC_CORE_VOCAB_NS}dppStatus`]?.[0]?.['@id']).toBe(`${EC_INSTANCE_STATUS_VOCAB_NS}validStatus`);
        expect(root[`${EC_BATTERY_VOCAB_NS}batteryCategory`]?.[0]?.['@id']).toBe(`${EC_BATTERY_CATEGORY_VOCAB_NS}electricVehicleBattery`);
        expect(root[`${EC_BATTERY_VOCAB_NS}batteryChemistry`]?.[0]?.['@id']).toBe(`${EC_BATTERY_CHEMISTRY_VOCAB_NS}lithiumIonLFP`);
        expect(root[`${EC_BATTERY_VOCAB_NS}batteryStatus`]?.[0]?.['@id']).toBe(`${EC_BATTERY_STATUS_VOCAB_NS}original`);
        expect(root[`${EC_BATTERY_VOCAB_NS}batteryWeight`]?.[0]?.['@value']).toBe(45.5);

        // @nest-flattened performance metrics on root + scoped power metrics without fade collision
        expect(root[`${EC_BATTERY_VOCAB_NS}batteryCapacity`]?.[0]?.['@value']).toBe(100);
        expect(root[`${EC_BATTERY_VOCAB_NS}capacityFade`]?.[0]?.['@value']).toBe(2.5);
        expect(root[`${EC_BATTERY_VOCAB_NS}stateOfCertifiedEnergy`]?.[0]?.['@value']).toBe(99);
        expect(root[`${EC_BATTERY_VOCAB_NS}expectedLifetimeCycles`]?.[0]?.['@value']).toBe(3000);
        expect(root[`${EC_BATTERY_VOCAB_NS}initialRoundTripEnergyEfficiency`]?.[0]?.['@value']).toBe(95.5);

        const powerNode = root[`${KEYSTONE_TERMS_NS}power`]?.[0];
        expect(powerNode?.[`${EC_BATTERY_VOCAB_NS}originalPowerCapability`]?.[0]?.['@value']).toBe(2000);
        expect(powerNode?.[`${EC_BATTERY_VOCAB_NS}powerFade`]?.[0]?.['@value']).toBe(1.0);

        // Keystone-only properties retain dppk: IRIs
        expect(root[`${KEYSTONE_TERMS_NS}serviceDate`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}materialComposition`]).toBeDefined();
        expect(root[`${KEYSTONE_TERMS_NS}postConsumerRecycledMaterialComposition`]).toBeDefined();
    });

    test.each([
        {
            label: 'EV Battery (battery-dpp-v1.json -> evb)',
            exampleFile: 'src/examples/battery-dpp-v1.json',
            subgroup: 'evb',
            expectedCategory: 'electricVehicleBattery'
        },
        {
            label: 'LMV Battery (battery-lmv-dpp-v1.json -> lmt)',
            exampleFile: 'src/examples/battery-lmv-dpp-v1.json',
            subgroup: 'lmt',
            expectedCategory: 'lightMeansOfTransportBattery'
        },
        {
            label: 'Industrial Battery (battery-industrial-dpp-v1.json -> ind)',
            exampleFile: 'src/examples/battery-industrial-dpp-v1.json',
            subgroup: 'ind',
            expectedCategory: 'industrialBattery'
        }
    ])('Goal 5 (Step 4.4): ec-battery transformation profile produces valid EC output across all 17 layered schemas & 18 SHACL files for $label', async ({ exampleFile, subgroup, expectedCategory }) => {
        const sourceDpp = await readKeystoneJson(exampleFile);
        const transformedList = await transform(
            sourceDpp,
            {
                profile: 'ec-battery',
                documentLoader,
                version: KEYSTONE_VERSION
            },
            {}
        );

        expect(Array.isArray(transformedList)).toBe(true);
        expect(transformedList).toHaveLength(1);
        const ecDpp = transformedList[0];

        expect(ecDpp.batteryCategory).toBe(expectedCategory);
        // Unit conversion check: Keystone 15.0 mOhm -> EC 0.015 Ohm; "5 Years" -> 60 months
        expect(ecDpp.internalPackResistance).toBe(0.015);
        expect(ecDpp.commercialWarrantyPeriod).toBe(60);
        // Preserves Keystone federated extensions
        expect(ecDpp.serviceDate).toBe('2024-02-01');
        expect(ecDpp.materialComposition).toHaveLength(2);
        expect(ecDpp.postConsumerRecycledMaterialComposition).toHaveLength(2);

        // Verify per-tier EC contentSpecificationIds are emitted alongside federated Keystone URN
        for (const tier of ['pub', 'res1', 'res2', 'res3']) {
            expect(ecDpp.contentSpecificationIds).toContain(
                `https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/${tier}`
            );
            expect(ecDpp.contentSpecificationIds).toContain(
                `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/${subgroup}/1.0.0/${tier}`
            );
        }

        if (!HAS_EC_BUNDLE) return;

        // Validate against all 17 EC JSON Schemas and all 18 EC SHACL files simultaneously
        expect(validateSchemas(ecDpp, allLayeredSchemaIds)).toEqual([]);

        const shaclRes = await validateShaclEndToEnd(ecDpp, allLayeredShapes);
        expect(shaclRes.errors).toEqual([]);
        expect(shaclRes.valid).toBe(true);
    });

    testIfEcBundle('Goal 6: All 4 OpenAPI 3.1 YAML contracts compile in Ajv 2020-12, validate all inline examples, and power the layered validation engine', async () => {
        // Collect all EC + Keystone v3 JSON Schemas for OpenAPI $ref resolution
        const ecSchemaFiles = await walkFiles(EC_SEMANTICS_ROOT, '.schema.json');
        const externalSchemas = [];
        for (const f of ecSchemaFiles) {
            externalSchemas.push(JSON.parse(await fs.readFile(f, 'utf-8')));
        }
        const keystoneSchemaFiles = await walkFiles(
            path.join(PROJECT_ROOT, `src/validation/${KEYSTONE_VERSION}/json-schema`),
            '.schema.json'
        );
        for (const f of keystoneSchemaFiles) {
            const raw = (await fs.readFile(f, 'utf-8')).replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
            externalSchemas.push(jsoncParse(raw));
        }

        const oasResult = await validateOpenApi31Suite(
            [
                {
                    label: 'openapi-dpp-common-public.yml',
                    filePath: path.join(PROJECT_ROOT, 'ec-bundle/openapi/openapi-dpp-common-public.yml'),
                    docUri: 'https://openapi.local/ec-bundle/openapi-dpp-common-public.yml'
                },
                {
                    label: 'openapi-dpp-registry-public.yml',
                    filePath: path.join(PROJECT_ROOT, 'ec-bundle/openapi/openapi-dpp-registry-public.yml'),
                    docUri: 'https://openapi.local/ec-bundle/openapi-dpp-registry-public.yml'
                },
                {
                    label: 'openapi-dpp-dashboard-public.yml',
                    filePath: path.join(PROJECT_ROOT, 'ec-bundle/openapi/openapi-dpp-dashboard-public.yml'),
                    docUri: 'https://openapi.local/ec-bundle/openapi-dpp-dashboard-public.yml'
                },
                {
                    label: 'example-dpp-validation-api.yml',
                    filePath: path.join(PROJECT_ROOT, 'src/examples/openapi/example-dpp-validation-api.yml'),
                    docUri: 'https://openapi.local/examples/example-dpp-validation-api.yml'
                }
            ],
            externalSchemas
        );

        expect(oasResult.errors).toEqual([]);
        expect(oasResult.compiledSchemas).toBeGreaterThanOrEqual(40);
        expect(oasResult.validatedExamples).toBeGreaterThanOrEqual(30);

        // Exercise the live validation engine against EV Battery, Textile, Aligned EVB, and MSA audit policy
        const engine = await createValidationEngine();
        const reqExamples =
            engine.validationApiDoc.paths['/v1/dpps/validate'].post.requestBody.content['application/ld+json'].examples;

        const evbRes = await engine.validatePayload(reqExamples.evBatteryPublicDpp.value, { shacl: true });
        expect(evbRes.statusCode).toBe(200);
        expect(evbRes.report.conforms).toBe(true);
        expect(evbRes.report.shaclValidated).toBe(true);

        const textileRes = await engine.validatePayload(reqExamples.esprTextileBatchDpp.value, { shacl: true });
        expect(textileRes.statusCode).toBe(200);
        expect(textileRes.report.conforms).toBe(true);
        expect(textileRes.report.shaclValidated).toBe(true);

        const alignedExample = await readKeystoneJson('src/examples/battery-dpp-ec-aligned-v1.json');
        const alignedRes = await engine.validatePayload(alignedExample, { shacl: true });
        expect(alignedRes.statusCode).toBe(200);
        expect(alignedRes.report.conforms).toBe(true);
        expect(alignedRes.report.unrecognizedSpecifications).toContain(`urn:dpp-keystone:${KEYSTONE_VERSION}:sector:battery-ev`);

        const msaAuditRes = await engine.validatePayload(reqExamples.evBatteryPublicDpp.value, {
            requiredSpecs: ['https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/res2'],
            shacl: true
        });
        expect(msaAuditRes.statusCode).toBe(422);
        expect(msaAuditRes.report.conforms).toBe(false);
        expect(msaAuditRes.report.findings.some((f) => f.stage === 'REQUIRED_SPECIFICATION_POLICY')).toBe(true);
    });
});
