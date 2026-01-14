import { generateHTML } from '../../src/lib/html-generator.js';

describe('HTML Generator', () => {
  test('should generate HTML containing the input JSON', () => {
    const mockDpp = {
      productName: "Test Product",
      id: "12345"
    };

    const html = generateHTML(mockDpp);

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Test Product');
    expect(html).toContain('12345');
    expect(html).toContain('Digital Product Passport');
  });

  test('should throw error if input is missing', () => {
    expect(() => generateHTML(null)).toThrow("DPP JSON is required");
  });
});
