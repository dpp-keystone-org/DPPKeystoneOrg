import { setProperty, compactArrays } from './dpp-data-utils.js';

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

    // 4. Post-processing: Apply Array Indices
    // We must convert "root.prop" to "root[i].prop" for all array fields
    // to ensure setProperty creates arrays correctly.
    
    // Group headers by Array Root
    const arrayRoots = {}; // "root" -> [headers]
    const fieldIsArrayMap = new Map();
    normalizedFields.forEach(f => fieldIsArrayMap.set(f.path, f.isArray));

    for (const [header, path] of Object.entries(mapping)) {
        if (fieldIsArrayMap.get(path)) {
            const root = path.split('.')[0];
            if (!arrayRoots[root]) arrayRoots[root] = [];
            arrayRoots[root].push(header);
        }
    }

    // Process each Array Root
    for (const [root, headers] of Object.entries(arrayRoots)) {
        // Group by numeric ID in header
        const idGroups = new Map(); // id (int) -> [headers]
        const noIdHeaders = [];

        headers.forEach(h => {
            const match = h.match(/(\d+)/);
            if (match) {
                const id = parseInt(match[1], 10);
                if (!idGroups.has(id)) idGroups.set(id, []);
                idGroups.get(id).push(h);
            } else {
                noIdHeaders.push(h);
            }
        });

        const sortedIds = Array.from(idGroups.keys()).sort((a, b) => a - b);
        let currentIndex = 0;

        // Assign indices for numbered groups
        sortedIds.forEach(id => {
            const groupHeaders = idGroups.get(id);
            groupHeaders.forEach(h => {
                const originalPath = mapping[h];
                const parts = originalPath.split('.');
                parts[0] = `${root}[${currentIndex}]`;
                mapping[h] = parts.join('.');
            });
            currentIndex++;
        });

        // Assign indices for unnumbered headers
        if (noIdHeaders.length > 0) {
            noIdHeaders.sort(); // Alpha sort for stability
            
            const currentGroupPaths = new Set();
            
            noIdHeaders.forEach(h => {
                const path = mapping[h];
                // If we've already seen this path in the current index group,
                // it means we have a collision (e.g. "Doc A" -> refDocs, "Doc B" -> refDocs).
                // We must start a new item/index.
                if (currentGroupPaths.has(path)) {
                    currentIndex++;
                    currentGroupPaths.clear();
                }
                
                currentGroupPaths.add(path);
                
                const parts = path.split('.');
                parts[0] = `${root}[${currentIndex}]`;
                mapping[h] = parts.join('.');
            });
            // If we processed any unnumbered headers, ensure we increment for safety if logic continues
            // (though loop ends here for this root)
        }
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


/**
 * Scans the current mapping to find which indices are already used for a given array root.
 * 
 * @param {Object} mapping - Current mapping { "Header": "path" }
 * @param {string} arrayRoot - The root path of the array (e.g., "materialComposition")
 * @returns {Set<number>} Set of used indices
 */
export function findUsedIndices(mapping, arrayRoot) {
    const indices = new Set();
    if (!mapping || !arrayRoot) return indices;

    const regex = new RegExp(`^${escapeRegExp(arrayRoot)}\\[(\\d+)\\]`);

    for (const path of Object.values(mapping)) {
        if (!path) continue;
        const match = path.match(regex);
        if (match) {
            indices.add(parseInt(match[1], 10));
        }
    }
    return indices;
}

/**
 * Generates specific indexed path suggestions for an array field.
 * Returns paths for all currently used indices (to join objects) 
 * plus one for the next available index (to start a new object).
 * 
 * @param {Object} field - { path, isArray }
 * @param {Set<number>} usedIndices - Indices currently used in the mapping for this array
 * @returns {Array<{value: string, type: 'existing'|'new', index: number}>} List of suggestion objects
 */
export function generateIndexedSuggestions(field, usedIndices) {
    if (!field.isArray) {
        // Return structured object for scalar (though usually not called for scalars by UI logic, but good for safety)
        return [{ value: field.path, type: 'scalar', index: -1 }];
    }

    const parts = field.path.split('.');
    const root = parts[0];
    const rest = parts.slice(1).join('.');
    const suggestions = [];

    // 1. Suggest joining existing items
    const sortedIndices = Array.from(usedIndices).sort((a, b) => a - b);
    for (const idx of sortedIndices) {
        suggestions.push({
            value: `${root}[${idx}].${rest}`,
            type: 'existing',
            index: idx
        });
    }

    // 2. Suggest starting a new item
    // If no indices used, start at 0.
    // Otherwise, start at max + 1.
    const nextIndex = sortedIndices.length > 0 ? sortedIndices[sortedIndices.length - 1] + 1 : 0;
    suggestions.push({
        value: `${root}[${nextIndex}].${rest}`,
        type: 'new',
        index: nextIndex
    });

    return suggestions;
}

function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
        
        // Post-process to remove holes from arrays (e.g. from indices like [0], [2])
        compactArrays(dpp);
        
        return dpp;
    });
}