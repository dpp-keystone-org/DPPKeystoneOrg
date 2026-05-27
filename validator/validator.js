import { validateDpp } from '../util/js/common/validation/schema-validator.js?v=1779884547364';
import stripJsonComments from 'strip-json-comments';
import { EXAMPLES } from '../lib/example-registry.js?v=1779884547364';
import { generateHTML } from '../lib/html-generator.js?v=1779884547364';
import { transformDpp } from '../util/js/client/dpp-schema-adapter.js?v=1779884547364';
import * as jsonld from 'jsonld'; // Import jsonld for the default loader
import { loadOntology } from '../lib/ontology-loader.js?v=1779884547364';
import { validateAgainstOntology } from '../util/js/common/validation/ontology-validator.js?v=1779884547364';
import { validateContextAwarePayload } from '../util/js/common/validation/context-semantic-validator.js?v=1779884547364';

// Configuration: Map Spec IDs to Schema filenames
// This assumes the schemas are available at ../spec/validation/v1/json-schema/
// NOTE: This must match the IDs used in the "contentSpecificationIds" of the DPP JSON.
const SECTOR_MAP = {
    'draft_battery_specification_id': 'battery.schema.json',
    'draft_construction_specification_id': 'construction.schema.json',
    'draft_electronics_specification_id': 'electronics.schema.json',
    'draft_iron_and_steel_specification_id': 'iron-steel.schema.json',
    'draft_textile_specification_id': 'textile.schema.json',
};

// Common schemas that should always be loaded for $ref resolution
const COMMON_SCHEMAS = [
    'dopc.schema.json',
    'epd.schema.json',
    'organization.schema.json',
    'packaging.schema.json',
    'postal-address.schema.json',
    'product-characteristic.schema.json',
    'related-resource.schema.json',
    'general-product.schema.json',
    'component.schema.json',
    'mtc.schema.json'
];

const BASE_SCHEMA_FILE = 'dpp.schema.json';
const SCHEMA_BASE_URL = '../spec/validation/v1/json-schema/';

// State to hold loaded schemas
const schemaContext = {
    baseSchema: null,
    sectorSchemas: {},
    commonSchemas: []
};

document.addEventListener('DOMContentLoaded', async () => {
    const validateBtn = document.getElementById('validate-btn');
    const previewSchemaBtn = document.getElementById('preview-schema-btn');
    const previewNoSchemaBtn = document.getElementById('preview-no-schema-btn');
    const schemaBtn = document.getElementById('schema-btn');
    const cssUrlInput = document.getElementById('css-url');
    const jsonInput = document.getElementById('json-input');
    const resultBox = document.getElementById('validation-result');
    const exampleSelector = document.getElementById('example-selector');

    // 1. Load Schemas
    try {
        await loadSchemas();
        console.log('Schemas loaded successfully');
        validateBtn.disabled = false;
        if (previewSchemaBtn) previewSchemaBtn.disabled = false;
        if (previewNoSchemaBtn) previewNoSchemaBtn.disabled = false;
        if (schemaBtn) schemaBtn.disabled = false;
    } catch (error) {
        console.error('Failed to load schemas:', error);
        resultBox.hidden = false;
        resultBox.className = 'result-box error';
        resultBox.textContent = 'System Error: Failed to load validation schemas. Check console for details.';
        validateBtn.disabled = true;
        return;
    }

    // 2. Setup Example Selector
    if (exampleSelector) {
        Object.keys(EXAMPLES).forEach(name => {
            const option = document.createElement('option');
            option.value = EXAMPLES[name];
            option.textContent = name;
            exampleSelector.appendChild(option);
        });

        exampleSelector.addEventListener('change', async (e) => {
            const url = e.target.value;
            if (!url) return;

            try {
                jsonInput.disabled = true;
                exampleSelector.disabled = true;

                const res = await fetch(url);
                if (!res.ok) throw new Error(`HTTP ${res.status}`);

                // We use text() then JSON.parse to allow potentially handling JSONC if examples ever use comments (unlikely for strict JSON examples but safe)
                // Actually, examples are .json, so strictly JSON.
                const json = await res.json();

                jsonInput.value = JSON.stringify(json, null, 2);
                resultBox.hidden = true;
            } catch (err) {
                console.error(err);
                alert('Failed to load example: ' + err.message);
            } finally {
                jsonInput.disabled = false;
                exampleSelector.disabled = false;
            }
        });
    }

    // 3. Setup Validation Event Listener
    validateBtn.addEventListener('click', async () => {
        const inputStr = jsonInput.value.trim();
        resultBox.hidden = true;
        resultBox.innerHTML = '';
        resultBox.className = 'result-box';

        if (!inputStr) {
            showError('Please paste a JSON object to validate.');
            return;
        }

        let dppData;
        let isJsonc = false;
        try {
            dppData = JSON.parse(inputStr);
        } catch (e) {
            // Attempt to parse as JSONC
            try {
                const stripped = stripJsonComments(inputStr);
                dppData = JSON.parse(stripped);
                isJsonc = true;
            } catch (jsoncError) {
                // If both fail, show the original error (or maybe the JSONC one if it's cleaner, but original is safer)
                showError('Invalid JSON format: ' + e.message);
                return;
            }
        }

        // Validate
        validateBtn.disabled = true;
        try {
            const result = validateDpp(dppData, schemaContext);
            let isValid = result.valid;
            let allErrors = result.errors ? [...result.errors] : [];

            // Branch dynamic Ontology validation to intercept `@context` specifically!
            if (dppData['@context']) {
                const localContextLoader = async (url) => {
                    const CONTEXT_PROD_PREFIX = 'https://dpp-keystone.org/spec/contexts/';
                    let fetchUrl = url;
                    if (url.startsWith(CONTEXT_PROD_PREFIX)) {
                        fetchUrl = url.replace(CONTEXT_PROD_PREFIX, '../spec/contexts/');
                    }
                    const response = await fetch(fetchUrl);
                    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
                    return {
                        contextUrl: null,
                        documentUrl: url,
                        document: await response.json()
                    };
                };

                const contextResult = await validateContextAwarePayload(dppData, localContextLoader);
                if (!contextResult.valid) {
                    isValid = false;
                    allErrors = allErrors.concat(contextResult.errors);
                }

            } else {
                // Compile dynamic Ontology Map tracking short key replacements for Legacy/Wizard Draft Fallbacks
                const aggregatedMap = new Map();
                const dppOntology = await loadOntology('dpp');
                if (dppOntology) dppOntology.forEach((v, k) => aggregatedMap.set(k, v));

                if (dppData.contentSpecificationIds && Array.isArray(dppData.contentSpecificationIds)) {
                    for (const id of dppData.contentSpecificationIds) {
                        const schemaFile = SECTOR_MAP[id];
                        if (schemaFile) {
                            const sectorName = schemaFile.replace('.schema.json', '');
                            const sectorOntology = await loadOntology(sectorName);
                            if (sectorOntology) sectorOntology.forEach((v, k) => aggregatedMap.set(k, v));
                        }
                    }
                }

                const ontologyResult = validateAgainstOntology(dppData, aggregatedMap);

                if (!ontologyResult.valid) {
                    isValid = false;
                    allErrors = allErrors.concat(ontologyResult.errors);
                }
            }

            if (isValid) {
                if (isJsonc) {
                    showSuccessWithWarning('Validation Successful! (Note: Comments were stripped from valid JSONC)', 'The DPP data conforms to all schemas and strict ontology logic.');
                } else {
                    showSuccess('Validation Successful! The DPP data conforms to all schemas and strict ontology logic.');
                }
            } else {
                showValidationErrors(allErrors, isJsonc);
            }
        } catch (e) {
            console.error(e);
            showError('An unexpected error occurred during validation: ' + e.message);
        } finally {
            validateBtn.disabled = false;
        }
    });

    // 4. Setup HTML Preview Helper
    const handleHtmlPreview = async (includeSchema, btn) => {
        const inputStr = jsonInput.value.trim();
        resultBox.hidden = true;

        if (!inputStr) {
            showError('Please paste a JSON object to preview.');
            return;
        }

        const originalText = btn.textContent;

        try {
            let dppData;
            // Try strict then loose parsing
            try {
                dppData = JSON.parse(inputStr);
            } catch (e) {
                const stripped = stripJsonComments(inputStr);
                dppData = JSON.parse(stripped);
            }

            btn.disabled = true;
            btn.textContent = 'Generating...';

            // Patch image URLs to be absolute if they use absolute-relative paths
            // because the generated HTML runs in a 'blob:' context and will fail to resolve them.
            if (dppData.image && Array.isArray(dppData.image)) {
                dppData.image.forEach(img => {
                    if (img.url && img.url.startsWith('/spec/')) {
                        img.url = window.location.origin + img.url;
                    }
                });
            }

            const customCssUrl = cssUrlInput ? cssUrlInput.value.trim() : '';
            const html = await generateHTML(dppData, { customCssUrl, includeSchema });

            // Open in new tab
            const blob = new Blob([html], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            window.open(url, '_blank');

        } catch (e) {
            console.error(e);
            showError('Failed to generate HTML: ' + e.message);
        } finally {
            btn.disabled = false;
            btn.textContent = originalText;
        }
    };

    if (previewSchemaBtn) {
        previewSchemaBtn.addEventListener('click', () => handleHtmlPreview(true, previewSchemaBtn));
    }

    if (previewNoSchemaBtn) {
        previewNoSchemaBtn.addEventListener('click', () => handleHtmlPreview(false, previewNoSchemaBtn));
    }

    // 5. Setup Schema.org Event Listener
    if (schemaBtn) {
        schemaBtn.addEventListener('click', async () => {
            const inputStr = jsonInput.value.trim();
            resultBox.hidden = true;

            if (!inputStr) {
                showError('Please paste a JSON object to transform.');
                return;
            }

            try {
                let dppData;
                try {
                    dppData = JSON.parse(inputStr);
                } catch (e) {
                    const stripped = stripJsonComments(inputStr);
                    dppData = JSON.parse(stripped);
                }

                schemaBtn.disabled = true;
                schemaBtn.textContent = 'Transforming...';

                // Configure document loader to resolve specific URLs locally
                const documentLoader = async (url, options) => {
                    // Intercept spec URLs and redirect to local files if possible
                    if (url.startsWith('https://dpp-keystone.org/spec/')) {
                        const relativePath = url.replace('https://dpp-keystone.org/spec/', '../spec/');

                        // Try to fetch locally
                        try {
                            const res = await fetch(relativePath);
                            if (res.ok) {
                                const document = await res.json();
                                return {
                                    contextUrl: null,
                                    document,
                                    documentUrl: url
                                };
                            }
                        } catch (e) {
                            console.warn(`Failed to fetch local spec for ${url}, falling back to network/default.`);
                        }
                    }

                    // Fallback to standard jsonld loader (which uses fetch/node)
                    // Note: jsonld in browser environment usually uses XHR/fetch
                    // We can use the default or a simple fetch wrapper.
                    // Accessing the global jsonld object or the imported one.
                    return (jsonld.documentLoaders ? jsonld.documentLoaders.xhr() : (u) => fetch(u).then(r => r.json()).then(d => ({ document: d, documentUrl: u })))(url);
                };

                const options = {
                    profile: 'schema.org',
                    // Point to the full ontology file. 
                    // Note: dpp-ontology.jsonld might be an aggregate or imports others.
                    // If imports are used, the documentLoader must handle them.
                    ontologyPaths: ['../spec/ontology/v1/dpp-ontology.jsonld'],
                    documentLoader
                };

                const transformed = await transformDpp(dppData, options);

                // Open in new tab as formatted JSON
                const jsonStr = JSON.stringify(transformed, null, 2);
                const blob = new Blob([jsonStr], { type: 'application/ld+json' });
                const url = URL.createObjectURL(blob);
                window.open(url, '_blank');

            } catch (e) {
                console.error(e);
                showError('Failed to generate Schema.org JSON-LD: ' + e.message);
            } finally {
                schemaBtn.disabled = false;
                schemaBtn.textContent = 'Preview Schema.org';
            }
        });
    }

    function showError(msg) {
        resultBox.hidden = false;
        resultBox.className = 'result-box error';
        resultBox.textContent = msg;
    }

    function showSuccess(msg) {
        resultBox.hidden = false;
        resultBox.className = 'result-box success';
        resultBox.textContent = msg;
    }

    function showSuccessWithWarning(title, msg) {
        resultBox.hidden = false;
        resultBox.className = 'result-box success';

        const strong = document.createElement('strong');
        strong.textContent = title;
        resultBox.appendChild(strong);

        resultBox.appendChild(document.createElement('br'));

        const span = document.createElement('span');
        span.textContent = msg;
        resultBox.appendChild(span);
    }

    function showValidationErrors(errors, isJsonc) {
        resultBox.hidden = false;
        resultBox.className = 'result-box error';

        const heading = document.createElement('h3');
        heading.textContent = `Validation Failed (${errors.length} errors)`;
        resultBox.appendChild(heading);

        if (isJsonc) {
            const note = document.createElement('p');
            note.style.fontSize = '0.9em';
            note.style.fontStyle = 'italic';
            note.textContent = '(Note: Input was parsed as JSONC. Line numbers in errors refer to the structure, not the original text lines.)';
            resultBox.appendChild(note);
        }

        const ul = document.createElement('ul');
        errors.forEach(err => {
            const li = document.createElement('li');
            const strong = document.createElement('strong');
            strong.textContent = err.instancePath || 'root';
            li.appendChild(strong);
            li.appendChild(document.createTextNode(`: ${err.message}`));
            ul.appendChild(li);
        });
        resultBox.appendChild(ul);
    }
});

async function loadSchemas() {
    // Helper to fetch JSON
    const fetchJson = async (filename) => {
        const res = await fetch(SCHEMA_BASE_URL + filename);
        if (!res.ok) throw new Error(`Failed to fetch ${filename}: ${res.statusText}`);
        return res.json();
    };

    // Load Base
    schemaContext.baseSchema = await fetchJson(BASE_SCHEMA_FILE);

    // Load Common
    const commonPromises = COMMON_SCHEMAS.map(filename => fetchJson(filename));
    schemaContext.commonSchemas = await Promise.all(commonPromises);

    // Load Sectors (We load all known mapped sectors so they are ready)
    // In a larger system, we might lazy load, but for this tool, eager loading is fine.
    const sectorPromises = Object.entries(SECTOR_MAP).map(async ([id, filename]) => {
        const schema = await fetchJson(filename);
        schemaContext.sectorSchemas[id] = schema;
    });
    await Promise.all(sectorPromises);
}
