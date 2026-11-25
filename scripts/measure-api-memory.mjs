/**
 * @file measure-api-memory.mjs
 * @description Profiles RSS and heap memory usage of the DPP Keystone API server
 * across /validate (patched + raw), /adapt (patched + raw), /render/html, and
 * a burst of concurrent requests to size Cloud Run --memory accurately.
 */
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as jsoncParse } from 'jsonc-parser';
import { createServer } from '../api/src/server.js';
import { KEYSTONE_VERSION } from '../src/lib/keystone-version.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function fmtMb(bytes) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

let peakRss = 0;
function report(label) {
    const m = process.memoryUsage();
    if (m.rss > peakRss) peakRss = m.rss;
    console.log(
        `${label.padEnd(42)} | RSS: ${fmtMb(m.rss).padStart(9)} | HeapUsed: ${fmtMb(m.heapUsed).padStart(9)} | HeapTotal: ${fmtMb(m.heapTotal).padStart(9)}`
    );
}

async function loadJson(relPath) {
    const raw = await fs.readFile(path.join(PROJECT_ROOT, relPath), 'utf-8');
    return jsoncParse(raw.replace(/\{\{VERSION\}\}/g, KEYSTONE_VERSION));
}

const server = createServer();
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
    console.log('\n--- DPP Keystone API Memory Profile ---\n');
    report('1. Baseline (server started)');

    const keystoneEv = await loadJson('src/examples/battery-dpp-v1.json');
    const patchedFixture = await loadJson('ec-bundle/semantics/product/batteries/subgroup/evb/1.0.0/tests/conforms/pub-batteries-evb.json');

    await fetch(`${baseUrl}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpp: patchedFixture, options: { target: 'patched', mode: 'strict' } })
    });
    report('2. After /validate (patched, strict)');

    await fetch(`${baseUrl}/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpp: keystoneEv, options: { target: 'patched', validate: true, mode: 'strict' } })
    });
    report('3. After /adapt (patched + strict)');

    await fetch(`${baseUrl}/adapt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpp: keystoneEv, options: { target: 'raw', validate: true, mode: 'strict' } })
    });
    report('4. After /adapt (raw + strict)');

    await fetch(`${baseUrl}/render/html`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dpp: keystoneEv })
    });
    report('5. After /render/html');

    const runBurst = async () => {
        const burst = [];
        for (let i = 0; i < 20; i++) {
            const target = i % 2 === 0 ? 'patched' : 'raw';
            burst.push(
                fetch(`${baseUrl}/adapt`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dpp: keystoneEv, options: { target, validate: true, mode: 'strict' } })
                }).then((r) => r.text())
            );
        }
        await Promise.all(burst);
    };

    await runBurst();
    report('6. After burst 1 (20 concurrent)');

    await runBurst();
    report('7. After burst 2 (20 concurrent, leak chk)');

    const peakMb = peakRss / (1024 * 1024);
    const recommended = peakMb * 1.5 <= 256 ? '256Mi' : peakMb * 1.5 <= 512 ? '512Mi' : '1Gi';
    console.log(`\nPeak RSS: ${peakMb.toFixed(1)} MiB -> Recommended Cloud Run --memory: ${recommended} (with 1.5x headroom)\n`);
} finally {
    await new Promise((resolve) => server.close(resolve));
}
