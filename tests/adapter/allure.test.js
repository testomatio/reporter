import { expect } from 'chai';
import AllureReader from '../../src/allureReader.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('AllureReader', () => {
  let reader;
  const tempDir = path.join(os.tmpdir(), 'allure-test-results');

  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  beforeEach(() => {
    reader = new AllureReader({});
  });

  describe('Status Mapping', () => {
    it('should map passed to passed', () => {
      expect(reader.mapStatus('passed')).to.equal('passed');
    });

    it('should map failed to failed', () => {
      expect(reader.mapStatus('failed')).to.equal('failed');
    });

    it('should map broken to failed', () => {
      expect(reader.mapStatus('broken')).to.equal('failed');
    });

    it('should map skipped to skipped', () => {
      expect(reader.mapStatus('skipped')).to.equal('skipped');
    });

    it('should map pending to skipped', () => {
      expect(reader.mapStatus('pending')).to.equal('skipped');
    });

    it('should default to failed for unknown status', () => {
      expect(reader.mapStatus('unknown')).to.equal('failed');
    });
  });

  describe('Suite Title Extraction', () => {
    it('should use only suite label (epic and feature go to meta)', () => {
      const result = {
        labels: [
          { name: 'epic', value: 'Security' },
          { name: 'feature', value: 'Authentication' },
          { name: 'suite', value: 'com.example.auth.LoginTests' },
        ],
      };
      expect(reader.extractSuiteTitle(result)).to.equal('LoginTests');
    });

    it('should strip namespace from suite', () => {
      const result = {
        labels: [{ name: 'suite', value: 'org.company.project.module.TestSuite' }],
      };
      expect(reader.extractSuiteTitle(result)).to.equal('TestSuite');
    });

    it('should handle parentSuite and subSuite when no suite label', () => {
      const result = {
        labels: [
          { name: 'parentSuite', value: 'API Tests' },
          { name: 'subSuite', value: 'User Tests' },
        ],
      };
      expect(reader.extractSuiteTitle(result)).to.equal('API Tests / User Tests');
    });

    it('should handle only parentSuite', () => {
      const result = {
        labels: [{ name: 'parentSuite', value: 'LoginTests' }],
      };
      expect(reader.extractSuiteTitle(result)).to.equal('LoginTests');
    });

    it('should return Default Suite when no labels present', () => {
      const result = { labels: [] };
      expect(reader.extractSuiteTitle(result)).to.equal('Default Suite');
    });

    it('should return Default Suite when labels is missing', () => {
      const result = {};
      expect(reader.extractSuiteTitle(result)).to.equal('Default Suite');
    });
  });

  describe('Meta Field Extraction', () => {
    it('should extract non-suite labels as meta', () => {
      const result = {
        labels: [
          { name: 'language', value: 'java' },
          { name: 'framework', value: 'junit4' },
          { name: 'host', value: 'test-runner-01' },
        ],
      };
      const meta = reader.extractMeta(result);
      expect(meta).to.deep.equal({
        language: 'java',
        framework: 'junit4',
        host: 'test-runner-01',
      });
    });

    it('should exclude suite, package, epic, feature from meta', () => {
      const result = {
        labels: [
          { name: 'epic', value: 'Auth' },
          { name: 'feature', value: 'Login' },
          { name: 'suite', value: 'LoginTests' },
          { name: 'package', value: 'com.example' },
          { name: 'language', value: 'java' },
        ],
      };
      const meta = reader.extractMeta(result);
      expect(meta).to.have.keys('language');
      expect(meta).to.deep.equal({
        language: 'java',
      });
    });

    it('should return empty object when no labels', () => {
      const result = { labels: [] };
      const meta = reader.extractMeta(result);
      expect(meta).to.deep.equal({});
    });

    it('should handle undefined labels', () => {
      const result = {};
      const meta = reader.extractMeta(result);
      expect(meta).to.deep.equal({});
    });
  });

  describe('Links Extraction', () => {
    it('should extract epic and feature as links', () => {
      const result = {
        labels: [
          { name: 'epic', value: 'Security' },
          { name: 'feature', value: 'Authentication' },
        ],
      };
      const links = reader.extractLinks(result);
      expect(links).to.deep.equal([
        { label: 'epic:Security' },
        { label: 'feature:Authentication' },
      ]);
    });

    it('should return undefined when no epic or feature', () => {
      const result = {
        labels: [
          { name: 'suite', value: 'LoginTests' },
          { name: 'language', value: 'java' },
        ],
      };
      const links = reader.extractLinks(result);
      expect(links).to.be.undefined;
    });

    it('should return only epic when feature is missing', () => {
      const result = {
        labels: [{ name: 'epic', value: 'Auth' }],
      };
      const links = reader.extractLinks(result);
      expect(links).to.deep.equal([{ label: 'epic:Auth' }]);
    });

    it('should return only feature when epic is missing', () => {
      const result = {
        labels: [{ name: 'feature', value: 'Login' }],
      };
      const links = reader.extractLinks(result);
      expect(links).to.deep.equal([{ label: 'feature:Login' }]);
    });
  });

  describe('Test ID Extraction (TmsLink)', () => {
    it('should use a tms link name as the test id', () => {
      const result = {
        links: [{ name: 'T1a2b3c4d', type: 'tms', url: 'https://app.testomat.io/p/x/test/1a2b3c4d' }],
      };
      expect(reader.extractTestId(result)).to.equal('1a2b3c4d');
    });

    it('should match tms type case-insensitively', () => {
      const result = { links: [{ name: '1a2b3c4d', type: 'TMS' }] };
      expect(reader.extractTestId(result)).to.equal('1a2b3c4d');
    });

    it('should keep ids that already have no marker prefix', () => {
      const result = { links: [{ name: '00062226', type: 'tms' }] };
      expect(reader.extractTestId(result)).to.equal('00062226');
    });

    it('should fall back to a Testomat.io link even when type is null', () => {
      const result = {
        links: [{ name: '00062226', url: 'https://app.testomat.io/projects/ios-86637/test/00062226', type: null }],
      };
      expect(reader.extractTestId(result)).to.equal('00062226');
    });

    it('should derive the id from the URL when the link name is empty', () => {
      const result = {
        links: [{ name: '', type: 'tms', url: 'https://app.testomat.io/projects/x/test/abcd1234' }],
      };
      expect(reader.extractTestId(result)).to.equal('abcd1234');
    });

    it('should prefer a tms link over an unrelated link', () => {
      const result = {
        links: [
          { name: 'BUG-1', type: 'issue', url: 'https://jira/BUG-1' },
          { name: 'deadbeef', type: 'tms' },
        ],
      };
      expect(reader.extractTestId(result)).to.equal('deadbeef');
    });

    it('should ignore non-tms links that are not Testomat.io test pages', () => {
      const result = {
        links: [{ name: '102308', url: 'https://allure.betterme.world/project/37/test-cases/102308' }],
      };
      expect(reader.extractTestId(result)).to.be.null;
    });

    it('should reject a tms id that is not exactly 8 chars (e.g. Allure TestOps numeric id)', () => {
      expect(reader.extractTestId({ links: [{ name: '12345', type: 'tms' }] })).to.be.null;
      expect(reader.extractTestId({ links: [{ name: 'PROJ-123', type: 'tms' }] })).to.be.null;
      expect(reader.extractTestId({ links: [{ name: '123456789', type: 'tms' }] })).to.be.null;
    });

    it('should strip the @T prefix from a full marker', () => {
      expect(reader.extractTestId({ links: [{ name: '@T1a2b3c4d', type: 'tms' }] })).to.equal('1a2b3c4d');
    });

    it('should preserve a valid 8-char id that starts with T (not over-strip)', () => {
      // Tabcdef0 is a valid 8-char id; stripping T would corrupt it to 7 chars
      expect(reader.extractTestId({ links: [{ name: 'Tabcdef0', type: 'tms' }] })).to.equal('Tabcdef0');
    });

    it('should extract the id from a Testomat.io URL carrying a query string', () => {
      const result = {
        links: [{ name: '', type: 'tms', url: 'https://app.testomat.io/projects/x/test/abcd1234?utm=1' }],
      };
      expect(reader.extractTestId(result)).to.equal('abcd1234');
    });

    it('always yields an 8-char id when it yields one at all', () => {
      const samples = [
        { name: '1a2b3c4d', type: 'tms' },
        { name: 'T1a2b3c4d', type: 'tms' },
        { name: '@T1a2b3c4d', type: 'tms' },
        { name: '00062226', url: 'https://app.testomat.io/p/x/test/00062226', type: null },
      ];
      for (const link of samples) {
        const id = reader.extractTestId({ links: [link] });
        expect(id, `id for ${link.name || link.url}`).to.have.length(8);
      }
    });

    it('should return null when there are no links', () => {
      expect(reader.extractTestId({})).to.be.null;
      expect(reader.extractTestId({ links: [] })).to.be.null;
    });

    it('extractTmsIds returns every tms id in order, de-duplicated', () => {
      const result = {
        links: [
          { name: '00056731', type: 'tms' },
          { name: 'BUG-1', type: 'issue' },
          { name: '00056729', type: 'tms' },
          { name: '00056731', type: 'tms' },
        ],
      };
      expect(reader.extractTmsIds(result)).to.deep.equal(['00056731', '00056729']);
    });

    it('links a processed test to a tms-link case instead of setting test_id', () => {
      const result = {
        uuid: 'u-1',
        name: 'My test',
        status: 'passed',
        links: [{ name: 'T00062226', type: 'tms' }],
      };
      const test = reader.processAllureResult(result, '/tmp');
      expect(test).to.not.have.property('test_id');
      expect(test.links).to.deep.include({ test: '00062226' });
    });

    it('links a processed test to ALL tms-link cases (multiple @TmsLink)', () => {
      const result = {
        uuid: 'u-3',
        name: 'Multi link test',
        status: 'passed',
        links: [
          { name: '00056731', type: 'tms' },
          { name: '00056729', type: 'tms' },
        ],
      };
      const test = reader.processAllureResult(result, '/tmp');
      expect(test).to.not.have.property('test_id');
      expect(test.links).to.deep.include({ test: '00056731' });
      expect(test.links).to.deep.include({ test: '00056729' });
    });

    it('keeps epic/feature labels alongside linked tms cases', () => {
      const result = {
        uuid: 'u-4',
        name: 'Labelled test',
        status: 'passed',
        labels: [
          { name: 'epic', value: 'Premium Pack' },
          { name: 'feature', value: 'My Progress' },
        ],
        links: [{ name: '00056731', type: 'tms' }],
      };
      const test = reader.processAllureResult(result, '/tmp');
      expect(test.links).to.deep.include({ label: 'epic:Premium Pack' });
      expect(test.links).to.deep.include({ test: '00056731' });
    });

    it('should not set test_id or add test links when no usable link exists', () => {
      const result = { uuid: 'u-2', name: 'No link test', status: 'passed' };
      const test = reader.processAllureResult(result, '/tmp');
      expect(test).to.not.have.property('test_id');
      expect((test.links || []).some(l => l.test)).to.equal(false);
    });
  });

  describe('TmsLink linking from source', () => {
    const kotlinSource = `package com.app.tests

import org.junit.Ignore
import io.qameta.allure.TmsLink
import io.qameta.allure.TmsLinks

class CalorieTrackerTest {

    @Test
    @TmsLink("00062226")
    fun testCanLogDish() {
        // ...
    }

    @Ignore("flaky")
    @Test
    @TmsLink("00100538")
    fun testCanCheckRecentDishesListAfterRestartApp() {
        // ...
    }

    @Ignore("flaky")
    @Test
    @TmsLinks(TmsLink("00056731"), TmsLink("00056729"))
    fun testCanCheckSnapYourMealLogicForTakingPhoto() {
        // ...
    }

    @Ignore("flaky")
    @Test
    @TmsLinks(
        TmsLink("00011111"),
        TmsLink("00022222"),
    )
    fun testMultiLineContainer() {
        // ...
    }

    @Test
    fun testWithoutTmsLink() {
        // ...
    }
}
`;

    describe('extractTmsIdsFromSource', () => {
      it('reads the @TmsLink id from the matching method (skipped test)', () => {
        const test = { title: 'testCanCheckRecentDishesListAfterRestartApp' };
        expect(reader.extractTmsIdsFromSource(kotlinSource, test)).to.deep.equal(['00100538']);
      });

      it('reads ALL ids from a single-line @TmsLinks container', () => {
        const test = { title: 'testCanCheckSnapYourMealLogicForTakingPhoto' };
        expect(reader.extractTmsIdsFromSource(kotlinSource, test)).to.deep.equal(['00056731', '00056729']);
      });

      it('reads ALL ids from a multi-line @TmsLinks container', () => {
        const test = { title: 'testMultiLineContainer' };
        expect(reader.extractTmsIdsFromSource(kotlinSource, test)).to.deep.equal(['00011111', '00022222']);
      });

      it('picks the ids of the requested method, not another method in the same file', () => {
        const test = { title: 'testCanLogDish' };
        expect(reader.extractTmsIdsFromSource(kotlinSource, test)).to.deep.equal(['00062226']);
      });

      it('returns [] when the method has no @TmsLink', () => {
        expect(reader.extractTmsIdsFromSource(kotlinSource, { title: 'testWithoutTmsLink' })).to.deep.equal([]);
      });

      it('returns [] when the method is not in the file', () => {
        expect(reader.extractTmsIdsFromSource(kotlinSource, { title: 'testThatDoesNotExist' })).to.deep.equal([]);
      });

      it('works for Java method declarations', () => {
        const javaSource = `class LoginTest {
    @Disabled
    @Test
    @TmsLink("abcd1234")
    public void canLogin() {}
}`;
        expect(reader.extractTmsIdsFromSource(javaSource, { title: 'canLogin' })).to.deep.equal(['abcd1234']);
      });

      it('drops a @TmsLink value that is not a valid 8-char id', () => {
        const src = `@TmsLink("PROJ-123")\nfun testX() {}`;
        expect(reader.extractTmsIdsFromSource(src, { title: 'testX' })).to.deep.equal([]);
      });
    });

    describe('recoverTmsLinksFromSource', () => {
      let srcRoot;

      beforeEach(() => {
        srcRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'allure-src-'));
        const dir = path.join(srcRoot, 'com', 'app', 'tests');
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'CalorieTrackerTest.kt'), kotlinSource);
      });

      afterEach(() => {
        fs.rmSync(srcRoot, { recursive: true, force: true });
      });

      it('links a single-@TmsLink skipped test to its case (test_id stays unset)', () => {
        reader.opts.javaTests = srcRoot;
        reader._tests = [
          {
            title: 'testCanCheckRecentDishesListAfterRestartApp',
            status: 'skipped',
            file: 'CalorieTrackerTest.java',
            meta: { testFile: 'CalorieTrackerTest.kt' },
          },
        ];

        reader.recoverTmsLinksFromSource();

        expect(reader._tests[0]).to.not.have.property('test_id');
        expect(reader._tests[0].links).to.deep.equal([{ test: '00100538' }]);
      });

      it('links a skipped test to ALL cases from a @TmsLinks container', () => {
        reader.opts.javaTests = srcRoot;
        reader._tests = [
          {
            title: 'testCanCheckSnapYourMealLogicForTakingPhoto',
            status: 'skipped',
            file: 'CalorieTrackerTest.java',
            meta: { testFile: 'CalorieTrackerTest.kt' },
          },
        ];

        reader.recoverTmsLinksFromSource();

        expect(reader._tests[0]).to.not.have.property('test_id');
        expect(reader._tests[0].links).to.deep.equal([{ test: '00056731' }, { test: '00056729' }]);
      });

      it('keeps existing label links and appends the test links', () => {
        reader.opts.javaTests = srcRoot;
        reader._tests = [
          {
            title: 'testCanCheckSnapYourMealLogicForTakingPhoto',
            file: 'CalorieTrackerTest.java',
            links: [{ label: 'epic:Premium Pack' }],
            meta: { testFile: 'CalorieTrackerTest.kt' },
          },
        ];

        reader.recoverTmsLinksFromSource();

        expect(reader._tests[0].links).to.deep.equal([
          { label: 'epic:Premium Pack' },
          { test: '00056731' },
          { test: '00056729' },
        ]);
      });

      it('does not touch a test that already has a tms link', () => {
        reader.opts.javaTests = srcRoot;
        reader._tests = [
          {
            title: 'testCanCheckSnapYourMealLogicForTakingPhoto',
            links: [{ test: '99999999' }],
            file: 'CalorieTrackerTest.java',
            meta: { testFile: 'CalorieTrackerTest.kt' },
          },
        ];

        reader.recoverTmsLinksFromSource();

        expect(reader._tests[0].links).to.deep.equal([{ test: '99999999' }]);
      });

      it('is a no-op when no source root is configured', () => {
        reader.opts.javaTests = undefined;
        reader._tests = [{ title: 'testCanCheckRecentDishesListAfterRestartApp', meta: {} }];

        reader.recoverTmsLinksFromSource();

        expect((reader._tests[0].links || []).some(l => l.test)).to.equal(false);
      });

      it('leaves a test unlinked when its method has no @TmsLink', () => {
        reader.opts.javaTests = srcRoot;
        reader._tests = [
          {
            title: 'testWithoutTmsLink',
            file: 'CalorieTrackerTest.java',
            meta: { testFile: 'CalorieTrackerTest.kt' },
          },
        ];

        reader.recoverTmsLinksFromSource();

        expect((reader._tests[0].links || []).some(l => l.test)).to.equal(false);
      });
    });

    describe('applyPrimaryTestIdFromLinks', () => {
      it('adopts the first linked case as test_id when test_id is missing', () => {
        reader._tests = [{ title: 't', links: [{ label: 'epic:X' }, { test: '00056731' }, { test: '00056729' }] }];

        reader.applyPrimaryTestIdFromLinks();

        expect(reader._tests[0].test_id).to.equal('00056731');
        // every linked case is still kept
        expect(reader._tests[0].links).to.deep.include({ test: '00056729' });
      });

      it('does not override an existing (native) test_id', () => {
        reader._tests = [{ title: 't', test_id: 'deadbeef', links: [{ test: '00056731' }] }];

        reader.applyPrimaryTestIdFromLinks();

        expect(reader._tests[0].test_id).to.equal('deadbeef');
      });

      it('leaves test_id unset when there are no linked cases', () => {
        reader._tests = [{ title: 't', links: [{ label: 'epic:X' }] }];

        reader.applyPrimaryTestIdFromLinks();

        expect(reader._tests[0]).to.not.have.property('test_id');
      });
    });
  });

  describe('Step Conversion', () => {
    it('should convert simple step', () => {
      const step = {
        name: 'Login',
        start: 1234567891000,
        stop: 1234567892000,
        status: 'passed',
        steps: [],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted).to.deep.equal({
        category: 'user',
        title: 'Login',
        status: 'passed',
        duration: 1,
      });
    });

    it('should apply passed status to a passing step', () => {
      const converted = reader.convertSteps([{ name: 'ok', status: 'passed', steps: [] }])[0];
      expect(converted.status).to.equal('passed');
    });

    it('should apply failed status to a failing step', () => {
      const converted = reader.convertSteps([{ name: 'boom', status: 'failed', steps: [] }])[0];
      expect(converted.status).to.equal('failed');
    });

    it('should map a broken step to failed', () => {
      const converted = reader.convertSteps([{ name: 'oops', status: 'broken', steps: [] }])[0];
      expect(converted.status).to.equal('failed');
    });

    it('should map a skipped step to none', () => {
      const converted = reader.convertSteps([{ name: 'skip', status: 'skipped', steps: [] }])[0];
      expect(converted.status).to.equal('none');
    });

    it('should default to none when a step has no status', () => {
      const converted = reader.convertSteps([{ name: 'no status', steps: [] }])[0];
      expect(converted.status).to.equal('none');
    });

    it('should attach error (message + trace) to a failed step', () => {
      const step = {
        name: 'I see "Welcome"',
        status: 'failed',
        statusDetails: {
          message: 'Expected "Welcome" but got "Goodbye"',
          trace: 'AssertionError\n    at LoginTest.java:42',
        },
        steps: [],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.status).to.equal('failed');
      expect(converted.error).to.deep.equal({
        message: 'Expected "Welcome" but got "Goodbye"',
        stack: 'AssertionError\n    at LoginTest.java:42',
      });
    });

    it('should attach error to a broken step', () => {
      const step = {
        name: 'I click "Submit"',
        status: 'broken',
        statusDetails: { message: 'Element not found', trace: 'at page.js:10' },
        steps: [],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.error).to.deep.equal({ message: 'Element not found', stack: 'at page.js:10' });
    });

    it('should not attach error to a passing step', () => {
      const converted = reader.convertSteps([
        { name: 'ok', status: 'passed', statusDetails: { message: 'ignored' }, steps: [] },
      ])[0];
      expect(converted).to.not.have.property('error');
    });

    it('should not attach error to a failed step without statusDetails', () => {
      const converted = reader.convertSteps([{ name: 'boom', status: 'failed', steps: [] }])[0];
      expect(converted).to.not.have.property('error');
    });

    it('should attach error to a failed nested step', () => {
      const step = {
        name: 'Outer',
        status: 'failed',
        steps: [
          {
            name: 'Inner',
            status: 'failed',
            statusDetails: { message: 'inner boom', trace: 'at inner.js:5' },
            steps: [],
          },
        ],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.steps[0].error).to.deep.equal({ message: 'inner boom', stack: 'at inner.js:5' });
    });

    it('should keep the error on the deepest failed step only, not on its failed ancestors', () => {
      // Allure propagates the failure statusDetails up the whole chain, so the
      // parent step carries the same message as the failing child. Only the
      // child (the real failure point) should surface the error.
      const step = {
        name: 'Check the description of Typical day screen',
        status: 'failed',
        statusDetails: { message: 'Failed AssertTextEquals', trace: 'at outer.js:1' },
        steps: [
          { name: 'Assert title', status: 'passed', steps: [] },
          {
            name: 'Assert description',
            status: 'failed',
            statusDetails: { message: 'Failed AssertTextEquals', trace: 'at inner.js:5' },
            steps: [],
          },
        ],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted).to.not.have.property('error');
      expect(converted.steps[0]).to.not.have.property('error');
      expect(converted.steps[1].error).to.deep.equal({
        message: 'Failed AssertTextEquals',
        stack: 'at inner.js:5',
      });
    });

    it('should surface the error on the nearest failed ancestor when the deepest failed step has no statusDetails', () => {
      const step = {
        name: 'Outer',
        status: 'failed',
        statusDetails: { message: 'boom', trace: 'at outer.js:1' },
        steps: [{ name: 'Inner', status: 'failed', steps: [] }],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.error).to.deep.equal({ message: 'boom', stack: 'at outer.js:1' });
      expect(converted.steps[0]).to.not.have.property('error');
    });

    it('should apply status to nested steps as well', () => {
      const step = {
        name: 'Outer',
        status: 'failed',
        steps: [{ name: 'Inner', status: 'failed', steps: [] }],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.status).to.equal('failed');
      expect(converted.steps[0].status).to.equal('failed');
    });

    it('should convert nested steps', () => {
      const step = {
        name: 'Outer step',
        start: 1234567890000,
        stop: 1234567895000,
        steps: [
          {
            name: 'Inner step',
            start: 1234567891000,
            stop: 1234567892000,
            steps: [],
          },
        ],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.steps).to.have.lengthOf(1);
      expect(converted.steps[0].title).to.equal('Inner step');
    });

    it('should use title as fallback if name missing', () => {
      const step = {
        title: 'Test title',
        start: 1234567891000,
        stop: 1234567892000,
        steps: [],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.title).to.equal('Test title');
    });

    it('should use Unknown step as fallback', () => {
      const step = {
        start: 1234567891000,
        stop: 1234567892000,
        steps: [],
      };
      const converted = reader.convertSteps([step])[0];
      expect(converted.title).to.equal('Unknown step');
    });

    it('should filter out steps beyond depth 10', () => {
      let currentStep = { name: 'Level 1', start: 1000, stop: 2000, steps: [] };

      for (let i = 2; i <= 12; i++) {
        const newStep = { name: `Level ${i}`, start: i * 1000, stop: (i + 1) * 1000, steps: [] };
        currentStep.steps.push(newStep);
        currentStep = newStep;
      }

      const converted = reader.convertSteps([currentStep])[0];
      expect(converted).to.be.ok;
    });

    it('should return empty array for no steps', () => {
      const converted = reader.convertSteps([]);
      expect(converted).to.deep.equal([]);
    });
  });

  describe('Retry Attempts Combination', () => {
    it('should return single test without retries when only one attempt', () => {
      const attempts = [
        { _stop: 1000, status: 'passed', title: 'test1' },
      ];
      const result = reader.combineRetryAttempts(attempts);

      expect(result.status).to.equal('passed');
      expect(result.retries).to.be.undefined;
    });

    it('should set retries count when multiple attempts', () => {
      const attempts = [
        { _stop: 1000, status: 'failed', title: 'test1', message: 'fail 1' },
        { _stop: 2000, status: 'passed', title: 'test1' },
      ];
      const result = reader.combineRetryAttempts(attempts);

      expect(result.retries).to.equal(1);
    });

    it('should combine failure messages from all failed attempts', () => {
      const attempts = [
        { _stop: 1000, status: 'failed', title: 'test1', message: 'AssertionError: expected 5', stack: 'stack1' },
        { _stop: 2000, status: 'failed', title: 'test1', message: 'TimeoutError', stack: 'stack2' },
      ];
      const result = reader.combineRetryAttempts(attempts);

      expect(result.message).to.contain('[Attempt 1] AssertionError: expected 5');
      expect(result.message).to.contain('[Attempt 2] TimeoutError');
      expect(result.stack).to.contain('--- Attempt 1 ---');
      expect(result.stack).to.contain('stack1');
      expect(result.stack).to.contain('--- Attempt 2 ---');
      expect(result.stack).to.contain('stack2');
    });

    it('should mark as passed and keep failure history when test passed after retries', () => {
      const attempts = [
        { _stop: 1000, status: 'failed', title: 'test1', message: 'first fail', stack: 'trace1' },
        { _stop: 2000, status: 'failed', title: 'test1', message: 'second fail', stack: 'trace2' },
        { _stop: 3000, status: 'passed', title: 'test1' },
      ];
      const result = reader.combineRetryAttempts(attempts);

      expect(result.status).to.equal('passed');
      expect(result.retries).to.equal(2);
      expect(result.message).to.contain('Test passed after 2 retries');
      expect(result.message).to.contain('[Attempt 1] first fail');
      expect(result.stack).to.contain('--- Attempt 1 ---');
    });

    it('should handle three failed attempts', () => {
      const attempts = [
        { _stop: 1000, status: 'failed', title: 'test1', message: 'fail1', stack: 'trace1' },
        { _stop: 2000, status: 'failed', title: 'test1', message: 'fail2', stack: 'trace2' },
        { _stop: 3000, status: 'failed', title: 'test1', message: 'fail3', stack: 'trace3' },
      ];
      const result = reader.combineRetryAttempts(attempts);

      expect(result.status).to.equal('failed');
      expect(result.retries).to.equal(2);
      expect(result.message).to.contain('[Attempt 1] fail1');
      expect(result.message).to.contain('[Attempt 2] fail2');
      expect(result.message).to.contain('[Attempt 3] fail3');
    });

    it('should keep original message and stack when no failures', () => {
      const attempts = [
        { _stop: 1000, status: 'passed', title: 'test1' },
        { _stop: 2000, status: 'passed', title: 'test1' },
      ];
      const result = reader.combineRetryAttempts(attempts);

      expect(result.status).to.equal('passed');
      expect(result.retries).to.equal(1);
    });
  });

  describe('Parameter Conversion', () => {
    it('should convert parameters array to object', () => {
      const result = {
        parameters: [
          { name: 'username', value: 'testuser' },
          { name: 'password', value: 'secret123' },
        ],
      };
      const example = reader.convertParameters(result.parameters);
      expect(example).to.deep.equal({
        username: 'testuser',
        password: 'secret123',
      });
    });

    it('should handle empty parameters', () => {
      const result = { parameters: [] };
      const example = reader.convertParameters(result.parameters);
      expect(example).to.deep.equal({});
    });

    it('should handle parameters without name', () => {
      const result = {
        parameters: [{ value: 'anonymous' }, { name: 'key', value: 'value' }],
      };
      const example = reader.convertParameters(result.parameters);
      expect(example).to.deep.equal({ key: 'value' });
    });
  });

  describe('Run Time Calculation', () => {
    it('should calculate run time in seconds', () => {
      const item = {
        start: 1234567890000,
        stop: 1234567895000,
      };
      const runTime = reader.calculateRunTime(item);
      expect(runTime).to.equal(5);
    });

    it('should return null when start or stop missing', () => {
      const item1 = { start: 1234567890000 };
      expect(reader.calculateRunTime(item1)).to.be.null;

      const item2 = { stop: 1234567895000 };
      expect(reader.calculateRunTime(item2)).to.be.null;
    });
  });

  describe('File Path Extraction', () => {
    it('should extract class name from fullName when testClass label missing', () => {
      const result = {
        labels: [
          { name: 'package', value: 'com.example.auth' },
          { name: 'language', value: 'java' },
        ],
        fullName: 'com.example.auth.LoginTests.testLogin',
      };
      const filePath = reader.extractFile(result);
      expect(filePath).to.equal('LoginTests.java');
    });

    it('should use testClass label when available', () => {
      const result = {
        labels: [
          { name: 'package', value: 'com.example' },
          { name: 'testClass', value: 'com.example.MyTests' },
          { name: 'language', value: 'kotlin' },
        ],
        fullName: 'com.example.MyTests.testMethod',
      };
      const filePath = reader.extractFile(result);
      expect(filePath).to.equal('MyTests.kt');
    });

    it('should default to java extension when language label missing', () => {
      const result = {
        labels: [{ name: 'package', value: 'com.example' }],
        fullName: 'com.example.Tests.testCase',
      };
      const filePath = reader.extractFile(result);
      expect(filePath).to.equal('Tests.java');
    });

    it('should return null when package label missing', () => {
      const result = {
        labels: [],
        fullName: 'Tests.testCase',
      };
      const filePath = reader.extractFile(result);
      expect(filePath).to.be.null;
    });

    it('should return null when fullName missing', () => {
      const result = {
        labels: [{ name: 'package', value: 'com.example' }],
      };
      const filePath = reader.extractFile(result);
      expect(filePath).to.be.null;
    });

    it('should include full package path when withPackage is true', () => {
      const readerWithPackage = new AllureReader({ withPackage: true });
      const result = {
        labels: [
          { name: 'package', value: 'com.example.auth' },
          { name: 'language', value: 'java' },
        ],
        fullName: 'com.example.auth.LoginTests.testLogin',
      };
      const filePath = readerWithPackage.extractFile(result);
      expect(filePath).to.equal('com/example/auth/LoginTests.java');
    });
  });

  describe('Full Result Processing', () => {
    it('should process complete result object', () => {
      const result = {
        uuid: 'test-uuid-123',
        name: 'testLogin',
        fullName: 'com.example.auth.LoginTests.testLogin',
        status: 'passed',
        start: 1234567890000,
        stop: 1234567900000,
        steps: [
          {
            name: 'Open page',
            start: 1234567891000,
            stop: 1234567892000,
            steps: [],
          },
        ],
        labels: [
          { name: 'suite', value: 'LoginTests' },
          { name: 'package', value: 'com.example.auth' },
          { name: 'language', value: 'java' },
        ],
      };

      const converted = reader.processAllureResult(result, tempDir);

      expect(converted.title).to.equal('testLogin');
      expect(converted.suite_title).to.equal('LoginTests');
      expect(converted.status).to.equal('passed');
      expect(converted.run_time).to.equal(10);
      expect(converted.steps).to.have.lengthOf(1);
      expect(converted.steps[0].title).to.equal('Open page');
      expect(converted.meta).to.deep.equal({ language: 'java' });
      expect(converted.rid).to.equal('test-uuid-123');
    });

    it('should process result with broken status', () => {
      const result = {
        uuid: 'test-uuid-456',
        name: 'testError',
        status: 'broken',
        statusDetails: {
          message: 'Test failed unexpectedly',
          trace: 'Error at line 42',
        },
        start: 1234567890000,
        stop: 1234567892000,
        steps: [],
        labels: [{ name: 'suite', value: 'ErrorTests' }],
      };

      const converted = reader.processAllureResult(result, tempDir);

      expect(converted.status).to.equal('failed');
      expect(converted.message).to.equal('Test failed unexpectedly');
      expect(converted.stack).to.equal('Error at line 42');
    });

    it('should process result with parameters', () => {
      const result = {
        uuid: 'test-uuid-789',
        name: 'testWithParams',
        status: 'passed',
        start: 1234567890000,
        stop: 1234567900000,
        parameters: [
          { name: 'browser', value: 'chrome' },
          { name: 'version', value: '120' },
        ],
        steps: [],
        labels: [],
      };

      const converted = reader.processAllureResult(result, tempDir);

      expect(converted.example).to.deep.equal({
        browser: 'chrome',
        version: '120',
      });
    });

    it('should handle result without uuid by generating random one', () => {
      const result = {
        name: 'testWithoutUuid',
        status: 'passed',
        start: 1234567890000,
        stop: 1234567900000,
        steps: [],
        labels: [],
      };

      const converted = reader.processAllureResult(result, tempDir);

      expect(converted.rid).to.be.a('string');
      expect(converted.rid).to.have.lengthOf(36); // UUID format
    });
  });

  describe('Stats Calculation', () => {
    beforeEach(() => {
      reader.tests = [
        { status: 'passed', run_time: 1 },
        { status: 'passed', run_time: 2 },
        { status: 'failed', run_time: 3 },
        { status: 'skipped', run_time: 0 },
      ];
    });

    it('should calculate correct test counts', () => {
      const stats = reader.calculateStats();

      expect(stats.tests_count).to.equal(4);
      expect(stats.passed_count).to.equal(2);
      expect(stats.failed_count).to.equal(1);
      expect(stats.skipped_count).to.equal(1);
    });

    it('should calculate total duration', () => {
      const stats = reader.calculateStats();

      expect(stats.duration).to.equal(6);
    });

    it('should set status to failed when there are failures', () => {
      const stats = reader.calculateStats();

      expect(stats.status).to.equal('failed');
    });

    it('should set status to passed when no failures', () => {
      reader.tests = [
        { status: 'passed', run_time: 1 },
        { status: 'passed', run_time: 2 },
      ];
      const stats = reader.calculateStats();

      expect(stats.status).to.equal('passed');
    });

    it('should include all required stats fields', () => {
      const stats = reader.calculateStats();

      expect(stats).to.have.keys(
        'create_tests',
        'tests_count',
        'passed_count',
        'failed_count',
        'skipped_count',
        'duration',
        'status',
        'tests',
      );
    });
  });

  describe('Container File Parsing', () => {
    it('should parse container file and map test uuids to suite names', () => {
      const containerPath = path.join(tempDir, 'test-container.json');
      const containerData = {
        uuid: 'container-uuid-123',
        name: 'Test Suite',
        children: ['test-uuid-1', 'test-uuid-2', 'test-uuid-3'],
      };

      fs.writeFileSync(containerPath, JSON.stringify(containerData));

      reader.parseContainerFiles([containerPath]);

      expect(reader.suites['test-uuid-1']).to.equal('Test Suite');
      expect(reader.suites['test-uuid-2']).to.equal('Test Suite');
      expect(reader.suites['test-uuid-3']).to.equal('Test Suite');
    });

    it('should handle malformed container file gracefully', () => {
      const containerPath = path.join(tempDir, 'bad-container.json');
      fs.writeFileSync(containerPath, 'invalid json');

      expect(() => reader.parseContainerFiles([containerPath])).to.not.throw();
    });

    it('should handle container file without children', () => {
      const containerPath = path.join(tempDir, 'no-children-container.json');
      const containerData = {
        uuid: 'container-uuid-456',
        name: 'Empty Suite',
      };

      fs.writeFileSync(containerPath, JSON.stringify(containerData));

      reader.parseContainerFiles([containerPath]);

      expect(reader.suites).to.be.empty;
    });
  });

  describe('Integration Tests with Sample Files', () => {
    beforeEach(() => {
      reader = new AllureReader({});
      fs.rmSync(tempDir, { recursive: true, force: true });
      fs.mkdirSync(tempDir, { recursive: true });
    });

    it('should parse directory and process all result files', () => {
      const result1Path = path.join(tempDir, 'test1-result.json');
      const result2Path = path.join(tempDir, 'test2-result.json');

      const result1 = {
        uuid: 'uuid-1',
        name: 'test1',
        status: 'passed',
        start: 1000,
        stop: 2000,
        steps: [],
        labels: [{ name: 'suite', value: 'TestSuite1' }],
      };

      const result2 = {
        uuid: 'uuid-2',
        name: 'test2',
        status: 'failed',
        start: 3000,
        stop: 5000,
        steps: [],
        labels: [{ name: 'suite', value: 'TestSuite2' }],
      };

      fs.writeFileSync(result1Path, JSON.stringify(result1));
      fs.writeFileSync(result2Path, JSON.stringify(result2));

      const stats = reader.parse(path.join(tempDir, '*-result.json'));

      expect(stats.tests_count).to.equal(2);
      expect(reader.tests).to.have.lengthOf(2);

      const test1 = reader.tests.find(t => t.title === 'test1');
      const test2 = reader.tests.find(t => t.title === 'test2');

      expect(test1).to.exist;
      expect(test2).to.exist;
      expect(test1.title).to.equal('test1');
      expect(test2.title).to.equal('test2');
    });

    it('should skip malformed result files', () => {
      const resultPath1 = path.join(tempDir, 'valid-result.json');
      const resultPath2 = path.join(tempDir, 'invalid-result.json');

      const validResult = {
        uuid: 'uuid-1',
        name: 'validTest',
        status: 'passed',
        start: 1000,
        stop: 2000,
        steps: [],
        labels: [],
      };

      fs.writeFileSync(resultPath1, JSON.stringify(validResult));
      fs.writeFileSync(resultPath2, 'invalid json content');

      const stats = reader.parse(path.join(tempDir, '*-result.json'));

      expect(stats.tests_count).to.equal(1);
      expect(reader.tests).to.have.lengthOf(1);
    });

    it('should skip malformed result files', () => {
      const resultPath1 = path.join(tempDir, 'valid-result.json');
      const resultPath2 = path.join(tempDir, 'invalid-result.json');

      const validResult = {
        uuid: 'uuid-1',
        name: 'validTest',
        status: 'passed',
        start: 1000,
        stop: 2000,
        steps: [],
        labels: [],
      };

      fs.writeFileSync(resultPath1, JSON.stringify(validResult));
      fs.writeFileSync(resultPath2, 'invalid json content');

      const stats = reader.parse(path.join(tempDir, '*-result.json'));

      expect(stats.tests_count).to.equal(1);
      expect(reader.tests).to.have.lengthOf(1);
    });

    it('should handle empty results directory', () => {
      const emptyDir = path.join(tempDir, 'empty');
      fs.mkdirSync(emptyDir, { recursive: true });

      expect(() => reader.parse(path.join(emptyDir, '*-result.json'))).to.throw();
    });
  });
});
