import fs from 'fs';
import path from 'path';
import { expect } from 'chai';
import { fileURLToPath } from 'url';
import XmlReader from '../../src/xmlReader.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('XML Reader - Entity Expansion', () => {
  it('should parse XML with 1500 entity references', () => {
    const reader = new XmlReader({ apiKey: 'test-key', lang: 'javascript' });
    const result = reader.parse(path.join(__dirname, 'data/xmlReader/large_entities.xml'));

    expect(result.status).to.eql('passed');
    expect(result.tests_count).to.eql(1500);
    expect(result.tests.length).to.eql(1500);

    expect(result.tests[0].title).to.eql('testvalue1');
    expect(result.tests[1].title).to.eql('testvalue2');
    expect(result.tests[1499].title).to.eql('testvalue1500');
  });

  it('should suggest increasing TESTOMATIO_MAX_ENTITY_EXPANSIONS when the parser limit is exceeded', () => {
    const tmpDir = path.join(__dirname, 'data/xmlReader/tmp');
    const tmpFile = path.join(tmpDir, 'too_many_entities.xml');
    const entityRefs = Array.from({ length: 10001 }, () => '&test;').join('');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE testsuite [
  <!ENTITY test "value">
]>
<testsuite>
  <testcase name="${entityRefs}" time="1"/>
</testsuite>`;

    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(tmpFile, xml);

    try {
      const reader = new XmlReader({ apiKey: 'test-key', lang: 'javascript' });

      expect(() => reader.parse(tmpFile)).to.throw(
        /TESTOMATIO_MAX_ENTITY_EXPANSIONS=20000 npx report-xml "\{pattern\}" --lang=\{lang\}/,
      );
    } finally {
      fs.rmSync(tmpFile, { force: true });
    }
  });
});
