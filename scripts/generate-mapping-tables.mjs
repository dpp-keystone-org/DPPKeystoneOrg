import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'jsonc-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getJsonFiles(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(getJsonFiles(fullPath));
        } else if (fullPath.endsWith('.jsonld')) {
            results.push(fullPath);
        }
    });
    return results;
}

function generateTables() {
    const baseDir = path.join(__dirname, '..');
    const ontologyDir = path.join(baseDir, 'src', 'ontology', 'v3');
    const designsDir = path.join(baseDir, 'designs');
    
    if (!fs.existsSync(designsDir)) {
        fs.mkdirSync(designsDir);
    }
    
    const files = getJsonFiles(ontologyDir);
    let termsData = [];
    
    for (const filepath of files) {
        const relPath = path.relative(ontologyDir, filepath);
        const content = fs.readFileSync(filepath, 'utf-8');
        try {
            const data = parse(content);
            let items = data;
            if (data && data["@graph"]) {
                items = data["@graph"];
            } else if (!Array.isArray(data)) {
                items = [data];
            }
            
            for (const item of items) {
                if (item && typeof item === 'object' && item["@id"] && item["@id"].startsWith("dppk:")) {
                    let eqProps = item["owl:equivalentProperty"] || item["owl:equivalentClass"];
                    let eqStr = "None";
                    if (eqProps) {
                        if (Array.isArray(eqProps)) {
                            const eqList = eqProps.map(ep => typeof ep === 'object' && ep["@id"] ? ep["@id"] : String(ep));
                            eqStr = eqList.join("<br>");
                        } else {
                            eqStr = typeof eqProps === 'object' && eqProps["@id"] ? eqProps["@id"] : String(eqProps);
                        }
                    }
                    termsData.push({
                        id: item["@id"],
                        file: relPath.replace(/\\/g, '/'),
                        eq: eqStr
                    });
                }
            }
        } catch (e) {
            console.error(`Error parsing ${filepath}: ${e}`);
        }
    }
    
    termsData.sort((a, b) => a.id.localeCompare(b.id));
    
    const batchSize = 50;
    const totalBatches = Math.ceil(termsData.length / batchSize);
    
    const tableHeader = "| Term (`@id`) | File | Current `equivalent` | Proposed SKOS Mappings | Confidence | Rationale | QC Status | JSON-LD Updated? |\n|---|---|---|---|---|---|---|---|\n";
    
    for (let i = 0; i < totalBatches; i++) {
        const batch = termsData.slice(i * batchSize, (i + 1) * batchSize);
        const filename = path.join(designsDir, `mapping-batch-${i + 1}.md`);
        
        let mdContent = `# Mapping Batch ${i + 1} of ${totalBatches}\n\n`;
        mdContent += tableHeader;
        
        for (const term of batch) {
            mdContent += `| \`${term.id}\` | \`${term.file}\` | \`${term.eq}\` | | | | [PENDING] | [PENDING] |\n`;
        }
        
        fs.writeFileSync(filename, mdContent, 'utf-8');
        console.log(`Generated mapping-batch-${i + 1}.md with ${batch.length} terms.`);
    }
}

generateTables();
