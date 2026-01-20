import { renderProductPage, detectTableStructure } from '../util/js/common/rendering/dpp-html-renderer.js';

// Re-export for testing compatibility
export { detectTableStructure };

/**
 * Generates a standalone HTML product page from a DPP JSON object.
 * Orchestrates CSS fetching, JSON-LD generation, and HTML rendering.
 * 
 * @param {Object} dppJson - The Digital Product Passport data.
 * @param {string} [customCssUrl] - Optional URL for a custom stylesheet to override defaults.
 * @returns {Promise<string>} The complete HTML string.
 */
export async function generateHTML(dppJson, customCssUrl) {
  if (!dppJson) {
    throw new Error("DPP JSON is required");
  }

  // 1. Fetch CSS
  let cssContent = '';
  try {
    const response = await fetch('../branding/css/dpp-product-page.css');
    if (response.ok) {
      cssContent = await response.text();
    } else {
      console.warn("Failed to load DPP CSS, using default styles.");
    }
  } catch (e) {
    console.warn("Could not fetch CSS (likely running in non-browser env without fetch polyfill), using default styles.", e);
  }

  // 2. Generate JSON-LD (Schema.org)
  let jsonLdString = null;
  try {
      // Dynamically import the adapter
      const { transformDpp } = await import('../util/js/client/dpp-schema-adapter.js');

      // Determine correct ontology path
      let ontologyPath = '../ontology/v1/dpp-ontology.jsonld';
      try {
          const specCheck = await fetch('../spec/ontology/v1/dpp-ontology.jsonld', { method: 'HEAD' });
          if (specCheck.ok) {
              ontologyPath = '../spec/ontology/v1/dpp-ontology.jsonld';
          }
      } catch (ignore) { }
      
      const ontologyPaths = [ontologyPath];
      
      // Custom Document Loader
      const localDocumentLoader = async (url) => {
          if (url.startsWith('https://dpp-keystone.org/spec/')) {
              let relativePath = url.replace('https://dpp-keystone.org/spec/', '../');
              const isDist = ontologyPath.includes('/spec/');
              if (isDist) {
                   relativePath = url.replace('https://dpp-keystone.org/spec/', '../spec/');
              } else {
                   relativePath = url.replace('https://dpp-keystone.org/spec/', '../');
              }
              try {
                  const response = await fetch(relativePath);
                  if (!response.ok) throw new Error('404');
                  const document = await response.json();
                  return { contextUrl: null, documentUrl: url, document: document };
              } catch (e) {
                  console.warn(`Failed to fetch local context for ${url}, falling back to network.`);
              }
          }
          const response = await fetch(url, { headers: { 'Accept': 'application/ld+json, application/json' } });
          const document = await response.json();
          return { contextUrl: null, documentUrl: url, document: document };
      };

      console.log("DPP HTML Generator Debug: Calling transformDpp with:", dppJson);
      const transformed = await transformDpp(dppJson, {
           profile: 'schema.org',
           ontologyPaths: ontologyPaths,
           documentLoader: localDocumentLoader
      });
      console.log("DPP HTML Generator Debug: Result from transformDpp:", transformed);
      
      if (transformed) {
           jsonLdString = JSON.stringify(transformed, null, 2);
      }
  } catch (e) {
      console.warn("Failed to generate JSON-LD:", e);
      console.log("DPP HTML Generator Debug: JSON-LD generation error:", e);
  }

  // 3. Render Page
  return renderProductPage({
      dppData: dppJson,
      css: cssContent,
      jsonLd: jsonLdString,
      customCssUrl: customCssUrl
  });
}
