import { expect } from 'chai';
import reporterFunctions from '../../src/reporter-functions.js';
import { services } from '../../src/services/index.js';
import { dataStorage } from '../../src/data-storage.js';

const { linkTest, linkJira, label, keyValue: meta } = reporterFunctions;

describe('Link Functions', () => {
  let testCounter = 0;

  beforeEach(() => {
    testCounter++;
  });

  describe('linkTest', () => {
    it('should store single test link', () => {
      const context = `test1-${testCounter}`;
      services.setContext(context);
      linkTest('TEST-123');

      const links = services.links.get(context);
      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ test: 'TEST-123' });
    });

    it('should store multiple test links', () => {
      const context = `test2-${testCounter}`;
      services.setContext(context);
      linkTest('TEST-123', 'TEST-456', 'TEST-789');

      const links = services.links.get(context);
      expect(links).to.have.length(3);
      expect(links).to.deep.equal([{ test: 'TEST-123' }, { test: 'TEST-456' }, { test: 'TEST-789' }]);
    });

    it('should store test links from array', () => {
      const context = `test3-${testCounter}`;
      services.setContext(context);
      linkTest(['TEST-123', 'TEST-456']);

      const links = services.links.get(context);
      expect(links).to.have.length(2);
      expect(links).to.deep.equal([{ test: 'TEST-123' }, { test: 'TEST-456' }]);
    });
  });

  describe('linkJira', () => {
    it('should store single JIRA link', () => {
      const context = `jira1-${testCounter}`;
      services.setContext(context);
      linkJira('PROJ-123');

      const links = services.links.get(context);
      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ jira: 'PROJ-123' });
    });

    it('should store multiple JIRA links', () => {
      const context = `jira2-${testCounter}`;
      services.setContext(context);
      linkJira('PROJ-123', 'PROJ-456', 'ISSUE-789');

      const links = services.links.get(context);
      expect(links).to.have.length(3);
      expect(links).to.deep.equal([{ jira: 'PROJ-123' }, { jira: 'PROJ-456' }, { jira: 'ISSUE-789' }]);
    });

    it('should store JIRA links from array', () => {
      const context = `jira4-${testCounter}`;
      services.setContext(context);
      linkJira(['PROJ-123', 'PROJ-456']);

      const links = services.links.get(context);
      expect(links).to.have.length(2);
      expect(links).to.deep.equal([{ jira: 'PROJ-123' }, { jira: 'PROJ-456' }]);
    });

    it('should handle various JIRA ID formats', () => {
      const context = `jira3-${testCounter}`;
      services.setContext(context);
      linkJira('PROJECT-1234', 'ABC-999', 'DEF-001');

      const links = services.links.get(context);
      expect(links).to.have.length(3);
      expect(links).to.deep.equal([{ jira: 'PROJECT-1234' }, { jira: 'ABC-999' }, { jira: 'DEF-001' }]);
    });
  });

  describe('label', () => {
    it('should store label without value', () => {
      const context = `label1-${testCounter}`;
      services.setContext(context);
      label('smoke');

      const links = services.links.get(context);
      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ label: 'smoke' });
    });

    it('should store label with value', () => {
      const context = `label2-${testCounter}`;
      services.setContext(context);
      label('severity', 'high');

      const links = services.links.get(context);
      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ label: 'severity:high' });
    });

    it('should store labels from object with single key-value', () => {
      const context = `label3-${testCounter}`;
      services.setContext(context);
      label({ severity: 'high' });

      const links = services.links.get(context);
      expect(links).to.have.length(1);
      expect(links[0]).to.deep.equal({ label: 'severity:high' });
    });

    it('should store labels from object with multiple key-values', () => {
      const context = `label4-${testCounter}`;
      services.setContext(context);
      label({ severity: 'high', priority: 'critical' });

      const links = services.links.get(context);
      expect(links).to.have.length(2);
      expect(links[0]).to.deep.equal({ label: 'severity:high' });
      expect(links[1]).to.deep.equal({ label: 'priority:critical' });
    });

    it('should store labels from object with only keys (no values)', () => {
      const context = `label5-${testCounter}`;
      services.setContext(context);
      label({ smoke: '', suite: 'auth' });

      const links = services.links.get(context);
      expect(links).to.have.length(2);
      expect(links[0]).to.deep.equal({ label: 'smoke:' });
      expect(links[1]).to.deep.equal({ label: 'suite:auth' });
    });
  });

  describe('meta (keyValue)', () => {
    it('should store meta with key-value pair', () => {
      const context = `meta1-${testCounter}`;
      services.setContext(context);
      meta('build', '123');

      const keyValueData = services.keyValues.get(context);
      expect(keyValueData).to.deep.equal({ build: '123' });
    });

    it('should store meta with object containing multiple values', () => {
      const context = `meta2-${testCounter}`;
      services.setContext(context);
      meta({ build: '123', env: 'staging' });

      const keyValueData = services.keyValues.get(context);
      expect(keyValueData).to.deep.equal({ build: '123', env: 'staging' });
    });

    it('should merge multiple meta calls', () => {
      const context = `meta3-${testCounter}`;
      services.setContext(context);
      meta({ build: '123' });
      meta({ env: 'staging' });

      const keyValueData = services.keyValues.get(context);
      expect(keyValueData).to.deep.equal({ build: '123', env: 'staging' });
    });

    it('should overwrite existing meta keys', () => {
      const context = `meta4-${testCounter}`;
      services.setContext(context);
      meta({ build: '123' });
      meta({ build: '456' });

      const keyValueData = services.keyValues.get(context);
      expect(keyValueData).to.deep.equal({ build: '456' });
    });
  });

  describe('mixed links', () => {
    it('should store different types of links together', () => {
      const context = `mixed-${testCounter}`;
      services.setContext(context);
      linkJira('PROJ-123');
      linkTest('TEST-456');
      label('smoke');
      label('priority', 'high');

      const links = services.links.get(context);
      expect(links).to.have.length(4);
      expect(links).to.deep.equal([
        { jira: 'PROJ-123' },
        { test: 'TEST-456' },
        { label: 'smoke' },
        { label: 'priority:high' },
      ]);
    });

    it('should deduplicate identical links', () => {
      const context = `dedup-${testCounter}`;
      services.setContext(context);
      linkJira('PROJ-123');
      linkJira('PROJ-123'); // duplicate
      linkTest('TEST-456');
      linkTest('TEST-456'); // duplicate
      label('smoke');
      label('smoke'); // duplicate

      const links = services.links.get(context);
      expect(links).to.have.length(3);
      expect(links).to.deep.equal([{ jira: 'PROJ-123' }, { test: 'TEST-456' }, { label: 'smoke' }]);
    });
  });

  describe('context isolation', () => {
    it('should isolate links by context', () => {
      const context1 = `context1-${testCounter}`;
      const context2 = `context2-${testCounter}`;

      services.setContext(context1);
      linkJira('PROJ-123');

      services.setContext(context2);
      linkTest('TEST-456');

      const links1 = services.links.get(context1);
      const links2 = services.links.get(context2);

      expect(links1).to.deep.equal([{ jira: 'PROJ-123' }]);
      expect(links2).to.deep.equal([{ test: 'TEST-456' }]);
    });
  });
});
