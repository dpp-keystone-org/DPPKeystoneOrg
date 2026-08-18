import { promises as fs } from 'fs';
import path from 'path';
import { validateDppPayload } from '../../../api/src/lib/dpp-validator-service.js';

describe('DPP Validator Orchestrator (Unit Test)', () => {
    let validBatteryDpp;

    beforeAll(async () => {
        const examplePath = path.resolve(process.cwd(), 'src/examples/battery-industrial-dpp-v1.json');
        const content = await fs.readFile(examplePath, 'utf-8');
        validBatteryDpp = JSON.parse(content);
    });

    it('should successfully validate a complete, valid battery DPP example', async () => {
        const result = await validateDppPayload(validBatteryDpp);
        expect(result.valid).toBe(true);
        expect(result.errors).toBeNull();
    });

    it('should fail validation when mandatory DPP header fields are missing', async () => {
        const invalidPayload = {
            ...validBatteryDpp,
            digitalProductPassportId: undefined // delete mandatory header ID
        };
        delete invalidPayload.digitalProductPassportId;

        const result = await validateDppPayload(invalidPayload);
        expect(result.valid).toBe(false);
        expect(Array.isArray(result.errors)).toBe(true);
        expect(result.errors.length).toBeGreaterThan(0);
        
        const hasHeaderError = result.errors.some(err => 
            (err.params && err.params.missingProperty === 'digitalProductPassportId') ||
            err.message.includes('digitalProductPassportId')
        );
        expect(hasHeaderError).toBe(true);
    });

    it('should fail validation when sector-specific fields have invalid data types', async () => {
        const invalidPayload = {
            ...validBatteryDpp,
            batteryCapacity: "NOT_A_NUMBER" // should be numeric/decimal
        };

        const result = await validateDppPayload(invalidPayload);
        expect(result.valid).toBe(false);
        expect(Array.isArray(result.errors)).toBe(true);
        
        const hasTypeError = result.errors.some(err => 
            err.instancePath.includes('batteryCapacity') ||
            err.message.includes('batteryCapacity')
        );
        expect(hasTypeError).toBe(true);
    });

    it('should fail validation when invalid country codes or malformed dates are passed', async () => {
        const invalidPayload = {
            ...validBatteryDpp,
            lastUpdate: "invalid-date-string"
        };

        const result = await validateDppPayload(invalidPayload);
        expect(result.valid).toBe(false);
        expect(Array.isArray(result.errors)).toBe(true);
    });

    it('should reject non-object or null input gracefully', async () => {
        const resultNull = await validateDppPayload(null);
        expect(resultNull.valid).toBe(false);
        expect(resultNull.errors).toBeDefined();

        const resultString = await validateDppPayload("string-payload");
        expect(resultString.valid).toBe(false);
        expect(resultString.errors).toBeDefined();
    });
});
