import path from 'path';
import { fileURLToPath } from 'url';
import { renderProductPage, detectTableStructure } from '../util/js/common/rendering/dpp-html-renderer.js?v=1790088505990';
import { transformDpp } from '../util/js/server/dpp-schema-adapter.js?v=1790088505990';
import { getProductPageCss, getServerOntologyMap, createServerDocumentLoader } from './server-resource-loader.js?v=1790088505990';
import { KEYSTONE_VERSION } from './keystone-version.js?v=1790088505990';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');

export { detectTableStructure };

/**
 * Generates a standalone HTML product page from a DPP JSON object on the server.
 * 
 * @param {Object} dppJson - The Digital Product Passport data.
 * @param {Object} [options] - Options: { customCssUrl, includeSchema, language }.
 * @returns {Promise<string>} The complete HTML document string.
 */
export async function generateDppHtml(dppJson, options = {}) {
    if (!dppJson || typeof dppJson !== 'object') {
        throw new Error("DPP JSON is required");
    }

    const { customCssUrl, includeSchema = true, language = 'en' } = options;

    // 1. Get CSS
    const cssContent = await getProductPageCss();

    // 2. Generate Schema.org JSON-LD if requested
    let jsonLdString = null;
    if (includeSchema) {
        try {
            const ontologyPath = path.join(PROJECT_ROOT, 'src/ontology', KEYSTONE_VERSION, 'dpp-ontology.jsonld');
            const documentLoader = createServerDocumentLoader();

            const transformed = await transformDpp(dppJson, {
                profile: 'schema.org',
                ontologyPaths: [ontologyPath],
                documentLoader: documentLoader,
                version: KEYSTONE_VERSION
            });

            if (transformed) {
                jsonLdString = JSON.stringify(transformed, null, 2);
            }
        } catch (e) {
            console.warn("Failed to generate Schema.org JSON-LD on server:", e.message);
        }
    }

    // 3. Resolve sector ontology map
    let sector = 'dpp';
    if (dppJson.contentSpecificationIds && Array.isArray(dppJson.contentSpecificationIds)) {
        for (const specId of dppJson.contentSpecificationIds) {
            if (specId.includes('battery')) sector = 'battery';
            else if (specId.includes('textile')) sector = 'textile';
            else if (specId.includes('steel') || specId.includes('iron')) sector = 'iron-steel';
            else if (specId.includes('construction')) sector = 'construction';
            else if (specId.includes('electronic')) sector = 'electronics';
        }
    }

    let ontologyMap = null;
    try {
        ontologyMap = await getServerOntologyMap(sector);
    } catch (e) {
        console.warn("Could not load ontology for HTML rendering on server:", e.message);
    }

    // 4. Render final HTML
    return renderProductPage({
        dppData: dppJson,
        css: cssContent,
        jsonLd: jsonLdString,
        customCssUrl: customCssUrl,
        ontologyMap: ontologyMap,
        language: language
    });
}
