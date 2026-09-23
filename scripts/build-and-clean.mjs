/**
 * @file build-and-clean.mjs
 * @description The primary build orchestrator for the project. Deletes build targets (dist/), 
 * lints and sanitizes all JSON/JSON-LD files in the src/ tree (removing comments), 
 * builds the functional code, and deploys everything to the dist/ directory. 
 * This is the ONLY script that needs to be run between file changes to reflect them in the build.
 * It is invoked automatically via `npm run build` or `npm test`.
 */
import { promises as fs } from 'fs';
import path from 'path';
import fse from 'fs-extra'; // For copy and ensureDir
import { parse as jsoncParse, printParseErrorCode } from 'jsonc-parser';
import { execSync } from 'child_process';
import * as cheerio from 'cheerio';
import { generateSpecDocs } from './generate-spec-docs.mjs';
import { KEYSTONE_VERSION, rewriteSpecFileUrls } from '../src/lib/keystone-version.js';

const PROJECT_ROOT = process.cwd();
const SOURCE_DIR = path.join(PROJECT_ROOT, 'src');
const BUILD_DIR = path.join(PROJECT_ROOT, 'dist');

import { getPreviewChunk } from './branch-helper.mjs';

const jsonFileExtensions = ['.json', '.jsonld'];

export const PREVIEW_CHUNK = getPreviewChunk();

/**
 * Rewrites spec URLs to include the preview chunk when PREVIEW_BRANCH is set,
 * and replaces {{VERSION}} with KEYSTONE_VERSION.
 * @param {string} content
 * @returns {string}
 */
export function rewriteSpecUrls(content) {
    return rewriteSpecFileUrls(content, PREVIEW_CHUNK);
}

async function cleanAndCopyJsonFile(sourcePath, targetPath) {
    try {
        let content = await fs.readFile(sourcePath, 'utf-8');
        content = rewriteSpecUrls(content);
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
        if (entry.name === 'desktop.ini' || entry.name === 'branding' || entry.name.includes('stripped') || (sourceDir === SOURCE_DIR && (entry.name === 'index.html' || entry.name === 'util' || entry.name === 'lib' || entry.name === 'wizard' || entry.name === 'validator' || entry.name === 'explorer' || entry.name === 'csv-dpp-adapter'))) {
            continue;
        }
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            await processDirectory(sourcePath, targetPath);
        } else if (jsonFileExtensions.includes(path.extname(entry.name))) {
            await cleanAndCopyJsonFile(sourcePath, targetPath);
        } else if (entry.name.endsWith('.js') || entry.name.endsWith('.mjs')) {
            let content = await fs.readFile(sourcePath, 'utf-8');
            // In JS application logic, preserve canonical spec URLs so generators and transforms
            // remain standard-compliant and stable across environments, while expanding {{VERSION}}.
            content = content.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION);
            await fs.writeFile(targetPath, content, 'utf-8');
        } else if (entry.name.endsWith('.html')) {
            let content = await fs.readFile(sourcePath, 'utf-8');
            content = rewriteSpecUrls(content);
            const i18nPath = sourcePath.replace(/\.html$/, '.i18n.json');
            
            if (await fse.pathExists(i18nPath)) {
                try {
                    const translations = JSON.parse(await fs.readFile(i18nPath, 'utf-8'));
                    const $ = cheerio.load(content, { recognizeSelfClosing: true });
                    let injected = false;
                    
                    $('[data-i18n-key]').each((i, el) => {
                        const $el = $(el);
                        const key = $el.attr('data-i18n-key');
                        if (translations[key]) {
                            const enTranslation = translations[key].find(t => t['@language'] === 'en');
                            if (enTranslation) {
                                if (el.tagName.toLowerCase() === 'input' && $el.attr('placeholder') !== undefined) {
                                    $el.attr('placeholder', enTranslation['@value']);
                                } else {
                                    $el.html(enTranslation['@value']);
                                }
                                injected = true;
                            }
                        }
                    });
                    
                    if (injected) {
                        content = $.html();
                    }
                } catch (error) {
                    console.warn(`Warning: Could not process translations for ${sourcePath}: ${error.message}`);
                }
            }
            
            await fs.writeFile(targetPath, content, 'utf-8');
        } else {
            // Copy other files directly (e.g., .md, .css)
            await fse.copy(sourcePath, targetPath);
            //console.log(`Copied static file: ${sourcePath} -> ${targetPath}`);
        }
    }
}

async function createRedirects(targetDir) {
    console.log('Generating client-side redirects...');

    const redirectEntries = [
        {
            subpath: ['terms'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`
        },
        {
            subpath: ['terms', 'cement-dopc'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/sectors/cement/DoPC.jsonld`
        },
        {
            subpath: ['terms', 'cement'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/sectors/Cement.jsonld`
        },
        {
            subpath: ['terms', 'epd'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/core/EPD.jsonld`
        },
        {
            subpath: ['terms', 'signature'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/core/Signature.jsonld`
        },
        {
            subpath: ['terms', 'unit'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/core/Unit.jsonld`
        },
        {
            subpath: ['terms', 'dopc'],
            target: `${PREVIEW_CHUNK}/spec/ontology/${KEYSTONE_VERSION}/core/DoPC.jsonld`
        }
    ];

    for (const entry of redirectEntries) {
        const redirectContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Redirecting...</title>
  <link rel="canonical" href="${entry.target}"/>
  <meta http-equiv="refresh" content="0; url=${entry.target}">
</head>
<body>
  <h1>Redirecting...</h1>
  <p>If you are not redirected automatically, follow this <a href="${entry.target}">link</a>.</p>
</body>
</html>`;

        // 1. Versioned path: dist/spec/v3/terms/.../index.html
        const versionedPath = path.join(targetDir, 'spec', KEYSTONE_VERSION, ...entry.subpath, 'index.html');
        await fse.outputFile(versionedPath, redirectContent);
        console.log(`Created redirect: /spec/${KEYSTONE_VERSION}/${entry.subpath.join('/')}/index.html -> ${entry.target}`);

        // 2. Unversioned shadow path: dist/spec/terms/.../index.html
        const shadowPath = path.join(targetDir, 'spec', ...entry.subpath, 'index.html');
        await fse.outputFile(shadowPath, redirectContent);
    }
}

async function addCacheBusting(targetDir) {
    console.log('Adding cache-busting...');
    const timestamp = Date.now();

    // 1. Update HTML files (Entry points)
    const htmlPaths = [
        path.join(targetDir, 'wizard', 'index.html'),
        path.join(targetDir, 'validator', 'index.html'),
        path.join(targetDir, 'explorer', 'index.html'),
        path.join(targetDir, 'csv-dpp-adapter', 'index.html')
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
    const jsDirs = ['wizard', 'validator', 'explorer', 'lib', 'util', 'csv-dpp-adapter'];
    
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
    
    // Verify versioned directories exist
    const expectedOntologyDir = path.join(SOURCE_DIR, 'ontology', KEYSTONE_VERSION);
    const expectedContextsDir = path.join(SOURCE_DIR, 'contexts', KEYSTONE_VERSION);
    
    if (!await fse.pathExists(expectedOntologyDir)) {
        throw new Error(`Noisy Failure: Expected ontology directory not found at ${expectedOntologyDir}`);
    }
    if (!await fse.pathExists(expectedContextsDir)) {
        throw new Error(`Noisy Failure: Expected contexts directory not found at ${expectedContextsDir}`);
    }
    
    // Run vendor bundling first to ensure dependencies are ready
    console.log('Running vendor bundling...');
    execSync('npm run bundle:vendor', { stdio: 'inherit' });

    await fse.emptyDir(BUILD_DIR); // Clear previous build artifacts

    // Process source directories into the 'dist/spec' subdirectory
    const specDir = path.join(BUILD_DIR, 'spec');
    await processDirectory(SOURCE_DIR, specDir);

    // Create version-less "latest" copies of context files
    console.log('Creating "latest" context file shadows...');
    const latestContextsDir = path.join(specDir, 'contexts', KEYSTONE_VERSION);
    const shadowContextsDir = path.join(specDir, 'contexts');
    if (await fse.pathExists(latestContextsDir)) {
        await fse.copy(latestContextsDir, shadowContextsDir, { overwrite: true });
        console.log(`Shadowed latest context files to dist/spec/contexts`);
    } else {
        console.warn(`Warning: Latest contexts directory not found at ${latestContextsDir}. Skipping shadow creation.`);
    }

    // Create version-less "latest" copies of ontology files
    console.log('Creating "latest" ontology file shadows...');
    const latestOntologyDir = path.join(specDir, 'ontology', KEYSTONE_VERSION);
    const shadowOntologyDir = path.join(specDir, 'ontology');
    if (await fse.pathExists(latestOntologyDir)) {
        await fse.copy(latestOntologyDir, shadowOntologyDir, { overwrite: true });
        console.log(`Shadowed latest ontology files to dist/spec/ontology`);
    } else {
        console.warn(`Warning: Latest ontology directory not found at ${latestOntologyDir}. Skipping shadow creation.`);
    }

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

    // Process 'csv-dpp-adapter' into its own root-level directory in dist
    const csvAdapterDir = path.join(BUILD_DIR, 'csv-dpp-adapter');
    if (await fse.pathExists(path.join(SOURCE_DIR, 'csv-dpp-adapter'))) {
        await processDirectory(path.join(SOURCE_DIR, 'csv-dpp-adapter'), csvAdapterDir);
        console.log(`Copied csv-dpp-adapter to dist/csv-dpp-adapter`);
    }

    // Copy root-level static assets
    const rootStaticAssets = ['CONTRIBUTING.md', 'LICENSE', 'README.md', 'impressum.html'];
    for (const asset of rootStaticAssets) {
        const sourcePath = path.join(PROJECT_ROOT, asset);
        const targetPath = path.join(BUILD_DIR, asset);
        await fse.copy(sourcePath, targetPath);
        //console.log(`Copied root asset: ${sourcePath} -> ${targetPath}`);
    }

    // Copy docs folder
    const docsDir = path.join(PROJECT_ROOT, 'docs');
    const targetDocsDir = path.join(BUILD_DIR, 'docs');
    if (await fse.pathExists(docsDir)) {
        await fse.copy(docsDir, targetDocsDir);
        console.log(`Copied docs to dist/docs`);
    }

    // Copy root level i18n files
    if (await fse.pathExists(path.join(PROJECT_ROOT, 'index.i18n.json'))) {
        await cleanAndCopyJsonFile(path.join(PROJECT_ROOT, 'index.i18n.json'), path.join(BUILD_DIR, 'index.i18n.json'));
        console.log('Processed and copied index.i18n.json to dist/');
    }

    // Call the new redirect function
    await createRedirects(BUILD_DIR);

    console.log('Generating auto-generated SHACL shapes...');
    execSync('node scripts/generate-shacl.mjs', { stdio: 'inherit' });

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
