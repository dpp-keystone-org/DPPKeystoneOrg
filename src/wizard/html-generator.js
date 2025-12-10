// src/wizard/html-generator.js

import { transform } from '../util/js/common/dpp-logic.js';
import { EPD_TRANSFORMATION_PROFILE } from '../util/js/common/profiles/schema.org.js';

/**
 * Generates a standalone HTML page for a given DPP JSON object.
 *
 * @param {object} dpp - The DPP JSON object.
 * @returns {Promise<string>} A promise that resolves to the full HTML string.
 */
export async function generateDppHtml(dpp) {
    let schemaOrgJson = {};
    try {
        // Use the existing transformation engine to generate schema.org JSON-LD
        schemaOrgJson = await transform(dpp, {
            profile: EPD_TRANSFORMATION_PROFILE,
            // In a real client-side scenario, you would fetch these.
            // For this generator, we assume the logic doesn't need external context.
            getContext: async () => ({}) 
        });
    } catch (error) {
        console.error("Failed to transform DPP to Schema.org JSON-LD:", error);
        // Continue without the JSON-LD script if transformation fails
    }

    const title = dpp.productName || 'Digital Product Passport';

    // Body content
    let bodyContent = `<h1>${title}</h1>`;
    bodyContent += '<h2>Core Information</h2>';
    bodyContent += '<ul>';
    for (const [key, value] of Object.entries(dpp)) {
        if (typeof value !== 'object') {
            bodyContent += `<li><strong>${key}:</strong> ${value}</li>`;
        }
    }
    bodyContent += '</ul>';

    // Full HTML structure
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: sans-serif; line-height: 1.6; max-width: 800px; margin: 20px auto; }
        h1, h2 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
        ul { list-style-type: none; padding: 0; }
        li { background: #f4f4f4; margin-bottom: 5px; padding: 10px; border-radius: 4px; }
        strong { color: #333; }
    </style>
    <script type="application/ld+json">
        ${JSON.stringify(schemaOrgJson, null, 2)}
    </script>
</head>
<body>
    ${bodyContent}
</body>
</html>`;

    return html;
}
