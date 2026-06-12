/**
 * @jest-environment jsdom
 */

import { jest } from '@jest/globals';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TextEncoder, TextDecoder } from 'util';
import { ReadableStream } from 'stream/web';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const loadFile = (filePath) => fs.readFile(path.resolve(__dirname, '../../', filePath), 'utf-8');

// Polyfill setImmediate and TextEncoder/ReadableStream for jsonld in jsdom environment
global.setImmediate = global.setTimeout;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;
global.ReadableStream = ReadableStream;
global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');

const waitFor = (callback) => {
    return new Promise(resolve => {
        const check = () => {
            const result = callback();
            if (result) resolve(result);
            else setTimeout(check, 10);
        };
        check();
    });
};

describe('DPP Validator - Localized HTML Preview Integration', () => {
    let validatorHtml;

    beforeAll(async () => {
        validatorHtml = await loadFile('dist/validator/index.html');
    });

    beforeEach(() => {
        document.body.innerHTML = validatorHtml;
        jest.resetModules();
        localStorage.clear();
    });

    it('should pass selected language from Validator UI to generateHTML', async () => {
        localStorage.setItem('dpp_keystone_preferred_language', 'de');

        const mockGenerateHTML = jest.fn().mockResolvedValue('<html><body>Pass-Status</body></html>');
        jest.unstable_mockModule('../dist/lib/html-generator.js', () => ({
            generateHTML: mockGenerateHTML
        }));

        // Mock schema validator to immediately return valid
        jest.unstable_mockModule('../dist/util/js/common/validation/schema-validator.js', () => ({
            validateDpp: jest.fn().mockResolvedValue({ valid: true, errors: [] })
        }));

        await import('../../dist/validator/validator.js');

        // Dispatch DOMContentLoaded to trigger validator initialization
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const previewBtn = await waitFor(() => {
            const b = document.getElementById('preview-no-schema-btn');
            return (b && !b.disabled) ? b : null;
        });

        expect(previewBtn).not.toBeNull();

        // Populate valid JSON input
        document.getElementById('json-input').value = JSON.stringify({
            digitalProductPassportId: "urn:uuid:123",
            dppStatus: "Active"
        });

        // Click HTML Preview
        window.open = jest.fn();
        previewBtn.click();

        await waitFor(() => mockGenerateHTML.mock.calls.length > 0);

        expect(mockGenerateHTML).toHaveBeenCalledWith(
            expect.any(Object),
            expect.objectContaining({ language: 'de' })
        );
    });
});
