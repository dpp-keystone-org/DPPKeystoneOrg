/**
 * Lightweight, dependency-free validation functions for the DPP Wizard.
 */

/**
 * Checks if a string is a valid, absolute URI.
 * A simple check for a scheme is sufficient for user guidance.
 * @param {string} value The string to validate.
 * @returns {boolean} True if the string is a valid URI.
 */
export function isURI(value) {
    if (typeof value !== 'string' || value.trim() === '') {
        return false;
    }
    // We are checking for a common scheme followed by ://
    // This covers http, https, ftp, etc. and is good enough for user input validation.
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

const iso31661Alpha3Codes = new Set([
    "AFG", "ALB", "DZA", "ASM", "AND", "AGO", "AIA", "ATA", "ATG", "ARG",
    "ARM", "ABW", "AUS", "AUT", "AZE", "BHS", "BHR", "BGD", "BRB", "BLR",
    "BEL", "BLZ", "BEN", "BMU", "BTN", "BOL", "BES", "BIH", "BWA", "BVT",
    "BRA", "IOT", "BRN", "BGR", "BFA", "BDI", "CPV", "KHM", "CMR", "CAN",
    "CYM", "CAF", "TCD", "CHL", "CHN", "CXR", "CCK", "COL", "COM", "COG",
    "COD", "COK", "CRI", "HRV", "CUB", "CUW", "CYP", "CZE", "CIV", "DNK",
    "DJI", "DMA", "DOM", "ECU", "EGY", "SLV", "GNQ", "ERI", "EST", "SWZ",
    "ETH", "FLK", "FRO", "FJI", "FIN", "FRA", "GUF", "PYF", "ATF", "GAB",
    "GMB", "GEO", "DEU", "GHA", "GIB", "GRC", "GRL", "GRD", "GLP", "GUM",
    "GTM", "GGY", "GIN", "GNB", "GUY", "HTI", "HMD", "VAT", "HND", "HKG",
    "HUN", "ISL", "IND", "IDN", "IRN", "IRQ", "IRL", "IMN", "ISR", "ITA",
    "JAM", "JPN", "JEY", "JOR", "KAZ", "KEN", "KIR", "PRK", "KOR", "KWT",
    "KGZ", "LAO", "LVA", "LBN", "LSO", "LBR", "LBY", "LIE", "LTU", "LUX",
    "MAC", "MDG", "MWI", "MYS", "MDV", "MLI", "MLT", "MHL", "MTQ", "MRT",
    "MUS", "MYT", "MEX", "FSM", "MDA", "MCO", "MNG", "MNE", "MSR", "MAR",
    "MOZ", "MMR", "NAM", "NRU", "NPL", "NLD", "NCL", "NZL", "NIC", "NER",
    "NGA", "NIU", "NFK", "MKD", "MNP", "NOR", "OMN", "PAK", "PLW", "PSE",
    "PAN", "PNG", "PRY", "PER", "PHL", "PCN", "POL", "PRT", "PRI", "QAT",
    "REU", "ROU", "RUS", "RWA", "BLM", "SHN", "KNA", "LCA", "MAF", "SPM",
    "VCT", "WSM", "SMR", "STP", "SAU", "SEN", "SRB", "SYC", "SLE", "SGP",
    "SXM", "SVK", "SVN", "SLB", "SOM", "ZAF", "SGS", "SSD", "ESP", "LKA",
    "SDN", "SUR", "SJM", "SWE", "CHE", "SYR", "TWN", "TJK", "TZA", "THA",
    "TLS", "TGO", "TKL", "TON", "TTO", "TUN", "TUR", "TKM", "TCA", "TUV",
    "UGA", "UKR", "ARE", "GBR", "UMI", "USA", "URY", "UZB", "VUT", "VEN",
    "VNM", "VGB", "VIR", "WLF", "ESH", "YEM", "ZMB", "ZWE", "ALA"
]);

/**
 * Checks if a string is a valid ISO 3166-1 alpha-3 country code.
 * @param {string} value The string to validate.
 * @returns {boolean} True if the string is a valid code.
 */
export function isCountryCodeAlpha3(value) {
    if (typeof value !== 'string') return false;
    return iso31661Alpha3Codes.has(value.toUpperCase());
}

/**
 * Checks if a value is a valid number.
 * @param {string} value The value to validate.
 * @returns {boolean} True if the value is a number.
 */
export function isNumber(value) {
    if (value === null || String(value).trim() === '') {
        return false;
    }
    // The unary plus operator is a concise way to convert a value to a number.
    // We then check if the result is a finite number.
    return !isNaN(+value) && isFinite(+value);
}

/**
 * Checks if a value is a valid integer.
 * @param {string} value The value to validate.
 * @returns {boolean} True if the value is an integer.
 */
export function isInteger(value) {
    if (!isNumber(value)) return false;
    return parseFloat(value) % 1 === 0;
}

/**
 * Validates text input for control characters.
 * @param {string} value The text to validate.
 * @returns {{isValid: boolean, message?: string}} The validation result.
 */
export function validateText(value) {
    if (typeof value !== 'string') return { isValid: true };
    
    // Check for control characters (excluding standard whitespace like space, tab, newline)
    // eslint-disable-next-line no-control-regex
    const controlChars = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/;
    if (controlChars.test(value)) {
        return { isValid: false, message: 'Invalid characters detected' };
    }
    
    return { isValid: true };
}

/**
 * Validates a custom field key (strict camelCase).
 * @param {string} value The key to validate.
 * @returns {{isValid: boolean, message?: string}} The validation result.
 */
export function validateKey(value) {
    if (!value || !value.trim()) return { isValid: false, message: 'Key cannot be empty' };
    
    const reserved = ['__proto__', 'constructor', 'prototype'];
    if (reserved.includes(value)) return { isValid: false, message: 'Reserved word not allowed' };

    const camelCaseRegex = /^[a-z][a-zA-Z0-9]*$/;
    if (!camelCaseRegex.test(value)) {
        return { isValid: false, message: 'Name must be camelCase (e.g., myProperty)' };
    }

    return { isValid: true };
}
