import { promises as fs, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';

import { KEYSTONE_VERSION, KNOWN_VERSIONS } from '../../../src/lib/keystone-version.js';
import { transform, buildDictionary } from '../../../src/util/js/common/transformation/dpp-schema-logic.js';
import { createServerDocumentLoader } from './server-resource-loader.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

const EC_UNIT_BASE = 'https://repository.product-passport.ec.europa.eu/core/vocabs/measurement-unit#';
const EC_OBS_CHAR_TEMP = 'https://repository.product-passport.ec.europa.eu/core/vocabs/observed-characteristic#temperature';

const LANG_TO_LOCALE = {
    bg: 'bg-BG', cs: 'cs-CZ', da: 'da-DK', de: 'de-DE', el: 'el-GR',
    en: 'en-GB', es: 'es-ES', et: 'et-EE', fi: 'fi-FI', fr: 'fr-FR',
    ga: 'ga-IE', hr: 'hr-HR', hu: 'hu-HU', it: 'it-IT', lt: 'lt-LT',
    lv: 'lv-LV', mt: 'mt-MT', nl: 'nl-NL', pl: 'pl-PL', pt: 'pt-PT',
    ro: 'ro-RO', sk: 'sk-SK', sl: 'sl-SI', sv: 'sv-SE'
};

const RAW_UNIT_FIELDS = {
    batteryWeight: 'kilogram',
    batteryCapacity: 'ampereHour',
    ratedCapacity: 'ampereHour',
    remainingCapacity: 'ampereHour',
    renewableContentShare: 'percent',
    capacityExhaustionThreshold: 'percent',
    initialRoundTripEnergyEfficiency: 'percent',
    roundTripEfficiencyAtHalfCycleLife: 'percent',
    roundTripEnergyEfficiency: 'percent',
    roundTripEnergyEfficiencyFade: 'percent',
    remainingRoundTripEfficiency: 'percent',
    capacityFade: 'percent',
    powerFade: 'percent',
    internalResistanceIncrease: 'percent',
    stateOfCertifiedEnergy: 'percent',
    originalPowerCapability: 'watt',
    powerCapability: 'watt',
    remainingPowerCapability: 'watt',
    internalCellResistance: 'ohm',
    internalPackResistance: 'ohm',
    internalResistance: 'ohm',
    ohmicResistance: 'ohm',
    cycleLifeChargeCRate: 'reciprocalHour',
    cycleLifeDischargeCRate: 'reciprocalHour'
};

const ALLOWED_RAW_EC_ROOT_KEYS = new Set([
    '@context', '@id', '@type',
    'digitalProductPassportId', 'uniqueProductIdentifier', 'granularity',
    'dppStatus', 'lastUpdate', 'contentSpecificationIds',
    'registrantIdentity', 'manufacturerIdentification', 'manufacturerPostalAddress',
    'manufacturerContactDetails', 'batteryCategory', 'batteryIdentification',
    'manufacturingPlace', 'manufacturingDate', 'batteryWeight', 'batteryCapacity',
    'batteryChemistry', 'hazardousSubstances', 'extinguishingAgent',
    'criticalRawMaterials', 'renewableContentShare',
    'minimalVoltage', 'minimalVoltageMinTemp', 'minimalVoltageMaxTemp',
    'nominalVoltage', 'nominalVoltageMinTemp', 'nominalVoltageMaxTemp',
    'maximumVoltage', 'maximumVoltageMinTemp', 'maximumVoltageMaxTemp',
    'originalPowerCapability', 'powerLimit', 'powerLimitMinTemp', 'powerLimitMaxTemp',
    'notInUseTemperatureRange', 'commercialWarrantyPeriod',
    'internalCellResistance', 'internalPackResistance', 'cycleLifeDischargeCRate',
    'separateCollectionSymbol', 'chemicalSymbol', 'euDeclarationOfConformity',
    'wasteBatteryPreventionManagementInfo',
    'expectedLifetimeCycles', 'cycleLifeReferenceTest', 'capacityExhaustionThreshold',
    'initialRoundTripEnergyEfficiency', 'roundTripEfficiencyAtHalfCycleLife', 'cycleLifeChargeCRate',
    'detailedComposition', 'sparePartReplacementDetails', 'dismantlingInformation', 'safetyMeasures',
    'complianceTestReportResults',
    'roundTripEnergyEfficiency', 'roundTripEnergyEfficiencyFade', 'batteryStatus',
    'numberOfChargingCycles', 'numberOfDischargingCycles', 'negativeEvents',
    'environmentalConditionHistogramSet', 'stateOfChargeHistogram',
    'ratedCapacity', 'capacityFade', 'powerCapability', 'powerFade',
    'internalResistance', 'internalResistanceIncrease', 'expectedLifetimeCyclesRest',
    'expectedLifetimeYears', 'stateOfCertifiedEnergy', 'remainingCapacity',
    'remainingPowerCapability', 'remainingRoundTripEfficiency', 'selfDischargingRateSet',
    'ohmicResistance'
]);

const RELATED_RESOURCE_KEYS = [
    'euDeclarationOfConformity',
    'sparePartReplacementDetails',
    'dismantlingInformation',
    'safetyMeasures',
    'complianceTestReportResults'
];

const dictionaryCache = new Map();

function normalizeRawLocale(tag) {
    if (!tag || typeof tag !== 'string') return 'en-GB';
    const trimmed = tag.trim();
    if (/^[A-Za-z]{2}-[A-Za-z]{2}$/.test(trimmed)) return trimmed;
    const base = trimmed.split('-')[0].toLowerCase();
    return LANG_TO_LOCALE[base] || `${base}-${base.toUpperCase()}`;
}

function convertMultiLanguageToRaw(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === 'string' && v.length > 0) {
            out[normalizeRawLocale(k)] = v;
        }
    }
    return out;
}

function prefixVocabUri(value, baseUri) {
    if (typeof value !== 'string') return value;
    if (value.startsWith('http://') || value.startsWith('https://')) return value;
    return `${baseUri}${value}`;
}

function sanitizeRawRelatedResource(res, warnings, fieldName) {
    let item = res;
    if (Array.isArray(res)) {
        if (res.length > 1) {
            warnings.push(`Raw EC v1.0.0 only allows a single RelatedResource for '${fieldName}'; truncated ${res.length} items to 1.`);
        }
        item = res[0];
    }
    if (!item || typeof item !== 'object') return item;
    const clean = {
        contentType: item.contentType || 'application/octet-stream',
        url: item.url
    };
    if (item.resourceTitle) clean.resourceTitle = item.resourceTitle;
    if (item.language) clean.language = normalizeRawLocale(item.language);
    return clean;
}

function detectSubgroupFromPayload(ecPayload, explicitSubgroup) {
    if (explicitSubgroup && ['evb', 'ind', 'lmt'].includes(explicitSubgroup)) {
        return explicitSubgroup;
    }
    const cat = String(ecPayload.batteryCategory || '').toLowerCase();
    if (cat.includes('electricvehicle')) return 'evb';
    if (cat.includes('lightmeansoftransport')) return 'lmt';
    if (cat.includes('industrial')) return 'ind';
    const specs = Array.isArray(ecPayload.contentSpecificationIds) ? ecPayload.contentSpecificationIds : [];
    for (const id of specs) {
        if (typeof id !== 'string') continue;
        if (id.includes('/subgroup/evb/')) return 'evb';
        if (id.includes('/subgroup/lmt/')) return 'lmt';
        if (id.includes('/subgroup/ind/')) return 'ind';
    }
    return 'evb';
}

/**
 * Converts a patched EC Battery DPP payload into the unmodified official EC v1.0.0 format.
 */
export function convertPatchedEcToRawEc(patchedPayload, options = {}) {
    const raw = structuredClone(patchedPayload);
    const warnings = [];
    const droppedFields = [];

    const subgroup = detectSubgroupFromPayload(raw, options.subgroup);

    // 1. JSON-LD framing: raw EC uses a single subgroup context and @type (not aliased `type`/`id`)
    raw['@context'] = `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/${subgroup}/1.0.0/contexts/${subgroup}-context.jsonld`;
    if (raw.id && !raw['@id']) {
        raw['@id'] = raw.id;
    }
    delete raw.id;
    delete raw.type;
    raw['@type'] = 'dpp:DigitalProductPassport';

    // 2. contentSpecificationIds: strip /pub, /res1, /res2, /res3 and non-EC URNs
    raw.contentSpecificationIds = [
        'https://repository.product-passport.ec.europa.eu/core/1.0.0',
        'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0',
        `https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/${subgroup}/1.0.0`
    ];

    // 3. Drop all non-EC properties (Keystone federated extensions & custom voluntary attributes)
    // because unmodified EC v1.0.0 uses `@protected: true` and `@vocab: unknown#` in SHACL.
    for (const key of Object.keys(raw)) {
        if (!ALLOWED_RAW_EC_ROOT_KEYS.has(key)) {
            delete raw[key];
            droppedFields.push(key);
        }
    }
    if (droppedFields.length > 0) {
        warnings.push(
            `Dropped ${droppedFields.length} non-EC/voluntary field(s) not recognized by unmodified EC v1.0.0: ${droppedFields.join(', ')}.`
        );
    }

    // 4. Controlled vocabularies -> full URIs
    if (raw.granularity) {
        raw.granularity = prefixVocabUri(raw.granularity, 'https://repository.product-passport.ec.europa.eu/core/vocabs/granularity-level#');
    }
    if (raw.dppStatus) {
        raw.dppStatus = prefixVocabUri(raw.dppStatus, 'https://repository.product-passport.ec.europa.eu/core/vocabs/instance-status#');
    }
    if (raw.batteryCategory) {
        raw.batteryCategory = prefixVocabUri(raw.batteryCategory, 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-category#');
    }
    if (Array.isArray(raw.batteryChemistry)) {
        raw.batteryChemistry = raw.batteryChemistry.map((c) =>
            prefixVocabUri(c, 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-chemistry#')
        );
    }
    if (Array.isArray(raw.criticalRawMaterials)) {
        raw.criticalRawMaterials = raw.criticalRawMaterials.map((c) =>
            prefixVocabUri(c, 'https://repository.product-passport.ec.europa.eu/core/vocabs/critical-raw-material#')
        );
    } else {
        raw.criticalRawMaterials = [];
    }
    if (!Array.isArray(raw.hazardousSubstances)) {
        raw.hazardousSubstances = [];
    }
    if (Array.isArray(raw.chemicalSymbol)) {
        raw.chemicalSymbol = raw.chemicalSymbol.map((c) =>
            prefixVocabUri(c, 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-chemical-symbol#')
        );
    }
    if (raw.batteryStatus) {
        raw.batteryStatus = prefixVocabUri(raw.batteryStatus, 'https://repository.product-passport.ec.europa.eu/product/batteries/vocabs/battery-status#');
    }

    // 5. multiLanguage maps -> xx-YY locale keys
    for (const mlKey of ['extinguishingAgent', 'cycleLifeReferenceTest', 'detailedComposition', 'negativeEvents']) {
        if (raw[mlKey]) {
            raw[mlKey] = convertMultiLanguageToRaw(raw[mlKey]);
        }
    }
    if (raw.wasteBatteryPreventionManagementInfo && typeof raw.wasteBatteryPreventionManagementInfo === 'object') {
        for (const [k, v] of Object.entries(raw.wasteBatteryPreventionManagementInfo)) {
            raw.wasteBatteryPreventionManagementInfo[k] = convertMultiLanguageToRaw(v);
        }
    }

    // 6. Quantitative scalars -> { value, unit } wrappers
    for (const [field, unitName] of Object.entries(RAW_UNIT_FIELDS)) {
        if (typeof raw[field] === 'number') {
            raw[field] = {
                value: raw[field],
                unit: `${EC_UNIT_BASE}${unitName}`
            };
        }
    }

    // 7. Voltages -> unitValueWithRange with required valueRange
    const defaultMinTemp = raw.notInUseTemperatureRange?.lowerBound ?? -20;
    const defaultMaxTemp = raw.notInUseTemperatureRange?.upperBound ?? 60;
    for (const vKey of ['minimalVoltage', 'nominalVoltage', 'maximumVoltage']) {
        const minKey = `${vKey}MinTemp`;
        const maxKey = `${vKey}MaxTemp`;
        if (typeof raw[vKey] === 'number') {
            const lowerBound = typeof raw[minKey] === 'number' ? raw[minKey] : defaultMinTemp;
            const upperBound = typeof raw[maxKey] === 'number' ? raw[maxKey] : defaultMaxTemp;
            raw[vKey] = {
                value: raw[vKey],
                unit: `${EC_UNIT_BASE}volt`,
                valueRange: {
                    observedCharacteristic: EC_OBS_CHAR_TEMP,
                    lowerBound,
                    upperBound,
                    unit: `${EC_UNIT_BASE}degreeCelsius`
                }
            };
        }
        delete raw[minKey];
        delete raw[maxKey];
    }

    // 8. powerLimit -> array of unitValueWithRange
    if (typeof raw.powerLimit === 'number') {
        const entry = {
            value: raw.powerLimit,
            unit: `${EC_UNIT_BASE}watt`
        };
        if (typeof raw.powerLimitMinTemp === 'number' && typeof raw.powerLimitMaxTemp === 'number') {
            entry.valueRange = {
                observedCharacteristic: EC_OBS_CHAR_TEMP,
                lowerBound: raw.powerLimitMinTemp,
                upperBound: raw.powerLimitMaxTemp,
                unit: `${EC_UNIT_BASE}degreeCelsius`
            };
        }
        raw.powerLimit = [entry];
    }
    delete raw.powerLimitMinTemp;
    delete raw.powerLimitMaxTemp;

    // 9. notInUseTemperatureRange -> nest lowerBound/upperBound inside valueRange
    if (raw.notInUseTemperatureRange && typeof raw.notInUseTemperatureRange === 'object') {
        const range = raw.notInUseTemperatureRange;
        raw.notInUseTemperatureRange = {
            notInUseTemperatureRangeTest: convertMultiLanguageToRaw(
                range.notInUseTemperatureRangeTest || { en: 'Standard operating temperature range' }
            ),
            valueRange: {
                observedCharacteristic: EC_OBS_CHAR_TEMP,
                lowerBound: range.lowerBound ?? -20,
                upperBound: range.upperBound ?? 60,
                unit: `${EC_UNIT_BASE}degreeCelsius`
            }
        };
    }

    // 10. manufacturerContactDetails.manufacturerEmail -> mailto: URI
    if (raw.manufacturerContactDetails?.manufacturerEmail) {
        const email = raw.manufacturerContactDetails.manufacturerEmail;
        if (typeof email === 'string' && !email.includes('://') && !email.startsWith('mailto:')) {
            raw.manufacturerContactDetails.manufacturerEmail = `mailto:${email}`;
        }
    }

    // 11. RelatedResources -> single object with additionalProperties: false
    for (const rrKey of RELATED_RESOURCE_KEYS) {
        if (raw[rrKey] !== undefined) {
            raw[rrKey] = sanitizeRawRelatedResource(raw[rrKey], warnings, rrKey);
        }
    }

    // 12. Cycle counters -> integer arrays; expectedLifetimeCyclesRest -> minimum 1
    if (typeof raw.numberOfChargingCycles === 'number') {
        raw.numberOfChargingCycles = [raw.numberOfChargingCycles];
    }
    if (typeof raw.numberOfDischargingCycles === 'number') {
        raw.numberOfDischargingCycles = [raw.numberOfDischargingCycles];
    }
    if (typeof raw.expectedLifetimeCyclesRest === 'number' && raw.expectedLifetimeCyclesRest < 1) {
        raw.expectedLifetimeCyclesRest = 1;
        warnings.push('Raw EC v1.0.0 requires expectedLifetimeCyclesRest >= 1; clamped 0 to 1.');
    }

    // 13. selfDischargingRateSet -> raw object { selfDischargingRate: [unitValue], recordedTime }
    if (Array.isArray(raw.selfDischargingRateSet) && raw.selfDischargingRateSet.length > 0) {
        const first = raw.selfDischargingRateSet[0];
        raw.selfDischargingRateSet = {
            selfDischargingRate: [
                {
                    value: first.selfDischargingRate,
                    unit: `${EC_UNIT_BASE}percentPerYear`
                }
            ],
            recordedTime: first.recordedTime || raw.lastUpdate
        };
        warnings.push(
            'Raw EC v1.0.0 lacks percentPerMonth in measurement-unit and uses disconnected selfDischargingRateSet arrays; mapped using percentPerYear.'
        );
    }

    return { payload: raw, warnings, droppedFields, subgroup };
}

function detectKeystoneVersion(dppData, explicitVersion) {
    if (explicitVersion && KNOWN_VERSIONS.includes(explicitVersion)) {
        return explicitVersion;
    }
    const ctxList = Array.isArray(dppData['@context']) ? dppData['@context'] : [dppData['@context']];
    for (const c of ctxList) {
        if (typeof c === 'string') {
            const match = c.match(/\/contexts\/(v\d+)\//);
            if (match && KNOWN_VERSIONS.includes(match[1])) {
                return match[1];
            }
        }
    }
    const specs = Array.isArray(dppData.contentSpecificationIds) ? dppData.contentSpecificationIds : [];
    for (const s of specs) {
        if (typeof s === 'string') {
            const match = s.match(/^urn:dpp-keystone:(v\d+):/);
            if (match && KNOWN_VERSIONS.includes(match[1])) {
                return match[1];
            }
        }
    }
    return KEYSTONE_VERSION;
}

async function getOntologyDictionary(version, documentLoader) {
    if (dictionaryCache.has(version)) return dictionaryCache.get(version);

    const distPath = path.join(PROJECT_ROOT, `dist/spec/ontology/${version}/dpp-ontology.jsonld`);
    const srcPath = path.join(PROJECT_ROOT, `src/ontology/${version}/dpp-ontology.jsonld`);
    const fallbackPath = path.join(PROJECT_ROOT, `src/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`);
    const ontologyPath = existsSync(distPath) ? distPath : (existsSync(srcPath) ? srcPath : fallbackPath);

    const loader = async (filePath) => {
        const raw = await fs.readFile(filePath, 'utf-8');
        return jsoncParse(raw.replace(/\{\{VERSION\}\}/g, version));
    };

    const dictionary = {};
    await buildDictionary([ontologyPath], loader, documentLoader, dictionary, version);
    dictionaryCache.set(version, dictionary);
    return dictionary;
}

/**
 * Adapts a Keystone Battery DPP payload (v3 or earlier Keystone versions) into an EC Battery DPP
 * targeting either `patched` (`ec-bundle/`) or `raw` (`ec-bundle-raw/`).
 *
 * @param {object} keystoneDpp - Input Keystone Battery DPP JSON/JSON-LD object.
 * @param {object} [options={}]
 * @param {'patched' | 'raw'} [options.target='patched']
 * @param {string} [options.sourceVersion] - Optional Keystone version override (e.g. 'v3', 'v2', 'v1').
 * @param {'evb' | 'ind' | 'lmt'} [options.subgroup] - Optional battery subgroup override.
 */
export async function adaptKeystoneToEcBattery(keystoneDpp, options = {}) {
    const target = options.target || 'patched';
    if (!['patched', 'raw'].includes(target)) {
        throw Object.assign(new Error(`Invalid target '${target}'. Allowed values: 'patched', 'raw'.`), {
            statusCode: 400,
            code: 'INVALID_TARGET'
        });
    }
    if (!keystoneDpp || typeof keystoneDpp !== 'object' || Array.isArray(keystoneDpp)) {
        throw Object.assign(new Error('Invalid request: DPP payload must be a non-null JSON object.'), {
            statusCode: 400,
            code: 'INVALID_REQUEST'
        });
    }

    const detectedVersion = detectKeystoneVersion(keystoneDpp, options.sourceVersion);
    // Use v3 local ontology/context when older versions are not present locally on disk
    const localContextExists = existsSync(path.join(PROJECT_ROOT, `src/contexts/${detectedVersion}/dpp-battery.context.jsonld`))
        || existsSync(path.join(PROJECT_ROOT, `dist/spec/contexts/${detectedVersion}/dpp-battery.context.jsonld`));
    const effectiveVersion = localContextExists ? detectedVersion : KEYSTONE_VERSION;

    const dppForTransform = structuredClone(keystoneDpp);
    const warnings = [];
    if (effectiveVersion !== detectedVersion) {
        warnings.push(`Keystone ${detectedVersion} ontology/context not bundled locally; adapted using ${effectiveVersion} semantics.`);
    }

    const keystoneBatteryContext = `https://dpp-keystone.org/spec/contexts/${effectiveVersion}/dpp-battery.context.jsonld`;
    if (!dppForTransform['@context']) {
        dppForTransform['@context'] = keystoneBatteryContext;
    } else {
        const rawContexts = Array.isArray(dppForTransform['@context'])
            ? dppForTransform['@context']
            : [dppForTransform['@context']];
        const normalizedContexts = rawContexts
            .filter((c) => !(typeof c === 'string' && c.startsWith('https://repository.product-passport.ec.europa.eu/')))
            .map((c) => typeof c === 'string' ? c.replace(/\/contexts\/v\d+\//, `/contexts/${effectiveVersion}/`).replace(/\{\{VERSION\}\}/g, effectiveVersion) : c);
        if (!normalizedContexts.some((c) => typeof c === 'string' && c.includes('dpp-battery.context.jsonld'))) {
            normalizedContexts.push(keystoneBatteryContext);
        }
        dppForTransform['@context'] = normalizedContexts.length === 1 ? normalizedContexts[0] : normalizedContexts;
    }

    if (!dppForTransform.digitalProductPassportId && dppForTransform.id) {
        dppForTransform.digitalProductPassportId = dppForTransform.id;
    }

    const documentLoader = createServerDocumentLoader(effectiveVersion);
    const dictionary = await getOntologyDictionary(effectiveVersion, documentLoader);

    const transformed = await transform(
        dppForTransform,
        {
            profile: 'ec-battery',
            documentLoader,
            version: effectiveVersion
        },
        dictionary
    );

    const patchedPayload = Array.isArray(transformed) && transformed.length === 1 ? transformed[0] : transformed;

    if (target === 'patched') {
        const subgroup = detectSubgroupFromPayload(patchedPayload, options.subgroup);
        return {
            target: 'patched',
            sourceVersion: detectedVersion,
            subgroup,
            adaptedDpp: patchedPayload,
            warnings,
            droppedFields: []
        };
    }

    const rawResult = convertPatchedEcToRawEc(patchedPayload, { subgroup: options.subgroup });
    return {
        target: 'raw',
        sourceVersion: detectedVersion,
        subgroup: rawResult.subgroup,
        adaptedDpp: rawResult.payload,
        warnings: [...warnings, ...rawResult.warnings],
        droppedFields: rawResult.droppedFields
    };
}
