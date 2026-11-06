const EC_CORE_SPEC_ID = 'https://repository.product-passport.ec.europa.eu/core/1.0.0';
const EC_BATTERIES_SPEC_BASE = 'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0';
const EC_CORE_CONTEXT = 'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld';
const EC_BATTERIES_CONTEXT = 'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld';

const SUBGROUP_SPEC_BASES = {
    evb: 'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/evb/1.0.0',
    lmt: 'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/lmt/1.0.0',
    ind: 'https://repository.product-passport.ec.europa.eu/product/batteries/subgroup/ind/1.0.0'
};

const EC_CRITICAL_RAW_MATERIALS = new Set([
    'antimony', 'arsenic', 'bauxiteAluminaAluminium', 'baryte', 'beryllium',
    'bismuth', 'boron', 'cobalt', 'cokingCoal', 'copper', 'feldspar',
    'fluorspar', 'gallium', 'germanium', 'hafnium', 'helium',
    'heavyRareEarthElements', 'lightRareEarthElements', 'lithium', 'magnesium',
    'manganese', 'graphite', 'nickelBatteryGrade', 'niobium', 'phosphateRock',
    'phosphorus', 'platinumGroupMetals', 'scandium', 'siliconMetal',
    'strontium', 'tantalum', 'titaniumMetal', 'tungsten', 'vanadium'
]);

const CRM_SYNONYMS = {
    aluminum: 'bauxiteAluminaAluminium',
    aluminium: 'bauxiteAluminaAluminium',
    bauxite: 'bauxiteAluminaAluminium',
    alumina: 'bauxiteAluminaAluminium',
    nickel: 'nickelBatteryGrade',
    silicon: 'siliconMetal',
    titanium: 'titaniumMetal',
    phosphate: 'phosphateRock',
    'coking coal': 'cokingCoal',
    'heavy rare earth': 'heavyRareEarthElements',
    'light rare earth': 'lightRareEarthElements',
    'rare earth': 'lightRareEarthElements',
    pgm: 'platinumGroupMetals',
    platinum: 'platinumGroupMetals'
};

const CHEMISTRY_MAP = {
    lfp: 'lithiumIonLFP',
    lithiumionlfp: 'lithiumIonLFP',
    nmc: 'lithiumIonNMC',
    lithiumionnmc: 'lithiumIonNMC',
    nca: 'lithiumIonNCA',
    lithiumionnca: 'lithiumIonNCA',
    lmo: 'lithiumIonLMO',
    lithiumionlmo: 'lithiumIonLMO',
    lco: 'lithiumIonLCO',
    lithiumionlco: 'lithiumIonLCO',
    leadacid: 'leadAcid',
    'lead-acid': 'leadAcid',
    nicd: 'nickelCadmium',
    'ni-cd': 'nickelCadmium',
    nickelcadmium: 'nickelCadmium',
    nimh: 'nickelMetalHydride',
    'ni-mh': 'nickelMetalHydride',
    nickelmetalhydride: 'nickelMetalHydride',
    lithiummetal: 'lithiumMetal',
    sodiumion: 'sodiumIon',
    'na-ion': 'sodiumIon'
};

const COUNTRY_ALPHA3_MAP = {
    AT: 'AUT', AUSTRIA: 'AUT',
    BE: 'BEL', BELGIUM: 'BEL',
    BG: 'BGR', BULGARIA: 'BGR',
    CH: 'CHE', SWITZERLAND: 'CHE',
    CN: 'CHN', CHINA: 'CHN',
    CY: 'CYP', CYPRUS: 'CYP',
    CZ: 'CZE', CZECHIA: 'CZE', 'CZECH REPUBLIC': 'CZE',
    DE: 'DEU', GERMANY: 'DEU', DEUTSCHLAND: 'DEU',
    DK: 'DNK', DENMARK: 'DNK',
    EE: 'EST', ESTONIA: 'EST',
    ES: 'ESP', SPAIN: 'ESP',
    FI: 'FIN', FINLAND: 'FIN',
    FR: 'FRA', FRANCE: 'FRA',
    GB: 'GBR', UK: 'GBR', 'UNITED KINGDOM': 'GBR',
    GR: 'GRC', EL: 'GRC', GREECE: 'GRC',
    HR: 'HRV', CROATIA: 'HRV',
    HU: 'HUN', HUNGARY: 'HUN',
    IE: 'IRL', IRELAND: 'IRL',
    IT: 'ITA', ITALY: 'ITA',
    JP: 'JPN', JAPAN: 'JPN',
    KR: 'KOR', 'SOUTH KOREA': 'KOR', KOREA: 'KOR',
    LT: 'LTU', LITHUANIA: 'LTU',
    LU: 'LUX', LUXEMBOURG: 'LUX',
    LV: 'LVA', LATVIA: 'LVA',
    MT: 'MLT', MALTA: 'MLT',
    NL: 'NLD', NETHERLANDS: 'NLD',
    NO: 'NOR', NORWAY: 'NOR',
    PL: 'POL', POLAND: 'POL',
    PT: 'PRT', PORTUGAL: 'PRT',
    RO: 'ROU', ROMANIA: 'ROU',
    SE: 'SWE', SWEDEN: 'SWE',
    SI: 'SVN', SLOVENIA: 'SVN',
    SK: 'SVK', SLOVAKIA: 'SVK',
    US: 'USA', USA: 'USA', 'UNITED STATES': 'USA'
};

const getNode = (node, property) => node?.[property]?.[0];

const getStr = (node, property) => {
    const item = node?.[property]?.[0];
    if (!item) return undefined;
    const raw = item['@value'] ?? item['@id'];
    return raw !== undefined && raw !== null ? String(raw) : undefined;
};

const getNum = (node, property) => {
    const raw = node?.[property]?.[0]?.['@value'];
    if (raw === undefined || raw === null || raw === '') return undefined;
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
};

const roundMetric = (value) => Number(Number(value).toPrecision(6));

function normalizeUrl(url) {
    if (!url) return undefined;
    const trimmed = String(url).trim();
    if (!trimmed) return undefined;
    if (trimmed.startsWith('/')) {
        return `https://dpp-keystone.org${trimmed}`;
    }
    return trimmed;
}

function normalizeDateTime(dateTimeStr) {
    if (!dateTimeStr) return new Date().toISOString();
    const s = String(dateTimeStr).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        return `${s}T00:00:00Z`;
    }
    if (!/(Z|[+-]\d{2}:\d{2})$/.test(s)) {
        return `${s}Z`;
    }
    return s;
}

function normalizeYearMonth(dateStr) {
    if (!dateStr) return '2024-01';
    const match = String(dateStr).trim().match(/^(\d{4}-\d{2})/);
    return match ? match[1] : '2024-01';
}

function parseWarrantyMonths(raw) {
    if (raw === undefined || raw === null) return undefined;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
        return Math.max(0, Math.round(raw));
    }
    const s = String(raw).trim();
    if (/^\d+(\.\d+)?$/.test(s)) {
        return Math.max(0, Math.round(Number(s)));
    }
    const yearMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:year|years|yr|yrs|jahr|jahre)/i);
    if (yearMatch) {
        return Math.max(0, Math.round(Number(yearMatch[1]) * 12));
    }
    const monthMatch = s.match(/(\d+(?:\.\d+)?)\s*(?:month|months|mo|monat|monate)/i);
    if (monthMatch) {
        return Math.max(0, Math.round(Number(monthMatch[1])));
    }
    return undefined;
}

function toMultiLang(node, property, fallbackEn) {
    const entries = node?.[property];
    const map = {};
    if (Array.isArray(entries)) {
        for (const entry of entries) {
            const val = entry?.['@value'];
            if (val !== undefined && val !== null && String(val).trim() !== '') {
                const lang = entry['@language'] || 'en';
                map[lang] = String(val).trim();
            }
        }
    }
    if (Object.keys(map).length === 0 && fallbackEn) {
        map.en = fallbackEn;
    }
    return Object.keys(map).length > 0 ? map : undefined;
}

function inferMimeType(contentType, url) {
    if (contentType && contentType !== 'RelatedResource') {
        return contentType;
    }
    const lowerUrl = (url || '').toLowerCase();
    if (lowerUrl.endsWith('.pdf')) return 'application/pdf';
    if (lowerUrl.endsWith('.png')) return 'image/png';
    if (lowerUrl.endsWith('.jpg') || lowerUrl.endsWith('.jpeg')) return 'image/jpeg';
    if (lowerUrl.endsWith('.svg')) return 'image/svg+xml';
    if (lowerUrl.endsWith('.json') || lowerUrl.endsWith('.jsonld')) return 'application/ld+json';
    return 'text/html';
}

function toRelatedResource(docNode, termsBase, defaultTitle) {
    if (!docNode) return undefined;
    const rawUrl = getStr(docNode, `${termsBase}url`) || docNode['@id'];
    const url = normalizeUrl(rawUrl);
    if (!url || url.startsWith('_:')) return undefined;

    const rawType = getStr(docNode, `${termsBase}contentType`);
    const title = getStr(docNode, `${termsBase}resourceTitle`) || defaultTitle;
    const language = getStr(docNode, `${termsBase}language`);

    const res = {
        contentType: inferMimeType(rawType, url),
        url
    };
    if (title) res.resourceTitle = title;
    if (language && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(language)) {
        res.language = language;
    }
    return res;
}

function toRelatedResourceList(nodes, termsBase, defaultTitle) {
    if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
    const mapped = nodes
        .map(n => toRelatedResource(n, termsBase, defaultTitle))
        .filter(Boolean);
    if (mapped.length === 0) return undefined;
    return mapped.length === 1 ? mapped[0] : mapped;
}

function toIsoAlpha3(countryStr) {
    if (!countryStr) return 'XXX';
    const upper = String(countryStr).trim().toUpperCase();
    if (COUNTRY_ALPHA3_MAP[upper]) return COUNTRY_ALPHA3_MAP[upper];
    if (/^[A-Z]{3}$/.test(upper)) return upper;
    return 'XXX';
}

function parseManufacturingPlace(placeStr, addressNode, countryOfOrigin, termsBase) {
    const addrCity = getStr(addressNode, `${termsBase}addressLocality`);
    const addrCountry = getStr(addressNode, `${termsBase}addressCountry`);

    if (placeStr) {
        const parts = placeStr.split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length >= 2) {
            const countryRaw = parts[parts.length - 1];
            const cityRaw = parts[0];
            const regionRaw = parts.length >= 3 ? parts.slice(1, -1).join(', ') : undefined;
            return {
                manufacturingCity: cityRaw || addrCity || 'Unspecified',
                ...(regionRaw && { manufacturingRegion: regionRaw }),
                manufacturingCountry: toIsoAlpha3(countryRaw)
            };
        }
        // Single token: check if it maps to a known country
        const maybeCountry = COUNTRY_ALPHA3_MAP[placeStr.trim().toUpperCase()];
        if (maybeCountry) {
            return {
                manufacturingCity: addrCity || 'Unspecified',
                manufacturingCountry: maybeCountry
            };
        }
        return {
            manufacturingCity: placeStr.trim(),
            manufacturingCountry: toIsoAlpha3(addrCountry || countryOfOrigin)
        };
    }

    return {
        manufacturingCity: addrCity || 'Unspecified',
        manufacturingCountry: toIsoAlpha3(addrCountry || countryOfOrigin)
    };
}

function detectSubgroup(rootNode, termsBase) {
    const rawCat = getStr(rootNode, `${termsBase}batteryCategory`) || '';
    const catFragment = rawCat.includes('#') ? rawCat.split('#').pop() : rawCat;
    const specIds = (rootNode[`${termsBase}contentSpecificationIds`] || [])
        .map(s => s['@value'] || s['@id'] || '');

    if (
        catFragment === 'LMVBattery' ||
        catFragment === 'lightMeansOfTransportBattery' ||
        specIds.some(id => id.includes('battery-lmv') || id.includes('/subgroup/lmt/'))
    ) {
        return { subgroup: 'lmt', batteryCategory: 'lightMeansOfTransportBattery' };
    }

    if (
        catFragment === 'IndustrialBattery' ||
        catFragment === 'industrialBattery' ||
        specIds.some(id => id.includes('battery-industrial') || id.includes('/subgroup/ind/'))
    ) {
        return { subgroup: 'ind', batteryCategory: 'industrialBattery' };
    }

    return { subgroup: 'evb', batteryCategory: 'electricVehicleBattery' };
}

function mapGranularity(rawGranularity) {
    if (!rawGranularity) return 'item';
    const token = (rawGranularity.includes('#') ? rawGranularity.split('#').pop() : rawGranularity).toLowerCase();
    if (token === 'model') return 'model';
    if (token === 'batch') return 'batch';
    return 'item';
}

function mapDppStatus(rawStatus) {
    if (!rawStatus) return 'validStatus';
    const token = (rawStatus.includes('#') ? rawStatus.split('#').pop() : rawStatus).toLowerCase();
    if (token === 'active' || token === 'validstatus') return 'validStatus';
    return 'invalidStatus';
}

function mapBatteryStatus(rawStatus) {
    if (!rawStatus) return 'original';
    const token = (rawStatus.includes('#') ? rawStatus.split('#').pop() : rawStatus).toLowerCase();
    if (['original', 'reused', 'repurposed', 'remanufactured', 'waste'].includes(token)) {
        return token;
    }
    return 'original';
}

function mapBatteryChemistry(rootNode, termsBase) {
    const entries = rootNode[`${termsBase}batteryChemistry`] || [];
    const tokens = [];
    for (const entry of entries) {
        const raw = entry?.['@value'] ?? entry?.['@id'];
        if (!raw) continue;
        const fragment = String(raw).includes('#') ? String(raw).split('#').pop() : String(raw);
        for (const part of fragment.split(/[,;/]+/)) {
            const key = part.trim().toLowerCase().replace(/\s+/g, '');
            if (CHEMISTRY_MAP[key]) {
                tokens.push(CHEMISTRY_MAP[key]);
            } else if (Object.values(CHEMISTRY_MAP).includes(part.trim())) {
                tokens.push(part.trim());
            }
        }
    }
    const unique = [...new Set(tokens)];
    return unique.length > 0 ? unique : ['lithiumIonLFP'];
}

function mapCriticalRawMaterials(rootNode, termsBase) {
    const entries = rootNode[`${termsBase}criticalRawMaterials`] || [];
    const mapped = [];
    for (const entry of entries) {
        const raw = entry?.['@value'] ?? entry?.['@id'];
        if (!raw) continue;
        for (const token of String(raw).split(/[,;]+/)) {
            const trimmed = token.trim();
            if (!trimmed) continue;
            if (EC_CRITICAL_RAW_MATERIALS.has(trimmed)) {
                mapped.push(trimmed);
                continue;
            }
            const lower = trimmed.toLowerCase();
            if (EC_CRITICAL_RAW_MATERIALS.has(lower)) {
                mapped.push(lower);
                continue;
            }
            if (CRM_SYNONYMS[lower]) {
                mapped.push(CRM_SYNONYMS[lower]);
            }
        }
    }
    return [...new Set(mapped)];
}

function extractComponentObjects(nodes, termsBase) {
    if (!Array.isArray(nodes) || nodes.length === 0) return undefined;
    const list = nodes.map(c => {
        const obj = {};
        const name = getStr(c, `${termsBase}componentName`) || getStr(c, `${termsBase}name`);
        const percentage = getNum(c, `${termsBase}componentPercentage`);
        const upi = getStr(c, `${termsBase}componentIdentifier`);
        const casNumber = getStr(c, `${termsBase}componentCasNumber`);
        const ecNumber = getStr(c, `${termsBase}componentEcNumber`);
        const iupacName = getStr(c, `${termsBase}componentIupacName`);
        const locationInProduct = getStr(c, `${termsBase}componentLocationInProduct`);

        if (name) obj.name = name;
        if (percentage !== undefined) obj.percentage = percentage;
        if (upi) obj.uniqueProductIdentifier = upi;
        if (casNumber) obj.casNumber = casNumber;
        if (ecNumber) obj.ecNumber = ecNumber;
        if (iupacName) obj.iupacName = iupacName;
        if (locationInProduct) obj.locationInProduct = locationInProduct;
        return Object.keys(obj).length > 0 ? obj : null;
    }).filter(Boolean);
    return list.length > 0 ? list : undefined;
}

/**
 * Transforms an expanded Keystone Battery DPP node into an EC-compliant Battery DPP JSON-LD payload
 * while preserving Keystone federated extensions via context composition.
 */
export function dppToEcBattery(sourceData, dictionary, rootNode, version = 'v3') {
    const termsBase = `https://dpp-keystone.org/spec/${version}/terms#`;
    const { subgroup, batteryCategory } = detectSubgroup(rootNode, termsBase);

    const dppId = getStr(rootNode, `${termsBase}digitalProductPassportId`) || 'urn:uuid:00000000-0000-0000-0000-000000000000';
    const upi = getStr(rootNode, `${termsBase}uniqueProductIdentifier`) || dppId;
    const granularity = mapGranularity(getStr(rootNode, `${termsBase}granularity`));
    const dppStatus = mapDppStatus(getStr(rootNode, `${termsBase}dppStatus`));
    const lastUpdate = normalizeDateTime(getStr(rootNode, `${termsBase}lastUpdate`));
    const dppSchemaVersion = getStr(rootNode, `${termsBase}dppSchemaVersion`);
    const economicOperatorId = getStr(rootNode, `${termsBase}economicOperatorId`);
    const facilityId = getStr(rootNode, `${termsBase}facilityId`);
    const productName = toMultiLang(rootNode, `${termsBase}productName`);

    // Preserve federated non-EC contentSpecificationIds alongside the active EC per-tier specification URIs
    const existingSpecs = (rootNode[`${termsBase}contentSpecificationIds`] || [])
        .map(s => s['@value'] || s['@id'])
        .filter(s => typeof s === 'string' && s.trim() !== '' && !s.startsWith('https://repository.product-passport.ec.europa.eu/'));

    const contentSpecificationIds = [
        ...new Set([
            EC_CORE_SPEC_ID,
            `${EC_BATTERIES_SPEC_BASE}/pub`,
            `${SUBGROUP_SPEC_BASES[subgroup]}/pub`,
            ...existingSpecs
        ])
    ];

    // Manufacturer & Contact
    const manufacturerNode = getNode(rootNode, `${termsBase}manufacturer`);
    const addressNode = getNode(manufacturerNode, `${termsBase}address`);
    const orgName = getStr(manufacturerNode, `${termsBase}organizationName`) || 'Unknown Manufacturer';
    const tradeName = getStr(manufacturerNode, `${termsBase}tradingName`);
    const brand = getStr(rootNode, `${termsBase}brand`);

    const manufacturerIdentification = {
        manufacturerName: orgName,
        ...(tradeName && { manufacturerTradeName: tradeName }),
        ...(brand && { manufacturerTrademark: brand })
    };

    const street = getStr(addressNode, `${termsBase}streetAddress`);
    const postal = getStr(addressNode, `${termsBase}postalCode`);
    const locality = getStr(addressNode, `${termsBase}addressLocality`);
    const country = getStr(addressNode, `${termsBase}addressCountry`);
    const postalLocality = [postal, locality].filter(Boolean).join(' ');
    const manufacturerPostalAddress = [street, postalLocality, country].filter(Boolean).join(', ') || 'Address not specified';

    const website = normalizeUrl(getStr(manufacturerNode, `${termsBase}website`));
    const emailRaw = getStr(manufacturerNode, `${termsBase}email`) || getStr(rootNode, `${termsBase}operatorEmail`);
    const email = emailRaw ? emailRaw.replace(/^mailto:/i, '').trim() : undefined;
    const manufacturerContactDetails = (website || email)
        ? {
            ...(website && { manufacturerWebsite: website }),
            ...(email && { manufacturerEmail: email })
        }
        : undefined;

    const registrantIdentity = economicOperatorId
        || getStr(manufacturerNode, `${termsBase}additionalOrganizationId`)
        || getStr(manufacturerNode, `${termsBase}gln`)
        || getStr(manufacturerNode, `${termsBase}leiCode`)
        || getStr(manufacturerNode, `${termsBase}eori`)
        || dppId;

    // Battery Identification (respecting dependentRequired: modelIdentifier <-> batchNumber)
    const model = getStr(rootNode, `${termsBase}model`);
    const batchNumber = getStr(rootNode, `${termsBase}batchNumber`);
    const serialNumber = getStr(rootNode, `${termsBase}serialNumber`);
    const gtin = getStr(rootNode, `${termsBase}gtin`) || getStr(rootNode, `${termsBase}sku`);

    const batteryIdentification = {};
    if (model && batchNumber) {
        batteryIdentification.modelIdentifier = model;
        batteryIdentification.batchNumber = batchNumber;
    } else if (granularity === 'batch') {
        batteryIdentification.modelIdentifier = model || getStr(rootNode, `${termsBase}productName`) || 'BATCH-MODEL';
        batteryIdentification.batchNumber = batchNumber || dppId;
    }
    if (serialNumber) {
        batteryIdentification.serialNumber = serialNumber;
    }
    if (gtin) {
        batteryIdentification.productNumber = gtin;
    }
    if (Object.keys(batteryIdentification).length === 0) {
        if (granularity === 'item') {
            batteryIdentification.serialNumber = dppId;
            if (model) batteryIdentification.otherIdentificationElement = model;
        } else {
            batteryIdentification.otherIdentificationElement = model || dppId;
        }
    }

    const manufacturingPlace = parseManufacturingPlace(
        getStr(rootNode, `${termsBase}manufacturingPlace`),
        addressNode,
        getStr(rootNode, `${termsBase}countryOfOrigin`),
        termsBase
    );
    const manufacturingDate = normalizeYearMonth(getStr(rootNode, `${termsBase}manufacturingDate`));
    const commercialWarrantyPeriod = parseWarrantyMonths(getStr(rootNode, `${termsBase}warrantyPeriod`));

    // Performance Nodes
    const perfNode = getNode(rootNode, `${termsBase}performance`);
    const capNode = getNode(perfNode, `${termsBase}capacity`);
    const powerNode = getNode(perfNode, `${termsBase}power`);
    const effNode = getNode(perfNode, `${termsBase}efficiency`);
    const resNode = getNode(perfNode, `${termsBase}internalResistance`);
    const lifeNode = getNode(perfNode, `${termsBase}lifetime`);
    const tempNode = getNode(perfNode, `${termsBase}temperature`);

    const netWeightNode = getNode(rootNode, `${termsBase}netWeight`);
    const batteryWeight = getNum(rootNode, `${termsBase}batteryMass`)
        ?? getNum(netWeightNode, `${termsBase}value`)
        ?? getNum(rootNode, `${termsBase}netWeight`)
        ?? 0;
    const batteryCapacity = getNum(capNode, `${termsBase}ratedCapacity`) ?? 0;
    const batteryChemistry = mapBatteryChemistry(rootNode, termsBase);

    const hazNodes = rootNode[`${termsBase}hazardousSubstances`] || [];
    const hazardousSubstances = [...new Set(
        hazNodes
            .map(h => getStr(h, `${termsBase}componentName`) || getStr(h, `${termsBase}name`))
            .filter(Boolean)
    )];

    const criticalRawMaterials = mapCriticalRawMaterials(rootNode, termsBase);
    const extinguishingAgent = toMultiLang(rootNode, `${termsBase}extinguishingAgent`, 'Water');
    const renewableContentShare = getNum(rootNode, `${termsBase}renewableContent`) ?? 0;

    // Heavy metal chemical symbols
    const hazLower = hazardousSubstances.map(s => s.toLowerCase()).join(' ');
    const chemicalSymbol = [];
    if (/\bcadmium\b|\bcd\b/.test(hazLower)) chemicalSymbol.push('cadmiumSymbol');
    if (/\blead\b|\bpb\b/.test(hazLower)) chemicalSymbol.push('leadSymbol');
    if (chemicalSymbol.length === 0) chemicalSymbol.push('noneSymbol');

    // Voltages, Power, Temperature, Resistance (Keystone mOhm -> EC Ohm)
    const minimalVoltage = getNum(capNode, `${termsBase}voltageMinimum`) ?? 0;
    const nominalVoltage = getNum(capNode, `${termsBase}voltageNominal`) ?? 0;
    const maximumVoltage = getNum(capNode, `${termsBase}voltageMaximum`) ?? 0;
    const originalPowerCapability = getNum(powerNode, `${termsBase}powerOriginal`) ?? 0;
    const powerLimit = getNum(powerNode, `${termsBase}powerMaximumPermitted`) ?? originalPowerCapability;

    const notInUseTemperatureRange = {
        lowerBound: getNum(tempNode, `${termsBase}temperatureIdleLower`) ?? -20,
        upperBound: getNum(tempNode, `${termsBase}temperatureIdleUpper`) ?? 60,
        notInUseTemperatureRangeTest: toMultiLang(lifeNode, `${termsBase}referenceTestCycleLife`, 'IEC 62660-2')
    };

    const initialMohm = getNum(resNode, `${termsBase}internalResistanceInitial`) ?? 10;
    const ohmicMohm = getNum(resNode, `${termsBase}internalResistanceOhmic`);
    const dynamicMohm = getNum(resNode, `${termsBase}internalResistanceDynamic`);
    const internalCellResistance = roundMetric((ohmicMohm ?? initialMohm) / 1000);
    const internalPackResistance = roundMetric(initialMohm / 1000);

    // Documents & Waste Prevention Info
    const dopcNode = getNode(rootNode, `${termsBase}dopc`);
    const euDeclarationOfConformity = toRelatedResource(dopcNode, termsBase, 'EU Declaration of Conformity') || {
        contentType: 'application/pdf',
        resourceTitle: 'EU Declaration of Conformity',
        url: upi.startsWith('http') ? upi : 'https://dpp-keystone.org/docs/eu-doc.pdf'
    };

    const wastePrevUrl = normalizeUrl(getStr(getNode(rootNode, `${termsBase}wastePreventionInfo`), `${termsBase}url`));
    const safetyUrl = normalizeUrl(getStr(getNode(rootNode, `${termsBase}safetyMeasures`), `${termsBase}url`));
    const labelMeaning = toMultiLang(rootNode, `${termsBase}labelMeaning`, 'Crossed-out wheeled bin symbol indicates mandatory separate collection under Regulation (EU) 2023/1542.');
    const substancesImpact = toMultiLang(
        rootNode,
        `${termsBase}hazardousSubstancesImpact`,
        hazardousSubstances.length > 0
            ? `Contains regulated battery substances (${hazardousSubstances.join(', ')}); improper disposal may harm human health and the environment.`
            : 'Improper disposal of battery electrolyte and active materials may harm human health and the environment.'
    );

    const defaultWasteRef = wastePrevUrl || 'Consult manufacturer waste battery management documentation.';
    const wasteBatteryPreventionManagementInfo = {
        endUserRoleInWastePrevention: { en: `Follow operating limits and charging instructions to maximize battery service life (${defaultWasteRef}).` },
        endUserRoleInSeparateCollection: { en: 'Do not dispose of waste batteries as unsorted municipal waste; return via designated separate collection channels.' },
        separateCollectionPoints: { en: wastePrevUrl || 'Return to authorized municipal or distributor battery collection points.' },
        takeBackCollectionPoints: { en: wastePrevUrl || 'Authorized manufacturer take-back and service partner network.' },
        preparationForReuseFacilities: { en: wastePrevUrl || 'Authorized battery evaluation and preparation-for-reuse facilities.' },
        preparationForRepurposingFacilities: { en: wastePrevUrl || 'Authorized second-life battery repurposing facilities.' },
        wasteBatteryTreatmentFacilities: { en: wastePrevUrl || 'Permitted waste battery recycling and treatment facilities.' },
        wasteBatterySafetyInstructions: { en: safetyUrl ? `Follow safety instructions at ${safetyUrl}` : 'Isolate terminals and protect against short-circuit, mechanical damage, and heat exposure.' },
        batteryLabelSymbolMeaning: labelMeaning,
        batterySubstancesImpact: substancesImpact
    };

    const ecPayload = {
        '@context': [
            `https://dpp-keystone.org/spec/contexts/${version}/dpp-battery.context.jsonld`,
            EC_CORE_CONTEXT,
            EC_BATTERIES_CONTEXT
        ],
        id: rootNode['@id'] || dppId,
        type: ['DigitalProductPassport', 'BatteryProduct'],
        digitalProductPassportId: dppId,
        uniqueProductIdentifier: upi,
        granularity,
        ...(dppSchemaVersion && { dppSchemaVersion }),
        dppStatus,
        lastUpdate,
        ...(economicOperatorId && { economicOperatorId }),
        ...(facilityId && { facilityId }),
        contentSpecificationIds,
        ...(productName && { productName }),
        registrantIdentity,
        manufacturerIdentification,
        manufacturerPostalAddress,
        ...(manufacturerContactDetails && { manufacturerContactDetails }),
        batteryCategory,
        batteryIdentification,
        manufacturingPlace,
        manufacturingDate,
        batteryWeight,
        batteryCapacity,
        batteryChemistry,
        hazardousSubstances,
        extinguishingAgent,
        criticalRawMaterials,
        renewableContentShare,
        minimalVoltage,
        nominalVoltage,
        maximumVoltage,
        originalPowerCapability,
        powerLimit,
        notInUseTemperatureRange,
        ...(commercialWarrantyPeriod !== undefined && { commercialWarrantyPeriod }),
        internalCellResistance,
        internalPackResistance
    };

    // Subgroup-specific public cycle-life & efficiency fields
    const rawCycles = getNum(lifeNode, `${termsBase}expectedLifetimeCycles`);
    const rawCRate = getNum(lifeNode, `${termsBase}cRateCycleTest`);
    const rawRtInit = getNum(effNode, `${termsBase}roundTripEfficiencyInitial`);
    const rawRt50 = getNum(effNode, `${termsBase}roundTripEfficiencyAt50Cycles`);
    const rawRefTest = toMultiLang(lifeNode, `${termsBase}referenceTestCycleLife`);

    if (subgroup === 'evb' || subgroup === 'lmt') {
        ecPayload.expectedLifetimeCycles = rawCycles !== undefined ? Math.max(1, Math.round(rawCycles)) : 1000;
        ecPayload.cycleLifeReferenceTest = rawRefTest || { en: 'IEC 62660-2' };
        if (subgroup === 'evb') {
            ecPayload.capacityExhaustionThreshold = getNum(lifeNode, `${termsBase}exhaustionCapacityThreshold`) ?? 80.0;
        }
        ecPayload.initialRoundTripEnergyEfficiency = rawRtInit ?? 95.0;
        ecPayload.roundTripEfficiencyAtHalfCycleLife = rawRt50 ?? rawRtInit ?? 93.0;
        ecPayload.cycleLifeChargeCRate = rawCRate ?? 0.5;
        if (rawCRate !== undefined) {
            ecPayload.cycleLifeDischargeCRate = rawCRate;
        }
    } else {
        // Industrial (ind): capacityExhaustionThreshold is forbidden; cycle-life fields are optional
        if (rawCycles !== undefined && rawCycles >= 1) {
            ecPayload.expectedLifetimeCycles = Math.round(rawCycles);
        }
        if (rawRefTest) {
            ecPayload.cycleLifeReferenceTest = rawRefTest;
        }
        if (rawRtInit !== undefined) {
            ecPayload.initialRoundTripEnergyEfficiency = rawRtInit;
        }
        if (rawRt50 !== undefined) {
            ecPayload.roundTripEfficiencyAtHalfCycleLife = rawRt50;
        }
        if (rawCRate !== undefined) {
            ecPayload.cycleLifeChargeCRate = rawCRate;
            ecPayload.cycleLifeDischargeCRate = rawCRate;
        }
    }

    ecPayload.separateCollectionSymbol = true;
    ecPayload.chemicalSymbol = chemicalSymbol;
    ecPayload.euDeclarationOfConformity = euDeclarationOfConformity;
    ecPayload.wasteBatteryPreventionManagementInfo = wasteBatteryPreventionManagementInfo;

    // RES1 & RES2 restricted fields (populated when available in source DPP)
    const materialComp = extractComponentObjects(rootNode[`${termsBase}materialComposition`], termsBase);
    if (materialComp && materialComp.length > 0) {
        const compSummary = materialComp
            .map(m => (m.percentage !== undefined ? `${m.name} (${m.percentage}%)` : m.name))
            .join(', ');
        ecPayload.detailedComposition = { en: compSummary };
    }

    const spareSources = rootNode[`${termsBase}sparePartsSources`] || [];
    const partNums = rootNode[`${termsBase}partNumbers`] || [];
    const sparePartReplacementDetails = toRelatedResourceList([...spareSources, ...partNums], termsBase, 'Spare Parts');
    if (sparePartReplacementDetails) {
        ecPayload.sparePartReplacementDetails = sparePartReplacementDetails;
    }

    const dismantlingInformation = toRelatedResourceList(rootNode[`${termsBase}dismantlingInformation`], termsBase, 'Dismantling Information');
    if (dismantlingInformation) {
        ecPayload.dismantlingInformation = dismantlingInformation;
    }

    const safetyMeasures = toRelatedResourceList(rootNode[`${termsBase}safetyMeasures`], termsBase, 'Safety Measures');
    if (safetyMeasures) {
        ecPayload.safetyMeasures = safetyMeasures;
    }

    const complianceTestReportResults = toRelatedResourceList(rootNode[`${termsBase}testReports`], termsBase, 'Compliance Test Reports');
    if (complianceTestReportResults) {
        ecPayload.complianceTestReportResults = complianceTestReportResults;
    }

    // RES3 item-level operational metrics (strictly respecting subgroup prohibitions)
    if (granularity === 'item') {
        ecPayload.batteryStatus = mapBatteryStatus(getStr(rootNode, `${termsBase}batteryStatus`));

        const cycleCountFull = getNum(lifeNode, `${termsBase}cycleCountFull`);
        if (cycleCountFull !== undefined) {
            const cyclesInt = Math.max(0, Math.round(cycleCountFull));
            ecPayload.numberOfChargingCycles = cyclesInt;
            ecPayload.numberOfDischargingCycles = cyclesInt;
        }

        const negNode = getNode(perfNode, `${termsBase}negativeEvents`);
        if (negNode) {
            const negParts = [];
            const deepD = getStr(negNode, `${termsBase}eventsDeepDischarge`);
            const overC = getStr(negNode, `${termsBase}eventsOvercharge`);
            const acc = getStr(negNode, `${termsBase}eventsAccidents`);
            if (deepD !== undefined) negParts.push(`Deep discharge events: ${deepD}`);
            if (overC !== undefined) negParts.push(`Overcharge events: ${overC}`);
            if (acc !== undefined) negParts.push(`Accidents: ${acc}`);
            if (negParts.length > 0) {
                ecPayload.negativeEvents = { en: negParts.join('; ') };
            }
        }

        const capFade = getNum(capNode, `${termsBase}capacityFade`);
        const pwrRem = getNum(powerNode, `${termsBase}powerRemaining`);
        const pwrFade = getNum(powerNode, `${termsBase}powerFade`);
        const resInc = getNum(resNode, `${termsBase}internalResistanceIncrease`);
        const rtRem = getNum(effNode, `${termsBase}roundTripEfficiencyRemaining`);
        const rtFade = getNum(effNode, `${termsBase}roundTripEfficiencyFade`);
        const years = getNum(lifeNode, `${termsBase}expectedLifetimeYears`);

        if (subgroup === 'evb') {
            ecPayload.ratedCapacity = batteryCapacity;
            ecPayload.capacityFade = capFade ?? 0;
            ecPayload.powerCapability = pwrRem ?? originalPowerCapability;
            ecPayload.powerFade = pwrFade ?? 0;
            ecPayload.internalResistance = roundMetric((dynamicMohm ?? initialMohm) / 1000);
            ecPayload.internalResistanceIncrease = resInc ?? 0;
            ecPayload.roundTripEnergyEfficiency = rtRem ?? rawRtInit ?? 95.0;
            ecPayload.roundTripEnergyEfficiencyFade = rtFade ?? 0;
            ecPayload.expectedLifetimeCyclesRest = Math.max(
                0,
                Math.round((ecPayload.expectedLifetimeCycles ?? 1000) - (cycleCountFull ?? 0))
            );
            ecPayload.expectedLifetimeYears = Math.max(1, Math.round(years ?? 10));
            ecPayload.stateOfCertifiedEnergy = getNum(capNode, `${termsBase}soce`) ?? 100.0;
        } else if (subgroup === 'lmt') {
            ecPayload.ratedCapacity = batteryCapacity;
            ecPayload.capacityFade = capFade ?? 0;
            ecPayload.powerCapability = pwrRem ?? originalPowerCapability;
            ecPayload.powerFade = pwrFade ?? 0;
            ecPayload.internalResistance = roundMetric((dynamicMohm ?? initialMohm) / 1000);
            ecPayload.internalResistanceIncrease = resInc ?? 0;
            ecPayload.roundTripEnergyEfficiency = rtRem ?? rawRtInit ?? 95.0;
            ecPayload.roundTripEnergyEfficiencyFade = rtFade ?? 0;
            ecPayload.expectedLifetimeCyclesRest = Math.max(
                0,
                Math.round((ecPayload.expectedLifetimeCycles ?? 1000) - (cycleCountFull ?? 0))
            );
            ecPayload.expectedLifetimeYears = Math.max(1, Math.round(years ?? 10));
            ecPayload.remainingCapacity = getNum(capNode, `${termsBase}remainingCapacity`) ?? batteryCapacity;
            ecPayload.remainingPowerCapability = pwrRem ?? originalPowerCapability;
            ecPayload.remainingRoundTripEfficiency = rtRem ?? rawRtInit ?? 95.0;
            ecPayload.ohmicResistance = roundMetric((ohmicMohm ?? initialMohm) / 1000);
            const sdRate = getNum(effNode, `${termsBase}selfDischargeCurrent`)
                ?? getNum(effNode, `${termsBase}selfDischargeInitial`)
                ?? 2.0;
            ecPayload.selfDischargingRateSet = [
                {
                    selfDischargingRate: sdRate,
                    recordedTime: lastUpdate
                }
            ];
        } else {
            // Industrial (ind): stateOfCertifiedEnergy is forbidden; operational metrics are optional
            ecPayload.ratedCapacity = batteryCapacity;
            if (capFade !== undefined) ecPayload.capacityFade = capFade;
            if (pwrRem !== undefined) ecPayload.powerCapability = pwrRem;
            if (pwrFade !== undefined) ecPayload.powerFade = pwrFade;
            if (dynamicMohm !== undefined) ecPayload.internalResistance = roundMetric(dynamicMohm / 1000);
            if (resInc !== undefined) ecPayload.internalResistanceIncrease = resInc;
            if (rtRem !== undefined || rawRtInit !== undefined) {
                ecPayload.roundTripEnergyEfficiency = rtRem ?? rawRtInit;
            }
            if (rtFade !== undefined) ecPayload.roundTripEnergyEfficiencyFade = rtFade;
            if (rawCycles !== undefined) {
                ecPayload.expectedLifetimeCyclesRest = Math.max(0, Math.round(rawCycles - (cycleCountFull ?? 0)));
            }
            if (years !== undefined && years >= 1) {
                ecPayload.expectedLifetimeYears = Math.round(years);
            }
            const remCap = getNum(capNode, `${termsBase}remainingCapacity`);
            if (remCap !== undefined) ecPayload.remainingCapacity = remCap;
            if (pwrRem !== undefined) ecPayload.remainingPowerCapability = pwrRem;
            if (rtRem !== undefined) ecPayload.remainingRoundTripEfficiency = rtRem;
            if (ohmicMohm !== undefined) ecPayload.ohmicResistance = roundMetric(ohmicMohm / 1000);
            const sdRate = getNum(effNode, `${termsBase}selfDischargeCurrent`)
                ?? getNum(effNode, `${termsBase}selfDischargeInitial`);
            if (sdRate !== undefined) {
                ecPayload.selfDischargingRateSet = [
                    {
                        selfDischargingRate: sdRate,
                        recordedTime: lastUpdate
                    }
                ];
            }
        }
    }

    const activeTiers = ['pub'];
    if (
        ecPayload.detailedComposition &&
        ecPayload.sparePartReplacementDetails &&
        ecPayload.dismantlingInformation &&
        ecPayload.safetyMeasures
    ) {
        activeTiers.push('res1');
    }
    if (ecPayload.complianceTestReportResults) {
        activeTiers.push('res2');
    }
    if (granularity === 'item') {
        activeTiers.push('res3');
    }

    ecPayload.contentSpecificationIds = [
        ...new Set([
            EC_CORE_SPEC_ID,
            ...activeTiers.map(tier => `${EC_BATTERIES_SPEC_BASE}/${tier}`),
            ...activeTiers.map(tier => `${SUBGROUP_SPEC_BASES[subgroup]}/${tier}`),
            ...existingSpecs
        ])
    ];

    // Preserve Keystone federated extensions (backed by dpp-battery.context.jsonld)
    const imageList = toRelatedResourceList(rootNode[`${termsBase}image`], termsBase, 'Product Image');
    if (imageList) {
        ecPayload.image = Array.isArray(imageList) ? imageList : [imageList];
    }

    const serviceDate = getStr(rootNode, `${termsBase}serviceDate`);
    if (serviceDate) ecPayload.serviceDate = serviceDate;

    const cfpClass = getStr(rootNode, `${termsBase}batteryCarbonFootprintClass`);
    if (cfpClass) ecPayload.batteryCarbonFootprintClass = cfpClass;

    const cfpAbs = getNum(rootNode, `${termsBase}carbonFootprintAbsolute`);
    if (cfpAbs !== undefined) ecPayload.carbonFootprintAbsolute = cfpAbs;

    const cfpStudy = toRelatedResource(getNode(rootNode, `${termsBase}carbonFootprintStudy`), termsBase, 'Carbon Footprint Study');
    if (cfpStudy) ecPayload.carbonFootprintStudy = cfpStudy;

    const cfpGenInfo = toRelatedResource(getNode(rootNode, `${termsBase}carbonFootprintGeneralInfo`), termsBase, 'Carbon Footprint Information');
    if (cfpGenInfo) ecPayload.carbonFootprintGeneralInfo = cfpGenInfo;

    const cfpLabel = toRelatedResource(getNode(rootNode, `${termsBase}carbonFootprintLabel`), termsBase, 'Carbon Footprint Label');
    if (cfpLabel) ecPayload.carbonFootprintLabel = cfpLabel;

    const ddReport = toRelatedResource(getNode(rootNode, `${termsBase}dueDiligenceReport`), termsBase, 'Due Diligence Report');
    if (ddReport) ecPayload.dueDiligenceReport = ddReport;

    const scAssurances = toRelatedResource(getNode(rootNode, `${termsBase}supplyChainAssurances`), termsBase, 'Supply Chain Assurances');
    if (scAssurances) ecPayload.supplyChainAssurances = scAssurances;

    const scIndices = toRelatedResource(getNode(rootNode, `${termsBase}supplyChainIndices`), termsBase, 'Supply Chain Indices');
    if (scIndices) ecPayload.supplyChainIndices = scIndices;

    if (materialComp) ecPayload.materialComposition = materialComp;

    const preRecycled = extractComponentObjects(rootNode[`${termsBase}preConsumerRecycledMaterialComposition`], termsBase);
    if (preRecycled) ecPayload.preConsumerRecycledMaterialComposition = preRecycled;

    const postRecycled = extractComponentObjects(rootNode[`${termsBase}postConsumerRecycledMaterialComposition`], termsBase);
    if (postRecycled) ecPayload.postConsumerRecycledMaterialComposition = postRecycled;

    return [ecPayload];
}

export const profile = {
    transformations: [
        {
            source: 'digitalProductPassportId',
            transformer: dppToEcBattery
        }
    ]
};
