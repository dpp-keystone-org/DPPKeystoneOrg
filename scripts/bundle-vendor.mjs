import { execSync } from 'child_process';
import path from 'path';
import fse from 'fs-extra';

const PROJECT_ROOT = process.cwd();
const VENDOR_DIR = path.join(PROJECT_ROOT, 'src', 'lib', 'vendor');

// Ensure vendor directory exists
fse.ensureDirSync(VENDOR_DIR);

console.log('Bundling vendor dependencies...');

try {
    // Bundle AJV
    console.log('  Bundling ajv.2020.js...');
    execSync('npx esbuild node_modules/ajv/dist/2020.js --bundle --format=esm --outfile=src/lib/vendor/ajv.2020.js', { stdio: 'inherit' });

    // Bundle AJV Formats
    console.log('  Bundling ajv-formats.js...');
    execSync('npx esbuild node_modules/ajv-formats/dist/index.js --bundle --format=esm --outfile=src/lib/vendor/ajv-formats.js', { stdio: 'inherit' });

    // Bundle Strip Json Comments
    console.log('  Bundling strip-json-comments.js...');
    execSync('npx esbuild node_modules/strip-json-comments/index.js --bundle --format=esm --outfile=src/lib/vendor/strip-json-comments.js', { stdio: 'inherit' });

    console.log('Vendor bundling completed successfully.');
} catch (error) {
    console.error('Vendor bundling failed:', error);
    process.exit(1);
}
