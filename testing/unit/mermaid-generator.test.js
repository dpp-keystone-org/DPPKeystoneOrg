import { generateMermaidDiagram } from '../../scripts/generate-spec-docs.mjs';
import { jest } from '@jest/globals';

describe('Mermaid Diagram Generator', () => {
    const mockMetadata = [
        {
            name: 'Super.jsonld',
            module: 'core',
            classes: [
                { id: 'dppk:SuperClass', label: 'Super Class' }
            ]
        },
        {
            name: 'Range.jsonld',
            module: 'core',
            classes: [
                { id: 'dppk:RangeClass', label: 'Range Class' }
            ]
        }
    ];

    const currentHtmlPath = '/abs/dist/ontology/v1/core/Main.html';
    const ontologyDir = '/abs/dist/ontology/v1';

    it('should generate valid mermaid syntax with click events', () => {
        const mockClass = {
            id: 'dppk:MainClass',
            label: 'Main Class',
            attributes: {
                'rdfs:subClassOf': { '@id': 'dppk:SuperClass' }
            },
            properties: [
                { id: 'dppk:prop1', label: 'Prop 1', range: 'dppk:RangeClass' }
            ]
        };

        const diagram = generateMermaidDiagram(mockClass, mockMetadata, currentHtmlPath, ontologyDir);
        
        console.log('Generated Diagram:\n', diagram);

        expect(diagram).toContain('classDiagram');
        expect(diagram).toContain('class MainClass');
        expect(diagram).toContain('SuperClass <|-- MainClass');
        expect(diagram).toContain('MainClass --|> RangeClass : prop1');
        
        // Check for click events
        // Relative path from /core/Main.html to /core/Super/SuperClass.html is ./Super/SuperClass.html
        // But the generator uses full logic.
        // Assuming resolveClassUrl works (which we mock implicitly by the logic inside generateMermaidDiagram calling the real one? 
        // No, generateMermaidDiagram calls resolveClassUrl which is NOT exported/mocked easily without being rewritten.
        // But since it's in the same module, it uses the internal one. 
        // We need to match the logic: 
        // target: /abs/dist/ontology/v1/core/Super/SuperClass.html
        // from: /abs/dist/ontology/v1/core/Main.html
        // relative: ./Super/SuperClass.html (approx) 
        
        expect(diagram).toMatch(/click SuperClass href ".+" "dppk:SuperClass"/);
        expect(diagram).toMatch(/style SuperClass stroke:#2962ff,color:#2962ff/);
        expect(diagram).toMatch(/click RangeClass href ".+" "dppk:RangeClass"/);
        expect(diagram).toMatch(/style RangeClass stroke:#2962ff,color:#2962ff/);
    });

    it('should handle multiple inheritance', () => {
        const mockClass = {
            id: 'dppk:Child',
            attributes: {
                'rdfs:subClassOf': [
                    { '@id': 'dppk:Super1' },
                    { '@id': 'dppk:Super2' }
                ]
            },
            properties: []
        };
        
        // We don't provide metadata here, so no click events should be generated, ensuring no crash.
        const diagram = generateMermaidDiagram(mockClass, [], currentHtmlPath, ontologyDir);
        expect(diagram).toContain('Super1 <|-- Child');
        expect(diagram).toContain('Super2 <|-- Child');
    });
});
