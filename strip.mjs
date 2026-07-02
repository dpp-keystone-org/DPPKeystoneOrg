import { promises as fs } from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';

const PROJECT_ROOT = process.cwd();

const htmlFiles = [
    'index.html',
    'src/wizard/index.html',
    'src/validator/index.html',
    'src/explorer/index.html',
    'src/csv-dpp-adapter/index.html'
];

async function stripText() {
    for (const file of htmlFiles) {
        const fullPath = path.join(PROJECT_ROOT, file);
        try {
            let content = await fs.readFile(fullPath, 'utf-8');
            const $ = cheerio.load(content, { recognizeSelfClosing: true });
            let modified = false;

            $('[data-i18n-key]').each((i, el) => {
                const $el = $(el);
                if (el.tagName.toLowerCase() === 'input' && $el.attr('placeholder') !== undefined) {
                    $el.attr('placeholder', '');
                    modified = true;
                } else {
                    $el.empty();
                    modified = true;
                }
            });

            if (modified) {
                // Formatting might be slightly altered by cheerio, but we accept this for the clean source
                await fs.writeFile(fullPath, $.html(), 'utf-8');
                console.log(`Stripped text from ${file}`);
            }
        } catch (error) {
            console.error(`Error processing ${file}:`, error);
        }
    }
}

stripText().catch(console.error);
