import {
    KEYSTONE_VERSION,
    CANONICAL_SPEC_URL,
    SPEC_URL_REGEX,
    isSpecUrl,
    normalizeSpecUrl,
    specUrlToRelativePath,
    specUrlToPreviewUrl,
    rewriteSpecFileUrls
} from '../../../src/lib/keystone-version.js';

describe('keystone-version helpers', () => {
    describe('isSpecUrl', () => {
        it('identifies canonical spec URLs', () => {
            expect(isSpecUrl('https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld')).toBe(true);
            expect(isSpecUrl('https://dpp-keystone.org/spec/ontology/v3/dpp-ontology.jsonld')).toBe(true);
            expect(isSpecUrl('https://dpp-keystone.org/spec/v3/terms#Product')).toBe(true);
        });

        it('identifies branch preview spec URLs', () => {
            expect(isSpecUrl('https://dpp-keystone.org/preview/feature/version3/spec/contexts/v3/dpp-core.context.jsonld')).toBe(true);
            expect(isSpecUrl('https://dpp-keystone.org/preview/fix-typo/spec/validation/v3/json-schema/dpp.schema.json')).toBe(true);
        });

        it('returns false for external and non-spec URLs', () => {
            expect(isSpecUrl('https://schema.org/Product')).toBe(false);
            expect(isSpecUrl('https://example.com/spec/something')).toBe(false);
            expect(isSpecUrl('https://dpp-keystone.org/about')).toBe(false);
            expect(isSpecUrl(null)).toBe(false);
            expect(isSpecUrl(undefined)).toBe(false);
            expect(isSpecUrl(123)).toBe(false);
        });
    });

    describe('normalizeSpecUrl', () => {
        it('strips preview branch from spec URLs', () => {
            const previewUrl = 'https://dpp-keystone.org/preview/feature/version3/spec/contexts/v3/dpp-core.context.jsonld';
            expect(normalizeSpecUrl(previewUrl)).toBe('https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld');
        });

        it('leaves canonical spec URLs unchanged', () => {
            const canonicalUrl = 'https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld';
            expect(normalizeSpecUrl(canonicalUrl)).toBe(canonicalUrl);
        });

        it('leaves external and non-spec URLs unchanged', () => {
            expect(normalizeSpecUrl('https://schema.org/Product')).toBe('https://schema.org/Product');
            expect(normalizeSpecUrl(null)).toBeNull();
        });
    });

    describe('specUrlToRelativePath', () => {
        it('converts canonical spec URLs to local relative paths with default prefix', () => {
            const url = 'https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld';
            expect(specUrlToRelativePath(url)).toBe('../spec/contexts/v3/dpp-core.context.jsonld');
        });

        it('converts preview spec URLs to local relative paths with default prefix', () => {
            const url = 'https://dpp-keystone.org/preview/feature/version3/spec/contexts/v3/dpp-core.context.jsonld';
            expect(specUrlToRelativePath(url)).toBe('../spec/contexts/v3/dpp-core.context.jsonld');
        });

        it('respects custom prefix', () => {
            const url = 'https://dpp-keystone.org/preview/feature/version3/spec/ontology/v3/dpp-ontology.jsonld';
            expect(specUrlToRelativePath(url, '../')).toBe('../ontology/v3/dpp-ontology.jsonld');
        });

        it('returns non-spec URLs unchanged', () => {
            expect(specUrlToRelativePath('https://schema.org/Product')).toBe('https://schema.org/Product');
            expect(specUrlToRelativePath(null)).toBeNull();
        });
    });

    describe('specUrlToPreviewUrl', () => {
        it('injects preview branch into canonical spec URL', () => {
            const canonical = 'https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld';
            expect(specUrlToPreviewUrl(canonical, 'feature/version3'))
                .toBe('https://dpp-keystone.org/preview/feature/version3/spec/contexts/v3/dpp-core.context.jsonld');
        });

        it('updates branch if already a preview URL', () => {
            const preview = 'https://dpp-keystone.org/preview/old-branch/spec/contexts/v3/dpp-core.context.jsonld';
            expect(specUrlToPreviewUrl(preview, 'feature/version3'))
                .toBe('https://dpp-keystone.org/preview/feature/version3/spec/contexts/v3/dpp-core.context.jsonld');
        });

        it('returns URL unchanged if previewBranch is empty', () => {
            const canonical = 'https://dpp-keystone.org/spec/contexts/v3/dpp-core.context.jsonld';
            expect(specUrlToPreviewUrl(canonical, '')).toBe(canonical);
        });
    });

    describe('rewriteSpecFileUrls', () => {
        it('rewrites file URLs to include preview chunk and expands {{VERSION}}', () => {
            const content = JSON.stringify({
                "@context": [
                    "https://dpp-keystone.org/spec/contexts/{{VERSION}}/dpp-core.context.jsonld",
                    "https://dpp-keystone.org/spec/ontology/{{VERSION}}/dpp-ontology.jsonld",
                    "https://dpp-keystone.org/spec/validation/{{VERSION}}/json-schema/dpp.schema.json",
                    "https://dpp-keystone.org/spec/examples/construction-product-dpp-v1.json"
                ],
                "dppk": "https://dpp-keystone.org/spec/{{VERSION}}/terms#",
                "dppk-unit": "https://dpp-keystone.org/spec/{{VERSION}}/units#"
            });

            const rewritten = JSON.parse(rewriteSpecFileUrls(content, 'feature/version3'));

            // File URLs MUST receive preview chunk
            expect(rewritten["@context"][0]).toBe(`https://dpp-keystone.org/preview/feature/version3/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`);
            expect(rewritten["@context"][1]).toBe(`https://dpp-keystone.org/preview/feature/version3/spec/ontology/${KEYSTONE_VERSION}/dpp-ontology.jsonld`);
            expect(rewritten["@context"][2]).toBe(`https://dpp-keystone.org/preview/feature/version3/spec/validation/${KEYSTONE_VERSION}/json-schema/dpp.schema.json`);
            expect(rewritten["@context"][3]).toBe('https://dpp-keystone.org/preview/feature/version3/spec/examples/construction-product-dpp-v1.json');

            // Semantic vocabulary concept IRIs MUST remain canonical
            expect(rewritten["dppk"]).toBe(`https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`);
            expect(rewritten["dppk-unit"]).toBe(`https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/units#`);
        });

        it('handles chunk starting with /preview/ prefix', () => {
            const input = '"https://dpp-keystone.org/spec/contexts/{{VERSION}}/dpp.jsonld"';
            const result = rewriteSpecFileUrls(input, '/preview/test-branch');
            expect(result).toBe(`"https://dpp-keystone.org/preview/test-branch/spec/contexts/${KEYSTONE_VERSION}/dpp.jsonld"`);
        });

        it('only expands {{VERSION}} when previewBranch is empty', () => {
            const content = JSON.stringify({
                "context": "https://dpp-keystone.org/spec/contexts/{{VERSION}}/dpp-core.context.jsonld",
                "dppk": "https://dpp-keystone.org/spec/{{VERSION}}/terms#"
            });

            const result = JSON.parse(rewriteSpecFileUrls(content, ''));
            expect(result.context).toBe(`https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-core.context.jsonld`);
            expect(result.dppk).toBe(`https://dpp-keystone.org/spec/${KEYSTONE_VERSION}/terms#`);
        });
    });
});
