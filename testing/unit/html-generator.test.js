/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { generateHTML, detectTableStructure } from '../../src/lib/html-generator.js';

// Mock the global fetch function
global.fetch = jest.fn();

describe('HTML Generator', () => {
  beforeEach(() => {
      fetch.mockClear();
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
    
    // Verify fetch was called with correct path
    expect(fetch).toHaveBeenCalledWith('/src/branding/css/dpp-product-page.css');
  });

  test('should render Hero section correctly', async () => {
    // Mock successful CSS fetch (or failure, doesn't matter for this test, but must return an object)
    fetch.mockResolvedValueOnce({
        ok: true,
        text: async () => "body {}",
    });

    const mockDpp = {
      productName: "Super Widget",
      manufacturer: { organizationName: "Acme Corp" },
      uniqueProductIdentifier: "GTIN:123456789",
      productImage: "http://example.com/image.png"
    };

    const html = await generateHTML(mockDpp);

    expect(html).toContain('Super Widget');
    expect(html).toContain('Acme Corp');
    expect(html).toContain('GTIN:123456789');
    expect(html).toContain('<img src="http://example.com/image.png"');
    expect(html).toContain('class="dpp-hero"');
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
    
    expect(html).toContain('Passport Status:</span> Active');
    expect(html).toContain('Last Updated:</span> 2023-10-27');
    expect(html).toContain('Passport ID:</span> urn:uuid:999');
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
    
    expect(html).toContain('Color:</span> Red');
    expect(html).toContain('Weight:</span> 10');
    expect(html).toContain('Is Recyclable:</span> true');
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
      expect(html).toContain('Width:</span> 10');
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
});