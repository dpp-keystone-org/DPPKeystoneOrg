import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const filesToProcess = [
    'index.html',
    'src/explorer/index.html',
    'src/csv-dpp-adapter/index.html',
    'src/validator/index.html',
    'src/wizard/index.html'
];

function generateKey(text, existingKeys) {
    const cleanText = text.replace(/<[^>]*>/g, '').replace(/[<>]/g, '').trim();
    const words = cleanText.split(/[^a-zA-Z0-9]+/).filter(w => w.length > 0).slice(0, 5);
    let baseKey = words.map(w => w.toLowerCase()).join('-');
    
    if (!baseKey) {
        baseKey = 'text';
    }

    let key = baseKey;
    let counter = 1;
    while (existingKeys.has(key)) {
        key = `${baseKey}-${counter}`;
        counter++;
    }
    existingKeys.add(key);
    return key;
}

const blockTags = new Set(['div', 'section', 'header', 'footer', 'main', 'nav', 'ul', 'ol', 'table', 'tbody', 'thead', 'tr', 'form', 'body', 'head']);

function isTranslatableElement(el, $) {
    const tagName = el.tagName?.toLowerCase();
    if (!tagName) return false;
    
    if (['script', 'style', 'img', 'br', 'hr', 'input'].includes(tagName)) return false;

    let hasDirectText = false;
    let hasBlockChildren = false;

    for (const child of el.childNodes) {
        if (child.type === 'text') {
            if (child.data.trim().length > 0) {
                hasDirectText = true;
            }
        } else if (child.type === 'tag') {
            if (blockTags.has(child.name.toLowerCase())) {
                hasBlockChildren = true;
            }
        }
    }

    return hasDirectText && !hasBlockChildren;
}

function processInputs($, i18nMap, existingKeys) {
    $('input[placeholder]').each((_, el) => {
        const placeholder = $(el).attr('placeholder');
        if (placeholder && placeholder.trim().length > 0) {
            const key = generateKey(placeholder, existingKeys);
            $(el).attr('data-i18n-key', key);
            i18nMap[key] = [{ "@language": "en", "@value": placeholder }];
        }
    });
}

for (const relPath of filesToProcess) {
    const fullPath = path.join(rootDir, relPath);
    console.log(`\nProcessing ${relPath}...`);
    let originalHtml = fs.readFileSync(fullPath, 'utf8');
    
    // Do not use sourceCodeLocationInfo to avoid AST differences
    const $ = cheerio.load(originalHtml, { decodeEntities: false, recognizeSelfClosing: true });
    
    const existingKeys = new Set();
    const i18nMap = {};

    function walk(node) {
        if (node.type !== 'tag') return;

        if (['head', 'script', 'style'].includes(node.name.toLowerCase())) return;

        if (isTranslatableElement(node, $)) {
            const $node = $(node);
            
            // Skip elements that contain children with IDs, as they might be dynamic targets
            if ($node.find('[id]').length > 0 && $node[0].name !== 'label') {
                return;
            }

            if (!$node.attr('data-i18n-key')) {
                let innerHtml = $node.html();
                if (innerHtml && innerHtml.trim().length > 0) {
                    const cleanInner = innerHtml.trim();
                    const key = generateKey(cleanInner, existingKeys);
                    
                    $node.attr('data-i18n-key', key);
                    i18nMap[key] = [{ "@language": "en", "@value": cleanInner }];
                    console.log(`  Tagged: [${key}] -> ${cleanInner.substring(0, 50)}`);
                }
            }
            return;
        }

        for (const child of node.childNodes) {
            walk(child);
        }
    }

    const rootNodes = $.root()[0].childNodes;
    for (const node of rootNodes) {
        walk(node);
    }

    $('input[placeholder]').each((_, el) => {
        const placeholder = $(el).attr('placeholder');
        if (placeholder && placeholder.trim().length > 0) {
            const key = generateKey(placeholder, existingKeys);
            i18nMap[key] = [{ "@language": "en", "@value": placeholder }];
            $(el).attr('data-i18n-key', key);
            console.log(`  Tagged: [${key}] (placeholder) -> ${placeholder.substring(0, 50)}`);
        }
    });

    let outputHtml = $.html();
    
    // Fix LanguageManager.init()
    const jsonName = 'index.i18n.json'; // keep it uniform
    outputHtml = outputHtml.replace(/LanguageManager\.init\([^)]*\)/g, `LanguageManager.init('./${jsonName}')`);

    fs.writeFileSync(fullPath, outputHtml);
    
    const jsonPath = path.join(path.dirname(fullPath), jsonName);
    fs.writeFileSync(jsonPath, JSON.stringify(i18nMap, null, 2));
}

console.log("\nDone!");
