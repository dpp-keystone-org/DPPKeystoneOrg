import { loadOntology, loadContext } from '../../dist/lib/ontology-loader.js';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';
import fs from 'fs';
import path from 'path';

globalThis.fetch = async (url) => {
    let filePath = url;
    if (filePath.startsWith('../')) {
        filePath = path.join(process.cwd(), 'dist', filePath.substring(3));
    }
    
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return {
            ok: true,
            json: async () => JSON.parse(data)
        };
    } catch (err) {
        console.error("MOCK FETCH ERROR:", err);
        return { ok: false };
    }
};

async function test() {
    console.log("Loading textile...");
    const ontologyMap = await loadOntology('textile');
    const contextMap = await loadContext('textile');
    
    console.log("Has componentCasNumber in ontologyMap?", ontologyMap.has("componentCasNumber"));
    if (ontologyMap.has("componentCasNumber")) {
        console.log(ontologyMap.get("componentCasNumber"));
    }

    console.log("Has casNumber in contextMap?", contextMap.has("casNumber"));
    console.log("casNumber ->", contextMap.get("casNumber"));

    console.log("Has substancesOfConcern.casNumber in contextMap?", contextMap.has("substancesOfConcern.casNumber"));
    
    console.log("Has netWeight in contextMap?", contextMap.has("netWeight"));
    console.log("netWeight ->", contextMap.get("netWeight"));
    console.log("netWeight ontologyInfo:", ontologyMap.get("netWeight"));
}

test().catch(console.error);
