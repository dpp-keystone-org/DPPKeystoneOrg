import fs from 'fs';
import DataFactory from '@rdfjs/data-model/Factory.js';
import DatasetFactory from '@rdfjs/dataset/Factory.js';
import Environment from '@rdfjs/environment';
import ClownfaceFactory from 'clownface/Factory.js';
import NamespaceFactory from '@rdfjs/namespace/Factory.js';
import SHACLValidator from 'rdf-validate-shacl';
import { KEYSTONE_VERSION } from '../../src/lib/keystone-version.js';

const factory = new Environment([DataFactory, DatasetFactory, ClownfaceFactory, NamespaceFactory]);

export function loadOntologyDefinition(ontologyFilePath) {
    const rawData = fs.readFileSync(ontologyFilePath, 'utf8');
    return JSON.parse(rawData);
}

export function expandURI(uri, context) {
    if (!uri || typeof uri !== 'string') return uri;
    if (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('urn:')) return uri;
    
    const parts = uri.split(':');
    if (parts.length === 2) {
        if (parts[0] === 'dppk') {
            return `https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#` + parts[1];
        }
        let prefixUri = context[parts[0]];
        if (typeof prefixUri === 'object' && prefixUri['@id']) {
            prefixUri = prefixUri['@id'];
        }
        if (prefixUri) {
            let expanded = prefixUri + parts[1];
            expanded = expanded.replace('{{VERSION}}', KEYSTONE_VERSION);
            return expanded;
        }
    }
    return uri;
}

export function extractClassRequirements(ontologyGraph, targetClass) {
    const graphNodes = ontologyGraph["@graph"] || (Array.isArray(ontologyGraph) ? ontologyGraph : [ontologyGraph]);
    const context = ontologyGraph["@context"] || {};
    
    const requirements = [];
    
    // We also need to search through all imported/known ontologies for owl:oneOf, 
    // but for the sake of Phase 1, we look in the current graph.
    
    for (const node of graphNodes) {
        if (!node["rdfs:domain"]) continue;
        
        let domains = Array.isArray(node["rdfs:domain"]) ? node["rdfs:domain"] : [node["rdfs:domain"]];
        
        const hasDomain = domains.some(d => d["@id"] === targetClass || expandURI(d["@id"], context) === expandURI(targetClass, context));
        
        if (hasDomain) {
            let range = null;
            let expandedRange = null;
            if (node["rdfs:range"]) {
                range = typeof node["rdfs:range"] === 'string' ? node["rdfs:range"] : node["rdfs:range"]["@id"];
                expandedRange = expandURI(range, context);
            }
            
            let oneOf = null;
            if (range) {
                const rangeNode = graphNodes.find(n => (n["@id"] === range || expandURI(n["@id"], context) === expandedRange));
                if (rangeNode && rangeNode["owl:oneOf"]) {
                    let oneOfArray = Array.isArray(rangeNode["owl:oneOf"]) ? rangeNode["owl:oneOf"] : [rangeNode["owl:oneOf"]];
                    oneOf = oneOfArray.map(o => expandURI(o["@id"], context));
                }
            }
            let propertyTypes = [];
            if (node["@type"]) {
                propertyTypes = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
            }

            requirements.push({
                property: node["@id"],
                expandedProperty: expandURI(node["@id"], context),
                range: range,
                expandedRange: expandedRange,
                oneOf: oneOf,
                propertyTypes: propertyTypes
            });
        }
    }
    
    return requirements;
}

export function synthesizeHappyPathGraph(classRequirements, expandedTargetClass) {
    const dataGraph = factory.dataset();
    const focusNode = factory.namedNode('http://example.com/FuzzedNode');
    
    if (expandedTargetClass) {
        dataGraph.add(factory.quad(
            focusNode,
            factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'),
            factory.namedNode(expandedTargetClass)
        ));
    }
    
    for (const req of classRequirements) {
        // If property could not be expanded, fallback to raw
        const propUri = req.expandedProperty || req.property;
        const propNode = factory.namedNode(propUri);
        let valueNode;
        
        if (req.oneOf && req.oneOf.length > 0) {
            valueNode = factory.namedNode(req.oneOf[0]);
            if (req.expandedRange) {
                dataGraph.add(factory.quad(valueNode, factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), factory.namedNode(req.expandedRange)));
            }
        } else {
            // Check based on range
            const rangeUri = req.expandedRange || req.range;
            
            // Simplistic mapping for XSD types and custom datatypes
            if (rangeUri && rangeUri.includes('langString')) {
                valueNode = factory.literal('dummy string', 'en');
            } else if (rangeUri && rangeUri.includes('string')) {
                valueNode = factory.literal('dummy string');
            } else if (rangeUri && rangeUri.includes('integer')) {
                valueNode = factory.literal('1', factory.namedNode('http://www.w3.org/2001/XMLSchema#integer'));
            } else if (rangeUri && (rangeUri.includes('double') || rangeUri.includes('float') || rangeUri.includes('Literal'))) {
                valueNode = factory.literal('1.0', factory.namedNode('http://www.w3.org/2001/XMLSchema#double'));
            } else if (rangeUri && rangeUri.includes('decimal')) {
                valueNode = factory.literal('1.0', factory.namedNode('http://www.w3.org/2001/XMLSchema#decimal'));
            } else if (rangeUri && rangeUri.includes('boolean')) {
                valueNode = factory.literal('true', factory.namedNode('http://www.w3.org/2001/XMLSchema#boolean'));
            } else if (rangeUri && rangeUri.includes('dateTime')) {
                valueNode = factory.literal('2026-07-29T10:00:00Z', factory.namedNode('http://www.w3.org/2001/XMLSchema#dateTime'));
            } else if (rangeUri && rangeUri.includes('date')) {
                valueNode = factory.literal('2026-07-29', factory.namedNode('http://www.w3.org/2001/XMLSchema#date'));
            } else if (rangeUri && rangeUri.includes('anyURI')) {
                valueNode = factory.literal('https://example.com', factory.namedNode('http://www.w3.org/2001/XMLSchema#anyURI'));
            } else if (!rangeUri) {
                // Undefined range, default to string
                valueNode = factory.literal('undefined range fallback');
            } else {
                // Default to a named node (URI) for object properties
                valueNode = factory.namedNode('http://example.com/dummyURI');
                if (req.expandedRange) {
                    dataGraph.add(factory.quad(valueNode, factory.namedNode('http://www.w3.org/1999/02/22-rdf-syntax-ns#type'), factory.namedNode(req.expandedRange)));
                }
            }
        }
        
        dataGraph.add(factory.quad(focusNode, propNode, valueNode));
    }
    
    return dataGraph;
}

export function generateMutations(happyPathGraph, classRequirements) {
    const mutations = [];
    
    for (const req of classRequirements) {
        const propUri = req.expandedProperty || req.property;
        
        // 1. Missing Property (DISABLED)
        // Since the ontology does not explicitly define which properties are mandatory, 
        // the fuzzer cannot assume every property requires a sh:minCount 1 constraint.
        // We do not want to force the ontology to be overly restrictive.
        /*
        const missingPropGraph = factory.dataset();
        for (const quad of happyPathGraph) {
            if (quad.predicate.value !== propUri) {
                missingPropGraph.add(quad);
            }
        }
        mutations.push({
            name: `Missing Property`,
            graph: missingPropGraph,
            property: propUri,
            type: 'MissingProperty'
        });
        */

        // 2. Wrong Datatype
        // Only generate this mutation if a range was explicitly defined in the ontology,
        // otherwise SHACL won't restrict it, and the mutation will falsely pass.
        if (req.range) {
            const wrongTypeGraph = factory.dataset();
            for (const quad of happyPathGraph) {
                if (quad.predicate.value === propUri) {
                    let wrongValue;
                    if (quad.object.termType === 'Literal') {
                        if (quad.object.datatype && quad.object.datatype.value.includes('boolean')) {
                             wrongValue = factory.literal('not a boolean', factory.namedNode('http://www.w3.org/2001/XMLSchema#string'));
                        } else if (quad.object.datatype && (quad.object.datatype.value.includes('double') || quad.object.datatype.value.includes('float') || quad.object.datatype.value.includes('integer') || quad.object.datatype.value.includes('decimal') || quad.object.datatype.value.includes('Literal'))) {
                             wrongValue = factory.literal('not a number', factory.namedNode('http://www.w3.org/2001/XMLSchema#string'));
                        } else {
                             wrongValue = factory.literal('123', factory.namedNode('http://www.w3.org/2001/XMLSchema#integer'));
                        }
                    } else {
                        wrongValue = factory.literal('wrong type literal instead of URI');
                    }
                    wrongTypeGraph.add(factory.quad(quad.subject, quad.predicate, wrongValue));
                } else {
                    wrongTypeGraph.add(quad);
                }
            }
            mutations.push({
                name: `Wrong Datatype`,
                graph: wrongTypeGraph,
                property: propUri,
                type: 'WrongDatatype'
            });
        }

        // 3. Enum Violation
        if (req.oneOf && req.oneOf.length > 0) {
            const enumViolationGraph = factory.dataset();
            for (const quad of happyPathGraph) {
                if (quad.predicate.value === propUri) {
                    const badEnum = factory.namedNode('http://example.com/INVALID_ENUM_VALUE');
                    enumViolationGraph.add(factory.quad(quad.subject, quad.predicate, badEnum));
                } else {
                    enumViolationGraph.add(quad);
                }
            }
            mutations.push({
                name: `Enum Violation`,
                graph: enumViolationGraph,
                property: propUri,
                type: 'EnumViolation'
            });
        }
    }
    
    return mutations;
}

export function runFuzzer(happyPathGraph, mutations, shaclShapesDataset) {
    const validator = new SHACLValidator(shaclShapesDataset, { factory });
    
    const happyReport = validator.validate(happyPathGraph);
    if (!happyReport.conforms) {
        throw new Error(`Happy path failed validation! Report: ${happyReport.results.map(r => r.message.map(m => m.value).join(', ')).join('; ')}`);
    }
    
    for (const mutation of mutations) {
        const mutationReport = validator.validate(mutation.graph);
        if (mutationReport.conforms) {
            throw new Error(`Fuzzer found a hole! Mutation "${mutation.name}" on property "${mutation.property}" passed validation when it should have failed.`);
        }
    }
    
    return true;
}
