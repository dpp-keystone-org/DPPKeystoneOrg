import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

async function findFiles(dir, exts, fileList = []) {
    const files = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const file of files) {
        const fullPath = path.join(dir, file.name);
        if (file.isDirectory()) {
            await findFiles(fullPath, exts, fileList);
        } else if (exts.some(ext => file.name.endsWith(ext))) {
            fileList.push(fullPath);
        }
    }
    return fileList;
}

async function run() {
    console.log('Validating I18N translation keys...');
    const i18nFiles = await findFiles(SRC_DIR, ['.i18n.json']);
    const sourceFiles = await findFiles(SRC_DIR, ['.html', '.js', '.mjs', '.cjs']);

    const validKeys = new Set();
    for (const file of i18nFiles) {
        try {
            const content = JSON.parse(await fs.promises.readFile(file, 'utf8'));
            Object.keys(content).forEach(key => validKeys.add(key));
        } catch (err) {
            console.error(`Error parsing JSON in ${file}:`, err.message);
            process.exit(1);
        }
    }

    let hasErrors = false;
    // Regex matches data-i18n-key="<key>" and data-i18n-key='<key>'
    const regex = /data-i18n-key=["']([^"']+)["']/g;

    for (const file of sourceFiles) {
        const content = await fs.promises.readFile(file, 'utf8');
        let match;
        while ((match = regex.exec(content)) !== null) {
            const key = match[1];
            if (!validKeys.has(key)) {
                console.error(`Missing translation key: "${key}" found in ${path.relative(PROJECT_ROOT, file)}`);
                hasErrors = true;
            }
        }
    }

    if (hasErrors) {
        console.error('I18N Validation Failed! One or more translation keys are missing in the .i18n.json files.');
        process.exit(1);
    } else {
        console.log('I18N Validation Passed.');
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
