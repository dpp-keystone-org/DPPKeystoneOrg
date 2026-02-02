import { findBestMatch } from '../../src/lib/csv-adapter-logic.js';

// Copied helpers for debugging
const normalize = s => s.replace(/%/g, 'Percentage').toLowerCase().replace(/[^a-z0-9]/g, '');

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

describe('CSV Adapter Logic Reproduction', () => {
    const availableFields = [
        'image.contentType',
        'image.resourceTitle',
        'manufacturer.name',
        'physicalDimensions.weight',
        'identifiers.gtin'
    ];

    test('reproduce bad match for "Image 1 Title"', () => {
        const header = "Image 1 Title";
        const result = findBestMatch(header, availableFields);
        console.log(`Header: "${header}" matched: "${result}"`);
    });

    test('debug scores for "Image 1 Title" vs "image.contentType"', () => {
        const header = "Image 1 Title";
        const field = "image.contentType";
        
        const normHeader = normalize(header); // image1title
        const normField = normalize(field); // imagecontenttype
        const parts = field.split('.');
        const leaf = parts[parts.length - 1];
        const normLeaf = normalize(leaf); // contenttype
        
        console.log(`NormHeader: ${normHeader}`);
        console.log(`NormField: ${normField}`);
        console.log(`NormLeaf: ${normLeaf}`);

        // Fuzzy
        const leafDist = levenshteinDistance(normHeader, normLeaf);
        const fullDist = levenshteinDistance(normHeader, normField);
        console.log(`Fuzzy Leaf Dist: ${leafDist}`);
        console.log(`Fuzzy Full Dist: ${fullDist}`);
        
        const hLen = normHeader.length;
        let fuzzyThreshold;
        if (hLen <= 4) fuzzyThreshold = 0;
        else if (hLen <= 8) fuzzyThreshold = 1;
        else fuzzyThreshold = 3;
        console.log(`Fuzzy Threshold: ${fuzzyThreshold}`);

        // Acronym
        const headerAcronym = generateAcronym(header); // i1t
        const fieldAcronym = generatePathAcronym(field); // imagect
        const normHeaderAcronym = normalize(headerAcronym);
        const normFieldAcronym = normalize(fieldAcronym);

        console.log(`Header Acronym: ${headerAcronym}`);
        console.log(`Field Acronym: ${fieldAcronym}`);

        const acrDistA = levenshteinDistance(normHeader, normFieldAcronym);
        const acrDistB = levenshteinDistance(normHeaderAcronym, normFieldAcronym);
        console.log(`Acronym Dist A (NormHeader vs FieldAcr): ${acrDistA}`);
        console.log(`Acronym Dist B (HeaderAcr vs FieldAcr): ${acrDistB}`);
        
        const acrThreshold = Math.min(2, Math.floor(normFieldAcronym.length / 3));
        console.log(`Acronym Threshold: ${acrThreshold}`);
    });

    test('should NOT match "Category" to "color" via single-letter acronyms', () => {
        // "Category" -> Acronym "c"
        // "color" -> Acronym "c"
        // This is a bad match.
        const header = "Category";
        // Mock fields where 'color' exists. 
        // We want to ensure it returns null (or at least NOT 'color' if there's no better match).
        const fields = ['color', 'description', 'id'];
        
        const result = findBestMatch(header, fields);
        console.log(`Header: "${header}" matched: "${result}"`);
        
        // Expectation: null (or definitely not 'color')
        if (result === 'color') {
            throw new Error('False positive: "Category" matched "color"');
        }
    });
});
