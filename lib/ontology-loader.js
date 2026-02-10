// src/wizard/ontology-loader.js

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

    // Handle single language-tagged object
    if (property['@value']) return property['@value'];

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
function rewriteUrl(url) {
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
        const urlMatch = fetchUrl.match(/ontology\/v1\/(.+?)\/(.+?)\.jsonld/);
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
                const governedBy = getSingleRdfsValue(term['dppk:governedBy']);
                const source = getSingleRdfsValue(term['dcterms:source']);
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
                const hasSource = source && source.length > 0;
                const hasDomain = domain && domain.length > 0;
                const hasOneOf = oneOf && oneOf.length > 0;

                if (hasLabel || hasComment || hasUnit || hasGov || hasRange || hasSource || hasDomain || hasOneOf) {
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
        initialUrl = '../spec/ontology/v1/dpp-ontology.jsonld';
    } else if (sector === 'general-product') {
        initialUrl = '../spec/ontology/v1/core/Product.jsonld';
    } else if (sector === 'packaging') {
        initialUrl = '../spec/ontology/v1/core/Compliance.jsonld';
    } else {
        const sectorPascalCase = sector.charAt(0).toUpperCase() + sector.slice(1);
        initialUrl = `../spec/ontology/v1/sectors/${sectorPascalCase}.jsonld`;
    }

    try {
        await loadAndParseOntology(initialUrl, ontologyMap, loadedUrls, true);
        return ontologyMap;
    } catch (error) {
        console.error(`Failed to execute ontology loading for sector: ${sector}`, error);
        return null;
    }
}