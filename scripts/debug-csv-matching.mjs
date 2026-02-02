import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Papa from 'papaparse';
import { SYNONYM_MAP } from '../src/lib/csv-adapter-logic.js';

// We need to replicate the flattening logic or manually list available fields.
// Since schema loading is complex (involves fetch or reading JSONLDs), let's see if we can just 
// import the schema loader or if it's easier to mock a large list of fields.
// Ideally, we want the REAL fields.
// Let's try to import schema-loader, but it might depend on `fetch`.
// If we are in Node, `fetch` might need a polyfill or we can read files directly.
// Let's rely on a manual list of expected fields for now, effectively mocking the "available schema",
// but populating it with a comprehensive list from our knowledge or a dumped list.
// Actually, reading the ontology/schema files is best.

// Wait, I can't easily use the browser-based schema loader in Node without some mocking.
// Let's define a "Standard Field List" that mimics what the browser would have for Construction + Core.

const MOCK_AVAILABLE_FIELDS = [
    // Core
    "id",
    "dppStatus",
    "lastUpdate",
    "productName",
    "description",
    "tradeName",
    "identifiers.gtin",
    "identifiers.serialNumber",
    "manufacturer.name",
    "manufacturer.location.streetAddress",
    "manufacturer.location.postalCode",
    "manufacturer.location.city",
    "manufacturer.location.country",
    "manufacturer.contact.phoneNumber",
    "manufacturer.contact.email",
    "manufacturer.contact.website",
    "physicalDimensions.weight",
    "physicalDimensions.width",
    "physicalDimensions.height",
    "physicalDimensions.depth",
    "physicalDimensions.length",
    "sustainability.recycledContent",
    "lifespan.manufactureDate",
    // Construction Specific (mock examples)
    "declarationOfPerformance.id",
    "declarationOfPerformance.dateOfIssue",
    "declarationOfPerformance.tensileStrength",
    "declarationOfPerformance.modulusElasticity",
    "declarationOfPerformance.capillaryAbsorption",
    "declarationOfPerformance.declaredUnit",
    "declarationOfPerformance.functionalUnit",
    "declarationOfPerformance.serviceLife",
    "declarationOfPerformance.dangerousSubstances",
    "declarationOfPerformance.reactionToFire",
    "declarationOfPerformance.chlorideContent",
    "declarationOfPerformance.bondStrength",
    "declarationOfPerformance.thermalCompatibility",
    "declarationOfPerformance.carbonationResistance",
    "declarationOfPerformance.elasticRecovery",
    "declarationOfPerformance.flowResistance",
    // EPD
    "environmentalProfile.gwp.a1",
    "environmentalProfile.gwp.a2",
    "environmentalProfile.gwp.a3",
    "environmentalProfile.gwp.a4",
    "environmentalProfile.gwp.c1",
    "environmentalProfile.gwp.c2",
    "environmentalProfile.gwp.c3",
    "environmentalProfile.gwp.c4",
    "environmentalProfile.gwp.d",
    "environmentalProfile.gwp.total",
    
    "environmentalProfile.odp.a1",
    "environmentalProfile.odp.a2",
    "environmentalProfile.odp.a3",
    "environmentalProfile.odp.a4",
    "environmentalProfile.odp.c1",
    "environmentalProfile.odp.c2",
    "environmentalProfile.odp.c3",
    "environmentalProfile.odp.c4",
    "environmentalProfile.odp.d",
    "environmentalProfile.odp.total",

    "environmentalProfile.ap.a1",
    "environmentalProfile.ap.a2",
    "environmentalProfile.ap.a3",
    "environmentalProfile.ap.a4",
    "environmentalProfile.ap.c1",
    "environmentalProfile.ap.c2",
    "environmentalProfile.ap.c3",
    "environmentalProfile.ap.c4",
    "environmentalProfile.ap.d",
    "environmentalProfile.ap.total",
    
    // ... assume others follow same pattern
];

// Helper: Levenshtein (copied because we can't import private functions easily without exposing them)
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

const normalize = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');

function checkMatch(header, availableFields) {
    if (!header) return { match: null, stage: 'None' };
    const normalizedHeader = normalize(header);

    // Stage 1: Exact
    const exact = availableFields.find(f => normalize(f) === normalizedHeader);
    if (exact) return { match: exact, stage: '1. Exact Match' };

    // Stage 2: Synonym
    for (const [term, target] of Object.entries(SYNONYM_MAP)) {
        if (normalize(term) === normalizedHeader) {
            const targetMatch = availableFields.find(f => f === target);
            if (targetMatch) return { match: targetMatch, stage: '2. Synonym' };
        }
    }

    // Stage 3: Leaf
    const leafMatches = availableFields.filter(f => {
        const parts = f.split('.');
        const leaf = parts[parts.length - 1];
        return normalize(leaf) === normalizedHeader;
    });
    if (leafMatches.length > 0) {
        leafMatches.sort((a, b) => a.length - b.length);
        return { match: leafMatches[0], stage: '3. Leaf Match' };
    }

    // Stage 4: Fuzzy
    let bestFuzzy = null;
    let minDist = Infinity;
    const MAX_DIST = 3;

    for (const field of availableFields) {
        const parts = field.split('.');
        const leaf = parts[parts.length - 1];
        const nField = normalize(field);
        const nLeaf = normalize(leaf);

        const leafDist = levenshteinDistance(normalizedHeader, nLeaf);
        const fullDist = levenshteinDistance(normalizedHeader, nField);
        const currentBest = Math.min(leafDist, fullDist);

        if (currentBest <= MAX_DIST && currentBest < minDist) {
            minDist = currentBest;
            bestFuzzy = field;
        }
    }

    if (bestFuzzy) return { match: bestFuzzy, stage: `4. Fuzzy (Dist: ${minDist})` };

    // Stage 5: Acronym
    function generateAcronym(text) {
        if (!text) return '';
        // If the text has spaces, split by space first (for headers like "DOPC Tensile Strength")
        if (text.includes(' ')) {
            return text.split(' ').map(p => p.charAt(0).toLowerCase()).join('');
        }
        // Fallback to camelCase splitting
        const parts = text.split(/(?=[A-Z])/);
        return parts.map(p => p.charAt(0).toLowerCase()).join('');
    }
    function generatePathAcronym(path) {
        if (!path) return '';
        return path.split('.').map(segment => {
            if (segment.length < 4 && !/[A-Z]/.test(segment)) return segment;
            return generateAcronym(segment);
        }).join('');
    }

    // Generate acronym for the HEADER
    const headerAcronym = generateAcronym(header);
    const normalizedHeaderAcronym = normalize(headerAcronym);

    let bestAcronym = null;
    let minAcronymDist = Infinity;
    
    for (const field of availableFields) {
        const acronym = generatePathAcronym(field);
        const normalizedAcronym = normalize(acronym);
        
        // Compare Header Acronym vs Field Acronym
        const dist = levenshteinDistance(normalizedHeaderAcronym, normalizedAcronym);
        
        // Also compare Normalized Header vs Field Acronym (fallback for EPD GWP A1 which might not condense well if we just take first letters? 
        // "EPD GWP A1" -> "ega" (first letters). 
        // "environmentalProfile.gwp.a1" -> "epgwpa1".
        // "ega" vs "epgwpa1" -> No match.
        // So we need BOTH strategies or a better acronym generator for Headers.
        
        // Let's stick to the current "Header (normalized) vs Field Acronym" logic AS WELL, 
        // or improve Header Acronym generation.
        // "EPD GWP A1" -> We probably want "epdgwpa1" if we treat it as words?
        // But generateAcronym("EPD GWP A1") -> "ega" if we just take first chars.
        
        // Let's try:
        // 1. Normalized Header vs Field Acronym (Old way - worked for EPD GWP A1)
        const dist1 = levenshteinDistance(normalizedHeader, normalizedAcronym);
        
        // 2. Header Acronym vs Field Acronym (New way - for DOPC Tensile Strength)
        const dist2 = levenshteinDistance(normalizedHeaderAcronym, normalizedAcronym);
        
        const currentDist = Math.min(dist1, dist2);

        const maxAcronymDist = Math.min(2, Math.floor(normalizedAcronym.length / 3));

        if (currentDist <= maxAcronymDist && currentDist < minAcronymDist) {
            minAcronymDist = currentDist;
            bestAcronym = field;
        }
    }

    if (bestAcronym) return { match: bestAcronym, stage: `5. Acronym (Dist: ${minAcronymDist})` };

    return { match: null, stage: 'None' };
}


async function runDebug() {
    const csvPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/examples/csv/construction-product.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf8');

    const results = Papa.parse(csvContent, { header: true });
    const headers = results.meta.fields;

    console.log(`\nAnalyzing ${headers.length} CSV Headers against mock schema...\n`);
    console.log(`| CSV Header | Match Found | Stage |
`);
    console.log(`|---|---|---|
`);

    let stats = { exact: 0, synonym: 0, leaf: 0, fuzzy: 0, none: 0 };

    headers.forEach(header => {
        const result = checkMatch(header, MOCK_AVAILABLE_FIELDS);
        const shortStage = result.stage.split('(')[0].trim();
        
        console.log(`| ${header} | ${result.match || '❌'} | ${result.stage} |
`);

        if (shortStage.includes('Exact')) stats.exact++;
        else if (shortStage.includes('Synonym')) stats.synonym++;
        else if (shortStage.includes('Leaf')) stats.leaf++;
        else if (shortStage.includes('Fuzzy')) stats.fuzzy++;
        else stats.none++;
    });

    console.log('\n--- Summary ---');
    console.log(`Exact Matches: ${stats.exact}`);
    console.log(`Synonym Matches: ${stats.synonym}`);
    console.log(`Leaf Matches: ${stats.leaf}`);
    console.log(`Fuzzy Matches: ${stats.fuzzy}`);
    console.log(`No Match: ${stats.none}`);
}

runDebug();
