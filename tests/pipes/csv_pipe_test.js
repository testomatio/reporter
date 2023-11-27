const { expect } = require('chai');
const fs = require('fs');
const path = require("path");
const CsvPipe = require('../../lib/pipe/csv');

// test data
const DATA = [
    {
        suite_title: 'Test suite @TEST-1',
        title: 'Sample title',
        status: 'pass'
    }
];
const HEADERS = [
    { id: 'suite_title', title: 'Suite_title' },
    { id: 'title', title: 'Title' },
    { id: 'status', title: 'Status' }
];

describe('csv pipe confirmation tests', () => {
    let dir;

    before(() => {
        dir = path.resolve(process.cwd(), "export");
    });
    afterEach(async () => {
        try {
            await fs.promises.rm(dir, { recursive: true });
          } catch (err) {
            console.error(`Unknown error while deleting ${dir}.`);
          }
    });
    it('saveAsCsv function should save data to CSV file with default report.csv name', async () => {
        process.env.TESTOMATIO_CSV_FILENAME = "report.csv";

        const filepath = path.resolve(dir, "report.csv"); 

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

        process.env.TESTOMATIO_CSV_FILENAME = "test.csv";

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
});