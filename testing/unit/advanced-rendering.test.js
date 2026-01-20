/**
 * @jest-environment jsdom
 */
import { jest } from '@jest/globals';

// Mock fetch globally
global.fetch = jest.fn();

describe('Advanced Rendering Logic', () => {
    let generateHTML;
    let detectTableStructure;

    beforeAll(async () => {
        // Mock dependencies
        jest.unstable_mockModule('../../src/util/js/client/dpp-schema-adapter.js', () => ({
            transformDpp: jest.fn().mockResolvedValue(null)
        }));

        // Import module under test
        const module = await import('../../src/lib/html-generator.js');
        generateHTML = module.generateHTML;
        detectTableStructure = module.detectTableStructure;
    });

    beforeEach(() => {
        fetch.mockClear();
        // Default mock for CSS fetch
        fetch.mockResolvedValue({ ok: true, text: async () => "" });
    });

    describe('Matrix Detection (EPD Style)', () => {
        test('should detect dense matrix structure', () => {
            const matrix = {
                gwp: { a1: 10, a2: 5, a3: 2 },
                odp: { a1: 0.1, a2: 0.05, a3: 0.02 },
                pocp: { a1: 1, a2: 0.5, a3: 0.2 }
            };
            // 3 rows * 3 cols = 9 cells. 9 actual cells. Density = 1.0.
            expect(detectTableStructure(matrix)).toBe(true);
        });

        test('should detect semi-dense matrix structure', () => {
            const matrix = {
                gwp: { a1: 10, a2: 5 },     // 2
                odp: { a1: 0.1 },           // 1
                pocp: { a1: 1, a2: 0.5 }    // 2
            };
            // Unique cols: a1, a2 (2). Rows: 3. Theoretical: 6. Actual: 5.
            // Density: 5/6 = 0.83 > 0.5
            expect(detectTableStructure(matrix)).toBe(true);
        });

        test('should reject sparse structure', () => {
            const sparse = {
                row1: { a: 1 },
                row2: { b: 2 },
                row3: { c: 3 }
            };
            // Unique cols: a, b, c (3). Rows: 3. Theoretical: 9. Actual: 3.
            // Density: 3/9 = 0.33 < 0.5
            expect(detectTableStructure(sparse)).toBe(false);
        });

        test('should reject non-object children', () => {
            const invalid = {
                row1: { a: 1 },
                row2: "Not an object"
            };
            expect(detectTableStructure(invalid)).toBe(false);
        });

        test('should reject single row with few columns (better as card)', () => {
            const singleRow = {
                row1: { a: 1, b: 2 }
            };
            // 1 row, 2 cols. Pass 2 checks: rowKeys < 2 && uniqueCols < 3.
            expect(detectTableStructure(singleRow)).toBe(false);
        });

        test('should accept single row with MANY columns (wide data)', () => {
            const wideRow = {
                row1: { a: 1, b: 2, c: 3, d: 4, e: 5 }
            };
            // 1 row, 5 cols. Density 1.0. Condition (rowKeys < 2 && uniqueCols < 3) is False.
            expect(detectTableStructure(wideRow)).toBe(true);
        });
    });

    describe('Table Rendering', () => {
        test('should render EPD matrix as a table with correct headers and merged columns', async () => {
            const dpp = {
                productName: "Test", // needed for title
                environmentalProfile: {
                    gwp: { a1: 10, c1: 5 },
                    odp: { a1: 0.1, a2: 0.05 } // a2 is unique here
                }
            };

            const html = await generateHTML(dpp);

            // Expect table container
            expect(html).toContain('<div class="dpp-card">');
            expect(html).toContain('<h4>Environmental Profile</h4>');
            expect(html).toContain('<table>');
            
            // Check Headers (Union of keys: a1, a2, c1 -> Sorted: a1, a2, c1)
            expect(html).toContain('<th>a1</th>');
            expect(html).toContain('<th>a2</th>');
            expect(html).toContain('<th>c1</th>');

            // Check Rows
            // gwp row
            expect(html).toContain('<strong>gwp</strong>');
            expect(html).toContain('<td>10</td>'); // a1
            expect(html).toContain('<td>-</td>');  // a2 (missing in gwp)
            expect(html).toContain('<td>5</td>');  // c1

            // odp row
            expect(html).toContain('<strong>odp</strong>');
            expect(html).toContain('<td>0.1</td>'); // a1
            expect(html).toContain('<td>0.05</td>'); // a2
            expect(html).toContain('<td>-</td>');   // c1 (missing in odp)
        });

        test('should render Array of Objects as a table', async () => {
            const dpp = {
                productName: "Test",
                components: [
                    { name: "Part A", weight: 10 },
                    { name: "Part B", material: "Steel" } // mixed keys
                ]
            };

            const html = await generateHTML(dpp);
            
            expect(html).toContain('<table>');
            // Headers: material, name, weight (sorted)
            expect(html).toContain('<th>material</th>');
            expect(html).toContain('<th>name</th>');
            expect(html).toContain('<th>weight</th>');

            // Row 1
            expect(html).toContain('<td>Part A</td>');
            expect(html).toContain('<td>10</td>');
            expect(html).toContain('<td>-</td>'); // material missing

            // Row 2
            expect(html).toContain('<td>Part B</td>');
            expect(html).toContain('<td>Steel</td>');
        });
    });

    describe('Deep Nesting', () => {
        test('should render deeply nested objects as nested cards', async () => {
            const dpp = {
                productName: "Test",
                level1: {
                    level2: {
                        level3: {
                            value: "Deep Value"
                        }
                    }
                }
            };

            const html = await generateHTML(dpp);

            // Verify structure hierarchy
            expect(html).toContain('<h4>Level 1</h4>');
            expect(html).toContain('<h4>Level 2</h4>');
            expect(html).toContain('<h4>Level 3</h4>');
            expect(html).toContain('Value:</span> <span class="dpp-value">Deep Value</span>');
            
            // Ensure we have multiple dpp-card divs (at least 3 levels)
            // Use regex to count occurrences or checking structure logic is hard via string match.
            // We can just check that it's present multiple times.
            const cardCount = (html.match(/class="dpp-card"/g) || []).length;
            expect(cardCount).toBeGreaterThanOrEqual(3);
        });
    });
});
