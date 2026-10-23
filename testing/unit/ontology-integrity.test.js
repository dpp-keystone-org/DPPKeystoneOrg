import {
    auditContextMappings,
    auditDocumentation,
    auditNumericUnits,
    auditTermCollisions,
    IntegrityReporter,
    ontologyGraph,
    processContextBlock,
    registerOntologyTerm,
    resetIntegrityState
} from '../../scripts/validate-ontology-integrity.mjs';

describe('ontology integrity: context mapping to JSON-LD keywords', () => {
    beforeEach(() => {
        resetIntegrityState();
    });

    it('does not fail when a context term maps to a JSON-LD keyword', () => {
        processContextBlock({
            type: '@type',
            id: '@id'
        }, 'src/contexts/v3/dpp-core.context.jsonld');

        const reporter = new IntegrityReporter();
        auditContextMappings(reporter);

        expect(reporter.hasErrors).toBe(false);
        expect(reporter.violations['Context Mapping Integrity']).toBeUndefined();
    });

    it('still fails other unmapped terms in the same context as keyword aliases', () => {
        processContextBlock({
            type: '@type',
            id: '@id',
            ghostTerm: 'dppk:ghostTerm'
        }, 'src/contexts/v3/dpp-core.context.jsonld');

        const reporter = new IntegrityReporter();
        auditContextMappings(reporter);

        expect(reporter.hasErrors).toBe(true);
        const failures = reporter.violations['Context Mapping Integrity'];
        expect(failures).toHaveLength(1);
        expect(failures[0].message).toContain("Context maps term 'ghostTerm'");
        expect(failures[0].message).not.toContain("'type'");
        expect(failures[0].message).not.toContain("'id'");
    });

    it('still fails when a context term maps to an IRI that is not in the ontology', () => {
        processContextBlock({
            ghostTerm: 'dppk:ghostTerm'
        }, 'src/contexts/v3/dpp-core.context.jsonld');

        const reporter = new IntegrityReporter();
        auditContextMappings(reporter);

        expect(reporter.hasErrors).toBe(true);
        const failures = reporter.violations['Context Mapping Integrity'];
        expect(failures).toHaveLength(1);
        expect(failures[0].message).toContain("Context maps term 'ghostTerm'");
        expect(failures[0].message).toContain('NOT defined anywhere in the Ontology');
    });

    it('passes when a context term maps to an IRI that is defined in the ontology', () => {
        ontologyGraph.set('dppk:DigitalProductPassport', {
            '@id': 'dppk:DigitalProductPassport',
            _definedIn: 'src/ontology/v3/core/Header.jsonld'
        });

        processContextBlock({
            DigitalProductPassport: 'dppk:DigitalProductPassport'
        }, 'src/contexts/v3/dpp-core.context.jsonld');

        const reporter = new IntegrityReporter();
        auditContextMappings(reporter);

        expect(reporter.hasErrors).toBe(false);
        expect(reporter.violations['Context Mapping Integrity']).toBeUndefined();
    });
});

describe('ontology integrity: collision detection', () => {
    beforeEach(() => {
        resetIntegrityState();
    });

    it('fails when two non-deprecated terms share the exact same IRI across files', () => {
        registerOntologyTerm({ '@id': 'dppk:carbonFootprintClass' }, 'src/ontology/v3/sectors/Battery.jsonld');
        registerOntologyTerm({ '@id': 'dppk:carbonFootprintClass' }, 'src/ontology/v3/sectors/Textile.jsonld');

        const reporter = new IntegrityReporter();
        auditTermCollisions(reporter);

        expect(reporter.hasErrors).toBe(true);
        const failures = reporter.violations['Ontology Collision Integrity'];
        expect(failures).toHaveLength(1);
        expect(failures[0].message).toContain("Term 'dppk:carbonFootprintClass' is defined multiple times");
    });

    it('passes when terms share the same local name but have different namespaces', () => {
        registerOntologyTerm({ '@id': 'dppk:compressiveStrength' }, 'src/ontology/v3/core/Product.jsonld');
        registerOntologyTerm({ '@id': 'dppk-cement:compressiveStrength' }, 'src/ontology/v3/sectors/Cement.jsonld');

        const reporter = new IntegrityReporter();
        auditTermCollisions(reporter);

        expect(reporter.hasErrors).toBe(false);
        expect(reporter.violations['Ontology Collision Integrity']).toBeUndefined();
    });

    it('ignores collisions when duplicate terms are marked owl:deprecated', () => {
        registerOntologyTerm({ '@id': 'dppk:carbonFootprintClass', 'owl:deprecated': true }, 'src/ontology/v3/sectors/Battery.jsonld');
        registerOntologyTerm({ '@id': 'dppk:carbonFootprintClass', 'owl:deprecated': true }, 'src/ontology/v3/sectors/Textile.jsonld');

        const reporter = new IntegrityReporter();
        auditTermCollisions(reporter);

        expect(reporter.hasErrors).toBe(false);
        expect(reporter.violations['Ontology Collision Integrity']).toBeUndefined();
    });

    it('ignores collisions when one duplicate term is active and one is marked owl:deprecated', () => {
        registerOntologyTerm({ '@id': 'dppk:legacyTerm', 'owl:deprecated': true }, 'src/ontology/v3/core/Legacy.jsonld');
        registerOntologyTerm({ '@id': 'dppk:legacyTerm' }, 'src/ontology/v3/core/Current.jsonld');

        const reporter = new IntegrityReporter();
        auditTermCollisions(reporter);

        expect(reporter.hasErrors).toBe(false);
        expect(reporter.violations['Ontology Collision Integrity']).toBeUndefined();
    });
});

describe('ontology integrity: rdfs:subPropertyOf inheritance', () => {
    beforeEach(() => {
        resetIntegrityState();
    });

    it('inherits label, comment, range, and unit from parent property via rdfs:subPropertyOf', () => {
        registerOntologyTerm({
            '@id': 'dppk-cement:calciumOxideContent',
            '@type': 'owl:DatatypeProperty',
            'rdfs:range': 'xsd:double',
            'dppk:unit': { '@id': 'dppk-unit:Unitless' },
            'rdfs:label': [{ '@language': 'en', '@value': 'Calcium Oxide Content' }],
            'rdfs:comment': [{ '@language': 'en', '@value': 'Base property comment.' }]
        }, 'src/ontology/v3/sectors/Cement.jsonld');

        registerOntologyTerm({
            '@id': 'dppk-cement-portlandcementclinker:calciumOxideContent',
            '@type': 'owl:DatatypeProperty',
            'rdfs:subPropertyOf': { '@id': 'dppk-cement:calciumOxideContent' },
            'dppk:governedBy': 'prEN 197-1:2026, Clause 4.3.1.1'
        }, 'src/ontology/v3/sectors/Cement.jsonld');

        const reporter = new IntegrityReporter();
        auditDocumentation(reporter);
        auditNumericUnits(reporter);

        expect(reporter.hasErrors).toBe(false);
        expect(reporter.violations['Documentation Completeness']).toBeUndefined();
        expect(reporter.violations['Numeric Unit Check']).toBeUndefined();
    });

    it('fails when rdfs:subPropertyOf references a non-existent parent term', () => {
        registerOntologyTerm({
            '@id': 'dppk-cement-portlandcementclinker:calciumOxideContent',
            '@type': 'owl:DatatypeProperty',
            'rdfs:subPropertyOf': { '@id': 'dppk-cement:nonExistentTopic' }
        }, 'src/ontology/v3/sectors/Cement.jsonld');

        const reporter = new IntegrityReporter();
        auditDocumentation(reporter);

        expect(reporter.hasErrors).toBe(true);
        expect(reporter.violations['SubProperty Integrity']).toBeDefined();
    });
});

