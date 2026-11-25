/**
 * @file serve-validation-api.mjs
 * @description Local reference server and interactive Swagger UI for all 4 OpenAPI 3.1 contracts:
 *   1. src/examples/openapi/example-dpp-validation-api.yml (live POST /v1/dpps/validate & GET /v1/specifications)
 *   2. ec-bundle/openapi/openapi-dpp-registry-public.yml
 *   3. ec-bundle/openapi/openapi-dpp-dashboard-public.yml
 *   4. ec-bundle/openapi/openapi-dpp-common-public.yml
 *
 * Usage:
 *   node src/examples/openapi/serve-validation-api.mjs           # Starts HTTP server on http://localhost:3000
 *   PORT=8080 node src/examples/openapi/serve-validation-api.mjs # Custom port
 *   node src/examples/openapi/serve-validation-api.mjs --self-test
 */

import http from 'http';
import crypto from 'crypto';
import { existsSync, promises as fs } from 'fs';
import path from 'path';
import { Readable } from 'stream';
import { fileURLToPath } from 'url';

import yaml from 'js-yaml';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = existsSync(path.resolve(__dirname, '../../../ec-bundle'))
    ? path.resolve(__dirname, '../../..')
    : path.resolve(__dirname, '../../../..');

const EC_BUNDLE_ROOT = path.join(PROJECT_ROOT, 'ec-bundle');
const EC_SEMANTICS_ROOT = path.join(EC_BUNDLE_ROOT, 'semantics');
const EC_OPENAPI_ROOT = path.join(EC_BUNDLE_ROOT, 'openapi');
const KEYSTONE_VERSION = 'v3';
const VERSION_PLACEHOLDER_RE = new RegExp('\\{\\{VERSION\\}\\}', 'g');

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const RDF_LANG_STRING = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#langString';
const SH_SPARQL = 'http://www.w3.org/ns/shacl#sparql';
const EC_CORE_SPEC_ID = 'https://repository.product-passport.ec.europa.eu/core/1.0.0';
const EC_DPP_CLASS = 'https://repository.product-passport.ec.europa.eu/core/vocabs/core-vocabulary#DigitalProductPassport';
const EC_UNKNOWN_NS = 'https://repository.product-passport.ec.europa.eu/unknown#';
const EC_BATTERY_VOCAB_NS = 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-vocabulary#';
const EC_BATTERY_CATEGORY_PREDICATE = `${EC_BATTERY_VOCAB_NS}batteryCategory`;
const EC_BATTERY_CATEGORY_NS = 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-category#';
const KEYSTONE_TERMS_NS = `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`;
const KEYSTONE_DPP_CLASS = `${KEYSTONE_TERMS_NS}DigitalProductPassport`;
const KEYSTONE_BATTERY_PRODUCT_CLASS = `${KEYSTONE_TERMS_NS}BatteryProduct`;
const KEYSTONE_BATTERY_CATEGORY_PREDICATE = `${KEYSTONE_TERMS_NS}batteryCategory`;
const KEYSTONE_TYPE_TO_SPEC = new Map([
    [`${KEYSTONE_TERMS_NS}ConstructionProduct`, 'draft_construction_specification_id'],
    [`${KEYSTONE_TERMS_NS}IronSteelProduct`, 'draft_iron_and_steel_specification_id'],
    [`${KEYSTONE_TERMS_NS}ElectronicDevice`, 'draft_electronics_specification_id'],
    [`${KEYSTONE_TERMS_NS}PowerTool`, 'draft_electronics_specification_id']
]);
const KEYSTONE_PROP_TO_SPEC = new Map([
    [`${KEYSTONE_TERMS_NS}pefcrCategory`, 'draft_textile_espr_specification_id'],
    [`${KEYSTONE_TERMS_NS}fibreComposition`, 'draft_textile_espr_specification_id']
]);
const BCP47_REGEX = /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

const CATEGORY_TO_SUBGROUP = {
    [`${EC_BATTERY_CATEGORY_NS}electricVehicleBattery`]: 'evb',
    [`${EC_BATTERY_CATEGORY_NS}lightMeansOfTransportBattery`]: 'lmt',
    [`${EC_BATTERY_CATEGORY_NS}industrialBattery`]: 'ind',
    electricVehicleBattery: 'evb',
    lightMeansOfTransportBattery: 'lmt',
    industrialBattery: 'ind'
};

const factory = new Environment([
    DataFactory,
    DatasetFactory,
    N3Parser,
    ClownfaceFactory,
    NamespaceFactory
]);

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

/**
 * Builds the layered validator engine directly from `example-dpp-validation-api.yml`,
 * the 18 EC JSON Schemas, 18 EC SHACL shapes, and Keystone v3 JSON Schemas & contexts.
 */
export async function createValidationEngine() {
    const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
    addFormats(ajv);
    ajv.addKeyword('components');
    ajv.addKeyword('discriminator');

    const recognizedSpecs = [];
    const specById = new Map();
    const baseBatteryPropsByTier = new Map();
    const subgroupBatteryPropsByTier = new Map();

    // 1. Register all EC JSON Schemas & index battery root properties by access tier
    const ecSchemaFiles = await walkFiles(EC_SEMANTICS_ROOT, '.schema.json');
    for (const file of ecSchemaFiles) {
        const parsed = JSON.parse(await fs.readFile(file, 'utf-8'));
        ajv.addSchema(parsed);

        if (file.endsWith('common.schema.json')) continue;
        if (file.endsWith('core.schema.json')) {
            const entry = {
                contentSpecificationId: EC_CORE_SPEC_ID,
                title: parsed.title || 'EU DPP Core Envelope',
                authority: 'European Commission',
                accessTier: 'core',
                jsonSchemaId: parsed.$id,
                shaclShapesUri: 'https://repository.product-passport.ec.europa.eu/core/1.0.0/shapes/core-shapes.ttl',
                jsonLdContextUri: 'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld'
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
                authority: 'European Commission',
                ...(tierMatch ? { accessTier: tierMatch[1] } : {}),
                ...(parentId ? { parentSpecificationId: parentId } : {}),
                jsonSchemaId: parsed.$id,
                shaclShapesUri: parsed.$id.replace('/schemas/', '/shapes/').replace('.schema.json', '-shapes.ttl'),
                jsonLdContextUri: 'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld'
            };
            recognizedSpecs.push(entry);
            specById.set(triggerId, entry);

            if (tierMatch) {
                const tier = tierMatch[1];
                const isSubgroup = triggerId.includes('/subgroup/');
                const targetMap = isSubgroup ? subgroupBatteryPropsByTier : baseBatteryPropsByTier;
                if (!targetMap.has(tier)) targetMap.set(tier, new Set());
                for (const [propName, propSchema] of Object.entries(parsed.then?.properties || {})) {
                    if (propName === 'contentSpecificationIds' || propSchema === false) continue;
                    if (isSubgroup && propName === 'batteryCategory') continue;
                    targetMap.get(tier).add(propName);
                }
            }
        }
    }

    const ecBatteryPropToTier = new Map();
    for (const [tier, propSet] of baseBatteryPropsByTier.entries()) {
        for (const propName of propSet) {
            ecBatteryPropToTier.set(`${EC_BATTERY_VOCAB_NS}${propName}`, {
                propName,
                tier,
                subgroupOnly: false
            });
        }
    }
    for (const [tier, propSet] of subgroupBatteryPropsByTier.entries()) {
        for (const propName of propSet) {
            const iri = `${EC_BATTERY_VOCAB_NS}${propName}`;
            if (!ecBatteryPropToTier.has(iri)) {
                ecBatteryPropToTier.set(iri, {
                    propName,
                    tier,
                    subgroupOnly: true
                });
            }
        }
    }

    // 2. Register Keystone v3 JSON Schemas (shared + sector)
    const keystoneSchemaDir = path.join(PROJECT_ROOT, 'src', 'validation', KEYSTONE_VERSION, 'json-schema');
    const keystoneSchemaFiles = await walkFiles(keystoneSchemaDir, '.schema.json');
    for (const file of keystoneSchemaFiles) {
        const raw = (await fs.readFile(file, 'utf-8')).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
        const parsed = jsoncParse(raw);
        ajv.addSchema(parsed);

        const triggerId = parsed.if?.properties?.contentSpecificationIds?.contains?.const;
        if (triggerId && ['textile.schema.json', 'iron-steel.schema.json', 'construction.schema.json', 'electronics.schema.json'].includes(path.basename(file))) {
            const entry = {
                contentSpecificationId: triggerId,
                title: parsed.title || path.basename(file),
                authority: 'DPP Keystone',
                accessTier: 'pub',
                jsonSchemaId: parsed.$id
            };
            recognizedSpecs.push(entry);
            specById.set(triggerId, entry);
        }
    }

    // 3. Load and compile example-dpp-validation-api.yml -> LayeredDigitalProductPassport
    const validationApiPath = path.join(PROJECT_ROOT, 'src', 'examples', 'openapi', 'example-dpp-validation-api.yml');
    const validationApiRaw = await fs.readFile(validationApiPath, 'utf-8');
    const validationApiDoc = yaml.load(validationApiRaw);
    const validationDocUri = 'https://openapi.local/examples/example-dpp-validation-api.yml';
    ajv.addSchema({
        $id: validationDocUri,
        components: { schemas: validationApiDoc.components?.schemas || {} }
    });
    const validateLayeredSchema = ajv.getSchema(`${validationDocUri}#/components/schemas/LayeredDigitalProductPassport`);
    if (!validateLayeredSchema) {
        throw new Error('Failed to compile LayeredDigitalProductPassport from example-dpp-validation-api.yml');
    }

    // 4. Build offline JSON-LD context map (EC + Keystone v3)
    const contextMap = {
        'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld':
            path.join(EC_SEMANTICS_ROOT, 'core/1.0.0/contexts/core-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld':
            path.join(EC_SEMANTICS_ROOT, 'product/batteries/1.0.0/contexts/batteries-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld':
            path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/evb/1.0.0/contexts/evb-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld':
            path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/ind/1.0.0/contexts/ind-context.jsonld'),
        'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld':
            path.join(EC_SEMANTICS_ROOT, 'product/batteries/subgroup/lmt/1.0.0/contexts/lmt-context.jsonld')
    };
    const keystoneContextDir = path.join(PROJECT_ROOT, 'src', 'contexts', KEYSTONE_VERSION);
    for (const entry of await fs.readdir(keystoneContextDir)) {
        if (entry.endsWith('.context.jsonld')) {
            contextMap[`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/${entry}`] =
                path.join(keystoneContextDir, entry);
        }
    }

    async function documentLoader(url) {
        const normalized = url.replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
        const localPath = contextMap[normalized];
        if (!localPath) {
            throw new Error(`Unmapped remote JSON-LD context URL: ${url}`);
        }
        const content = (await fs.readFile(localPath, 'utf-8')).replace(VERSION_PLACEHOLDER_RE, KEYSTONE_VERSION);
        return {
            contextUrl: null,
            documentUrl: normalized,
            document: jsoncParse(content)
        };
    }

    // 5. Merge all 18 EC SHACL Core shapes graphs (plus a slice graph omitting core-shapes.ttl for standalone res1/res2/res3 slices)
    const ttlFiles = await walkFiles(EC_SEMANTICS_ROOT, '.ttl');
    const shapeFiles = ttlFiles.filter((f) => f.includes(`${path.sep}shapes${path.sep}`));
    const mergedShaclShapes = factory.dataset();
    const sliceShaclShapes = factory.dataset();
    for (const shapeFile of shapeFiles) {
        const isCoreShape = path.basename(shapeFile) === 'core-shapes.ttl';
        const ds = await parseTurtleFile(shapeFile);
        for (const quad of ds) {
            if (quad.predicate.value !== SH_SPARQL) {
                mergedShaclShapes.add(quad);
                if (!isCoreShape) {
                    sliceShaclShapes.add(quad);
                }
            }
        }
    }
    const shaclValidator = new SHACLValidator(mergedShaclShapes, { factory });
    const sliceShaclValidator = new SHACLValidator(sliceShaclShapes, { factory });

    /**
     * Evaluates a DPP payload and returns { statusCode, report }.
     */
    async function validatePayload(payload, { requiredSpecs = [], shacl = true } = {}) {
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
            return {
                statusCode: 400,
                error: { status: 400, code: 'INVALID_PAYLOAD', message: 'Request body must be a JSON object.' }
            };
        }

        const findings = [];
        const claimedSpecs = Array.isArray(payload.contentSpecificationIds)
            ? payload.contentSpecificationIds.filter((s) => typeof s === 'string')
            : [];
        const nonCoreSpecs = claimedSpecs.filter((id) => id !== EC_CORE_SPEC_ID);

        // Standalone restricted-tier slice payloads (res1/res2/res3) legitimately omit the public Core header
        const isRestrictedSliceCandidate =
            nonCoreSpecs.length > 0 &&
            !claimedSpecs.includes(EC_CORE_SPEC_ID) &&
            nonCoreSpecs.every((id) => ['res1', 'res2', 'res3'].includes(specById.get(id)?.accessTier));

        const activatedSpecifications = isRestrictedSliceCandidate
            ? claimedSpecs.filter((id) => specById.has(id))
            : [EC_CORE_SPEC_ID, ...claimedSpecs.filter((id) => id !== EC_CORE_SPEC_ID && specById.has(id))];
        const unrecognizedSpecifications = claimedSpecs.filter((id) => !specById.has(id));

        // 1a. Reject empty / Core-header-only DPPs that omit any product-sector contentSpecificationId
        if (nonCoreSpecs.length === 0) {
            findings.push({
                stage: 'IMPLIED_SPECIFICATION',
                code: 'SEM-MSG-009',
                path: '/contentSpecificationIds',
                message:
                    'A Digital Product Passport must declare at least one product-sector contentSpecificationId in addition to the Core envelope.'
            });
        }

        // 1b. Explicit inspection / audit specification policy (requireSpecificationId)
        for (const reqSpec of [...new Set(requiredSpecs)]) {
            if (!claimedSpecs.includes(reqSpec)) {
                findings.push({
                    stage: 'REQUIRED_SPECIFICATION_POLICY',
                    specificationId: reqSpec,
                    code: 'MSA-REQ-SPEC-MISSING',
                    path: '/contentSpecificationIds',
                    message: `Inspection policy requires contentSpecificationId "${reqSpec}" to be declared and satisfied.`
                });
            }
        }

        // 2. Layered Draft 2020-12 JSON Schema validation (run per-spec for clear attribution)
        for (const specId of activatedSpecifications) {
            const specEntry = specById.get(specId);
            if (!specEntry) continue;
            const validateFn = ajv.getSchema(specEntry.jsonSchemaId);
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

        // Also run the composite OpenAPI LayeredDigitalProductPassport validator for full DPPs
        if (!isRestrictedSliceCandidate && findings.filter((f) => f.stage === 'JSON_SCHEMA').length === 0) {
            const compositeOk = validateLayeredSchema(structuredClone(payload));
            if (!compositeOk && validateLayeredSchema.errors) {
                for (const err of validateLayeredSchema.errors) {
                    if (err.keyword === 'if') continue;
                    findings.push({
                        stage: 'JSON_SCHEMA',
                        path: err.instancePath || '/',
                        message: `${err.instancePath || '/'} ${err.message}`.trim()
                    });
                }
            }
        }

        // 3. JSON-LD 1.1 Expansion + Root Implied-Specification Guard + Merged SHACL Validation
        let shaclExecuted = false;
        const isPureEcCompactWithoutContext =
            payload['@context'] === undefined &&
            claimedSpecs.length > 0 &&
            claimedSpecs.every((id) => id.startsWith('https://repository.product-passport.ec.europa.eu/'));

        if (payload['@context'] !== undefined || isPureEcCompactWithoutContext) {
            try {
                const docToExpand = structuredClone(payload);
                if (isPureEcCompactWithoutContext) {
                    const synthesizedContexts = [
                        'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld'
                    ];
                    if (activatedSpecifications.some((id) => id.startsWith('https://repository.product-passport.ec.europa.eu/product/batteries/'))) {
                        synthesizedContexts.push(
                            'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld'
                        );
                    }
                    for (const sub of ['evb', 'ind', 'lmt']) {
                        if (activatedSpecifications.some((id) => id.includes(`/subgroup/${sub}/`))) {
                            synthesizedContexts.push(
                                `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/${sub}/1.0.0/contexts/${sub}-context.jsonld`
                            );
                        }
                    }
                    docToExpand['@context'] = synthesizedContexts;
                    if (docToExpand.type === undefined && docToExpand['@type'] === undefined) {
                        docToExpand.type = 'DigitalProductPassport';
                    }
                }

                const expanded = await jsonld.expand(docToExpand, {
                    documentLoader,
                    processingMode: 'json-ld-1.1'
                });
                const nquads = await jsonld.toRDF(expanded, { format: 'application/n-quads' });
                const parser = new N3Parser({ factory });
                const stream = parser.import(Readable.from([nquads]));
                const dataDataset = factory.dataset();
                await new Promise((resolve, reject) => {
                    stream.on('data', (quad) => dataDataset.add(quad));
                    stream.on('end', resolve);
                    stream.on('error', reject);
                });

                let hasEcDppNode = false;
                const rootPassportSubjects = new Set();
                const explicitRootId = typeof (payload.id || payload['@id']) === 'string' ? payload.id || payload['@id'] : null;

                for (const quad of dataDataset) {
                    if (quad.predicate.value === RDF_TYPE && quad.object.value === EC_DPP_CLASS) {
                        hasEcDppNode = true;
                        rootPassportSubjects.add(quad.subject.value);
                    } else if (quad.predicate.value === RDF_TYPE && quad.object.value === KEYSTONE_DPP_CLASS) {
                        rootPassportSubjects.add(quad.subject.value);
                    }
                }

                if (rootPassportSubjects.size === 0 && explicitRootId) {
                    rootPassportSubjects.add(explicitRootId);
                }

                const usesEcSpec = claimedSpecs.some((id) => id.startsWith('https://repository.product-passport.ec.europa.eu/'));

                // 3a. Root Implied-Specification Guard on the root passport node(s) ONLY
                //     (ignores nested sub-component nodes and permits multi-category arrays)
                const impliedKeystoneSpecs = new Map();
                const impliedBaseTiers = new Map();
                const impliedSubgroupTiers = new Map();
                let detectedSubgroup = null;
                let detectedCategoryLabel = null;
                let hasKeystoneBatteryMarker = false;

                for (const quad of dataDataset) {
                    if (!rootPassportSubjects.has(quad.subject.value)) continue;

                    if (quad.predicate.value === RDF_TYPE && KEYSTONE_TYPE_TO_SPEC.has(quad.object.value)) {
                        const targetSpec = KEYSTONE_TYPE_TO_SPEC.get(quad.object.value);
                        if (!impliedKeystoneSpecs.has(targetSpec)) {
                            impliedKeystoneSpecs.set(targetSpec, `@type ${quad.object.value.split('#').pop()}`);
                        }
                    }
                    if (KEYSTONE_PROP_TO_SPEC.has(quad.predicate.value)) {
                        const targetSpec = KEYSTONE_PROP_TO_SPEC.get(quad.predicate.value);
                        if (!impliedKeystoneSpecs.has(targetSpec)) {
                            impliedKeystoneSpecs.set(targetSpec, `dppk:${quad.predicate.value.split('#').pop()}`);
                        }
                    }

                    if (
                        (quad.predicate.value === RDF_TYPE && quad.object.value === KEYSTONE_BATTERY_PRODUCT_CLASS) ||
                        quad.predicate.value === KEYSTONE_BATTERY_CATEGORY_PREDICATE
                    ) {
                        hasKeystoneBatteryMarker = true;
                    }

                    if (quad.predicate.value === EC_BATTERY_CATEGORY_PREDICATE) {
                        const sub = CATEGORY_TO_SUBGROUP[quad.object.value];
                        if (sub) {
                            detectedSubgroup = sub;
                            detectedCategoryLabel = quad.object.value.split('#').pop();
                        }
                    }

                    const propMeta = ecBatteryPropToTier.get(quad.predicate.value);
                    if (propMeta) {
                        if (!impliedBaseTiers.has(propMeta.tier)) {
                            impliedBaseTiers.set(propMeta.tier, `bat:${propMeta.propName}`);
                        }
                        if (propMeta.subgroupOnly && !impliedSubgroupTiers.has(propMeta.tier)) {
                            impliedSubgroupTiers.set(propMeta.tier, `bat:${propMeta.propName}`);
                        }
                    }
                }

                for (const [expectedSpec, triggerTerm] of impliedKeystoneSpecs.entries()) {
                    if (!claimedSpecs.includes(expectedSpec)) {
                        findings.push({
                            stage: 'IMPLIED_SPECIFICATION',
                            specificationId: expectedSpec,
                            code: 'SEM-MSG-009',
                            path: '/contentSpecificationIds',
                            message: `Root passport node declares ${triggerTerm}, so contentSpecificationIds must include "${expectedSpec}".`
                        });
                    }
                }

                const hasKeystoneBatterySpecClaimed = claimedSpecs.some(
                    (id) =>
                        (id.startsWith('urn:dpp-keystone:') && id.includes(':sector:battery')) ||
                        id === 'draft_battery_specification_id'
                );
                if (hasKeystoneBatteryMarker && !hasKeystoneBatterySpecClaimed && !impliedBaseTiers.has('pub')) {
                    impliedBaseTiers.set('pub', 'dppk:BatteryProduct / dppk:batteryCategory');
                }

                for (const [tier, triggerTerm] of impliedBaseTiers.entries()) {
                    const expectedBaseSpec = `https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/${tier}`;
                    if (!claimedSpecs.includes(expectedBaseSpec)) {
                        findings.push({
                            stage: 'IMPLIED_SPECIFICATION',
                            specificationId: expectedBaseSpec,
                            code: 'SEM-MSG-009',
                            path: '/contentSpecificationIds',
                            message: `Root passport node contains Battery ${tier.toUpperCase()} markers/properties (e.g. ${triggerTerm}), so contentSpecificationIds must include "${expectedBaseSpec}".`
                        });
                    }
                }

                // For `pub` and `res3` (the two tiers with subgroup-specific regulatory constraints),
                // `bat:batteryCategory` on the root passport deterministically requires the matching subgroup spec ID.
                if (detectedSubgroup) {
                    for (const tier of ['pub', 'res3']) {
                        const baseSpec = `https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/${tier}`;
                        if (claimedSpecs.includes(baseSpec) || impliedBaseTiers.has(tier)) {
                            const expectedSubSpec = `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/${detectedSubgroup}/1.0.0/${tier}`;
                            if (!claimedSpecs.includes(expectedSubSpec)) {
                                findings.push({
                                    stage: 'IMPLIED_SPECIFICATION',
                                    specificationId: expectedSubSpec,
                                    code: 'SEM-MSG-009',
                                    path: '/contentSpecificationIds',
                                    message: `Root passport node declares bat:batteryCategory = ${detectedCategoryLabel}, so contentSpecificationIds must include "${expectedSubSpec}" for active ${tier.toUpperCase()} data.`
                                });
                            }
                        }
                    }
                } else {
                    // Standalone restricted slice without `bat:batteryCategory`, but containing subgroup-only properties
                    for (const [tier, triggerTerm] of impliedSubgroupTiers.entries()) {
                        const hasAnySubgroupForTier = ['evb', 'ind', 'lmt'].some((sub) =>
                            claimedSpecs.includes(
                                `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/${sub}/1.0.0/${tier}`
                            )
                        );
                        if (!hasAnySubgroupForTier) {
                            findings.push({
                                stage: 'IMPLIED_SPECIFICATION',
                                code: 'SEM-MSG-009',
                                path: '/contentSpecificationIds',
                                message: `Root passport node contains subgroup-specific ${tier.toUpperCase()} property (${triggerTerm}), so contentSpecificationIds must include the applicable subgroup specification (.../subgroup/{evb|lmt|ind}/1.0.0/${tier}).`
                            });
                        }
                    }
                }

                // 3b. Merged SHACL Core validation
                if (shacl) {
                    shaclExecuted = true;
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

                    if (usesEcSpec && !hasEcDppNode) {
                        findings.push({
                            stage: 'SHACL',
                            code: 'SEM-CORE-TYPE-MISSING',
                            path: '/type',
                            message: 'No rdf:type dpp:DigitalProductPassport node produced after JSON-LD expansion.'
                        });
                    }

                    const activeShaclValidator =
                        isRestrictedSliceCandidate && !impliedBaseTiers.has('pub')
                            ? sliceShaclValidator
                            : shaclValidator;
                    const shaclReport = await activeShaclValidator.validate(dataDataset);
                    if (!shaclReport.conforms) {
                        for (const res of shaclReport.results) {
                            const msg = res.message?.map((m) => m.value).join('; ') || 'SHACL constraint violation';
                            const codeMatch = msg.match(/^(SEM-[A-Z0-9-]+)/);
                            findings.push({
                                stage: 'SHACL',
                                ...(res.sourceShape?.value ? { schemaId: res.sourceShape.value } : {}),
                                ...(codeMatch ? { code: codeMatch[1] } : {}),
                                ...(res.path?.value ? { path: res.path.value } : {}),
                                message: msg
                            });
                        }
                    }
                }
            } catch (err) {
                findings.push({
                    stage: 'JSON_LD_EXPANSION',
                    message: err.message
                });
            }
        }

        const conforms = findings.length === 0;
        return {
            statusCode: conforms ? 200 : 422,
            report: {
                conforms,
                ...(typeof payload.digitalProductPassportId === 'string'
                    ? { digitalProductPassportId: payload.digitalProductPassportId }
                    : {}),
                ...(typeof payload.uniqueProductIdentifier === 'string'
                    ? { uniqueProductIdentifier: payload.uniqueProductIdentifier }
                    : {}),
                activatedSpecifications,
                unrecognizedSpecifications,
                shaclValidated: shaclExecuted,
                findings
            }
        };
    }

    return {
        recognizedSpecs,
        validationApiDoc,
        validatePayload
    };
}

function renderSwaggerUiHtml(port) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DPP OpenAPI 3.1 Explorer & Live Layered Validator</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .banner {
      background: #0f172a; color: #f8fafc; padding: 10px 20px;
      font-family: system-ui, -apple-system, sans-serif; font-size: 14px;
      display: flex; justify-content: space-between; align-items: center;
    }
    .banner code { background: #1e293b; padding: 2px 6px; border-radius: 4px; color: #38bdf8; }
  </style>
</head>
<body>
  <div class="banner">
    <div><strong>DPP OpenAPI 3.1 Suite</strong> — Switch contracts in the top-right dropdown. <code>POST /v1/dpps/validate</code> &amp; <code>GET /v1/specifications</code> execute live against Ajv 2020-12 + 18 SHACL graphs on port ${port}.</div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        urls: [
          { url: '/openapi/example-dpp-validation-api.yml', name: '1. DPP Layered Validation API (Live Try-It-Out)' },
          { url: '/openapi/openapi-dpp-registry-public.yml', name: '2. EC DPP Registry Service API' },
          { url: '/openapi/openapi-dpp-dashboard-public.yml', name: '3. EC DPP Activity Dashboard API' },
          { url: '/openapi/openapi-dpp-common-public.yml', name: '4. EC DPP Common Components' }
        ],
        'urls.primaryName': '1. DPP Layered Validation API (Live Try-It-Out)',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: 'StandaloneLayout'
      });
    };
  </script>
</body>
</html>`;
}

export async function startServer(port = Number(process.env.PORT || 3000)) {
    const engine = await createValidationEngine();

    const specFiles = {
        '/openapi/example-dpp-validation-api.yml': path.join(PROJECT_ROOT, 'src/examples/openapi/example-dpp-validation-api.yml'),
        '/openapi/openapi-dpp-common-public.yml': path.join(EC_OPENAPI_ROOT, 'openapi-dpp-common-public.yml'),
        '/openapi/openapi-dpp-registry-public.yml': path.join(EC_OPENAPI_ROOT, 'openapi-dpp-registry-public.yml'),
        '/openapi/openapi-dpp-dashboard-public.yml': path.join(EC_OPENAPI_ROOT, 'openapi-dpp-dashboard-public.yml')
    };

    const server = http.createServer(async (req, res) => {
        const correlationId = req.headers['x-correlation-id'] || `corr_${crypto.randomUUID().slice(0, 12)}`;
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Correlation-Id');
        res.setHeader('X-Correlation-Id', correlationId);

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const reqUrl = new URL(req.url || '/', `http://${req.headers.host || `localhost:${port}`}`);

        if (req.method === 'GET' && (reqUrl.pathname === '/' || reqUrl.pathname === '/docs')) {
            const actualPort = server.address()?.port || port;
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(renderSwaggerUiHtml(actualPort));
            return;
        }

        if (req.method === 'GET' && specFiles[reqUrl.pathname]) {
            let raw = await fs.readFile(specFiles[reqUrl.pathname], 'utf-8');
            if (reqUrl.pathname === '/openapi/example-dpp-validation-api.yml') {
                const actualPort = server.address()?.port || port;
                raw = raw.replace('http://localhost:3000', `http://localhost:${actualPort}`);
            }
            res.writeHead(200, { 'Content-Type': 'application/yaml; charset=utf-8' });
            res.end(raw);
            return;
        }

        if (req.method === 'GET' && reqUrl.pathname === '/v1/specifications') {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ specifications: engine.recognizedSpecs }, null, 2));
            return;
        }

        if (req.method === 'POST' && reqUrl.pathname === '/v1/dpps/validate') {
            const chunks = [];
            for await (const chunk of req) chunks.push(chunk);
            const bodyText = Buffer.concat(chunks).toString('utf-8');

            let parsedBody;
            try {
                parsedBody = JSON.parse(bodyText);
            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                res.end(JSON.stringify({ status: 400, code: 'MALFORMED_JSON', message: err.message }, null, 2));
                return;
            }

            const requiredSpecs = reqUrl.searchParams
                .getAll('requireSpecificationId')
                .flatMap((v) => v.split(','))
                .map((v) => v.trim())
                .filter(Boolean);
            const shaclParam = reqUrl.searchParams.get('shacl');
            const shacl = shaclParam === null ? true : shaclParam !== 'false';

            const result = await engine.validatePayload(parsedBody, {
                requiredSpecs,
                shacl
            });
            res.writeHead(result.statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify(result.report || result.error, null, 2));
            return;
        }

        res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ status: 404, code: 'NOT_FOUND', message: `Unknown route ${req.method} ${reqUrl.pathname}` }));
    });

    await new Promise((resolve) => server.listen(port, '127.0.0.1', resolve));
    return { server, engine, port: server.address().port };
}

async function runSelfTest() {
    const { server, engine, port } = await startServer(0);
    try {
        const examples =
            engine.validationApiDoc.paths['/v1/dpps/validate'].post.requestBody.content['application/ld+json'].examples;

        for (const [name, ex] of Object.entries(examples)) {
            const resp = await fetch(`http://127.0.0.1:${port}/v1/dpps/validate?shacl=true`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/ld+json' },
                body: JSON.stringify(ex.value)
            });
            const report = await resp.json();
            if (resp.status !== 200 || !report.conforms) {
                throw new Error(`Self-test failed on ${name}: HTTP ${resp.status} ${JSON.stringify(report)}`);
            }
            console.log(`  ✅ Live HTTP POST /v1/dpps/validate passed for example "${name}" (activated: ${report.activatedSpecifications.length} specs)`);
        }

        // 1. Bare Core-header-only ("empty") DPP with zero product-sector specifications is rejected
        const bareCorePath = path.join(EC_SEMANTICS_ROOT, 'core/1.0.0/tests/conforms/core.json');
        const bareCoreDpp = JSON.parse(await fs.readFile(bareCorePath, 'utf-8'));
        const bareCoreResp = await fetch(`http://127.0.0.1:${port}/v1/dpps/validate?shacl=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/ld+json' },
            body: JSON.stringify(bareCoreDpp)
        });
        const bareCoreReport = await bareCoreResp.json();
        if (
            bareCoreResp.status !== 422 ||
            !bareCoreReport.findings.some((f) => f.stage === 'IMPLIED_SPECIFICATION' && f.code === 'SEM-MSG-009')
        ) {
            throw new Error(`Self-test expected IMPLIED_SPECIFICATION 422 on bare Core-only DPP, got ${bareCoreResp.status}`);
        }
        console.log('  ✅ Live HTTP POST /v1/dpps/validate rejected bare Core-only empty DPP lacking any sector contentSpecificationId (HTTP 422)');

        // 2. Collaborator catch: EV Battery passport with `batteryCategory` omitting battery lines from `contentSpecificationIds`
        const omittedBatterySpecDpp = structuredClone(examples.evBatteryPublicDpp.value);
        omittedBatterySpecDpp.contentSpecificationIds = [EC_CORE_SPEC_ID, 'urn:example:sector:other:1.0'];
        const omittedResp = await fetch(`http://127.0.0.1:${port}/v1/dpps/validate?shacl=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/ld+json' },
            body: JSON.stringify(omittedBatterySpecDpp)
        });
        const omittedReport = await omittedResp.json();
        if (
            omittedResp.status !== 422 ||
            !omittedReport.findings.some(
                (f) =>
                    f.stage === 'IMPLIED_SPECIFICATION' &&
                    f.specificationId === 'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/pub'
            ) ||
            !omittedReport.findings.some(
                (f) =>
                    f.stage === 'IMPLIED_SPECIFICATION' &&
                    f.specificationId === 'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/evb/1.0.0/pub'
            )
        ) {
            throw new Error(`Self-test expected IMPLIED_SPECIFICATION 422 on omitted battery spec ID, got ${omittedResp.status}: ${JSON.stringify(omittedReport)}`);
        }
        console.log('  ✅ Live HTTP POST /v1/dpps/validate rejected battery passport missing battery contentSpecificationIds (IMPLIED_SPECIFICATION 422)');

        // 3. Partial dynamic data catch: `numberOfChargingCycles` present without `/res3` specification IDs
        const partialDynamicDpp = structuredClone(examples.evBatteryPublicDpp.value);
        partialDynamicDpp.numberOfChargingCycles = 42;
        const partialDynResp = await fetch(`http://127.0.0.1:${port}/v1/dpps/validate?shacl=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/ld+json' },
            body: JSON.stringify(partialDynamicDpp)
        });
        const partialDynReport = await partialDynResp.json();
        if (
            partialDynResp.status !== 422 ||
            !partialDynReport.findings.some(
                (f) =>
                    f.stage === 'IMPLIED_SPECIFICATION' &&
                    f.specificationId === 'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/res3'
            )
        ) {
            throw new Error(`Self-test expected IMPLIED_SPECIFICATION 422 on undeclared RES3 dynamic field, got ${partialDynResp.status}`);
        }
        console.log('  ✅ Live HTTP POST /v1/dpps/validate rejected undeclared RES3 dynamic telemetry without /res3 spec ID (IMPLIED_SPECIFICATION 422)');

        // 4. Standalone restricted BMS slice (`res3-batteries-evb.json`) validates cleanly
        const res3SlicePath = path.join(
            EC_SEMANTICS_ROOT,
            'product/batteries/subgroup/evb/1.0.0/tests/conforms/res3-batteries-evb.json'
        );
        const res3Slice = JSON.parse(await fs.readFile(res3SlicePath, 'utf-8'));
        const res3SliceResp = await fetch(`http://127.0.0.1:${port}/v1/dpps/validate?shacl=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/ld+json' },
            body: JSON.stringify(res3Slice)
        });
        const res3SliceReport = await res3SliceResp.json();
        if (res3SliceResp.status !== 200 || !res3SliceReport.conforms) {
            throw new Error(`Self-test expected HTTP 200 on standalone RES3 slice, got ${res3SliceResp.status}: ${JSON.stringify(res3SliceReport)}`);
        }
        console.log('  ✅ Live HTTP POST /v1/dpps/validate accepted standalone EVB RES3 dynamic slice (HTTP 200)');

        // 5. Verify explicit requireSpecificationId audit rejection when RES2 is mandated but omitted
        const auditResp = await fetch(
            `http://127.0.0.1:${port}/v1/dpps/validate?requireSpecificationId=${encodeURIComponent('https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/res2')}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/ld+json' },
                body: JSON.stringify(examples.evBatteryPublicDpp.value)
            }
        );
        const auditReport = await auditResp.json();
        if (auditResp.status !== 422 || auditReport.conforms !== false) {
            throw new Error(`Self-test expected HTTP 422 when mandatory RES2 spec is omitted, got ${auditResp.status}`);
        }
        console.log('  ✅ Live HTTP POST /v1/dpps/validate?requireSpecificationId=... rejected omitted RES2 tier (HTTP 422)');
    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

if (path.resolve(process.argv[1] || '') === path.resolve(__filename)) {
    if (process.argv.includes('--self-test')) {
        runSelfTest().catch((err) => {
            console.error(err);
            process.exit(1);
        });
    } else {
        startServer().then(({ port }) => {
            console.log(`🚀 DPP OpenAPI 3.1 Explorer & Layered Validator listening at http://localhost:${port}`);
            console.log(`   • Interactive Swagger UI (all 4 specs): http://localhost:${port}/`);
            console.log(`   • Live specification catalog:           http://localhost:${port}/v1/specifications`);
            console.log(`   • Live DPP validation endpoint:         POST http://localhost:${port}/v1/dpps/validate`);
        });
    }
}
