/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock the global fetch function
global.fetch = jest.fn();

describe('HTML Generator', () => {
  let generateHTML;
  let detectTableStructure;
  let transformDppMock;

  beforeAll(async () => {
      transformDppMock = jest.fn();
      
      // Mock the dpp-adapter dependency
      jest.unstable_mockModule('../../src/util/js/client/dpp-adapter.js', () => ({
          transformDpp: transformDppMock
      }));

      // Dynamically import the module under test
      const module = await import('../../src/lib/html-generator.js');
      generateHTML = module.generateHTML;
      detectTableStructure = module.detectTableStructure;
  });

  beforeEach(() => {
      fetch.mockClear();
      transformDppMock.mockClear();
      // Default mock implementation for transformDpp (return null/undefined to skip LD generation by default)
      transformDppMock.mockResolvedValue(null);
  });
  
  describe('detectTableStructure', () => {
      test('should return true for homogenous matrix', () => {
          const matrix = {
              row1: { col1: 1, col2: 2 },
              row2: { col1: 3, col2: 4 },
              row3: { col1: 5, col2: 6 }
          };
          expect(detectTableStructure(matrix)).toBe(true);
      });

      test('should return true for mostly dense matrix', () => {
          const matrix = {
              row1: { col1: 1, col2: 2 },
              row2: { col1: 3 }, // Missing one
              row3: { col1: 5, col2: 6 }
          };
          // Density: 5 actual / 6 theoretical = 0.83 > 0.5
          expect(detectTableStructure(matrix)).toBe(true);
      });

      test('should return false for sparse/disjoint objects', () => {
          const disjoint = {
              row1: { a: 1 },
              row2: { b: 2 },
              row3: { c: 3 }
          };
          // Density: 3 actual / (3 rows * 3 unique cols) = 3/9 = 0.33 < 0.5
          expect(detectTableStructure(disjoint)).toBe(false);
      });

      test('should return false for non-objects', () => {
          const mixed = {
              row1: { a: 1 },
              row2: 5 
          };
          expect(detectTableStructure(mixed)).toBe(false);
      });
  });


  test('should generate HTML containing the input JSON and fetched CSS', async () => {
    const mockDpp = {
      productName: "Test Product",
      id: "12345"
    };

    const mockCss = "body { background: blue; }";

    // Mock successful CSS fetch
    fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => mockCss,
    });

    const html = await generateHTML(mockDpp);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Product');
    expect(html).toContain('12345');
    // Verify CSS is embedded
    expect(html).toContain(mockCss);
    
    // Verify fetch was called with correct path (allowing for other calls like HEAD check)
    expect(fetch).toHaveBeenCalledWith(expect.stringMatching(/branding\/css\/dpp-product-page\.css/));
  });

  test('should render Header Only correctly (Minimal)', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const mockDpp = {
      productName: "Minimal Product",
      id: "MIN-123"
    };

    const html = await generateHTML(mockDpp);

    expect(html).toContain('Digital Product Passport');
    expect(html).toContain('MIN-123');
    expect(html).toContain('No Image Available');
    expect(html).not.toContain('<img');
  });

  test('should render Hero Title from Brand and Model', async () => {
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

      const mockDpp = {
          brand: "Acme",
          model: "Rocket 5000",
          id: "123"
      };

      const html = await generateHTML(mockDpp);

      expect(html).toContain('<h1>Acme Rocket 5000</h1>');
  });

  test('should render Hero Title from Model only', async () => {
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
      const mockDpp = { model: "Just Model", id: "123" };
      const html = await generateHTML(mockDpp);
      expect(html).toContain('<h1>Just Model</h1>');
  });

  test('should render Default Title if only Brand provided', async () => {
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
      const mockDpp = { brand: "Just Brand", id: "123" };
      const html = await generateHTML(mockDpp);
      // Fallback logic: no model -> default title
      expect(html).toContain('<h1>Digital Product Passport</h1>');
  });

  test('should render Single Image correctly (Static)', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const mockDpp = {
      brand: "Super",
      model: "Widget",
      uniqueProductIdentifier: "GTIN:123456789",
      image: [
          { url: "http://example.com/image.png", resourceTitle: "Main View" }
      ]
    };

    const html = await generateHTML(mockDpp);

    expect(html).toContain('Super Widget');
    expect(html).toContain('GTIN:123456789');
    expect(html).toContain('<img src="http://example.com/image.png"');
    expect(html).toContain('class="dpp-hero"');
    // Ensure carousel container is NOT present
    expect(html).not.toContain('dpp-carousel-container');
  });

  test('should render Multiple Images correctly (Carousel)', async () => {
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

      const mockDpp = {
          productName: "Carousel Item",
          image: [
              { url: "img1.png", resourceTitle: "View 1" },
              { url: "img2.png", resourceTitle: "View 2" }
          ]
      };

      const html = await generateHTML(mockDpp);

      expect(html).toContain('dpp-carousel-container');
      expect(html).toContain('onclick="moveSlide(1)"'); // Next button
      expect(html).toContain('onclick="moveSlide(-1)"'); // Prev button
      expect(html).toContain('img1.png');
      expect(html).toContain('img2.png');
      expect(html).toContain('function moveSlide'); // JS injected
  });

  test('should ignore Legacy Image Fields', async () => {
    fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const mockDpp = {
      productName: "Legacy Product",
      productImage: "http://example.com/legacy.png", // Should be ignored
      images: ["http://example.com/legacy2.png"] // Should be ignored
    };

    const html = await generateHTML(mockDpp);

    expect(html).toContain('Legacy Product');
    expect(html).toContain('No Image Available');
    expect(html).not.toContain('http://example.com/legacy.png');
    expect(html).not.toContain('http://example.com/legacy2.png');
  });

  test('should render Voluntary Attributes correctly', async () => {
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

      const mockDpp = {
          productName: "Voluntary Product",
          customAttribute: "Custom Value",
          anotherAttribute: 123
      };

      const html = await generateHTML(mockDpp);

      expect(html).toContain('Custom Attribute:</span> <span class="dpp-value">Custom Value</span>');
      expect(html).toContain('Another Attribute:</span> <span class="dpp-value">123</span>');
  });

  test('should render Metadata section correctly', async () => {
    const mockDpp = {
      productName: "Test Item",
      dppStatus: "Active",
      lastUpdate: "2023-10-27",
      digitalProductPassportId: "urn:uuid:999"
    };
    
    // Mock fetch for this test too
    fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const html = await generateHTML(mockDpp);
    
    expect(html).toContain('Passport Status:</span> <span class="dpp-value">Active</span>');
    expect(html).toContain('Last Updated:</span> <span class="dpp-value">2023-10-27</span>');
    expect(html).toContain('Passport ID:</span> <span class="dpp-value">urn:uuid:999</span>');
    expect(html).toContain('class="dpp-metadata"');
  });

  test('should render primitive values correctly', async () => {
    const mockDpp = {
      productName: "Simple Widget",
      color: "Red",
      weight: 10,
      isRecyclable: true
    };
    
    fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

    const html = await generateHTML(mockDpp);
    
    expect(html).toContain('Color:</span> <span class="dpp-value">Red</span>');
    expect(html).toContain('Weight:</span> <span class="dpp-value">10</span>');
    expect(html).toContain('Is Recyclable:</span> <span class="dpp-value">true</span>');
  });

  test('should render matrix objects as tables', async () => {
      const mockDpp = {
          productName: "Table Product",
          environmentalProfile: {
              gwp: { a1: 10, a2: 5 },
              odp: { a1: 0.1, a2: 0.05 }
          }
      };
      
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
      const html = await generateHTML(mockDpp);
      
      expect(html).toContain('<table>');
      expect(html).toContain('<th>a1</th>');
      // Row key is in the first cell, bolded
      expect(html).toContain('<strong>gwp</strong>'); 
      expect(html).toContain('<td>10</td>');
  });

  test('should render standard objects as cards', async () => {
      const mockDpp = {
          productName: "Card Product",
          dimensions: {
              width: 10,
              height: 20
          }
      };
      
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
      const html = await generateHTML(mockDpp);
      
      expect(html).not.toContain('<table>');
      expect(html).toContain('<h4>Dimensions</h4>');
      expect(html).toContain('Width:</span> <span class="dpp-value">10</span>');
  });

  test('should render object arrays as tables', async () => {
      const mockDpp = {
          productName: "List Product",
          components: [
              { name: "Part A", id: "1" },
              { name: "Part B", id: "2" }
          ]
      };
      
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
      const html = await generateHTML(mockDpp);
      
      expect(html).toContain('<table>');
      expect(html).toContain('<th>name</th>');
      expect(html).toContain('<td>Part A</td>');
      expect(html).toContain('<td>Part B</td>');
  });

  test('should render primitive arrays as lists', async () => {
      const mockDpp = {
          productName: "List Product",
          tags: ["urgent", "fragile"]
      };
      
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });
      const html = await generateHTML(mockDpp);
      
      expect(html).toContain('<ul>');
      expect(html).toContain('<li>urgent</li>');
  });

  test('should use fallback CSS if fetch fails', async () => {
    const mockDpp = { id: "123" };
    
    // Silence console.warn for this expected failure
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Mock failed fetch
    fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
    });

    const html = await generateHTML(mockDpp);
    
    expect(html).toContain('font-family: sans-serif'); // Part of fallback CSS
    expect(consoleSpy).toHaveBeenCalled();
    
    consoleSpy.mockRestore();
  });

  test('should throw error if input is missing', async () => {
    await expect(generateHTML(null)).rejects.toThrow("DPP JSON is required");
  });

  test('should inject JSON-LD script when transformDpp returns data', async () => {
      const mockDpp = { productName: "Test", id: "1" };
      const mockJsonLd = { "@context": "http://schema.org", "@type": "Product", "name": "Test" };
      
      // Setup mock return
      transformDppMock.mockResolvedValueOnce(mockJsonLd);
      
      fetch.mockResolvedValueOnce({ ok: true, text: async () => "" });

      const html = await generateHTML(mockDpp);

      // Verify transformDpp called with correct arguments
      expect(transformDppMock).toHaveBeenCalledWith(mockDpp, expect.objectContaining({
          profile: 'schema.org',
          ontologyPaths: expect.arrayContaining([expect.stringMatching(/ontology\/v1\/dpp-ontology\.jsonld/)]),
          documentLoader: expect.any(Function)
      }));

      // Verify script tag is present
      expect(html).toContain('<script type="application/ld+json">');
      expect(html).toContain('"@type": "Product"');
      expect(html).toContain('</script>');
  });
});
