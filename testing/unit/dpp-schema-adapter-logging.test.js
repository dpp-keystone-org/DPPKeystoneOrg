/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock the global fetch function
global.fetch = jest.fn();
// Mock console.log to verify logging
global.console.log = jest.fn();

describe('DPP Adapter Logging', () => {
  let generateHTML;
  let transformDppMock;

  beforeAll(async () => {
      transformDppMock = jest.fn();
      
      // Mock the dpp-adapter dependency
      jest.unstable_mockModule('../../src/util/js/client/dpp-schema-adapter.js', () => ({
          transformDpp: transformDppMock
      }));

      // Dynamically import the module under test
      const module = await import('../../src/lib/html-generator.js');
      generateHTML = module.generateHTML;
  });

  beforeEach(() => {
      fetch.mockClear();
      transformDppMock.mockClear();
      console.log.mockClear();
      
      // Default mock implementation
      transformDppMock.mockResolvedValue({ "@context": "test", "name": "Test" });
      fetch.mockResolvedValue({ ok: true, text: async () => "" });
  });

  test('should log debug messages during JSON-LD generation', async () => {
      const mockDpp = { productName: "Debug Product" };
      
      await generateHTML(mockDpp);
      
      // Verify calls to console.log
      expect(console.log).toHaveBeenCalledWith("DPP HTML Generator Debug: Calling transformDpp with:", mockDpp);
      expect(console.log).toHaveBeenCalledWith("DPP HTML Generator Debug: Result from transformDpp:", expect.anything());
  });

  test('should log error if transformation fails', async () => {
      const mockDpp = { productName: "Error Product" };
      const error = new Error("Transform Failed");
      transformDppMock.mockRejectedValueOnce(error);
      
      await generateHTML(mockDpp);
      
      expect(console.log).toHaveBeenCalledWith("DPP HTML Generator Debug: JSON-LD generation error:", error);
  });
});
