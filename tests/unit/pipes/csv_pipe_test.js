import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import CsvPipe from '../../../src/pipe/csv.js';

// test data
const DATA = [
  {
    suite_title: 'Test suite @TEST-1',
    title: 'Sample title',
    status: 'pass',
  },
];
const HEADERS = [
  { id: 'suite_title', title: 'Suite_title' },
  { id: 'title', title: 'Title' },
  { id: 'status', title: 'Status' },
];

describe('csv pipe confirmation tests', () => {
  let dir;
  let customDir;

  before(() => {
    dir = path.resolve(process.cwd(), 'export');
    customDir = path.resolve(process.cwd(), 'output', 'report');
  });
  afterEach(async () => {
    try {
      await fs.promises.rm(dir, { recursive: true, force: true });
    } catch (err) {
      console.error(`Unknown error while deleting ${dir}.`);
    }
    try {
      await fs.promises.rm(path.resolve(process.cwd(), 'output'), { recursive: true, force: true });
    } catch (err) {
      console.error(`Unknown error while deleting ${customDir}.`);
    }
    delete process.env.TESTOMATIO_CSV_FILENAME;
  });
  it('saveAsCsv function should save data to CSV file with default report.csv name', async () => {
    process.env.TESTOMATIO_CSV_FILENAME = 'report.csv';

    const filepath = path.resolve(dir, 'report.csv');

    const csvPipe = new CsvPipe({}, {});

    // call the saveToCsv function with the sample data
    await csvPipe.saveToCsv(DATA, HEADERS);

    // get list of files
    const files = fs.readdirSync(dir);

    // read the saved CSV file
    const savedData = fs.readFileSync(filepath, 'utf-8');

    // check that file with test suffix was created
    expect(files[0]).equal('report.csv');
    // check that the saved data matches the input data
    expect(savedData).equal('Suite_title,Title,Status\nTest suite @TEST-1,Sample title,pass\n');
  });
  it('saveAsCsv function should save data to CSV file with name based on the current date', async () => {
    let filepath;

    process.env.TESTOMATIO_CSV_FILENAME = 'test.csv';

    const csvPipe = new CsvPipe({}, {});

    // call the saveToCsv function with the sample data
    await csvPipe.saveToCsv(DATA, HEADERS);

    // get list of files
    const files = fs.readdirSync(dir);

    filepath = path.resolve(dir, files[0]);

    // read the saved CSV file
    const savedData = fs.readFileSync(filepath, 'utf-8');

    // check that file with test suffix was created
    expect(files[0]).to.include('_test.csv');
    // check that the saved data matches the input data
    expect(savedData).equal('Suite_title,Title,Status\nTest suite @TEST-1,Sample title,pass\n');
  });

  it('enables csv report from runtime params and writes into reportDir by default', async () => {
    const csvPipe = new CsvPipe({ csv: true, reportDir: path.join('output', 'report') }, {});
    await csvPipe.saveToCsv(DATA, HEADERS);

    const filepath = path.resolve(customDir, 'report.csv');
    const savedData = fs.readFileSync(filepath, 'utf-8');

    expect(csvPipe.isEnabled).to.equal(true);
    expect(filepath).to.equal(csvPipe.outputFile);
    expect(savedData).equal('Suite_title,Title,Status\nTest suite @TEST-1,Sample title,pass\n');
  });
});
