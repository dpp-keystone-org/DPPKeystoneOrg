import { generateDPPsFromCsv, findBestMatch, generateAutoMapping, findUsedIndices, generateIndexedSuggestions } from '../../src/lib/csv-adapter-logic.js';

describe('CSV Adapter Logic', () => {

    describe('Advanced Array Strategies (Step 7.9.7)', () => {
        
        describe('findUsedIndices', () => {
            it('should return empty set if no arrays are mapped', () => {
                const mapping = {
                    "Header A": "some.scalar",
                    "Header B": "another.scalar"
                };
                const indices = findUsedIndices(mapping, "materialComposition");
                expect(indices.size).toBe(0);
            });

            it('should find single index for a simple array mapping', () => {
                const mapping = {
                    "Mat 1": "materialComposition[0].name"
                };
                const indices = findUsedIndices(mapping, "materialComposition");
                expect(indices.size).toBe(1);
                expect(indices.has(0)).toBe(true);
            });

            it('should find multiple indices', () => {
                const mapping = {
                    "Mat 1": "materialComposition[0].name",
                    "Mat 2": "materialComposition[1].name",
                    "Mat 3": "materialComposition[5].weightPercentage" // Sparse/Manual
                };
                const indices = findUsedIndices(mapping, "materialComposition");
                expect(indices.size).toBe(3);
                expect(indices.has(0)).toBe(true);
                expect(indices.has(1)).toBe(true);
                expect(indices.has(5)).toBe(true);
            });

            it('should ignore other arrays', () => {
                const mapping = {
                    "Doc 1": "referenceDocuments[0].uri",
                    "Mat 1": "materialComposition[0].name"
                };
                const indices = findUsedIndices(mapping, "materialComposition");
                expect(indices.size).toBe(1);
                expect(indices.has(0)).toBe(true);
                // Should not carry over refDocs index
            });
        });

        describe('generateIndexedSuggestions', () => {
            it('should suggest [0] properties for a fresh array', () => {
                const field = { path: 'materialComposition.name', isArray: true };
                const usedIndices = new Set();
                
                const suggestions = generateIndexedSuggestions(field, usedIndices);
                
                // Should default to [0]
                expect(suggestions).toHaveLength(1);
                expect(suggestions[0].value).toBe('materialComposition[0].name');
                expect(suggestions[0].type).toBe('new');
            });

            it('should suggest joining existing indices AND starting a new one', () => {
                const field = { path: 'materialComposition.name', isArray: true };
                const usedIndices = new Set([0]); // Index 0 already used
                
                const suggestions = generateIndexedSuggestions(field, usedIndices);
                
                // Expect suggestions for [0] and [1]
                expect(suggestions).toHaveLength(2);
                expect(suggestions[0].value).toBe('materialComposition[0].name');
                expect(suggestions[0].type).toBe('existing');
                expect(suggestions[1].value).toBe('materialComposition[1].name');
                expect(suggestions[1].type).toBe('new');
            });

            it('should handle sparse existing indices correctly', () => {
                const field = { path: 'materialComposition.weightPercentage', isArray: true };
                const usedIndices = new Set([0, 5]); // User skipped 1-4
                
                const suggestions = generateIndexedSuggestions(field, usedIndices);
                
                expect(suggestions).toHaveLength(3);
                expect(suggestions[0].value).toBe('materialComposition[0].weightPercentage');
                expect(suggestions[1].value).toBe('materialComposition[5].weightPercentage');
                expect(suggestions[2].value).toBe('materialComposition[6].weightPercentage');
                expect(suggestions[2].type).toBe('new');
            });
            
            it('should not affect scalar fields', () => {
                 const field = { path: 'tradeName', isArray: false };
                 const usedIndices = new Set([0]); // Irrelevant for scalar
                 
                 const suggestions = generateIndexedSuggestions(field, usedIndices);
                 expect(suggestions).toHaveLength(1);
                 expect(suggestions[0].value).toBe('tradeName');
            });
        });

    });

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

        it('should allow multiple headers to map to the same field if it is an array and assign indices', () => {
            const headers = ['Reference Documents 1', 'Reference Documents 2'];
            // Pass field objects to simulate schema metadata
            const fields = [
                { path: 'referenceDocuments', isArray: true }, 
                { path: 'someScalar', isArray: false }
            ];
            
            const mapping = generateAutoMapping(headers, fields);
            
            // Should assign indices based on numbers in headers
            expect(mapping['Reference Documents 1']).toBe('referenceDocuments[0]');
            expect(mapping['Reference Documents 2']).toBe('referenceDocuments[1]');
        });
        
        it('should verify array mapping capability with stronger matches and mixed content', () => {
             const headers = ['Material Composition 1 Name', 'Material Composition 1 %', 'Material Composition 2 Name', 'Material Composition 2 %'];
             const fields = [
                { path: 'materialComposition.name', isArray: true },
                { path: 'materialComposition.weightPercentage', isArray: true }
             ];
             
             const mapping = generateAutoMapping(headers, fields);
             
             // Group 1
             expect(mapping['Material Composition 1 Name']).toBe('materialComposition[0].name');
             expect(mapping['Material Composition 1 %']).toBe('materialComposition[0].weightPercentage');
             
             // Group 2
             expect(mapping['Material Composition 2 Name']).toBe('materialComposition[1].name');
             expect(mapping['Material Composition 2 %']).toBe('materialComposition[1].weightPercentage');
        });

        it('should compact sparse arrays when indices are skipped', () => {
            const csvData = [
                { "Mat 1": "A", "Mat 3": "C" }
            ];
            // Simulate a user manually mapping to skipped indices, or auto-mapping doing so
            const mapping = {
                "Mat 1": "items[0]",
                "Mat 3": "items[2]"
            };
    
            const result = generateDPPsFromCsv(csvData, mapping, "core");
    
            // We expect the array to be compacted to length 2: ["A", "C"]
            // Instead of length 3: ["A", <empty>, "C"]
            expect(result[0].items).toHaveLength(2);
            expect(result[0].items[0]).toBe("A");
            expect(result[0].items[1]).toBe("C");
        });
        
        it('should assign indices in ascending order even if headers are unordered in CSV', () => {
             const headers = ['Item 2', 'Item 1'];
             const fields = [{ path: 'items', isArray: true }];
             
             const mapping = generateAutoMapping(headers, fields);
             
             // "Item 1" should get index [0], "Item 2" should get index [1]
             // regardless of their order in the input list.
             expect(mapping['Item 1']).toBe('items[0]');
             expect(mapping['Item 2']).toBe('items[1]');
        });

        it('should handle deep nesting of arrays', () => {
             // Case: components[0].parts[0].name
             const csvData = [
                 { "Comp 1 Part 1": "Gear", "Comp 1 Part 2": "Bolt" }
             ];
             const mapping = {
                 "Comp 1 Part 1": "components[0].parts[0].name",
                 "Comp 1 Part 2": "components[0].parts[1].name"
             };
             
             const result = generateDPPsFromCsv(csvData, mapping, "core");
             
             expect(result[0].components).toHaveLength(1);
             expect(result[0].components[0].parts).toHaveLength(2);
             expect(result[0].components[0].parts[0].name).toBe("Gear");
             expect(result[0].components[0].parts[1].name).toBe("Bolt");
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

    it('should support explicit array indexing via bracket notation in mapping', () => {
        const csvData = [
            { "Mat 1 Name": "Lithium", "Mat 1 %": "32", "Mat 2 Name": "Graphite", "Mat 2 %": "22" }
        ];
        const mapping = {
            "Mat 1 Name": "materialComposition[0].name",
            "Mat 1 %": "materialComposition[0].weightPercentage",
            "Mat 2 Name": "materialComposition[1].name",
            "Mat 2 %": "materialComposition[1].weightPercentage"
        };

        const result = generateDPPsFromCsv(csvData, mapping, "battery");

        expect(result[0].materialComposition).toHaveLength(2);
        expect(result[0].materialComposition[0]).toEqual({ name: "Lithium", weightPercentage: 32 });
        expect(result[0].materialComposition[1]).toEqual({ name: "Graphite", weightPercentage: 22 });
    });
});
