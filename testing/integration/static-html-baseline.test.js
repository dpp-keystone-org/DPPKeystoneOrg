import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DIST_DIR = path.join(__dirname, '../../dist');
const BASELINE_DIR = path.join(__dirname, 'baseline-data');

// Helper to strip dynamic cache-busting ?v=1234567 strings so the HTML compares cleanly
function stripDynamicContent(html) {
    return html.replace(/\?v=\d+/g, '')
               .replace(/\s*data-i18n-key="[^"]+"/g, '')
               .replace(/LanguageManager\.init\([^)]*\)/g, 'LanguageManager.init()');
}

describe('Feature 6: Static HTML Baseline Tests', () => {
    const filesToTest = [
        { dist: 'index.html', baseline: 'index.html' },
        { dist: 'explorer/index.html', baseline: 'explorer-index.html' },
        { dist: 'csv-dpp-adapter/index.html', baseline: 'csv-dpp-adapter-index.html' },
        { dist: 'validator/index.html', baseline: 'validator-index.html' },
        { dist: 'wizard/index.html', baseline: 'wizard-index.html' }
    ];

    for (const file of filesToTest) {
        it(`should match the baseline HTML for ${file.dist} exactly`, async () => {
            const distPath = path.join(DIST_DIR, file.dist);
            const baselinePath = path.join(BASELINE_DIR, file.baseline);

            const distHtml = await fs.readFile(distPath, 'utf8');
            const baselineHtml = await fs.readFile(baselinePath, 'utf8');

            const normalizedDist = stripDynamicContent(distHtml);
            const normalizedBaseline = stripDynamicContent(baselineHtml);

            expect(normalizedDist).toBe(normalizedBaseline);
        });
    }
});
