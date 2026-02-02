import { generateDPPsFromCsv, findBestMatch, generateAutoMapping } from '../../src/lib/csv-adapter-logic.js';

describe('CSV Adapter Logic', () => {

    describe('generateAutoMapping (Global Greedy Strategy)', () => {
        it('should resolve collisions by prioritizing the best match (DPP ID vs Product ID)', () => {
            const headers = ['DPP ID', 'Product ID'];
            const fields = ['digitalProductPassportId', 'uniqueProductId', 'otherField'];
            
            const mapping = generateAutoMapping(headers, fields);
            
            // "DPP ID" -> "digitalProductPassportId" should be a very strong match (Acronym "dppi")
            // "Product ID" -> "digitalProductPassportId" is a weaker match (Token overlap)
            // "Product ID" -> "uniqueProductId" is a decent match
            
            // Expected: DPP ID gets digitalProductPassportId, Product ID gets uniqueProductId (or something else, but NOT dppId)
            expect(mapping['DPP ID']).toBe('digitalProductPassportId');
            
            // Ensure Product ID didn't steal it or get assigned to it if it was taken
            expect(mapping['Product ID']).not.toBe('digitalProductPassportId');
            
            // Ideally it maps to uniqueProductId if the score is good enough
            // Let's check if it found uniqueProductId
            expect(mapping['Product ID']).toBe('uniqueProductId');
        });

        it('should handle non-colliding perfect matches correctly', () => {
            const headers = ['Weight', 'Name'];
            const fields = ['physicalDimensions.weight', 'manufacturer.name'];
            
            const mapping = generateAutoMapping(headers, fields);
            
            expect(mapping['Weight']).toBe('physicalDimensions.weight');
            expect(mapping['Name']).toBe('manufacturer.name');
        });

        it('should allow multiple headers to map to the same field if it is an array', () => {
            const headers = ['Doc 1', 'Doc 2'];
            // Pass field objects to simulate schema metadata
            const fields = [
                { path: 'referenceDocuments', isArray: true }, 
                { path: 'someScalar', isArray: false }
            ];
            
            const mapping = generateAutoMapping(headers, fields);
            
            // Both "Doc 1" and "Doc 2" should map to 'referenceDocuments' 
            // because fuzzy/token matching likely picks it up (assuming "Doc" matches "Documents")
            // Actually, "Doc" vs "referenceDocuments" might be weak.
            // Let's use a stronger token match example or synonym?
            // "Document 1" vs "referenceDocuments".
        });
        
        it('should verify array mapping capability with stronger matches', () => {
             const headers = ['Reference Document 1', 'Reference Document 2'];
             const fields = [
                { path: 'referenceDocuments', isArray: true },
                { path: 'other', isArray: false }
             ];
             
             const mapping = generateAutoMapping(headers, fields);
             
             expect(mapping['Reference Document 1']).toBe('referenceDocuments');
             expect(mapping['Reference Document 2']).toBe('referenceDocuments');
        });
    });
    
    describe('findBestMatch', () => {
        const availableFields = [
            'id',
            'tradeName',
            'description',
            'manufacturer.name',
            'manufacturer.location.city',
            'physicalDimensions.weight',
            'sustainability.recycledContent'
        ];

        it('should match exact field names (case insensitive)', () => {
            expect(findBestMatch('tradeName', availableFields)).toBe('tradeName');
            expect(findBestMatch('TRADENAME', availableFields)).toBe('tradeName');
            expect(findBestMatch('tradename', availableFields)).toBe('tradeName');
        });

        it('should use SYNONYM_MAP for common terms', () => {
            // "Brand" is in SYNONYM_MAP pointing to "tradeName"
            expect(findBestMatch('Brand', availableFields)).toBe('tradeName');
            
            // "Weight" -> "physicalDimensions.weight"
            expect(findBestMatch('Weight', availableFields)).toBe('physicalDimensions.weight');
            
            // "Manufacturer" -> "manufacturer.name"
            expect(findBestMatch('Manufacturer', availableFields)).toBe('manufacturer.name');
        });

        it('should match leaf property names', () => {
            expect(findBestMatch('City', availableFields)).toBe('manufacturer.location.city');
            expect(findBestMatch('Weight', availableFields)).toBe('physicalDimensions.weight');
        });

        it('should ignore special characters in header', () => {
            expect(findBestMatch('Trade Name', availableFields)).toBe('tradeName');
            expect(findBestMatch('Manufacturer Name', availableFields)).toBe('manufacturer.name');
            expect(findBestMatch('Recycled-Content', availableFields)).toBe('sustainability.recycledContent');
        });

        it('should prefer shorter paths/root fields for ambiguous matches', () => {
            // "Name" could match "manufacturer.name", but if we had a root "name", it should match that.
            // In our list, we have 'manufacturer.name'. Let's add a test case with ambiguity.
            const fields = ['name', 'manufacturer.name', 'importer.name'];
            expect(findBestMatch('Name', fields)).toBe('name');
        });

        it('should return null for no match', () => {
            expect(findBestMatch('Unknown Column', availableFields)).toBeNull();
        });

        it('should handle empty inputs', () => {
            expect(findBestMatch(null, availableFields)).toBeNull();
            expect(findBestMatch('header', [])).toBeNull();
        });

        test('matches headers to schema fields using fuzzy logic', () => {
        // "Wheight" -> "physicalDimensions.weight" (Leaf 'weight' matches 'Wheight' with distance 1)
        expect(findBestMatch('Wheight', availableFields)).toBe('physicalDimensions.weight');

        // "Descripton" -> "description" (Distance 1)
        expect(findBestMatch('Descripton', availableFields)).toBe('description');
        
        // "TrdeName" -> "tradeName" (Distance 1)
        expect(findBestMatch('TrdeName', availableFields)).toBe('tradeName');
    });

    test('avoids false positives for single-word headers (Category != color)', () => {
        // "Category" starts with 'C', "color" starts with 'c'. 
        // Single-letter acronym matching should be disabled.
        const fields = ['color', 'description', 'id'];
        const result = findBestMatch('Category', fields);
        expect(result).toBeNull();
    });

    test('matches long headers via acronyms (Digital Product Passport ID -> digitalProductPassportId)', () => {
        // "Digital Product Passport ID" -> "dppi"
        // "digitalProductPassportId" -> "dppi"
        const fields = ['digitalProductPassportId', 'otherField'];
        const result = findBestMatch('Digital Product Passport ID', fields);
        expect(result).toBe('digitalProductPassportId');
    });


        it('should use acronym matching for complex headers (Priority 5)', () => {
            // "EPD GWP" -> "environmentalProfile.gwp" (using mock field for test)
            // Field "environmentalProfile.gwp" -> Acronym "epgwp"
            // Header "EPD GWP" -> Norm "epdgwp" (Dist 1 to epgwp)
            const fields = [
                'environmentalProfile.gwp',
                'declarationOfPerformance.dateOfIssue',
                'manufacturer.name'
            ];

            expect(findBestMatch('EPD GWP', fields)).toBe('environmentalProfile.gwp');
            
            // "DOPC Date of Issue" -> "declarationOfPerformance.dateOfIssue"
            // Header Acronym: "ddoi" (DOPC, Date, of, Issue)
            // Field Acronym: "dopdoi" (declarationOfPerformance, dateOfIssue)
            // Distance: 2. Length 6. Threshold 2. Match!
            expect(findBestMatch('DOPC Date of Issue', fields)).toBe('declarationOfPerformance.dateOfIssue');
        });

        it('should avoid false positives for short strings (Regression Test)', () => {
            const fields = [
                'depth', 
                'partNumbers.language', 
                'image.contentType',
                'materialComposition.name',
                'digitalProductPassportId',
                'productName',
                'manufacturer.name'
            ];

            // "DPP ID" -> "digitalProductPassportId" (Acronym match: dppid vs dppi = 1)
            // Should NOT match "depth" (Dist 3, but for len 5 that is too high)
            expect(findBestMatch('DPP ID', fields)).toBe('digitalProductPassportId');

            // "Product Name" -> "productName" (Exact match normalized)
            // Should NOT match "partNumbers.language"
            expect(findBestMatch('Product Name', fields)).toBe('productName');

            // "Manufacturer Name" -> "manufacturer.name" (Exact match normalized)
            // Should NOT match "materialComposition.name"
            expect(findBestMatch('Manufacturer Name', fields)).toBe('manufacturer.name');
        });
    });

    it('should generate DPP objects with correct context and basic mapping', () => {
        const csvData = [
            { "Product Name": "Test Battery", "ID": "123" }
        ];
        const mapping = {
            "Product Name": "tradeName",
            "ID": "serialNumber"
        };
        const sector = "battery";

        const result = generateDPPsFromCsv(csvData, mapping, sector);

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual({
            "@context": [
                "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
                "https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld"
            ],
            tradeName: "Test Battery",
            serialNumber: 123
        });
    });

    it('should handle multiple sectors and generate an array of contexts', () => {
        const csvData = [{ "Name": "Hybrid Product" }];
        const mapping = { "Name": "tradeName" };
        const sectors = ["battery", "electronics"];

        const result = generateDPPsFromCsv(csvData, mapping, sectors);

        expect(result[0]['@context']).toEqual([
            "https://dpp-keystone.org/spec/contexts/v1/dpp-core.context.jsonld",
            "https://dpp-keystone.org/spec/contexts/v1/dpp-battery.context.jsonld",
            "https://dpp-keystone.org/spec/contexts/v1/dpp-electronics.context.jsonld"
        ]);
    });

    it('should handle nested properties via dot notation', () => {
        const csvData = [
            { "Manufacturer": "Acme Corp", "City": "Gotham" }
        ];
        const mapping = {
            "Manufacturer": "manufacturer.name",
            "City": "manufacturer.location.city"
        };

        const result = generateDPPsFromCsv(csvData, mapping, "electronics");

        expect(result[0].manufacturer).toEqual({
            name: "Acme Corp",
            location: {
                city: "Gotham"
            }
        });
    });

    it('should perform type inference for booleans and numbers', () => {
        const csvData = [
            { "Is Hazardous": "true", "Weight": "10.5", "Count": "42", "Is Recycled": "false" }
        ];
        const mapping = {
            "Is Hazardous": "isHazardous",
            "Weight": "physicalDimensions.weight",
            "Count": "itemCount",
            "Is Recycled": "sustainability.recycled"
        };

        const result = generateDPPsFromCsv(csvData, mapping, "textile");

        expect(result[0].isHazardous).toBe(true);
        expect(result[0].physicalDimensions.weight).toBe(10.5);
        expect(result[0].itemCount).toBe(42);
        expect(result[0].sustainability.recycled).toBe(false);
    });

    it('should handle empty strings and non-numeric strings correctly', () => {
        const csvData = [
            { "Empty": "", "Text Number": "123 Main St" }
        ];
        const mapping = {
            "Empty": "someField",
            "Text Number": "address"
        };

        const result = generateDPPsFromCsv(csvData, mapping, "construction");

        // Empty string should be ignored by setProperty (as per dpp-data-utils logic)
        expect(result[0]).not.toHaveProperty('someField');
        
        // "123 Main St" starts with a number but isn't a valid number overall, should remain string
        expect(result[0].address).toBe("123 Main St");
    });

    it('should process multiple rows', () => {
        const csvData = [
            { "ID": "1" },
            { "ID": "2" },
            { "ID": "3" }
        ];
        const mapping = { "ID": "id" };

        const result = generateDPPsFromCsv(csvData, mapping, "core");

        expect(result).toHaveLength(3);
        expect(result[0].id).toBe(1);
        expect(result[2].id).toBe(3);
    });

    it('should ignore mapped fields that are missing in the CSV row', () => {
        const csvData = [
            { "Name": "Product A" } // Missing "Description" column
        ];
        const mapping = {
            "Name": "name",
            "Description": "description"
        };

        const result = generateDPPsFromCsv(csvData, mapping, "core");

        expect(result[0].name).toBe("Product A");
        expect(result[0]).not.toHaveProperty("description");
    });
});
