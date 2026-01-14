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
    // Adjusted to use a relative path that works for both 'src' (dev) and 'dist' (prod) structures.
    // Assuming the executing page is at /wizard/index.html:
    // - Dev: /branding/css/... (mapped via ../branding)
    // - Prod: /branding/css/... (mapped via ../branding)
    const response = await fetch('../branding/css/dpp-product-page.css');
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

  // --- JSON-LD Generation ---
  let jsonLdScript = '';
  try {
      // Dynamically import the adapter to avoid top-level dependency on 'jsonld'
      // which can break app loading if not properly resolved by the environment.
      const { transformDpp } = await import('../util/js/client/dpp-adapter.js?v=1768414137213');

      // Determine correct ontology path based on environment (Source vs Dist)
      // Dist build moves ontology to 'spec/ontology', Source has it at 'ontology'
      let ontologyPath = '../ontology/v1/dpp-ontology.jsonld';
      try {
          const specCheck = await fetch('../spec/ontology/v1/dpp-ontology.jsonld', { method: 'HEAD' });
          if (specCheck.ok) {
              ontologyPath = '../spec/ontology/v1/dpp-ontology.jsonld';
          }
      } catch (ignore) {
          // fetch failed (network error etc), fallback to default
      }
      
      const ontologyPaths = [ontologyPath];
      
      // Custom Document Loader to intercept remote context URLs and serve local files
      const localDocumentLoader = async (url) => {
          // Check if it's one of our project contexts
          if (url.startsWith('https://dpp-keystone.org/spec/')) {
              // Map remote URL to local path
              // Remote: https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld
              // Local (Source): ../contexts/v1/dpp-core.context.jsonld
              // Local (Dist): ../spec/contexts/v1/dpp-core.context.jsonld
              
              let relativePath = url.replace('https://dpp-keystone.org/spec/', '../');
              
              // If we are in 'dist' (implied by ontologyPath containing 'spec'), we need to adjust
              // actually, strict mapping:
              // src:  ../contexts/...
              // dist: ../spec/contexts/...
              
              // Let's reuse the detection logic from ontologyPath
              const isDist = ontologyPath.includes('/spec/');
              if (isDist) {
                   relativePath = url.replace('https://dpp-keystone.org/spec/', '../spec/');
              } else {
                   // In source, structure is different:
                   // https://dpp-keystone.org/spec/contexts/v1/... -> ../contexts/v1/...
                   // https://dpp-keystone.org/spec/v1/terms -> (Ontology, handled separately usually, but good to cover)
                   relativePath = url.replace('https://dpp-keystone.org/spec/', '../');
              }
              
              try {
                  const response = await fetch(relativePath);
                  if (!response.ok) throw new Error('404');
                  const document = await response.json();
                  return {
                      contextUrl: null,
                      documentUrl: url,
                      document: document
                  };
              } catch (e) {
                  console.warn(`Failed to fetch local context for ${url}, falling back to network.`);
              }
          }

          // Fallback to default loader (using global jsonld if available, or simple fetch)
          // Since we are in browser, we can just fetch.
          const response = await fetch(url, {
              headers: { 'Accept': 'application/ld+json, application/json' }
          });
          const document = await response.json();
          return {
              contextUrl: null,
              documentUrl: url,
              document: document
          };
      };

      const transformed = await transformDpp(dppJson, {
           profile: 'schema.org',
           ontologyPaths: ontologyPaths,
           documentLoader: localDocumentLoader
      });
      
      if (transformed) {
           const jsonLdString = JSON.stringify(transformed, null, 2);
           jsonLdScript = `<script type="application/ld+json">\n${jsonLdString}\n</script>`;
      }
  } catch (e) {
      console.warn("Failed to generate JSON-LD:", e);
  }

  const jsonString = JSON.stringify(dppJson, null, 2);

  // --- Data Extraction ---
  const productName = dppJson.productName || "Untitled Product";
  // Handle manufacturer as string or object
  const manufacturerName = (typeof dppJson.manufacturer === 'object' && dppJson.manufacturer?.organizationName) 
      ? dppJson.manufacturer.organizationName 
      : (dppJson.manufacturer || "Unknown Manufacturer");
  
  const uniqueId = dppJson.uniqueProductIdentifier || dppJson.id || "N/A";
  
  // Try to find an image (naive check for now, can be improved later)
  // Check for specific 'productImage' or search in keys
  let imageUrl = dppJson.productImage;
  if (!imageUrl && dppJson.images && Array.isArray(dppJson.images) && dppJson.images.length > 0) {
      imageUrl = dppJson.images[0];
  }

  // --- Hero Section HTML ---
  const imageHtml = imageUrl 
      ? `<div class="dpp-hero-image"><img src="${imageUrl}" alt="${productName}" style="max-width: 100%; height: auto;"></div>` 
      : '';

  const heroHtml = `
    <header class="dpp-hero">
        ${imageHtml}
        <div class="dpp-hero-content">
            <h1>${productName}</h1>
            <h2>${manufacturerName}</h2>
            <p><strong>ID:</strong> ${uniqueId}</p>
        </div>
    </header>
  `;

  // --- Metadata Section ---
  const dppStatus = dppJson.dppStatus || "Unknown";
  // Format date if possible
  let lastUpdate = dppJson.lastUpdate || "N/A";
  
  const metadataHtml = `
    <section class="dpp-metadata">
        <div class="dpp-field"><span class="dpp-label">Passport Status:</span> ${dppStatus}</div>
        <div class="dpp-field"><span class="dpp-label">Last Updated:</span> ${lastUpdate}</div>
        <div class="dpp-field"><span class="dpp-label">Passport ID:</span> ${dppJson.digitalProductPassportId || "N/A"}</div>
    </section>
  `;

  // --- Content Body (Recursive Renderer) ---
  const EXCLUDED_KEYS = new Set([
      'productName', 'manufacturer', 'uniqueProductIdentifier', 'id', 'images', 'productImage', // Hero
      'dppStatus', 'lastUpdate', 'digitalProductPassportId', // Metadata
      '@context', '@type' // JSON-LD infrastructure
  ]);

  let contentHtml = '';
  
  // Helper function to render a single value (initially just primitives)
  function renderValue(key, value) {
      if (value === null || value === undefined) return '';
      
      const label = key.replace(/([A-Z])/g, ' $1').trim(); // CamelCase to Title Case (rough)
      const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return `<div class="dpp-field"><span class="dpp-label">${displayLabel}:</span> ${value}</div>`;
      }

      if (typeof value === 'object' && !Array.isArray(value)) {
          // Check for Table Structure
          if (detectTableStructure(value)) {
              // Collect all unique columns
              const allColumns = new Set();
              Object.values(value).forEach(row => Object.keys(row).forEach(k => allColumns.add(k)));
              const sortedCols = Array.from(allColumns).sort();

              const headers = ['Metric', ...sortedCols].map(h => `<th>${h}</th>`).join('');
              
              const rows = Object.entries(value).map(([rowKey, rowData]) => {
                  const cells = sortedCols.map(col => `<td>${rowData[col] !== undefined ? rowData[col] : '-'}</td>`).join('');
                  return `<tr><td><strong>${rowKey}</strong></td>${cells}</tr>`;
              }).join('');

              return `
                  <div class="dpp-section">
                      <h4>${displayLabel}</h4>
                      <table>
                          <thead><tr>${headers}</tr></thead>
                          <tbody>${rows}</tbody>
                      </table>
                  </div>
              `;
          }

          // Recursive Standard Object Rendering
          let childContent = '';
          Object.keys(value).forEach(k => {
              childContent += renderValue(k, value[k]);
          });
          
          return `
              <div class="dpp-card">
                  <h4>${displayLabel}</h4>
                  <div class="dpp-card-content">
                      ${childContent}
                  </div>
              </div>
          `;
      }
      
      if (Array.isArray(value)) {
          if (value.length === 0) return '';
          
          // Check for Array of Objects (Potential Table)
          const isArrayOfObjects = value.every(item => typeof item === 'object' && item !== null && !Array.isArray(item));
          
          if (isArrayOfObjects) {
              // Collect all keys
              const allKeys = new Set();
              value.forEach(item => Object.keys(item).forEach(k => allKeys.add(k)));
              const sortedKeys = Array.from(allKeys).sort();

              // Simple Heuristic: If we have keys, render as table. 
              // (Could check for schema overlap, but for MVP assuming uniform array if they are objects)
              const headers = sortedKeys.map(h => `<th>${h}</th>`).join('');
              
              const rows = value.map(item => {
                  const cells = sortedKeys.map(key => `<td>${item[key] !== undefined ? item[key] : ''}</td>`).join('');
                  return `<tr>${cells}</tr>`;
              }).join('');

              return `
                  <div class="dpp-section">
                      <h4>${displayLabel}</h4>
                      <table>
                          <thead><tr>${headers}</tr></thead>
                          <tbody>${rows}</tbody>
                      </table>
                  </div>
              `;
          }

          // Array of Primitives
          const listItems = value.map(item => `<li>${item}</li>`).join('');
          return `
              <div class="dpp-field">
                  <span class="dpp-label">${displayLabel}:</span>
                  <ul>${listItems}</ul>
              </div>
          `;
      }

      return `<div class="dpp-field"><span class="dpp-label">${displayLabel}:</span> (Unknown Type)</div>`;
  }

  // Iterate over remaining keys
  Object.keys(dppJson).forEach(key => {
      if (!EXCLUDED_KEYS.has(key)) {
          contentHtml += renderValue(key, dppJson[key]);
      }
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${productName} - Digital Product Passport</title>
    ${jsonLdScript}
    <style>
        ${cssContent}
    </style>
</head>
<body>
    <div class="dpp-container">
        ${heroHtml}
        ${metadataHtml}
        
        <section class="dpp-section">
            <h3>Product Attributes</h3>
            ${contentHtml}
        </section>
    </div>
</body>
</html>`;
}

/**
 * Heuristic to detect if an object should be rendered as a matrix table.
 * Returns true if children are objects sharing significant keys.
 * @param {Object} obj 
 * @returns {boolean}
 */
export function detectTableStructure(obj) {
    if (typeof obj !== 'object' || obj === null) return false;
    
    const keys = Object.keys(obj);
    if (keys.length < 2) return false; // Need at least 2 rows to justify a table

    let objectChildCount = 0;
    const allSubKeys = new Set();
    
    // Pass 1: Check children type and collect keys
    for (const key of keys) {
        const val = obj[key];
        if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
            objectChildCount++;
            Object.keys(val).forEach(k => allSubKeys.add(k));
        } else {
            // If any child is not an object, it's likely a mixed bag, not a matrix
            return false; 
        }
    }

    if (objectChildCount !== keys.length) return false;
    if (allSubKeys.size === 0) return false;

    // Pass 2: Check density
    // If we have 3 rows and 3 unique columns, total cells = 9.
    // If actual data has 8 or 9 entries, it's a good table.
    // If actual data has 3 entries (each row has disjoint keys), it's not a table.
    
    let totalCells = 0;
    for (const key of keys) {
        totalCells += Object.keys(obj[key]).length;
    }

    const theoreticalCells = keys.length * allSubKeys.size;
    const density = totalCells / theoreticalCells;

    return density > 0.5;
}