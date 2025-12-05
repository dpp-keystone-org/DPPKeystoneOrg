import { parse as jsoncParse } from 'jsonc-parser';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the function to be tested
import { EPDAdapter } from '../dpp-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('EPD Adapter Library', () => {
  it('should transform all EPD indicators from a document into an array of schema.org Certifications', async () => {
    // ARRANGE: Load source document
    const docPath = path.resolve(__dirname, '../../../../src/examples/construction-product-dpp-v1.json');
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));

    // The document loader is still needed to resolve contexts during the expansion
    const documentLoader = async (url, options) => {
      if (url.startsWith('https://dpp-keystone.org/spec/')) {
        const localPath = url.replace('https://dpp-keystone.org/spec', path.resolve(__dirname, '../../../../src'));
        try {
          const content = fs.readFileSync(localPath, 'utf-8');
          return { contextUrl: null, document: jsoncParse(content), documentUrl: url };
        } catch (e) { return jsonld.documentLoaders.node()(url); }
      }
      return jsonld.documentLoaders.node()(url);
    };

    const ontologyPaths = [
      path.resolve(__dirname, '../../../../src/ontology/v1/core/EPD.jsonld')
    ];

    // ACT: Run the adapter function from the library
    const certifications = await EPDAdapter(doc, ontologyPaths, documentLoader);
    
    // ASSERT: Verify the results are correct
    expect(certifications.length).toBe(130);

    const gwpA1 = certifications.find(c => c.name === 'GWP-A1');
    expect(gwpA1).toBeDefined();
    expect(gwpA1.hasMeasurement.value).toEqual(348);
    expect(gwpA1.hasMeasurement.unitText).toEqual('kg CO₂ eq');
    expect(gwpA1.issuedBy.name).toEqual('ExampleCorp');

    const adpfD = certifications.find(c => c.name === 'ADPF-D');
    expect(adpfD).toBeDefined();
    expect(adpfD.hasMeasurement.value).toEqual(5620);
    expect(adpfD.hasMeasurement.unitText).toEqual('MJ');
  });
});