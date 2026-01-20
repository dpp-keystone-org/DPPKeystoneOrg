/**
 * Common HTML Renderer for Digital Product Passports.
 * Transforms DPP JSON into a visual HTML string.
 */

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

/**
 * Recursive helper to render a single value.
 * @param {string} key 
 * @param {any} value 
 * @returns {string} HTML string
 */
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

/**
 * Generates a complete HTML string for the product page.
 * @param {object} options
 * @param {object} options.dppData - The raw DPP JSON.
 * @param {string} [options.css] - The CSS string to embed.
 * @param {string} [options.jsonLd] - The JSON-LD string to embed (without script tags).
 * @param {string} [options.customCssUrl] - Optional external CSS URL.
 * @returns {string} The full HTML document.
 */
export function renderProductPage({ dppData, css, jsonLd, customCssUrl }) {
    if (!dppData) throw new Error("DPP JSON is required");

    const jsonLdScript = jsonLd 
        ? `<script type="application/ld+json">
${jsonLd}
</script>` 
        : '';
    
    const cssContent = css || `
        body { font-family: sans-serif; padding: 20px; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
    `;

    const productName = dppData.productName || "Untitled Product";
    const uniqueId = dppData.uniqueProductIdentifier || dppData.id || "N/A";
  
    // Extract Images
    let images = [];
    if (dppData.image && Array.isArray(dppData.image)) {
        images = dppData.image.filter(img => img.url).map(img => ({
            url: img.url,
            title: img.resourceTitle || img.name || productName
        }));
    }

    // --- Hero Section Generation ---
    let heroImageHtml = '';
    let carouselScript = '';

    if (images.length === 0) {
        heroImageHtml = '<div class="dpp-hero-placeholder">No Image Available</div>';
    } else if (images.length === 1) {
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

        carouselScript = `
          <script>
              let currentSlide = 0;
              const totalSlides = ${images.length};

              function showSlide(index) {
                  if (index >= totalSlides) currentSlide = 0;
                  else if (index < 0) currentSlide = totalSlides - 1;
                  else currentSlide = index;

                  const slides = document.querySelectorAll('.dpp-carousel-slide');
                  slides.forEach(slide => slide.classList.remove('active'));
                  slides[currentSlide].classList.add('active');

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

    // Product Title
    let productTitle = "Digital Product Passport";
    const brand = dppData.brand || "";
    const model = dppData.model || "";
    if (brand && model) productTitle = `${brand} ${model}`;
    else if (model) productTitle = model;

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
    const dppStatus = dppData.dppStatus || "Unknown";
    let lastUpdate = dppData.lastUpdate || "N/A";
    
    const metadataHtml = `
      <section class="dpp-metadata">
          <div class="dpp-field"><span class="dpp-label">Passport Status:</span> <span class="dpp-value">${dppStatus}</span></div>
          <div class="dpp-field"><span class="dpp-label">Last Updated:</span> <span class="dpp-value">${lastUpdate}</span></div>
          <div class="dpp-field"><span class="dpp-label">Passport ID:</span> <span class="dpp-value">${dppData.digitalProductPassportId || "N/A"}</span></div>
          <div class="dpp-field"><span class="dpp-label">Schema Version:</span> <span class="dpp-value">${dppData.dppSchemaVersion || "N/A"}</span></div>
          <div class="dpp-field"><span class="dpp-label">Economic Operator ID:</span> <span class="dpp-value">${dppData.economicOperatorId || "N/A"}</span></div>
          <div class="dpp-field"><span class="dpp-label">Granularity:</span> <span class="dpp-value">${dppData.granularity || "N/A"}</span></div>
      </section>
    `;

    // --- Content Body ---
    const EXCLUDED_KEYS = new Set([
        'productName', 'manufacturer', 'uniqueProductIdentifier', 'id', 'images', 'productImage', 'image',
        'dppStatus', 'lastUpdate', 'digitalProductPassportId', 'dppSchemaVersion', 'economicOperatorId', 'granularity',
        '@context', '@type'
    ]);

    let contentHtml = '';
    Object.keys(dppData).forEach(key => {
        if (!EXCLUDED_KEYS.has(key)) {
            contentHtml += renderValue(key, dppData[key]);
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