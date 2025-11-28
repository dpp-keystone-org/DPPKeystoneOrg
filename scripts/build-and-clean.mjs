import { promises as fs } from 'fs';
import path from 'path';
import fse from 'fs-extra'; // For copy and ensureDir
import { parse as jsoncParse, printParseErrorCode } from 'jsonc-parser';

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
        console.log(`Cleaned and copied: ${sourcePath} -> ${targetPath}`);
    } catch (error) {
        console.error(`Error processing ${sourcePath}:`, error);
        throw error;
    }
}

async function processDirectory(sourceDir, targetDir) {
    await fse.ensureDir(targetDir);
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });

    for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
            await processDirectory(sourcePath, targetPath);
        } else if (jsonFileExtensions.includes(path.extname(entry.name))) {
            await cleanAndCopyJsonFile(sourcePath, targetPath);
        } else {
            // Copy other files directly (e.g., .md, .html, .css)
            await fse.copy(sourcePath, targetPath);
            console.log(`Copied static file: ${sourcePath} -> ${targetPath}`);
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

async function build() {
    console.log('Starting build process: Cleaning and copying files...');
    await fse.emptyDir(BUILD_DIR); // Clear previous build artifacts

    // Process source directories into the 'dist/spec' subdirectory
    const specDir = path.join(BUILD_DIR, 'spec');
    await processDirectory(SOURCE_DIR, specDir);
    
    // Copy root-level static assets
    const rootStaticAssets = ['index.html', 'docs', 'CONTRIBUTING.md', 'LICENSE', 'README.md'];
    for (const asset of rootStaticAssets) {
        const sourcePath = path.join(PROJECT_ROOT, asset);
        const targetPath = path.join(BUILD_DIR, asset);
        await fse.copy(sourcePath, targetPath);
        console.log(`Copied root asset: ${sourcePath} -> ${targetPath}`);
    }

    // Call the new redirect function
    await createRedirects(BUILD_DIR);

    console.log('Build process completed.');
}

build().catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
});
