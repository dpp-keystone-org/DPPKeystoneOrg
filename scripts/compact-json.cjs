const fs = require('fs');
const path = require('path');

// Default directories to process if no arguments are provided
const DEFAULT_PATHS = [
    path.join('src'),
    'index.i18n.json'
];

function getAllFiles(dirPath, arrayOfFiles) {
    const files = fs.readdirSync(dirPath);

    arrayOfFiles = arrayOfFiles || [];

    files.forEach(function(file) {
        const fullPath = path.join(dirPath, file);
        if (fs.statSync(fullPath).isDirectory()) {
            arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
        } else {
            if (file.endsWith('.json') || file.endsWith('.jsonld') || file.endsWith('.jsonc')) {
                arrayOfFiles.push(fullPath);
            }
        }
    });

    return arrayOfFiles;
}

function processFile(filePath) {
    try {
        const rawContent = fs.readFileSync(filePath, 'utf8');
        let content = rawContent;

        // Protect {{VERSION}} from regex matches that might incorrectly match its closing braces
        content = content.replaceAll('{{VERSION}}', '__DPP_VERSION_TOKEN__');

        // The original script would JSON.parse and then JSON.stringify here.
        // That would strip comments. By operating on the raw text, we can
        // preserve comments. This means, however, that we cannot re-format
        // the JSON structure, and rely on the RegEx below to be flexible
        // enough to handle JSON that is not "perfectly" formatted.

        // Expand Language Arrays, sort them (en first, then alphabetical), and align indentation
        content = content.replace(/^([ \t]*)"([^"]+)"\s*:\s*\[\s*(\{\s*"@language"[\s\S]*?)\s*\]/gm, (match, indent, key, inner) => {
            // Split inner into individual objects by comma (ensuring we split only between objects)
            let items = inner.split(/(?<=\})\s*,\s*(?=\{)/).map(s => s.trim());
            
            // Sort items
            items.sort((a, b) => {
                let langA = (a.match(/"@language"\s*:\s*"([^"]+)"/) || [])[1] || '';
                let langB = (b.match(/"@language"\s*:\s*"([^"]+)"/) || [])[1] || '';
                
                if (langA === 'en') return -1;
                if (langB === 'en') return 1;
                
                return langA.localeCompare(langB);
            });
            
            let expanded = items.join(`,\n${indent}  `);
            return `${indent}"${key}": [\n${indent}  ${expanded}\n${indent}]`;
        });

        // Collapse Language Objects
        // Case A: @language first
        // Matches: { "@language": "...", "@value": ... }
        content = content.replace(
            /\{\s*"@language":\s*"([^"]+)",\s*"@value":\s*(.*?)\s*\}/gs,
            (match, lang, val) => `{ "@language": "${lang}", "@value": ${val} }`
        );

        // Case B: @value first (Handle inconsistent key order from JSON.stringify)
        // Matches: { "@value": ..., "@language": "..." }
        content = content.replace(
            /\{\s*"@value":\s*(.*?),\s*"@language":\s*"([^"]+)"\s*\}/gs,
            (match, val, lang) => `{ "@language": "${lang}", "@value": ${val} }`
        );

        // Collapse ID Objects
        // Matches: { "@id": "..." }
        content = content.replace(
            /\{\s*"@id":\s*"([^"]+)"\s*\}/gs,
            (match, id) => `{ "@id": "${id}" }`
        );

        // Collapse Type Objects
        // Matches: { "@type": "..." }
        content = content.replace(
            /\{\s*"@type":\s*"([^"]+)"\s*\}/gs,
            (match, type) => `{ "@type": "${type}" }`
        );

        // Restore {{VERSION}}
        content = content.replaceAll('__DPP_VERSION_TOKEN__', '{{VERSION}}');

        fs.writeFileSync(filePath, content);
        console.log(`Compacted: ${filePath}`);
    } catch (err) {
        console.error(`Error processing ${filePath}:`, err.message);
    }
}

// Main execution
const args = process.argv.slice(2);
let targetPaths = args.length > 0 ? args : DEFAULT_PATHS;

// Resolve paths relative to cwd if necessary, mostly they are good as is
const rootDir = process.cwd();

const allFiles = [];

targetPaths.forEach(target => {
    const fullTarget = path.resolve(rootDir, target);
    if (!fs.existsSync(fullTarget)) {
        console.warn(`Warning: Path not found: ${target}`);
        return;
    }

    if (fs.statSync(fullTarget).isDirectory()) {
        getAllFiles(fullTarget, allFiles);
    } else {
        allFiles.push(fullTarget);
    }
});

if (allFiles.length === 0) {
    console.log("No JSON/JSONLD files found to process.");
} else {
    console.log(`Processing ${allFiles.length} files...`);
    allFiles.forEach(processFile);
    console.log("Done.");
}