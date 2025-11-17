import createDebugMessages from 'debug';
import fs from 'fs';
import path from 'path';
import pc from 'picocolors';
import { glob } from 'glob';
import { APP_PREFIX, COVERAGE_REPORT } from '../constants.js';

const debug = createDebugMessages('@testomatio/reporter:pipe:coverage');

/**
 * CoveragePipe - Handles code coverage reporting
 * @class CoveragePipe
 */
class CoveragePipe {
  constructor(params, store = {}) {
    this.store = store || {};
    this.apiKey = params.apiKey || process.env.TESTOMATIO;
    this.isEnabled = false;
    this.coverageData = null;
    this.coverageFiles = [];

    // Check if coverage reporting is enabled
    const enableCoverage = process.env.TESTOMATIO_COVERAGE;
    const coverageFolder = process.env.TESTOMATIO_COVERAGE_FOLDER || COVERAGE_REPORT.DEFAULT_FOLDER;

    if (enableCoverage) {
      this.isEnabled = true;
      this.coverageFolder = coverageFolder;
      
      debug(
        pc.yellow('Coverage Pipe:'),
        `Enabled: ${this.isEnabled}`,
        `Coverage folder: ${this.coverageFolder}`,
      );
    }
  }

  async createRun() {
    // Coverage is attached to run, not created separately
  }

  async prepareRun() {
    // No preparation needed for coverage
  }

  updateRun() {
    // Empty - coverage is collected at the end
  }

  /**
   * Add test data - coverage is collected separately
   * @param {import('../../types/types.js').RunData} test
   */
  addTest(test) {
    // Coverage is not per-test in this implementation
  }

  /**
   * Parse lcov.info file to extract coverage summary
   * @param {string} lcovPath - Path to lcov.info file
   * @returns {Object} Coverage summary
   */
  parseLcovFile(lcovPath) {
    try {
      const content = fs.readFileSync(lcovPath, 'utf8');
      const lines = content.split('\n');
      
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let files = 0;

      for (const line of lines) {
        if (line.startsWith('SF:')) {
          files++;
        } else if (line.startsWith('LF:')) {
          totalLines += parseInt(line.split(':')[1], 10) || 0;
        } else if (line.startsWith('LH:')) {
          coveredLines += parseInt(line.split(':')[1], 10) || 0;
        } else if (line.startsWith('BRF:')) {
          totalBranches += parseInt(line.split(':')[1], 10) || 0;
        } else if (line.startsWith('BRH:')) {
          coveredBranches += parseInt(line.split(':')[1], 10) || 0;
        } else if (line.startsWith('FNF:')) {
          totalFunctions += parseInt(line.split(':')[1], 10) || 0;
        } else if (line.startsWith('FNH:')) {
          coveredFunctions += parseInt(line.split(':')[1], 10) || 0;
        }
      }

      const linePercent = totalLines > 0 ? ((coveredLines / totalLines) * 100).toFixed(2) : '0';
      const branchPercent = totalBranches > 0 ? ((coveredBranches / totalBranches) * 100).toFixed(2) : '0';
      const functionPercent = totalFunctions > 0 ? ((coveredFunctions / totalFunctions) * 100).toFixed(2) : '0';

      return {
        files,
        lines: { total: totalLines, covered: coveredLines, percent: parseFloat(linePercent) },
        branches: { total: totalBranches, covered: coveredBranches, percent: parseFloat(branchPercent) },
        functions: { total: totalFunctions, covered: coveredFunctions, percent: parseFloat(functionPercent) },
      };
    } catch (err) {
      debug('Error parsing lcov file:', err);
      return null;
    }
  }

  /**
   * Parse JSON coverage report
   * @param {string} jsonPath - Path to coverage JSON file
   * @returns {Object} Coverage summary
   */
  parseJsonCoverageFile(jsonPath) {
    try {
      const content = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      
      let totalLines = 0;
      let coveredLines = 0;
      let totalBranches = 0;
      let coveredBranches = 0;
      let totalFunctions = 0;
      let coveredFunctions = 0;
      let files = 0;

      // Handle different JSON coverage formats (istanbul/nyc format)
      Object.keys(content).forEach(file => {
        if (file === 'total') return; // Skip total if present
        files++;
        const fileCoverage = content[file];
        
        // Handle Istanbul format (has s, b, f keys)
        if (fileCoverage.s) {
          const statements = Object.values(fileCoverage.s);
          totalLines += statements.length;
          coveredLines += statements.filter(s => s > 0).length;
        } else if (fileCoverage.lines) {
          // Handle coverage summary format
          const lines = fileCoverage.lines;
          totalLines += lines.total || 0;
          coveredLines += lines.covered || 0;
        }
        
        if (fileCoverage.b) {
          const branches = Object.values(fileCoverage.b);
          branches.forEach(branch => {
            totalBranches += branch.length;
            coveredBranches += branch.filter(b => b > 0).length;
          });
        } else if (fileCoverage.branches) {
          // Handle coverage summary format
          const branches = fileCoverage.branches;
          totalBranches += branches.total || 0;
          coveredBranches += branches.covered || 0;
        }
        
        if (fileCoverage.f) {
          const functions = Object.values(fileCoverage.f);
          totalFunctions += functions.length;
          coveredFunctions += functions.filter(f => f > 0).length;
        } else if (fileCoverage.functions) {
          // Handle coverage summary format
          const functions = fileCoverage.functions;
          totalFunctions += functions.total || 0;
          coveredFunctions += functions.covered || 0;
        }
      });

      const linePercent = totalLines > 0 ? ((coveredLines / totalLines) * 100).toFixed(2) : '0';
      const branchPercent = totalBranches > 0 ? ((coveredBranches / totalBranches) * 100).toFixed(2) : '0';
      const functionPercent = totalFunctions > 0 ? ((coveredFunctions / totalFunctions) * 100).toFixed(2) : '0';

      return {
        files,
        lines: { total: totalLines, covered: coveredLines, percent: parseFloat(linePercent) },
        branches: { total: totalBranches, covered: coveredBranches, percent: parseFloat(branchPercent) },
        functions: { total: totalFunctions, covered: coveredFunctions, percent: parseFloat(functionPercent) },
      };
    } catch (err) {
      debug('Error parsing JSON coverage file:', err);
      return null;
    }
  }

  /**
   * Collect coverage files from the coverage folder
   * @returns {Promise<Object>} Coverage data and file paths
   */
  async collectCoverageFiles() {
    if (!this.isEnabled) return null;

    const coveragePath = path.resolve(process.cwd(), this.coverageFolder);
    
    if (!fs.existsSync(coveragePath)) {
      console.log(APP_PREFIX, pc.yellow(`Coverage folder not found: ${coveragePath}`));
      return null;
    }

    const files = {
      lcov: null,
      html: [],
      json: null,
    };

    // Look for lcov.info
    const lcovPath = path.join(coveragePath, COVERAGE_REPORT.LCOV_REPORT_FILE);
    if (fs.existsSync(lcovPath)) {
      files.lcov = lcovPath;
      debug('Found lcov file:', lcovPath);
    }

    // Look for coverage JSON
    const jsonPath = path.join(coveragePath, COVERAGE_REPORT.JSON_REPORT_FILE);
    if (fs.existsSync(jsonPath)) {
      files.json = jsonPath;
      debug('Found JSON coverage file:', jsonPath);
    }

    // Look for HTML reports
    const htmlReportPath = path.join(coveragePath, COVERAGE_REPORT.HTML_REPORT_FOLDER);
    if (fs.existsSync(htmlReportPath)) {
      const htmlFiles = await glob('**/*.html', { cwd: htmlReportPath, absolute: true });
      files.html = htmlFiles;
      debug(`Found ${htmlFiles.length} HTML coverage files`);
    }

    // Parse coverage data
    let coverageSummary = null;
    if (files.lcov) {
      coverageSummary = this.parseLcovFile(files.lcov);
    } else if (files.json) {
      coverageSummary = this.parseJsonCoverageFile(files.json);
    }

    if (coverageSummary) {
      console.log(APP_PREFIX, pc.green('Coverage summary:'));
      console.log(
        APP_PREFIX,
        `  Lines: ${coverageSummary.lines.percent}% (${coverageSummary.lines.covered}/${coverageSummary.lines.total})`
      );
      console.log(
        APP_PREFIX,
        `  Branches: ${coverageSummary.branches.percent}% ` +
        `(${coverageSummary.branches.covered}/${coverageSummary.branches.total})`
      );
      console.log(
        APP_PREFIX,
        `  Functions: ${coverageSummary.functions.percent}% ` +
        `(${coverageSummary.functions.covered}/${coverageSummary.functions.total})`
      );
      console.log(APP_PREFIX, `  Files: ${coverageSummary.files}`);
    }

    return {
      files,
      summary: coverageSummary,
    };
  }

  /**
   * Finish run and collect coverage data
   * @param {Object} runParams - Run parameters
   */
  async finishRun(runParams) {
    if (!this.isEnabled) return;

    console.log(APP_PREFIX, pc.cyan('Collecting code coverage...'));

    const coverageData = await this.collectCoverageFiles();
    
    if (!coverageData || !coverageData.summary) {
      console.log(APP_PREFIX, pc.yellow('No coverage data found'));
      return;
    }

    this.coverageData = coverageData;
    this.coverageFiles = coverageData.files;

    // Store coverage data for uploader
    if (this.store) {
      this.store.coverage = {
        summary: coverageData.summary,
        files: coverageData.files,
      };
    }

    console.log(APP_PREFIX, pc.green('✓ Coverage data collected'));
  }

  toString() {
    return 'CodeCoverage';
  }
}

export default CoveragePipe;
