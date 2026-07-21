import fs from 'fs';
import path from 'path';

globalThis.fetch = async (url) => {
    let filePath = url;
    if (filePath.startsWith('../')) {
        filePath = path.join(process.cwd(), 'src/validation/v3/json-schema/sector', filePath.substring(3));
    } else if (filePath.startsWith('http')) {
        return { ok: false };
    } else {
        filePath = path.join(process.cwd(), 'dist', filePath);
    }
    
    try {
        const data = fs.readFileSync(filePath, 'utf8');
        return {
            ok: true,
            json: async () => JSON.parse(data)
        };
    } catch (err) {
        console.error("MOCK FETCH ERROR:", filePath, err.message);
        return { ok: false };
    }
};

import { loadSchema } from './src/lib/schema-loader.js';

async function main() {
    try {
        const schema = await loadSchema('construction', 'sector');
        const dopc = schema.properties.dopc;
        console.log("dopc oneOf[0] keys:", Object.keys(dopc.oneOf[0]));
        console.log("dopc oneOf[0].properties keys:", dopc.oneOf[0].properties ? Object.keys(dopc.oneOf[0].properties) : 'undefined');
    } catch (e) {
        console.error(e);
    }
}
main();
