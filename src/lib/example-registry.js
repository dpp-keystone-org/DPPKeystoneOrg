/**
 * Registry of available DPP examples for use in tools like Validator.
 * Paths are relative to the 'validator' or 'wizard' page location (e.g. src/validator/index.html).
 * In dist structure: validator/index.html is sibling to examples/ folder? 
 * No, dist/validator/index.html and dist/examples/...
 * So path from validator/index.html to examples/file.json is '../examples/file.json'.
 */
export const EXAMPLES = {
    'Battery': '../spec/examples/battery-dpp-v1.json',
    'Construction Product': '../spec/examples/construction-product-dpp-v1.json',
    'Drill': '../spec/examples/drill-dpp-v1.json',
    'Drill (Private)': '../spec/examples/drill-dpp-v1-private.json',
    'Rail': '../spec/examples/rail-dpp-v1.json',
    'Textile (Sock)': '../spec/examples/sock-dpp-v1.json'
};
