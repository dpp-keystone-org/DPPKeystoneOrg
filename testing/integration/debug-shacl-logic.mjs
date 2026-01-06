import SHACLValidator from 'rdf-validate-shacl';
import DataFactory from '@rdfjs/data-model/Factory.js';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import Environment from '@rdfjs/environment';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';

const factory = new Environment([DataFactory, DatasetFactory, ClownfaceFactory, NamespaceFactory]);

async function testShaclLogic() {
    console.log("--- Testing SHACL Conditional Logic ---");

    // 1. Create a minimal data graph (Simulating a Drill DPP)
    // It has the 'electronics' ID, but NOT the 'battery' ID.
    const dataGraph = factory.dataset();
    const focusNode = factory.namedNode('http://example.com/myDrill');
    
    dataGraph.add(factory.quad(
        focusNode,
        factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
        factory.namedNode('https://dpp-keystone.org/spec/v1/terms#DigitalProductPassport')
    ));
    
    dataGraph.add(factory.quad(
        focusNode,
        factory.namedNode('https://dpp-keystone.org/spec/v1/terms#contentSpecificationIds'),
        factory.literal('draft_electronics_specification_id') // Value present
    ));

    // 2. Define the Battery Shape (Should PASS because the ID is missing)
    const batteryShapeGraph = factory.dataset();
    const batteryShapeNode = factory.namedNode('http://example.com/BatteryShape');

    // Definition: Target Class DPP
    batteryShapeGraph.add(factory.quad(
        batteryShapeNode,
        factory.namedNode('http://www.w3.org/ns/shacl#targetClass'),
        factory.namedNode('https://dpp-keystone.org/spec/v1/terms#DigitalProductPassport')
    ));

    // Logic: OR ( NOT(HasID) , CheckProperties )
    const orList = factory.blankNode();
    const opt1 = factory.blankNode();
    const opt2 = factory.blankNode();

    batteryShapeGraph.add(factory.quad(
        batteryShapeNode,
        factory.namedNode('http://www.w3.org/ns/shacl#or'),
        orList
    ));

    // Construct the RDF List for sh:or
    // (This is tedious in raw RDF, emulating what the JSON-LD parser does)
    batteryShapeGraph.add(factory.quad(orList, factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'), opt1));
    const listRest = factory.blankNode();
    batteryShapeGraph.add(factory.quad(orList, factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'), listRest));
    batteryShapeGraph.add(factory.quad(listRest, factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#first'), opt2));
    batteryShapeGraph.add(factory.quad(listRest, factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'), factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')));

    // Option 1: NOT (Has Battery ID)
    const notNode = factory.blankNode();
    batteryShapeGraph.add(factory.quad(opt1, factory.namedNode('http://www.w3.org/ns/shacl#not'), notNode));
    
    // Inside NOT: Property hasValue 'draft_battery_specification_id'
    const propNode = factory.blankNode();
    batteryShapeGraph.add(factory.quad(notNode, factory.namedNode('http://www.w3.org/ns/shacl#property'), propNode));
    batteryShapeGraph.add(factory.quad(propNode, factory.namedNode('http://www.w3.org/ns/shacl#path'), factory.namedNode('https://dpp-keystone.org/spec/v1/terms#contentSpecificationIds')));
    batteryShapeGraph.add(factory.quad(propNode, factory.namedNode('http://www.w3.org/ns/shacl#hasValue'), factory.literal('draft_electronics_specification_id')));

    // Option 2: Requirements (We'll just put a dummy failing check to ensure it skipped)
    // If this runs, it WILL fail.
    const dummyProp = factory.blankNode();
    batteryShapeGraph.add(factory.quad(opt2, factory.namedNode('http://www.w3.org/ns/shacl#property'), dummyProp));
    batteryShapeGraph.add(factory.quad(dummyProp, factory.namedNode('http://www.w3.org/ns/shacl#path'), factory.namedNode('http://example.com/dummyField')));
    batteryShapeGraph.add(factory.quad(dummyProp, factory.namedNode('http://www.w3.org/ns/shacl#minCount'), factory.literal('1', factory.namedNode('http://www.w3.org/2001/XMLSchema#integer'))));


    // 3. Validate
    const validator = new SHACLValidator(batteryShapeGraph, { factory });
    const report = await validator.validate(dataGraph);

    console.log("Conforms:", report.conforms);
    if (!report.conforms) {
        console.log("Violations:", report.results.length);
        report.results.forEach(r => {
            console.log(` - ${r.message.map(m=>m.value)}`);
        });
    } else {
        console.log("Success! The Battery logic was correctly skipped.");
    }
}

testShaclLogic().catch(console.error);
