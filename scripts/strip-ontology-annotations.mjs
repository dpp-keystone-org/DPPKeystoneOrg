import fs from 'fs/promises';
import path from 'path';
import stripJsonComments from 'strip-json-comments';

const inputFile = process.argv[2];

if (!inputFile) {
  console.error('Usage: node scripts/strip-ontology-annotations.mjs <path-to-ontology-file>');
  process.exit(1);
}

const stripAnnotations = (obj) => {
  if (Array.isArray(obj)) {
    return obj.map(stripAnnotations);
  } else if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      // Only stripping rdfs:comment and rdfs:label as requested
      if (key !== 'rdfs:comment' && key !== 'rdfs:label') {
        newObj[key] = stripAnnotations(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
};

async function main() {
  try {
    const filePath = path.resolve(inputFile);
    const content = await fs.readFile(filePath, 'utf8');
    const json = JSON.parse(stripJsonComments(content));

    const stripped = stripAnnotations(json);

    const ext = path.extname(filePath);
    const basename = path.basename(filePath, ext);
    const dir = path.dirname(filePath);
    const outputPath = path.join(dir, `${basename}_stripped${ext}`);

    await fs.writeFile(outputPath, JSON.stringify(stripped, null, 2), 'utf8');
    console.log(`Stripped ontology saved to: ${outputPath}`);
  } catch (err) {
    console.error('Error processing file:', err);
    process.exit(1);
  }
}

main();
