import {
    auditContextMappings,
    IntegrityReporter,
    ontologyGraph,
    processContextBlock,
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
