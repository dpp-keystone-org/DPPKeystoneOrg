/**
 * Generates a standalone HTML product page from a DPP JSON object.
 * @param {Object} dppJson - The Digital Product Passport data.
 * @returns {Promise<string>} The complete HTML string.
 */
export async function generateHTML(dppJson) {
  if (!dppJson) {
    throw new Error("DPP JSON is required");
  }

  let cssContent = '';
  try {
    // Attempt to fetch the CSS file
    // Note: In a real deployment, this path must be accessible relative to the executing context
    // or be an absolute URL. For this wizard, we assume relative path from the root or similar.
    // Since this runs in the browser from the wizard (e.g. /wizard/index.html),
    // and the css is in /src/branding/css/..., we need the correct path.
    // If the app is served from root, it might be /src/branding/css/dpp-product-page.css
    // or if built, dist/css/...
    // For now, we'll try a relative path that works for the source structure.
    const response = await fetch('/src/branding/css/dpp-product-page.css');
    if (response.ok) {
      cssContent = await response.text();
    } else {
      console.warn("Failed to load DPP CSS, using default styles.");
    }
  } catch (e) {
    console.warn("Could not fetch CSS (likely running in non-browser env without fetch polyfill), using default styles.", e);
  }

  // Fallback CSS if fetch fails
  if (!cssContent) {
      cssContent = `
        body { font-family: sans-serif; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
      `;
  }

  const jsonString = JSON.stringify(dppJson, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Product Passport</title>
    <style>
        ${cssContent}
    </style>
</head>
<body>
    <h1>Digital Product Passport</h1>
    <p>This is a placeholder for the generated product page.</p>
    <h2>Raw Data</h2>
    <pre>${jsonString}</pre>
</body>
</html>`;
}