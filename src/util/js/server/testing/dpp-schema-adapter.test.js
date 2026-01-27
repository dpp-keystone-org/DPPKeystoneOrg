import { parse as jsoncParse } from 'jsonc-parser';
import jsonld from 'jsonld';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the function to be tested
import { transformDpp } from '../dpp-schema-adapter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('DPP Transformer Library', () => {
  it('should transform the EPD data into a single schema.org Certification', async () => {
    // ARRANGE: Load source document
    const docPath = path.resolve(__dirname, '../../../../../src/examples/construction-product-dpp-v1.json');
    const doc = JSON.parse(fs.readFileSync(docPath, 'utf-8'));

    const documentLoader = async (url, options) => {
      if (url.startsWith('https://dpp-keystone.org/spec/')) {
        const localPath = url.replace('https://dpp-keystone.org/spec', path.resolve(__dirname, '../../../../../src'));
        try {
          const content = fs.readFileSync(localPath, 'utf-8');
          return { contextUrl: null, document: jsoncParse(content), documentUrl: url };
        } catch (e) { return jsonld.documentLoaders.node()(url); }
      }
      return jsonld.documentLoaders.node()(url);
    };

    const options = {
        profile: 'schema.org',
        ontologyPaths: [
            path.resolve(__dirname, '../../../../../src/ontology/v1/core/EPD.jsonld'),
            path.resolve(__dirname, '../../../../../src/ontology/v1/core/EPDIndicators.jsonld'),
            path.resolve(__dirname, '../../../../../src/ontology/v1/core/EPDLifecycle.jsonld'),
            path.resolve(__dirname, '../../../../../src/ontology/v1/core/EPDMetadata.jsonld')
        ],
        documentLoader,
    };

    // ACT: Run the adapter function from the library
    const transformedData = await transformDpp(doc, options);
    
    // ASSERT: Verify the results are correct
    const certifications = transformedData.filter(item => item['@type'] === 'Certification');
    expect(certifications).toHaveLength(1);

    const epdCertification = certifications[0];
    expect(epdCertification.name).toBe('Environmental Product Declaration');
    expect(epdCertification.issuedBy.name).toEqual('ExampleCorp');

    const measurements = epdCertification.hasMeasurement;
    expect(measurements).toBeInstanceOf(Array);
    expect(measurements).toHaveLength(140);

    const gwpA1 = measurements.find(m => m.propertyID === 'gwp-a1');
    expect(gwpA1).toBeDefined();
    expect(gwpA1.value).toEqual(348);
    expect(gwpA1.unitText).toEqual('kg CO₂ eq');
    
    const adpfD = measurements.find(m => m.propertyID === 'adpf-d');
    expect(adpfD).toBeDefined();
    expect(adpfD.value).toEqual(5620);
    expect(adpfD.unitText).toEqual('MJ');
  });
});
