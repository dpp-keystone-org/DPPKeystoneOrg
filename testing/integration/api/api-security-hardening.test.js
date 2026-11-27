import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';

import { startTestServer } from '../../scripts/api-test-helper.mjs';
import { KEYSTONE_VERSION } from '../../../src/lib/keystone-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../../');

async function loadKeystoneExample(filename) {
    const raw = await fs.readFile(path.join(PROJECT_ROOT, 'src/examples', filename), 'utf-8');
    return jsoncParse(raw.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION));
}

describe('HTTP API - Security Hardening Suite', () => {
    let testServer;
    let baseUrl;

    beforeAll(async () => {
        testServer = await startTestServer();
        baseUrl = testServer.baseUrl;
    });

    afterAll(async () => {
        if (testServer) {
            await testServer.close();
        }
    });

    describe('Feature 1: Path Traversal Prevention in Server Document Loader', () => {
        it('must NOT load JSON-LD @context files outside src/contexts via .. path traversal', async () => {
            const dpp = await loadKeystoneExample('battery-dpp-v1.json');
            delete dpp.extinguishingAgent;
            dpp['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://dpp-keystone.org/spec/contexts/../../testing/fixtures/outside-context-fixture.json'
            ];
            dpp.outsideMappedField = 'MAPPED_FROM_OUTSIDE_CONTEXTS_DIR';

            const resp = await fetch(`${baseUrl}/adapt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dpp, options: { target: 'patched' } })
            });

            const body = await resp.json();
            // If path traversal succeeded, outside-context-fixture.json mapped `outsideMappedField`
            // onto `dppk:extinguishingAgent`, leaking into `adaptedDpp.extinguishingAgent`!
            if (resp.status === 200 && body.adaptedDpp) {
                expect(body.adaptedDpp.extinguishingAgent).not.toEqual({
                    en: 'MAPPED_FROM_OUTSIDE_CONTEXTS_DIR'
                });
            }
        });

        it('must NOT expose an arbitrary JSON file-existence oracle via .. path traversal (e.g. ../../package.json)', async () => {
            const dppExisting = await loadKeystoneExample('battery-dpp-v1.json');
            dppExisting['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://dpp-keystone.org/spec/contexts/../../package.json'
            ];

            const dppMissing = await loadKeystoneExample('battery-dpp-v1.json');
            dppMissing['@context'] = [
                `https://dpp-keystone.org/spec/contexts/${KEYSTONE_VERSION}/dpp-battery.context.jsonld`,
                'https://dpp-keystone.org/spec/contexts/../../definitely-does-not-exist-99999.json'
            ];

            const [respExisting, respMissing] = await Promise.all([
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppExisting, options: { target: 'patched' } })
                }),
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: dppMissing, options: { target: 'patched' } })
                })
            ]);

            // Both out-of-bounds traversal URLs must be rejected/handled identically —
            // the server must never read `package.json` and return a different HTTP status than for a missing file.
            expect(respExisting.status).toBe(respMissing.status);
        });
    });
});
