import { promises as fs } from 'fs';
import path from 'path';
import fse from 'fs-extra'; // For copy and ensureDir
import { parse as jsoncParse, printParseErrorCode } from 'jsonc-parser';
import { execSync } from 'child_process';
import { generateSpecDocs } from './generate-spec-docs.mjs';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'src');
const BUILD_DIR = path.join(PROJECT_ROOT, 'dist');

const jsonFileExtensions = ['.json', '.jsonld'];

async function cleanAndCopyJsonFile(sourcePath, targetPath) {
    try {
        const content = await fs.readFile(sourcePath, 'utf-8');
        let errors = [];
        const cleanedContent = jsoncParse(content, errors, {
            allowTrailingComma: true,
            allowComments: true
        });

        if (errors.length > 0) {
            console.warn(`Warning: JSONC parsing errors in ${sourcePath}:`);
            errors.forEach(error => console.warn(`  ${printParseErrorCode(error.error)} at offset ${error.offset}`));
        }

        // Re-serialize to strip comments and ensure standard JSON format
        await fse.outputJson(targetPath, cleanedContent, { spaces: 2 });
        //console.log(`Cleaned and copied: ${sourcePath} -> ${targetPath}`);
    } catch (error) {
        console.error(`Error processing ${sourcePath}:`, error);
        throw error;
    }
}

async function processDirectory(sourceDir, targetDir) {
    await fse.ensureDir(targetDir);
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === 'desktop.ini' || entry.name === 'branding' || (sourceDir === SOURCE_DIR && (entry.name === 'index.html' || entry.name === 'util' || entry.name === 'lib' || entry.name === 'wizard' || entry.name === 'validator' || entry.name === 'explorer'))) {
            continue;
        }
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            await processDirectory(sourcePath, targetPath);
        } else if (jsonFileExtensions.includes(path.extname(entry.name))) {
            await cleanAndCopyJsonFile(sourcePath, targetPath);
        } else {
            // Copy other files directly (e.g., .md, .html, .css)
            await fse.copy(sourcePath, targetPath);
            //console.log(`Copied static file: ${sourcePath} -> ${targetPath}`);
        }
    }
}

async function createRedirects(targetDir) {
    console.log('Generating client-side redirects...');

    const redirectPath = path.join(targetDir, 'spec', 'v1', 'terms', 'index.html');
    // The target URL should be a relative path to work correctly on the deployed site.
    const redirectTarget = '/spec/ontology/v1/dpp-ontology.jsonld';
    
    // This HTML file uses a meta refresh tag to immediately redirect the user.
    const redirectContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <link rel="canonical" href="${redirectTarget}"/>
  <meta http-equiv="refresh" content="0; url=${redirectTarget}">
</head>
<body>
  <h1>Redirecting...</h1>
  <p>If you are not redirected automatically, follow this <a href="${redirectTarget}">link</a>.</p>
</body>
</html>`;

    await fse.outputFile(redirectPath, redirectContent);
    console.log(`Created redirect: /spec/v1/terms/index.html -> ${redirectTarget}`);
}

async function addCacheBusting(targetDir) {
    console.log('Adding cache-busting...');
    const timestamp = Date.now();

    // 1. Update HTML files (Entry points)
    const htmlPaths = [
        path.join(targetDir, 'wizard', 'index.html'),
        path.join(targetDir, 'validator', 'index.html'),
        path.join(targetDir, 'explorer', 'index.html')
    ];

    for (const htmlPath of htmlPaths) {
        try {
            if (await fse.pathExists(htmlPath)) {
                let content = await fs.readFile(htmlPath, 'utf-8');
                content = content.replace(/(href|src)="(.*?\.(css|js))"/g, `$1="$2?v=${timestamp}"`);
                await fs.writeFile(htmlPath, content, 'utf-8');
                console.log(`Added cache-busting to HTML: ${htmlPath}`);
            }
        } catch (error) {
            console.warn(`Warning: Could not add cache-busting to ${htmlPath}. Error: ${error.message}`);
        }
    }

    // 2. Update JS files (Imports)
    // Directories known to contain JS modules that might have imports
    const jsDirs = ['wizard', 'validator', 'explorer', 'lib', 'util'];
    
    // Helper function to recursively walk and process JS files
    async function walkAndCacheBustJs(dir) {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                await walkAndCacheBustJs(fullPath);
            } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
                try {
                    let content = await fs.readFile(fullPath, 'utf-8');
                    let changed = false;
                    
                    // Replace static imports: import ... from '...';
                    // Matches: import ... from './file.js' or from "../lib/file.mjs"
                    // Modified to require starting with . or / to avoid breaking bare specifiers
                    const importRegex = /(from\s+['"])((?:\.|\/).*?\.(js|mjs))(['"])/g;
                    if (importRegex.test(content)) {
                        content = content.replace(importRegex, `$1$2?v=${timestamp}$4`);
                        changed = true;
                    }
                    
                    // Replace side-effect imports: import '...';
                    // Matches: import './file.js'
                    const sideEffectImportRegex = /(import\s+['"])((?:\.|\/).*?\.(js|mjs))(['"])/g;
                    if (sideEffectImportRegex.test(content)) {
                         content = content.replace(sideEffectImportRegex, `$1$2?v=${timestamp}$4`);
                         changed = true;
                    }

                    // Replace dynamic imports: import('...')
                    const dynamicImportRegex = /(import\(['"])((?:\.|\/).*?\.(js|mjs))(['"]\))/g;
                    if (dynamicImportRegex.test(content)) {
                        content = content.replace(dynamicImportRegex, `$1$2?v=${timestamp}$4`);
                        changed = true;
                    }

                    if (changed) {
                        await fs.writeFile(fullPath, content, 'utf-8');
                        // console.log(`Added cache-busting to JS: ${fullPath}`);
                    }
                } catch (err) {
                    console.warn(`Warning: Could not process JS file for cache-busting: ${fullPath}`, err);
                }
            }
        }
    }

    for (const dirName of jsDirs) {
        const dirPath = path.join(targetDir, dirName);
        if (await fse.pathExists(dirPath)) {
            await walkAndCacheBustJs(dirPath);
        }
    }
}

async function build() {
    console.log('Starting build process: Cleaning and copying files...');
    await fse.emptyDir(BUILD_DIR); // Clear previous build artifacts

    // Process source directories into the 'dist/spec' subdirectory
    const specDir = path.join(BUILD_DIR, 'spec');
    await processDirectory(SOURCE_DIR, specDir);

    // Copy branding to the root of dist
    await fse.copy(path.join(SOURCE_DIR, 'branding'), path.join(BUILD_DIR, 'branding'));
    console.log(`Copied branding to dist root`);

    // Process 'util' and 'lib' into their own root-level directories in dist
    const utilDir = path.join(BUILD_DIR, 'util');
    const libDir = path.join(BUILD_DIR, 'lib');
    // We check if source exists to avoid errors if directories are empty/missing initially
    if (await fse.pathExists(path.join(SOURCE_DIR, 'util'))) {
        await processDirectory(path.join(SOURCE_DIR, 'util'), utilDir);
        console.log(`Copied util to dist/util`);
    }
    if (await fse.pathExists(path.join(SOURCE_DIR, 'lib'))) {
        await processDirectory(path.join(SOURCE_DIR, 'lib'), libDir);
        console.log(`Copied lib to dist/lib`);
    }
    
    // Process 'wizard' into its own root-level directory in dist
    const wizardDir = path.join(BUILD_DIR, 'wizard');
    if (await fse.pathExists(path.join(SOURCE_DIR, 'wizard'))) {
        await processDirectory(path.join(SOURCE_DIR, 'wizard'), wizardDir);
        console.log(`Copied wizard to dist/wizard`);
    }

    // Process 'validator' into its own root-level directory in dist
    const validatorDir = path.join(BUILD_DIR, 'validator');
    if (await fse.pathExists(path.join(SOURCE_DIR, 'validator'))) {
        await processDirectory(path.join(SOURCE_DIR, 'validator'), validatorDir);
        console.log(`Copied validator to dist/validator`);
    }

    // Process 'explorer' into its own root-level directory in dist
    const explorerDir = path.join(BUILD_DIR, 'explorer');
    if (await fse.pathExists(path.join(SOURCE_DIR, 'explorer'))) {
        await processDirectory(path.join(SOURCE_DIR, 'explorer'), explorerDir);
        console.log(`Copied explorer to dist/explorer`);
    }

    // Copy root-level static assets
    const rootStaticAssets = ['CONTRIBUTING.md', 'LICENSE', 'README.md'];
    for (const asset of rootStaticAssets) {
        const sourcePath = path.join(PROJECT_ROOT, asset);
        const targetPath = path.join(BUILD_DIR, asset);
        await fse.copy(sourcePath, targetPath);
        //console.log(`Copied root asset: ${sourcePath} -> ${targetPath}`);
    }

    // Call the new redirect function
    await createRedirects(BUILD_DIR);

    console.log('Generating ontology documentation...');
    await generateSpecDocs(); // Call the function directly

    console.log('Updating index.html...');
    execSync('node scripts/update-index-html.mjs', { stdio: 'inherit' });

    // Add cache-busting to the wizard's HTML
    await addCacheBusting(BUILD_DIR);

    console.log('Build process completed.');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
