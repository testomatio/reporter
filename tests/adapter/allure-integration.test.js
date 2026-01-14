import AllureReader from '../../src/allureReader.js';
import { expect } from 'chai';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('AllureReader Adapter', function () {
  this.timeout(60000);

  const tempDir = path.join(os.tmpdir(), 'allure-test-results');

  before(() => {
    fs.mkdirSync(tempDir, { recursive: true });
  });

  after(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Basic Functionality', () => {
    it('should parse sample Allure results and create test data', () => {
      const reader = new AllureReader({});
      const stats = reader.parse('sample_allure/backend/allure-results/*-result.json');

      expect(stats.tests_count).to.be.greaterThan(0);
      expect(reader.tests).to.be.an('array');
    });

    it('should extract test title correctly', () => {
      const reader = new AllureReader({});
      reader.parse('sample_allure/backend/allure-results/*-result.json');

      const firstTest = reader.tests[0];
      expect(firstTest).to.have.property('title');
      expect(firstTest.title).to.be.a('string');
      expect(firstTest.title).to.equal('testCanSendFoodSearchRequest');
    });

    it('should extract suite hierarchy correctly', () => {
      const reader = new AllureReader({});
      reader.parse('sample_allure/backend/allure-results/*-result.json');

      const firstTest = reader.tests[0];
      expect(firstTest).to.have.property('suite_title');
      expect(firstTest.suite_title).to.be.a('string');
      expect(firstTest.suite_title).to.equal('api-autotests');
    });

    it('should include epic and feature as links', () => {
      const reader = new AllureReader({});
      reader.parse('sample_allure/android/allure-results/*-result.json');

      const firstTest = reader.tests[0];
      expect(firstTest).to.have.property('links');
      expect(firstTest.links).to.deep.equal([
        { label: 'epic:Bands' },
        { label: 'feature:Band Steps Dashboard' },
      ]);
    });
  });
});
