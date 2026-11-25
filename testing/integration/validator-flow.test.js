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
    let realTransformDpp;

    beforeAll(async () => {
        validatorHtml = await loadFile('dist/validator/index.html');
        const realAdapter = await import('../../dist/util/js/client/dpp-schema-adapter.js');
        realTransformDpp = realAdapter.transformDpp;
    });

    beforeEach(() => {
        document.body.innerHTML = validatorHtml;
        jest.resetModules();
        localStorage.clear();
        // Reset dpp-schema-adapter to the real implementation so mocked tests never leak into subsequent tests
        jest.unstable_mockModule('../dist/util/js/client/dpp-schema-adapter.js', () => ({
            transformDpp: (...args) => realTransformDpp(...args)
        }));
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

    it('should preserve voluntary and untransformed attributes when exporting EC Battery DPP from Validator', async () => {
        const originalFetch = global.fetch;
        const originalBlob = global.Blob;
        let capturedExportJson = null;

        // Serve local dist/spec/ files to the real transformDpp engine
        global.fetch = jest.fn(async (url) => {
            const urlStr = String(url);
            const specMatch = urlStr.match(/\/spec\/(.+)$/);
            if (specMatch) {
                const diskPath = path.resolve(__dirname, '../../dist/spec', specMatch[1]);
                const content = await fs.readFile(diskPath, 'utf-8');
                return { ok: true, json: async () => JSON.parse(content) };
            }
            return { ok: true, json: async () => ({}) };
        });

        // Capture JSON written to Blob on export
        global.Blob = class MockBlob {
            constructor(parts, opts) {
                if (opts?.type === 'application/ld+json' && typeof parts[0] === 'string') {
                    capturedExportJson = JSON.parse(parts[0]);
                }
            }
        };

        try {
            jest.unstable_mockModule('../dist/util/js/common/validation/schema-validator.js', () => ({
                validateDpp: jest.fn().mockResolvedValue({ valid: true, errors: [] })
            }));

            await import('../../dist/validator/validator.js');
            document.dispatchEvent(new Event('DOMContentLoaded'));

            const ecBtn = await waitFor(() => {
                const b = document.getElementById('ec-battery-btn');
                return (b && !b.disabled) ? b : null;
            });

            window.open = jest.fn();

            const exampleRaw = await loadFile('dist/spec/examples/battery-dpp-v1.json');
            const batteryDpp = JSON.parse(exampleRaw);
            batteryDpp['@context'] = [
                batteryDpp['@context'],
                { ex: 'https://example.org/voc#', customWarrantyCode: 'ex:customWarrantyCode' }
            ];
            batteryDpp.hsCode = '85076000';
            batteryDpp.customWarrantyCode = 'EXT-5Y-EU';
            batteryDpp.voluntaryNotes = { recyclingPartner: 'GreenCycle GmbH' };

            document.getElementById('json-input').value = JSON.stringify(batteryDpp);
            ecBtn.click();

            await waitFor(() => capturedExportJson !== null);

            expect(capturedExportJson.hsCode).toBe('85076000');
            expect(capturedExportJson.customWarrantyCode).toBe('EXT-5Y-EU');
            expect(capturedExportJson.voluntaryNotes).toEqual({ recyclingPartner: 'GreenCycle GmbH' });
        } finally {
            global.fetch = originalFetch;
            global.Blob = originalBlob;
        }
    });

    it('should export pasted Battery DPP via transformDpp with ec-battery profile and inject battery @context if omitted', async () => {
        const mockTransformDpp = jest.fn().mockResolvedValue([
            {
                '@context': [
                    'https://repository.product-passport.ec.europa.eu/core/1.0.0/contexts/core-context.jsonld',
                    'https://repository.product-passport.ec.europa.eu/product/batteries/1.0.0/contexts/batteries-context.jsonld'
                ],
                id: 'urn:uuid:bat-1',
                type: ['DigitalProductPassport', 'BatteryProduct'],
                batteryCategory: 'electricVehicleBattery'
            }
        ]);

        jest.unstable_mockModule('../dist/util/js/client/dpp-schema-adapter.js', () => ({
            transformDpp: mockTransformDpp
        }));

        jest.unstable_mockModule('../dist/util/js/common/validation/schema-validator.js', () => ({
            validateDpp: jest.fn().mockResolvedValue({ valid: true, errors: [] })
        }));

        await import('../../dist/validator/validator.js');
        document.dispatchEvent(new Event('DOMContentLoaded'));

        const ecBtn = await waitFor(() => {
            const b = document.getElementById('ec-battery-btn');
            return (b && !b.disabled) ? b : null;
        });

        expect(ecBtn).not.toBeNull();
        window.open = jest.fn();

        // 1. Non-battery payload should show error and NOT call transformDpp
        document.getElementById('json-input').value = JSON.stringify({
            digitalProductPassportId: 'urn:uuid:sock-1',
            contentSpecificationIds: ['draft_textile_espr_specification_id']
        });
        ecBtn.click();

        const resultBox = document.getElementById('validation-result');
        expect(resultBox.hidden).toBe(false);
        expect(resultBox.textContent).toContain('Battery DPP');
        expect(mockTransformDpp).not.toHaveBeenCalled();

        // 2. Plain JSON battery payload without @context should inject dpp-battery.context.jsonld and transform
        document.getElementById('json-input').value = JSON.stringify({
            digitalProductPassportId: 'urn:uuid:bat-1',
            batteryCategory: 'EVBattery',
            batteryMass: 320
        });
        ecBtn.click();

        await waitFor(() => mockTransformDpp.mock.calls.length > 0);

        expect(mockTransformDpp).toHaveBeenCalledWith(
            expect.objectContaining({
                digitalProductPassportId: 'urn:uuid:bat-1',
                batteryCategory: 'EVBattery',
                '@context': expect.stringContaining('dpp-battery.context.jsonld')
            }),
            expect.objectContaining({
                profile: 'ec-battery'
            })
        );
        expect(window.open).toHaveBeenCalledWith('blob:mock-url', '_blank');
    });
});

