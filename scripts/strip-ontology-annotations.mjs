import fs from 'fs/promises';
import path from 'path';
import stripJsonComments from 'strip-json-comments';
import { KEYSTONE_VERSION } from '../src/lib/keystone-version.js';

const SOURCE_DIR = `src/ontology/${KEYSTONE_VERSION}`;
const TARGET_DIR = `src/ontology/${KEYSTONE_VERSION}_stripped`;

const stripAnnotations = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(stripAnnotations);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (key === 'rdfs:comment' || key === 'rdfs:label') {
        const val = obj[key];
        if (Array.isArray(val)) {
          const enVal = val.find(v => v['@language'] === 'en');
          if (enVal) {
            newObj[key] = [enVal];
          }
          // Note: If no English value is found, we effectively strip it.
        } else if (val !== null && typeof val === 'object' && val['@language'] === 'en') {
          newObj[key] = val;
        } else if (typeof val === 'string') {
          // Un-tagged strings are often English or untranslatable raw IDs
          newObj[key] = val;
        }
      } else {
        newObj[key] = stripAnnotations(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

async function processDirectory(dir, targetDir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await fs.mkdir(targetPath, { recursive: true });
      await processDirectory(fullPath, targetPath);
    } else if (entry.isFile() && fullPath.endsWith('.jsonld')) {
      try {
        const content = await fs.readFile(fullPath, 'utf8');
        const json = JSON.parse(stripJsonComments(content));

        const stripped = stripAnnotations(json);

        await fs.writeFile(targetPath, JSON.stringify(stripped, null, 2), 'utf8');
        console.log(`Successfully stripped: ${targetPath}`);
      } catch (err) {
        console.error(`Error processing file ${fullPath}:`, err);
      }
    }
  }
}

async function main() {
  try {
    const cwd = process.cwd();
    const sourcePath = path.join(cwd, SOURCE_DIR);
    const targetPath = path.join(cwd, TARGET_DIR);

    await fs.mkdir(targetPath, { recursive: true });
    await processDirectory(sourcePath, targetPath);
    console.log('Finished stripping annotations.');
  } catch (err) {
    console.error('Error during processing:', err);
    process.exit(1);
  }
}

main();
