import path from 'path';
import fse from 'fs-extra';

const PROJECT_ROOT = process.cwd();
const BUILD_DIR = path.join(PROJECT_ROOT, 'dist');

async function clean() {
    console.log(`Removing build directory: ${BUILD_DIR}...`);
    await fse.remove(BUILD_DIR);
    console.log('Clean complete.');
}

clean().catch(err => {
    console.error('Clean failed:', err);
    process.exit(1);
});
