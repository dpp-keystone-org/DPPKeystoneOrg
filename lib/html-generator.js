/**
 * Generates a standalone HTML product page from a DPP JSON object.
 * @param {Object} dppJson - The Digital Product Passport data.
 * @param {string} [customCssUrl] - Optional URL for a custom stylesheet to override defaults.
 * @returns {Promise<string>} The complete HTML string.
 */
export async function generateHTML(dppJson, customCssUrl) {
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
      const { transformDpp } = await import('../util/js/client/dpp-adapter.js?v=1768510063388');

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

      console.log("DPP HTML Generator Debug: Calling transformDpp with:", dppJson);
      const transformed = await transformDpp(dppJson, {
           profile: 'schema.org',
           ontologyPaths: ontologyPaths,
           documentLoader: localDocumentLoader
      });
      console.log("DPP HTML Generator Debug: Result from transformDpp:", transformed);
      
      if (transformed) {
           const jsonLdString = JSON.stringify(transformed, null, 2);
           jsonLdScript = `<script type="application/ld+json">\n${jsonLdString}\n</script>`;
      }
  } catch (e) {
      console.warn("Failed to generate JSON-LD:", e);
      console.log("DPP HTML Generator Debug: JSON-LD generation error:", e);
  }

  const jsonString = JSON.stringify(dppJson, null, 2);

  // --- Data Extraction ---
  const productName = dppJson.productName || "Untitled Product";
  // Handle manufacturer as string or object
  const manufacturerName = (typeof dppJson.manufacturer === 'object' && dppJson.manufacturer?.organizationName) 
      ? dppJson.manufacturer.organizationName 
      : (dppJson.manufacturer || "Unknown Manufacturer");
  
  const uniqueId = dppJson.uniqueProductIdentifier || dppJson.id || "N/A";
  
  // Extract Images
  // Priority: 'image' array (Schema.org/general-product compliant)
  let images = [];
  
  if (dppJson.image && Array.isArray(dppJson.image)) {
      // Filter for valid objects with URLs
      images = dppJson.image.filter(img => img.url).map(img => ({
          url: img.url,
          title: img.resourceTitle || img.name || productName
      }));
  }

  // --- Hero Section Generation ---
  let heroImageHtml = '';
  let carouselScript = '';

  if (images.length === 0) {
      // No images placeholder
      heroImageHtml = '<div class="dpp-hero-placeholder">No Image Available</div>';
  } else if (images.length === 1) {
      // Single Static Image
      heroImageHtml = `
          <div class="dpp-hero-image">
              <img src="${images[0].url}" alt="${images[0].title}" style="max-width: 100%; height: auto;">
          </div>`;
  } else {
      // Carousel Logic
      const slidesHtml = images.map((img, index) => `
          <div class="dpp-carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
              <img src="${img.url}" alt="${img.title}">
              <div class="dpp-carousel-caption">${img.title}</div>
          </div>
      `).join('');

      const indicatorsHtml = images.map((_, index) => `
          <span class="dpp-indicator ${index === 0 ? 'active' : ''}" onclick="setSlide(${index})"></span>
      `).join('');

      heroImageHtml = `
          <div class="dpp-carousel-container" id="heroCarousel">
              <div class="dpp-carousel-slides">
                  ${slidesHtml}
              </div>
              <button class="dpp-carousel-btn prev" onclick="moveSlide(-1)">&#10094;</button>
              <button class="dpp-carousel-btn next" onclick="moveSlide(1)">&#10095;</button>
              <div class="dpp-carousel-indicators">
                  ${indicatorsHtml}
              </div>
          </div>
      `;

      // Inject Carousel JS logic
      carouselScript = `
        <script>
            let currentSlide = 0;
            const totalSlides = ${images.length};

            function showSlide(index) {
                if (index >= totalSlides) currentSlide = 0;
                else if (index < 0) currentSlide = totalSlides - 1;
                else currentSlide = index;

                // Update Slides
                const slides = document.querySelectorAll('.dpp-carousel-slide');
                slides.forEach(slide => slide.classList.remove('active'));
                slides[currentSlide].classList.add('active');

                // Update Indicators
                const indicators = document.querySelectorAll('.dpp-indicator');
                indicators.forEach(ind => ind.classList.remove('active'));
                if(indicators[currentSlide]) indicators[currentSlide].classList.add('active');
            }

            function moveSlide(step) {
                showSlide(currentSlide + step);
            }

            function setSlide(index) {
                showSlide(index);
            }
        </script>
      `;
  }

  // Construct Product Title logic
  let productTitle = "Digital Product Passport";
  const brand = dppJson.brand || "";
  const model = dppJson.model || "";

  if (brand && model) {
      productTitle = `${brand} ${model}`;
  } else if (model) {
      productTitle = model;
  }
  // If only brand is present, we still default to "Digital Product Passport" (or maybe "Brand Product"? stick to spec: no model -> no specific name)

  const heroHtml = `
    <header class="dpp-hero">
        ${heroImageHtml}
        <div class="dpp-hero-content">
            <h1>${productTitle}</h1>
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
        <div class="dpp-field"><span class="dpp-label">Passport Status:</span> <span class="dpp-value">${dppStatus}</span></div>
        <div class="dpp-field"><span class="dpp-label">Last Updated:</span> <span class="dpp-value">${lastUpdate}</span></div>
        <div class="dpp-field"><span class="dpp-label">Passport ID:</span> <span class="dpp-value">${dppJson.digitalProductPassportId || "N/A"}</span></div>
        <div class="dpp-field"><span class="dpp-label">Schema Version:</span> <span class="dpp-value">${dppJson.dppSchemaVersion || "N/A"}</span></div>
        <div class="dpp-field"><span class="dpp-label">Economic Operator ID:</span> <span class="dpp-value">${dppJson.economicOperatorId || "N/A"}</span></div>
        <div class="dpp-field"><span class="dpp-label">Granularity:</span> <span class="dpp-value">${dppJson.granularity || "N/A"}</span></div>
    </section>
  `;

  // --- Content Body (Recursive Renderer) ---
  const EXCLUDED_KEYS = new Set([
      'productName', 'manufacturer', 'uniqueProductIdentifier', 'id', 'images', 'productImage', 'image', // Hero
      'dppStatus', 'lastUpdate', 'digitalProductPassportId', 'dppSchemaVersion', 'economicOperatorId', 'granularity', // Metadata
      '@context', '@type' // JSON-LD infrastructure
  ]);

  let contentHtml = '';
  
  // Helper function to render a single value (initially just primitives)
  function renderValue(key, value) {
      if (value === null || value === undefined) return '';
      
      const label = key.replace(/([A-Z])/g, ' $1') // CamelCase to Title Case (rough)
                       .replace(/([a-zA-Z])(\d)/g, '$1 $2') // Space before numbers
                       .trim(); 
      const displayLabel = label.charAt(0).toUpperCase() + label.slice(1);

      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
          return `<div class="dpp-field"><span class="dpp-label">${displayLabel}:</span> <span class="dpp-value">${value}</span></div>`;
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
                  <div class="dpp-card">
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
                  const cells = sortedKeys.map(key => `<td>${item[key] !== undefined ? item[key] : '-'}</td>`).join('');
                  return `<tr>${cells}</tr>`;
              }).join('');

              return `
                  <div class="dpp-card">
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
              <div class="dpp-field dpp-field-list">
                  <span class="dpp-label">${displayLabel}:</span>
                  <span class="dpp-value"><ul>${listItems}</ul></span>
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
    ${customCssUrl ? `<link rel="stylesheet" href="${customCssUrl}">` : ''}
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
    ${carouselScript}
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
    
    const rowKeys = Object.keys(obj);
    if (rowKeys.length === 0) return false;

    let objectChildCount = 0;
    const allUniqueSubKeys = new Set();
    
    // Pass 1: Check children type and collect all unique column keys
    for (const key of rowKeys) {
        const val = obj[key];
        // Must be an object, not null, not array, and not empty
        if (typeof val === 'object' && val !== null && !Array.isArray(val) && Object.keys(val).length > 0) {
            objectChildCount++;
            Object.keys(val).forEach(k => allUniqueSubKeys.add(k));
        } else {
            // If any child is not a suitable object, it's likely not a matrix
            return false; 
        }
    }

    if (objectChildCount !== rowKeys.length) return false;
    if (allUniqueSubKeys.size === 0) return false;

    // Pass 2: Check density
    // Density = (Actual Total Cells) / (Rows * Unique Columns)
    let totalActualCells = 0;
    for (const key of rowKeys) {
        totalActualCells += Object.keys(obj[key]).length;
    }

    const theoreticalCells = rowKeys.length * allUniqueSubKeys.size;
    const density = totalActualCells / theoreticalCells;

    // Allow single-row tables if they have multiple columns (e.g. wide data)
    // But typically matrix implies > 1 row. 
    // If only 1 row, density is always 1.0 (since unique cols = actual cols).
    // A 1-row table is usually better as a Card unless it has many columns.
    if (rowKeys.length < 2 && allUniqueSubKeys.size < 3) return false;

    return density > 0.5;
}