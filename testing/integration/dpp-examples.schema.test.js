import fs from 'fs';
import path from 'path';
import { PROJECT_ROOT } from '../scripts/shacl-helpers.mjs';
import { validateDpp } from '../../src/util/js/common/validation/schema-validator.js';

// --- Configuration ---

const SCHEMA_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'validation', 'v1', 'json-schema');
const EXAMPLES_DIR = path.join(PROJECT_ROOT, 'dist', 'spec', 'examples');

// Map contentSpecificationIds to their corresponding schema files.
const conditionalSchemaMap = {
    'draft_construction_specification_id': 'construction.schema.json',
    'draft_battery_specification_id': 'battery.schema.json',
    'draft_electronics_specification_id': 'electronics.schema.json',
    'draft_textile_specification_id': 'textile.schema.json',
    // Add other conditional schemas here as they are created.
    'eprel_airconditioners_specification_id': 'eprel-airconditioners.schema.json',
    'eprel_dishwashers_specification_id': 'eprel-dishwashers.schema.json',
    'eprel_electronicdisplays_specification_id': 'eprel-electronicdisplays.schema.json',
    'eprel_hotwaterstoragetanks_specification_id': 'eprel-hotwaterstoragetanks.schema.json',
    'eprel_lightsources_specification_id': 'eprel-lightsources.schema.json',
    'eprel_localspaceheaters_specification_id': 'eprel-localspaceheaters.schema.json',
    'eprel_ovens_specification_id': 'eprel-ovens.schema.json',
    'eprel_professionalrefrigeratedstoragecabinets_specification_id': 'eprel-professionalrefrigeratedstoragecabinets.schema.json',
    'eprel_rangehoods_specification_id': 'eprel-rangehoods.schema.json',
    'eprel_refrigeratingappliances_specification_id': 'eprel-refrigeratingappliances.schema.json',
    'eprel_refrigeratingappliancesdirectsalesfunction_specification_id': 'eprel-refrigeratingappliancesdirectsalesfunction.schema.json',
    'eprel_residentialventilationunits_specification_id': 'eprel-residentialventilationunits.schema.json',
    'eprel_smartphonestablets_specification_id': 'eprel-smartphonestablets.schema.json',
    'eprel_solidfuelboilerpackages_specification_id': 'eprel-solidfuelboilerpackages.schema.json',
    'eprel_solidfuelboilers_specification_id': 'eprel-solidfuelboilers.schema.json',
    'eprel_spaceheaterpackages_specification_id': 'eprel-spaceheaterpackages.schema.json',
    'eprel_spaceheaters_specification_id': 'eprel-spaceheaters.schema.json',
    'eprel_spaceheatersolardevice_specification_id': 'eprel-spaceheatersolardevice.schema.json',
    'eprel_spaceheatertemperaturecontrol_specification_id': 'eprel-spaceheatertemperaturecontrol.schema.json',
    'eprel_tumbledryers_specification_id': 'eprel-tumbledryers.schema.json',
    'eprel_tyres_specification_id': 'eprel-tyres.schema.json',
    'eprel_washerdriers_specification_id': 'eprel-washerdriers.schema.json',
    'eprel_washingmachines_specification_id': 'eprel-washingmachines.schema.json',
    'eprel_waterheaterpackages_specification_id': 'eprel-waterheaterpackages.schema.json',
    'eprel_waterheaters_specification_id': 'eprel-waterheaters.schema.json',
    'eprel_waterheatersolardevices_specification_id': 'eprel-waterheatersolardevices.schema.json'
};

// --- Test Cases ---
const testCases = [
    'drill-dpp-v1.json',
    'drill-dpp-v1-private.json',
    'battery-dpp-v1.json',
    'sock-dpp-v1.json',
    'rail-dpp-v1.json',
    'construction-product-dpp-v1.json',
    'eprel-airconditioners-dpp-v1.json',
    'eprel-dishwashers-dpp-v1.json',
    'eprel-electronicdisplays-dpp-v1.json',
    'eprel-hotwaterstoragetanks-dpp-v1.json',
    'eprel-lightsources-dpp-v1.json',
    'eprel-localspaceheaters-dpp-v1.json',
    'eprel-ovens-dpp-v1.json',
    'eprel-professionalrefrigeratedstoragecabinets-dpp-v1.json',
    'eprel-rangehoods-dpp-v1.json',
    'eprel-refrigeratingappliances-dpp-v1.json',
    'eprel-refrigeratingappliancesdirectsalesfunction-dpp-v1.json',
    'eprel-residentialventilationunits-dpp-v1.json',
    'eprel-smartphonestablets-dpp-v1.json',
    'eprel-solidfuelboilerpackages-dpp-v1.json',
    'eprel-solidfuelboilers-dpp-v1.json',
    'eprel-spaceheaterpackages-dpp-v1.json',
    'eprel-spaceheaters-dpp-v1.json',
    'eprel-spaceheatersolardevice-dpp-v1.json',
    'eprel-spaceheatertemperaturecontrol-dpp-v1.json',
    'eprel-tumbledryers-dpp-v1.json',
    'eprel-tyres-dpp-v1.json',
    'eprel-washerdriers-dpp-v1.json',
    'eprel-washingmachines-dpp-v1.json',
    'eprel-waterheaterpackages-dpp-v1.json',
    'eprel-waterheaters-dpp-v1.json',
    'eprel-waterheatersolardevices-dpp-v1.json'
];

describe('DPP JSON Schema Validation', () => {
    let schemaContext = {
        baseSchema: null,
        sectorSchemas: {},
        commonSchemas: []
    };

    beforeAll(async () => {
        // Load common schemas
        const loadSchema = async (filename) => {
            const schemaPath = path.join(SCHEMA_DIR, filename);
            return JSON.parse(await fs.promises.readFile(schemaPath, 'utf-8'));
        };

        const componentSchema = await loadSchema('component.schema.json');
        const epdSchema = await loadSchema('epd.schema.json');
        const relatedResourceSchema = await loadSchema('related-resource.schema.json');
        const organizationSchema = await loadSchema('organization.schema.json');
        const postalAddressSchema = await loadSchema('postal-address.schema.json');
        const dopcSchema = await loadSchema('dopc.schema.json');
        const prodCharSchema = await loadSchema('product-characteristic.schema.json');
        const eprelSchema0 = await loadSchema('eprel/additional-info.schema.json');
        const eprelSchema1 = await loadSchema('eprel/appliance-light-source.schema.json');
        const eprelSchema2 = await loadSchema('eprel/cavity.schema.json');
        const eprelSchema3 = await loadSchema('eprel/compartment.schema.json');
        const eprelSchema4 = await loadSchema('eprel/contact-details.schema.json');
        const eprelSchema5 = await loadSchema('eprel/cooling-characteristics.schema.json');
        const eprelSchema6 = await loadSchema('eprel/correlated-colour-temp.schema.json');
        const eprelSchema7 = await loadSchema('eprel/direct-sales-compartment.schema.json');
        const eprelSchema8 = await loadSchema('eprel/filter-visual-warning.schema.json');
        const eprelSchema9 = await loadSchema('eprel/fridge-compartment.schema.json');
        const eprelSchema10 = await loadSchema('eprel/fridge-sub-compartment.schema.json');
        const eprelSchema11 = await loadSchema('eprel/heating-characteristics.schema.json');
        const eprelSchema12 = await loadSchema('eprel/language-specific.schema.json');
        const eprelSchema13 = await loadSchema('eprel/load-profile.schema.json');
        const eprelSchema14 = await loadSchema('eprel/organisation.schema.json');
        const eprelSchema15 = await loadSchema('eprel/specific-precaution.schema.json');
        const eprelSchema16 = await loadSchema('eprel/spectral-power-distribution-image.schema.json');

        schemaContext.commonSchemas = [
            componentSchema,
            epdSchema,
            relatedResourceSchema,
            organizationSchema,
            postalAddressSchema,
            dopcSchema,
            prodCharSchema,
            eprelSchema0,
            eprelSchema1,
            eprelSchema2,
            eprelSchema3,
            eprelSchema4,
            eprelSchema5,
            eprelSchema6,
            eprelSchema7,
            eprelSchema8,
            eprelSchema9,
            eprelSchema10,
            eprelSchema11,
            eprelSchema12,
            eprelSchema13,
            eprelSchema14,
            eprelSchema15,
            eprelSchema16
        ];

        // Load the base schema
        schemaContext.baseSchema = await loadSchema('dpp.schema.json');

        // Load all sector schemas
        for (const [id, filename] of Object.entries(conditionalSchemaMap)) {
            schemaContext.sectorSchemas[id] = await loadSchema(filename);
        }
    });

    test.each(testCases)('%s should be valid', async (exampleFile) => {
        // Load the example data
        const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // Validate using the shared library
        const result = validateDpp(data, schemaContext);

        // Provide detailed error logging if validation fails
        if (!result.valid) {
            console.log(`Validation errors for ${exampleFile}:`);
            console.log(JSON.stringify(result.errors, null, 2));
        }

        expect(result.valid).toBe(true);
    });

    test('battery-dpp-v1.json should be INVALID if batteryCategory is missing', async () => {
        // Load the example data
        const exampleFile = 'battery-dpp-v1.json';
        const exampleFilePath = path.join(EXAMPLES_DIR, exampleFile);
        const exampleContent = await fs.promises.readFile(exampleFilePath, 'utf-8');
        const data = JSON.parse(exampleContent);

        // --- Intentionally invalidate the data ---
        delete data.batteryCategory;
        // -----------------------------------------

        // Validate
        const result = validateDpp(data, schemaContext);

        // This test should fail validation
        expect(result.valid).toBe(false);

        // Check for the specific error
        expect(result.errors).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    keyword: 'required',
                    params: { missingProperty: 'batteryCategory' },
                }),
            ])
        );
    });
});
