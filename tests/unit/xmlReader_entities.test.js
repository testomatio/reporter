import path from 'path';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import XmlReader from '../../src/xmlReader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('XML Reader - Entity Expansion (> 1000 limit)', () => {
  it('should parse XML with 1500 entity references (exceeds old 1000 limit)', () => {
    const reader = new XmlReader({ apiKey: 'test-key', lang: 'javascript' });
    const result = reader.parse(path.join(__dirname, 'data/xmlReader/large_entities.xml'));

    expect(result.status).to.eql('passed');
    expect(result.tests_count).to.eql(1500);
    expect(result.tests.length).to.eql(1500);

    // Verify first few entities were resolved correctly
    expect(result.tests[0].title).to.eql('testvalue1');
    expect(result.tests[1].title).to.eql('testvalue2');
    expect(result.tests[1499].title).to.eql('testvalue1500');

    console.log('✅ Successfully parsed 1500 entities (old limit was 1000)');
  });
});
