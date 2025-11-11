import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import CoveragePipe from '../../src/pipe/coverage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Coverage Pipe', () => {
  let tempDir;
  let coveragePipe;

  beforeEach(() => {
    // Create a temporary directory for coverage files
    tempDir = path.join(__dirname, 'temp_coverage_' + Date.now());
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Store original env
    process.env.TESTOMATIO_COVERAGE = '1';
    process.env.TESTOMATIO_COVERAGE_FOLDER = tempDir;
  });

  afterEach(() => {
    // Cleanup temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    
    // Restore env
    delete process.env.TESTOMATIO_COVERAGE;
    delete process.env.TESTOMATIO_COVERAGE_FOLDER;
  });

  describe('Coverage Pipe Initialization', () => {
    it('should be enabled when TESTOMATIO_COVERAGE is set', () => {
      coveragePipe = new CoveragePipe({});
      expect(coveragePipe.isEnabled).to.be.true;
    });

    it('should use default coverage folder if not specified', () => {
      delete process.env.TESTOMATIO_COVERAGE_FOLDER;
      coveragePipe = new CoveragePipe({});
      expect(coveragePipe.coverageFolder).to.equal('coverage');
    });

    it('should use custom coverage folder if specified', () => {
      process.env.TESTOMATIO_COVERAGE_FOLDER = 'custom-coverage';
      coveragePipe = new CoveragePipe({});
      expect(coveragePipe.coverageFolder).to.equal('custom-coverage');
    });

    it('should be disabled when TESTOMATIO_COVERAGE is not set', () => {
      delete process.env.TESTOMATIO_COVERAGE;
      coveragePipe = new CoveragePipe({});
      expect(coveragePipe.isEnabled).to.be.false;
    });
  });

  describe('LCOV Parsing', () => {
    it('should parse lcov file correctly', () => {
      coveragePipe = new CoveragePipe({});
      
      const lcovContent = `TN:
SF:/path/to/file1.js
FNF:10
FNH:8
LF:100
LH:85
BRF:50
BRH:40
end_of_record
SF:/path/to/file2.js
FNF:5
FNH:5
LF:50
LH:45
BRF:20
BRH:18
end_of_record`;

      const lcovPath = path.join(tempDir, 'lcov.info');
      fs.writeFileSync(lcovPath, lcovContent);

      const result = coveragePipe.parseLcovFile(lcovPath);
      
      expect(result).to.not.be.null;
      expect(result.files).to.equal(2);
      expect(result.lines.total).to.equal(150);
      expect(result.lines.covered).to.equal(130);
      expect(result.lines.percent).to.be.closeTo(86.67, 0.1);
      expect(result.branches.total).to.equal(70);
      expect(result.branches.covered).to.equal(58);
      expect(result.functions.total).to.equal(15);
      expect(result.functions.covered).to.equal(13);
    });

    it('should handle empty lcov file', () => {
      coveragePipe = new CoveragePipe({});
      
      const lcovPath = path.join(tempDir, 'lcov.info');
      fs.writeFileSync(lcovPath, '');

      const result = coveragePipe.parseLcovFile(lcovPath);
      
      expect(result).to.not.be.null;
      expect(result.files).to.equal(0);
      expect(result.lines.total).to.equal(0);
      expect(result.lines.covered).to.equal(0);
    });

    it('should return null for non-existent lcov file', () => {
      coveragePipe = new CoveragePipe({});
      
      const result = coveragePipe.parseLcovFile('/non/existent/path/lcov.info');
      
      expect(result).to.be.null;
    });
  });

  describe('JSON Coverage Parsing', () => {
    it('should parse Istanbul JSON format correctly', () => {
      coveragePipe = new CoveragePipe({});
      
      const jsonContent = {
        '/path/to/file1.js': {
          s: { '0': 1, '1': 1, '2': 0, '3': 1 },
          b: { '0': [1, 0], '1': [1, 1] },
          f: { '0': 1, '1': 0 }
        },
        '/path/to/file2.js': {
          s: { '0': 1, '1': 1 },
          b: { '0': [1, 1] },
          f: { '0': 1 }
        }
      };

      const jsonPath = path.join(tempDir, 'coverage-final.json');
      fs.writeFileSync(jsonPath, JSON.stringify(jsonContent));

      const result = coveragePipe.parseJsonCoverageFile(jsonPath);
      
      expect(result).to.not.be.null;
      expect(result.files).to.equal(2);
      expect(result.lines.total).to.equal(6);
      expect(result.lines.covered).to.equal(5);
      expect(result.branches.total).to.equal(6);
      expect(result.branches.covered).to.equal(5);
      expect(result.functions.total).to.equal(3);
      expect(result.functions.covered).to.equal(2);
    });

    it('should handle empty JSON coverage file', () => {
      coveragePipe = new CoveragePipe({});
      
      const jsonPath = path.join(tempDir, 'coverage-final.json');
      fs.writeFileSync(jsonPath, '{}');

      const result = coveragePipe.parseJsonCoverageFile(jsonPath);
      
      expect(result).to.not.be.null;
      expect(result.files).to.equal(0);
    });

    it('should return null for invalid JSON file', () => {
      coveragePipe = new CoveragePipe({});
      
      const jsonPath = path.join(tempDir, 'coverage-final.json');
      fs.writeFileSync(jsonPath, 'invalid json');

      const result = coveragePipe.parseJsonCoverageFile(jsonPath);
      
      expect(result).to.be.null;
    });
  });

  describe('Coverage Collection', () => {
    it('should collect lcov file', async () => {
      coveragePipe = new CoveragePipe({});
      
      const lcovContent = `SF:/path/to/file.js
LF:100
LH:85
end_of_record`;
      
      const lcovPath = path.join(tempDir, 'lcov.info');
      fs.writeFileSync(lcovPath, lcovContent);

      const result = await coveragePipe.collectCoverageFiles();
      
      expect(result).to.not.be.null;
      expect(result.files.lcov).to.equal(lcovPath);
      expect(result.summary).to.not.be.null;
      expect(result.summary.lines.percent).to.equal(85);
    });

    it('should collect JSON coverage file', async () => {
      coveragePipe = new CoveragePipe({});
      
      const jsonContent = {
        '/path/to/file.js': {
          s: { '0': 1, '1': 1, '2': 0 }
        }
      };
      
      const jsonPath = path.join(tempDir, 'coverage-final.json');
      fs.writeFileSync(jsonPath, JSON.stringify(jsonContent));

      const result = await coveragePipe.collectCoverageFiles();
      
      expect(result).to.not.be.null;
      expect(result.files.json).to.equal(jsonPath);
      expect(result.summary).to.not.be.null;
    });

    it('should collect HTML coverage files', async () => {
      coveragePipe = new CoveragePipe({});
      
      const htmlDir = path.join(tempDir, 'lcov-report');
      fs.mkdirSync(htmlDir, { recursive: true });
      
      fs.writeFileSync(path.join(htmlDir, 'index.html'), '<html>Coverage</html>');
      fs.writeFileSync(path.join(htmlDir, 'file1.html'), '<html>File 1</html>');

      const result = await coveragePipe.collectCoverageFiles();
      
      expect(result).to.not.be.null;
      expect(result.files.html).to.be.an('array');
      expect(result.files.html.length).to.be.at.least(1);
    });

    it('should return null when coverage folder does not exist', async () => {
      process.env.TESTOMATIO_COVERAGE_FOLDER = '/non/existent/path';
      coveragePipe = new CoveragePipe({});

      const result = await coveragePipe.collectCoverageFiles();
      
      expect(result).to.be.null;
    });

    it('should prefer lcov over JSON when both exist', async () => {
      coveragePipe = new CoveragePipe({});
      
      const lcovContent = `SF:/path/to/file.js
LF:100
LH:85
end_of_record`;
      
      const lcovPath = path.join(tempDir, 'lcov.info');
      fs.writeFileSync(lcovPath, lcovContent);
      
      const jsonPath = path.join(tempDir, 'coverage-final.json');
      fs.writeFileSync(jsonPath, JSON.stringify({}));

      const result = await coveragePipe.collectCoverageFiles();
      
      expect(result).to.not.be.null;
      expect(result.summary.lines.percent).to.equal(85);
    });
  });

  describe('Coverage Pipe toString', () => {
    it('should return "Coverage" as string representation', () => {
      coveragePipe = new CoveragePipe({});
      expect(coveragePipe.toString()).to.equal('Coverage');
    });
  });
});
