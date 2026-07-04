import { KEYSTONE_VERSION } from './keystone-version.js?v=1783193134397';

/**
 * Robustly extracts a single string value from an RDFS property, preferring English.
 * @param {string|object|Array} property - The RDFS property from the JSON-LD graph.
 * @returns {string} The extracted string value, or an empty string if not found.
 */
function getSingleRdfsValue(property) {
    if (!property) return '';
    if (typeof property === 'string') return property;

    // Handle language-tagged array
    if (Array.isArray(property)) {
        const enEntry = property.find(entry => entry['@language'] === 'en');
        if (enEntry && enEntry['@value']) {
            return enEntry['@value'];
        }
        // Fallback to the first available value if no 'en' entry is found
        if (property[0] && property[0]['@value']) {
            return property[0]['@value'];
        }
    }

    // Handle single language-tagged object or literal
    if (property['@value'] !== undefined) return property['@value'];
    
    // Handle IRI references (e.g. for units)
    if (property['@id']) {
        let idStr = property['@id'];
        if (idStr.includes('#')) {
            const parts = idStr.split('#');
            return parts[parts.length - 1];
        } else if (idStr.includes(':')) {
            const parts = idStr.split(':');
            return parts[parts.length - 1];
        }
        return idStr;
    }

    return '';
}

/**
 * Parses an rdfs:label or rdfs:comment property and returns a language-keyed object.
 * @param {string|object|Array} property - The RDF property.
 * @returns {Object<string, string>} A map of language codes to text values.
 */
function parseLangTaggedProperty(property) {
    const langMap = {};
    if (!property) return langMap;

    if (typeof property === 'string') {
        langMap.en = property; // Assume string is English
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
 * Rewrites production URLs to local relative paths for local development/testing.
 * @param {string} url - The URL to rewrite.
 * @returns {string} The rewritten URL or the original if no match.
 */
export function rewriteUrl(url) {
    const PROD_PREFIX = 'https://dpp-keystone.org/spec/ontology/';
    if (url.startsWith(PROD_PREFIX)) {
        // Map to local relative path from wizard/index.html to ontology/ directory
        return url.replace(PROD_PREFIX, '../spec/ontology/');
    }
    return url;
}

/**
 * Internal recursive function to fetch, parse, and process an ontology file, including its imports.
 * @param {string} url - The URL of the ontology to load.
 * @param {Map<string, {label: Object<string, string>, comment: Object<string, string>, unit: string, governedBy: string}>} ontologyMap - The map to populate.
 * @param {Set<string>} loadedUrls - A set to track already loaded URLs to prevent infinite loops.
 * @param {boolean} isInitialCall - Flag to indicate if this is the first call in the recursion.
 * @returns {Promise<void>}
 */
async function loadAndParseOntology(url, ontologyMap, loadedUrls, isInitialCall = false) {
    // Resolve URL rewriting for imports
    const fetchUrl = rewriteUrl(url);

    if (loadedUrls.has(fetchUrl)) {
        return; // Avoid infinite loops and redundant fetches
    }
    loadedUrls.add(fetchUrl);

    try {
        const response = await fetch(fetchUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} for URL: ${fetchUrl}`);
        }

        const ontology = await response.json();

        // Extract module info from URL
        let definedIn = null;
        const urlMatch = fetchUrl.match(new RegExp(`ontology/${KEYSTONE_VERSION}/(.+?)/(.+?)\\.jsonld`));
        if (urlMatch) {
            definedIn = { type: urlMatch[1], name: urlMatch[2] };
        }

        // Process the graph of the current ontology
        if (ontology['@graph']) {
            for (const term of ontology['@graph']) {
                let key = term['@id'];
                if (!key) continue;

                if (key.includes(':')) {
                    key = key.split(':')[1];
                }

                const existing = ontologyMap.get(key) || {};

                const label = parseLangTaggedProperty(term['rdfs:label']);
                const comment = parseLangTaggedProperty(term['rdfs:comment']);
                const unit = getSingleRdfsValue(term['dppk:unit']);
                const unitSymbol = getSingleRdfsValue(term['dppk:unitSymbol']);
                const governedBy = getSingleRdfsValue(term['dppk:governedBy']);

                let source;
                const rawSource = term['dcterms:source'];
                if (rawSource && typeof rawSource === 'object' && rawSource['@id']) {
                    source = rawSource; // It's a link object, preserve it.
                } else {
                    source = getSingleRdfsValue(rawSource); // It's likely a literal, get the string value.
                }

                const domain = getSingleRdfsValue(term['rdfs:domain']);
                const rdfType = term['@type'] || term['rdf:type'];

                let range = term['rdfs:range'];
                if (range && range['@id']) {
                    range = range['@id'];
                } else {
                    range = getSingleRdfsValue(range);
                }
                if (range && typeof range === 'string' && range.includes(':')) {
                    range = range.split(':')[1];
                }

                let oneOf = null;
                if (term['owl:oneOf']) {
                    const oneOfRaw = Array.isArray(term['owl:oneOf']) ? term['owl:oneOf'] : [term['owl:oneOf']];
                    oneOf = oneOfRaw.map(item => (item && item['@id'] ? (item['@id'].split(':')[1] || item['@id']) : null)).filter(Boolean);
                }

                const hasLabel = label && Object.keys(label).length > 0;
                const hasComment = comment && Object.keys(comment).length > 0;
                const hasUnit = unit && unit.length > 0;
                const hasGov = governedBy && governedBy.length > 0;
                const hasRange = range && range.length > 0;
                const hasSource = (typeof source === 'string' && source.length > 0) || (typeof source === 'object' && source !== null);
                const hasDomain = domain && domain.length > 0;
                const hasOneOf = oneOf && oneOf.length > 0;
                const hasUnitSymbol = unitSymbol && unitSymbol.length > 0;

                const termHasAnyMetadata = hasLabel || hasComment || hasUnit || hasGov || hasRange || hasSource || hasDomain || hasOneOf || hasUnitSymbol;

                if (termHasAnyMetadata) {
                    ontologyMap.set(key, {
                        ...existing,
                        label: hasLabel ? label : (existing.label || {}),
                        comment: hasComment ? comment : (existing.comment || {}),
                        unit: hasUnit ? unit : (existing.unit || ''),
                        governedBy: hasGov ? governedBy : (existing.governedBy || ''),
                        range: hasRange ? range : (existing.range || ''),
                        source: hasSource ? source : (existing.source || null),
                        domain: hasDomain ? domain : (existing.domain || null),
                        definedIn: definedIn ?? existing.definedIn,
                        type: rdfType || existing.type,
                        'enum': hasOneOf ? oneOf : (existing.enum || null),
                        unitSymbol: hasUnitSymbol ? unitSymbol : (existing.unitSymbol || null),
                    });
                }
            }
        }

        // Recursively process imports
        if (ontology['owl:imports']) {
            const imports = Array.isArray(ontology['owl:imports']) ? ontology['owl:imports'] : [ontology['owl:imports']];
            for (const importDef of imports) {
                const importUrl = typeof importDef === 'string' ? importDef : importDef['@id'];
                if (importUrl) {
                    const DUMMY_BASE = 'http://localhost';
                    const baseUrl = new URL(url, DUMMY_BASE).href;
                    const absoluteUrl = new URL(importUrl, baseUrl).href;
                    await loadAndParseOntology(absoluteUrl, ontologyMap, loadedUrls, false);
                }
            }
        }
    } catch (error) {
        // Only re-throw if it's the initial call. Otherwise, just log and continue.
        if (isInitialCall) {
            throw error;
        } else {
            console.error(`Failed to load or parse imported ontology at ${url}`, error);
        }
    }
}


/**
 * Fetches and parses a JSON-LD ontology file and its imports to extract metadata.
 * @param {string} sector - The sector whose ontology needs to be loaded (e.g., 'construction').
 * @returns {Promise<Map<string, {label: string, comment: string}>|null>} A map of term metadata, or null on failure.
 */
export async function loadOntology(sector) {
    if (!sector) {
        console.error("loadOntology called with no sector.");
        return null;
    }

    const ontologyMap = new Map();
    const loadedUrls = new Set();
    let initialUrl;

    if (sector === 'dpp') {
        initialUrl = `../spec/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`;
    } else if (sector === 'general-product') {
        initialUrl = `../spec/ontology/${KEYSTONE_VERSION}/core/Product.jsonld`;
    } else if (sector === 'packaging') {
        initialUrl = `../spec/ontology/${KEYSTONE_VERSION}/core/Compliance.jsonld`;
    } else {
        const sectorPascalCase = sector.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');
        initialUrl = `../spec/ontology/${KEYSTONE_VERSION}/sectors/${sectorPascalCase}.jsonld`;
    }

    try {
        await loadAndParseOntology(initialUrl, ontologyMap, loadedUrls, true);

        // Second pass: resolve unit symbols
        for (const [key, term] of ontologyMap.entries()) {
            if (term.unit && typeof term.unit === 'string') {
                const unitTerm = ontologyMap.get(term.unit);
                if (unitTerm && unitTerm.unitSymbol) {
                    term.unit = unitTerm.unitSymbol;
                }
            }
        }

        return ontologyMap;
    } catch (error) {
        console.error(`Failed to execute ontology loading for sector: ${sector}`, error);
        return null;
    }
}

/**
 * Fetches and parses JSON-LD contexts to build a property-to-ontology-ID mapping.
 * @param {string} sector - The sector whose context needs to be loaded.
 * @returns {Promise<Map<string, string>>} A map of schema property paths to ontology IDs.
 */
export async function loadContext(sector) {
    if (!sector) return new Map();

    const contextMap = new Map();
    const loadedUrls = new Set();
    
    let initialUrl;
    if (sector === 'dpp') {
        initialUrl = `../spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`;
    } else if (sector === 'general-product') {
        initialUrl = `../spec/contexts/${KEYSTONE_VERSION}/dpp-general-product.context.jsonld`;
    } else if (sector === 'packaging') {
        initialUrl = `../spec/contexts/${KEYSTONE_VERSION}/dpp-packaging.context.jsonld`;
    } else {
        initialUrl = `../spec/contexts/${KEYSTONE_VERSION}/dpp-${sector}.context.jsonld`;
    }

    async function processContext(url) {
        if (loadedUrls.has(url)) return;
        loadedUrls.add(url);

        try {
            // Rewrite URL for local relative path
            let fetchUrl = url;
            if (url.startsWith('https://dpp-keystone.org/spec/contexts/')) {
                fetchUrl = url.replace('https://dpp-keystone.org/spec/contexts/', '../spec/contexts/');
            }
            
            // Handle v3 replacement
            fetchUrl = fetchUrl.replace('v3', KEYSTONE_VERSION);

            const response = await fetch(fetchUrl);
            if (!response.ok) return;
            const data = await response.json();

            async function flattenContext(ctxObj, prefix = '') {
                if (!ctxObj) return;

                // If @context is an array, process each item
                if (Array.isArray(ctxObj)) {
                    for (const item of ctxObj) {
                        if (typeof item === 'string') {
                            await processContext(item);
                        } else if (typeof item === 'object') {
                            await flattenContext(item, prefix);
                        }
                    }
                    return;
                }

                // If it's a standard object context
                for (const [key, value] of Object.entries(ctxObj)) {
                    if (key === '@context') {
                        if (typeof value === 'string') {
                            await processContext(value);
                        } else {
                            await flattenContext(value, prefix);
                        }
                        continue;
                    }
                    if (key.startsWith('@')) continue;

                    const fullKey = prefix ? `${prefix}.${key}` : key;

                    if (typeof value === 'string') {
                        let ontologyId = value;
                        if (ontologyId.includes(':')) ontologyId = ontologyId.split(':')[1];
                        contextMap.set(fullKey, ontologyId);
                        if (!contextMap.has(key)) contextMap.set(key, ontologyId); // global fallback if not set
                    } else if (typeof value === 'object') {
                        if (value['@id']) {
                            let ontologyId = value['@id'];
                            if (ontologyId.includes(':')) ontologyId = ontologyId.split(':')[1];
                            contextMap.set(fullKey, ontologyId);
                            if (!contextMap.has(key)) contextMap.set(key, ontologyId); // global fallback if not set
                        }
                        // Recurse into scoped contexts
                        if (value['@context']) {
                            await flattenContext(value['@context'], fullKey);
                        }
                    }
                }
            }

            if (data['@context']) {
                await flattenContext(data['@context']);
            }
        } catch (error) {
            console.error(`Failed to load context: ${url}`, error);
        }
    }

    await processContext(initialUrl);
    return contextMap;
}