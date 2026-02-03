import { setProperty } from './dpp-data-utils.js?v=1770142271452';

/**
 * Map of common industry terms to standard DPP schema fields.
 * Keys should be lowercase for case-insensitive matching.
 */
export const SYNONYM_MAP = {
    'ean': 'identifiers.gtin',
    'gtin': 'identifiers.gtin',
    'brand': 'tradeName',
    'manufacturer': 'manufacturer.name',
    'expiry': 'lifespan.manufactureDate',
    'weight': 'physicalDimensions.weight',
    'width': 'physicalDimensions.width',
    'height': 'physicalDimensions.height',
    'depth': 'physicalDimensions.depth',
    'length': 'physicalDimensions.length'
};

/**
 * Calculates a match score between a CSV header and a schema field.
 * Lower score is better. 0 is perfect.
 * Returns Infinity if no meaningful match is found.
 * 
 * @param {string} header 
 * @param {string} field - Dot notation path
 * @returns {number} Score
 */
export function computeMatchScore(header, field) {
    if (!header || !field) return Infinity;

    const normalize = s => s.replace(/%/g, 'Percentage').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedHeader = normalize(header);
    const normalizedField = normalize(field);
    const parts = field.split('.');
    const leaf = parts[parts.length - 1];
    const normalizedLeaf = normalize(leaf);

    // 1. Exact Match (Full Path) -> Score 0
    if (normalizedField === normalizedHeader) return 0;

    // 2. Synonym Map -> Score 0.05
    for (const [term, target] of Object.entries(SYNONYM_MAP)) {
        if (normalize(term) === normalizedHeader && field === target) {
            return 0.05;
        }
    }

    // 3. Leaf Exact Match -> Score 0.1
    if (normalizedLeaf === normalizedHeader) return 0.1;

    let bestScore = Infinity;

    // 4. Fuzzy Match (Levenshtein)
    // We check both leaf and full path, keep the best.
    const leafDist = levenshteinDistance(normalizedHeader, normalizedLeaf);
    const fullDist = levenshteinDistance(normalizedHeader, normalizedField);
    const fuzzyDist = Math.min(leafDist, fullDist);

    // Dynamic Threshold
    const hLen = normalizedHeader.length;
    let fuzzyThreshold;
    if (hLen <= 4) fuzzyThreshold = 0;
    else if (hLen <= 8) fuzzyThreshold = 1;
    else fuzzyThreshold = 3;

    if (fuzzyDist <= fuzzyThreshold) {
        // Score = 1.0 + Distance (so fuzzy 0 is worse than Exact Leaf)
        const score = 1.0 + fuzzyDist;
        if (score < bestScore) bestScore = score;
    }

    // 5. Acronym Match
    const headerAcronym = generateAcronym(header);
    const normalizedHeaderAcronym = normalize(headerAcronym);
    const fieldAcronym = generatePathAcronym(field);
    const normalizedFieldAcronym = normalize(fieldAcronym);

    // 5A: Normalized Header vs Field Acronym
    const acrDistA = levenshteinDistance(normalizedHeader, normalizedFieldAcronym);
    
    // 5B: Header Acronym vs Field Acronym (only if header has >= 3 parts)
    let acrDistB = Infinity;
    if (headerAcronym.length >= 3) {
        acrDistB = levenshteinDistance(normalizedHeaderAcronym, normalizedFieldAcronym);
    }

    const acrDist = Math.min(acrDistA, acrDistB);
    const acrLen = normalizedFieldAcronym.length;
    const acrThreshold = acrLen < 4 ? 0 : Math.min(2, Math.floor(acrLen / 3));

    if (acrDist <= acrThreshold) {
        // Score = 1.0 + Distance (same weight as fuzzy)
        const score = 1.0 + acrDist;
        if (score < bestScore) bestScore = score;
    }

    // 6. Token Set Match
    const headerTokens = tokenize(header);
    const fieldTokens = tokenize(field);
    let intersection = 0;
    for (const t of fieldTokens) {
        if (headerTokens.has(t)) intersection++;
    }
    const union = new Set([...headerTokens, ...fieldTokens]).size;
    
    if (union > 0) {
        const jaccard = intersection / union;
        if (jaccard >= 0.4) {
            // Score = (1 - Jaccard) * 5. 
            // Range: 0.4 -> 3.0, 1.0 -> 0.0
            // But strict exact/acronym matches should win (0.0 - 0.2).
            // So let's map Jaccard 1.0 to 0.2 to be competitive?
            // Or keep as is. Jaccard 1.0 is effectively token-exact match.
            // Let's use: 0.2 + (1 - Jaccard) * 5
            const score = 0.2 + (1 - jaccard) * 5; 
            if (score < bestScore) bestScore = score;
        }
    }

    return bestScore;
}

/**
 * Generates an optimized mapping between CSV headers and Schema fields.
 * Uses a global greedy strategy to assign the best header-field pairs first.
 * 
 * @param {Array<string>} headers 
 * @param {Array<string|Object>} availableFields - List of paths (string) or field objects ({ path, isArray })
 * @returns {Object} map { "Header Name": "field.path" }
 */
export function generateAutoMapping(headers, availableFields) {
    if (!headers || !availableFields) return {};

    const candidates = [];

    // Normalize availableFields to objects for internal processing
    const normalizedFields = availableFields.map(f => {
        if (typeof f === 'string') return { path: f, isArray: false };
        return f;
    });

    // 1. Calculate all scores
    for (const header of headers) {
        for (const field of normalizedFields) {
            const score = computeMatchScore(header, field.path);
            if (score < 5.0) { // arbitrary cutoff for "hopeless"
                candidates.push({ header, field, score });
            }
        }
    }

    // 2. Sort by score (best first)
    candidates.sort((a, b) => a.score - b.score);

    const mapping = {};
    const usedHeaders = new Set();
    const usedFields = new Set();

    // 3. Greedy Assignment
    for (const cand of candidates) {
        if (usedHeaders.has(cand.header)) continue;
        
        // If the field is NOT an array, ensure it's used only once.
        // If it IS an array, we allow multiple headers to map to it (though usually handled by appending).
        if (!cand.field.isArray && usedFields.has(cand.field.path)) continue;

        mapping[cand.header] = cand.field.path;
        usedHeaders.add(cand.header);
        usedFields.add(cand.field.path);
    }

    return mapping;
}

/**
 * Legacy wrapper for backward compatibility (and single-header checks).
 * NOTE: This is "Local Optimization" only. Use generateAutoMapping for full CSVs.
 */
export function findBestMatch(header, availableFields) {
    if (!header || !availableFields) return null;
    let bestField = null;
    let bestScore = Infinity;

    for (const field of availableFields) {
        const score = computeMatchScore(header, field);
        if (score < bestScore) {
            bestScore = score;
            bestField = field;
        }
    }
    return bestField;
}


// --- Helpers ---

function tokenize(text) {
    if (!text) return new Set();
    const parts = text.replace(/%/g, 'Percentage')
                      .replace(/([a-z])([A-Z])/g, '$1 $2')
                      .split(/[\.\s_-]+/);
    const tokens = new Set();
    parts.forEach(p => {
        const clean = p.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (clean && clean.length > 0) tokens.add(clean);
    });
    return tokens;
}

function generateAcronym(text) {
    if (!text) return '';
    if (text.includes(' ')) {
        return text.split(' ').map(p => p.charAt(0).toLowerCase()).join('');
    }
    const parts = text.split(/(?=[A-Z])/);
    return parts.map(p => p.charAt(0).toLowerCase()).join('');
}

function generatePathAcronym(path) {
    if (!path) return '';
    return path.split('.').map(segment => {
        if (segment.length < 4 && !/[A-Z]/.test(segment)) {
            return segment;
        }
        return generateAcronym(segment);
    }).join('');
}

function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

export function generateDPPsFromCsv(csvData, mapping, sector) {
    if (!csvData || !mapping || !sector) return [];

    return csvData.map(row => {
        const dpp = {};
        const contextBase = 'https://dpp-keystone.org/spec/contexts/v1/';
        const contexts = [contextBase + 'dpp-core.context.jsonld'];
        if (Array.isArray(sector)) {
            sector.forEach(s => contexts.push(`${contextBase}dpp-${s}.context.jsonld`));
        } else {
            contexts.push(`${contextBase}dpp-${sector}.context.jsonld`);
        }
        dpp['@context'] = contexts;

        for (const [header, targetField] of Object.entries(mapping)) {
            let value = row[header];
            if (value === undefined) continue;
            if (value === 'true') value = true;
            if (value === 'false') value = false;
            if (typeof value === 'string' && value.trim() !== '') {
                const num = Number(value);
                if (!isNaN(num) && isFinite(num)) {
                    value = num;
                }
            }
            setProperty(dpp, targetField, value);
        }
        return dpp;
    });
}