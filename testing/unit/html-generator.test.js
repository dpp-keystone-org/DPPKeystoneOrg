/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';
import { generateHTML } from '../../src/lib/html-generator.js';

// Mock the global fetch function
global.fetch = jest.fn();

describe('HTML Generator', () => {
  beforeEach(() => {
      fetch.mockClear();
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

  test('should use fallback CSS if fetch fails', async () => {
    const mockDpp = { id: "123" };

    // Mock failed fetch
    fetch.mockResolvedValueOnce({
        ok: false,
        status: 404
    });

    const html = await generateHTML(mockDpp);
    
    expect(html).toContain('font-family: sans-serif'); // Part of fallback CSS
  });

  test('should throw error if input is missing', async () => {
    await expect(generateHTML(null)).rejects.toThrow("DPP JSON is required");
  });
});