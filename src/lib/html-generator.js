/**
 * Generates a standalone HTML product page from a DPP JSON object.
 * @param {Object} dppJson - The Digital Product Passport data.
 * @returns {string} The complete HTML string.
 */
export function generateHTML(dppJson) {
  if (!dppJson) {
    throw new Error("DPP JSON is required");
  }

  const jsonString = JSON.stringify(dppJson, null, 2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Digital Product Passport</title>
    <style>
        body { font-family: sans-serif; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
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
