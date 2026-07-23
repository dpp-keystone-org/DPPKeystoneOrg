import fs from 'fs';
import path from 'path';
import { parse, modify, applyEdits } from 'jsonc-parser';

const batchFile = process.argv[2];
if (!batchFile) {
    console.error("Usage: node apply-batch.mjs <path-to-batch-markdown>");
    process.exit(1);
}

const mdContent = fs.readFileSync(batchFile, 'utf-8');
const lines = mdContent.split('\n');

const SKOS_URI = "http://www.w3.org/2004/02/skos/core#";
const SCHEMA_URI = "https://schema.org/";
const GS1_URI = "https://gs1.org/voc/";

let jsonUpdates = {}; // file -> { termId -> newMappings }
let updatedLines = [...lines];

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('| `dppk:')) {
        const parts = line.split('|').map(s => s.trim());
        if (parts.length >= 9) {
            const termId = parts[1].replace(/`/g, '');
            const file = parts[2].replace(/`/g, '');
            const proposedStr = parts[4];
            const qcStatus = parts[7];
            const jsonldUpdated = parts[8];
            
            // Only process if QC has reviewed it and it hasn't been applied yet
            if ((qcStatus === '[REVIEWED]' || qcStatus === '[CORRECTED]' || qcStatus === '[ENHANCED]' || qcStatus === '[DIVERSIFIED]') && jsonldUpdated !== '[DONE]') {
                
                let mappings = [];
                if (proposedStr !== 'None' && proposedStr !== '`None`' && proposedStr.trim() !== '') {
                    const items = proposedStr.split('<br>');
                    for (const item of items) {
                        const cleanStr = item.replace(/`/g, '').trim();
                        if (!cleanStr) continue;
                        
                        const firstSpace = cleanStr.indexOf(' ');
                        if (firstSpace > -1) {
                            const predicate = cleanStr.substring(0, firstSpace).trim();
                            const target = cleanStr.substring(firstSpace + 1).trim();
                            if (predicate && target) {
                                mappings.push({ predicate, target });
                            }
                        }
                    }
                }
                
                if (!jsonUpdates[file]) jsonUpdates[file] = {};
                jsonUpdates[file][termId] = { mappings, lineIndex: i };
            }
        }
    }
}

const baseDir = path.join(process.cwd(), 'src', 'ontology', 'v3');

for (const [file, terms] of Object.entries(jsonUpdates)) {
    const fullPath = path.join(baseDir, file);
    let content = fs.readFileSync(fullPath, 'utf-8');
    let ast = parse(content);
    
    // Check/add prefixes to @context
    let context = ast["@context"] || {};
    let prefixesToAdd = {};
    let needsSkos = false;
    let needsSchema = false;
    let needsGs1 = false;
    
    for (const termInfo of Object.values(terms)) {
        if (termInfo.mappings.length > 0) needsSkos = true;
        for (const m of termInfo.mappings) {
            if (m.target.startsWith('schema:')) needsSchema = true;
            if (m.target.startsWith('gs1:')) needsGs1 = true;
        }
    }
    
    if (needsSkos && !context["skos"]) {
        content = applyEdits(content, modify(content, ["@context", "skos"], SKOS_URI, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
    }
    if (needsSchema && !context["schema"]) {
        content = applyEdits(content, modify(content, ["@context", "schema"], SCHEMA_URI, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
    }
    if (needsGs1 && !context["gs1"]) {
        content = applyEdits(content, modify(content, ["@context", "gs1"], GS1_URI, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
    }
    
    ast = parse(content); // Re-parse after context updates
    
    let graph = ast["@graph"];
    let isGraph = true;
    if (!graph) {
        graph = Array.isArray(ast) ? ast : [ast];
        isGraph = false;
    }
    
    for (let i = 0; i < graph.length; i++) {
        const node = graph[i];
        const termId = node["@id"];
        if (terms[termId]) {
            const { mappings, lineIndex } = terms[termId];
            
            const pathPrefix = isGraph ? ["@context" in ast ? "@graph" : "", i].filter(x => x !== "") : [i];
            
            // Remove old owl:equivalentProperty and owl:equivalentClass
            if (node["owl:equivalentProperty"]) {
                content = applyEdits(content, modify(content, [...pathPrefix, "owl:equivalentProperty"], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
            }
            if (node["owl:equivalentClass"]) {
                content = applyEdits(content, modify(content, [...pathPrefix, "owl:equivalentClass"], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
            }
            
            // Remove existing SKOS mappings so they can be cleanly replaced
            const skosPredicates = ["skos:exactMatch", "skos:closeMatch", "skos:relatedMatch", "skos:broadMatch", "skos:narrowMatch"];
            for (const p of skosPredicates) {
                if (node[p]) {
                    content = applyEdits(content, modify(content, [...pathPrefix, p], undefined, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
                }
            }
            
            // Add new SKOS mappings
            // We group by predicate (e.g. skos:exactMatch -> array of targets)
            let grouped = {};
            for (const m of mappings) {
                if (!grouped[m.predicate]) grouped[m.predicate] = [];
                grouped[m.predicate].push({ "@id": m.target });
            }
            
            for (const [pred, targets] of Object.entries(grouped)) {
                let value = targets.length === 1 ? targets[0] : targets;
                content = applyEdits(content, modify(content, [...pathPrefix, pred], value, { formattingOptions: { insertSpaces: true, tabSize: 2 } }));
            }
            
            // Update markdown table row
            let rowParts = updatedLines[lineIndex].split('|');
            rowParts[8] = ' [DONE] ';
            updatedLines[lineIndex] = rowParts.join('|');
        }
    }
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`Updated ${file}`);
}

fs.writeFileSync(batchFile, updatedLines.join('\n'), 'utf-8');
console.log(`Updated ${batchFile}`);
