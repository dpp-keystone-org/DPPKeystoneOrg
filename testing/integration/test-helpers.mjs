import { promises as fs } from 'fs';
import path from 'path';

export async function setupTestEnvironment(testDirName) {
    const root = process.cwd();
    const FIXTURES_DIR = path.resolve(root, 'fixtures', 'spec-docs');
    const TEMP_DIR = path.resolve(root, 'tmp', testDirName);
    
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
    
    const distSpecDir = path.join(TEMP_DIR, 'dist', 'spec');
    
    const tempOntologyDir = path.join(distSpecDir, 'ontology', 'v1');
    const tempContextsDir = path.join(distSpecDir, 'contexts', 'v1');
    await fs.mkdir(path.join(tempOntologyDir, 'core'), { recursive: true });
    await fs.mkdir(path.join(tempOntologyDir, 'sectors'), { recursive: true });
    await fs.mkdir(tempContextsDir, { recursive: true });

    // Copy mock files
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-core.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'contexts', 'v1', 'mock-core.context.jsonld'),
        path.join(tempContextsDir, 'mock-core.context.jsonld')
    );
    await fs.copyFile(
        path.join(FIXTURES_DIR, 'ontology', 'v1', 'core', 'mock-core-toplevel.jsonld'),
        path.join(tempOntologyDir, 'core', 'mock-core-toplevel.jsonld')
    );


    return {
        fixturesDir: FIXTURES_DIR,
        tempDir: TEMP_DIR,
        distSpecDir: distSpecDir
    };
}

