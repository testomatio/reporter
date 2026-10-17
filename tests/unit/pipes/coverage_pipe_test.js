import { expect } from 'chai';
import ServerMock from 'mock-http-server';
import fs from 'fs';
import path from 'path';
import CoveragePipe from '../../../src/pipe/coverage.js';
import { config } from '../../adapter/config/index.js';
import { fileURLToPath } from 'url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const { host, port, TESTOMATIO_URL, TESTOMATIO } = config;

const TEMP_COVER_DIR = path.join(dirname, 'pipe-tmp');
const TEMP_COVERAGE_FILE = path.join(TEMP_COVER_DIR, 'temp_coverage.yml');

describe('CoveragePipe: general positive cases.', () => {
    const server = new ServerMock({ host, port });
    let coveragePipe;
    let originalEnv;

    before(done => {
        // Ensure clean temp directory
        if (!fs.existsSync(TEMP_COVER_DIR)) {
            fs.mkdirSync(TEMP_COVER_DIR);
            console.log(`[mock-tmp-folder]: tmp folder was created - ${TEMP_COVER_DIR}`);
        }

        process.env.COVERAGE_BY_DEFAULT_GIT_FILE = "1";
        process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;

        coveragePipe = new CoveragePipe({
            apiKey: TESTOMATIO,
            testomatioUrl: TESTOMATIO_URL,
            batchMode: 'disabled',
            pipeOptions: `file=${TEMP_COVERAGE_FILE}`
        });

        server.start(() => {
            console.log(`[mock-http-server]: Started at ${TESTOMATIO_URL}`);
            done();
        });
    });

    after(done => {
        delete process.env.COVERAGE_FILEPATH;
        delete process.env.TESTOMATIO_URL;
        delete process.env['INPUT_TESTOMATIO-KEY'];
        delete process.env.COVERAGE_BY_DEFAULT_GIT_FILE;

        coveragePipe = undefined;

        // Cleanup temp directory
        if (fs.existsSync(TEMP_COVER_DIR)) {
            fs.readdirSync(TEMP_COVER_DIR).forEach(file => {
                fs.unlinkSync(path.join(TEMP_COVER_DIR, file));
            });
            fs.rmdirSync(TEMP_COVER_DIR);
            console.log(`[mock-tmp-folder]: tmp folder was removed - ${TEMP_COVER_DIR}`);
        }

        server.stop(() => {
            console.log(`[mock-http-server]: Stopped`);
            done();
        });
    });

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.TESTOMATIO_URL = TESTOMATIO_URL;
        // process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
        process.env['INPUT_TESTOMATIO-KEY'] = TESTOMATIO;
    });

    afterEach(() => {
        process.env = originalEnv;

        fs.readdirSync(TEMP_COVER_DIR).forEach(file => {
            fs.unlinkSync(path.join(TEMP_COVER_DIR, file));
        });
    });

    describe('coverage prepareRun() testing', () => {
        it('should read coverage file and return matched test from file without server responce', async () => {
            const testId = "@Ttest10";
            // Create temp coverage file for this test
            fs.writeFileSync(TEMP_COVERAGE_FILE, 
            `
            todomvc-tests/edit-todos_test.js:
             - "${testId}"
            `);

            const result = await coveragePipe.prepareRun(`file=${TEMP_COVERAGE_FILE}`);
            expect(result).to.deep.equal([testId.slice(1)]);
            expect(coveragePipe.store.preparedTestIds).to.deep.equal(result);
        });

        it('should read coverage file and return matched test from server responce only', async () => {
            const serverTestIds= ['TStest1', 'TStest2'];
            // Create temp coverage file for this test
            fs.writeFileSync(TEMP_COVERAGE_FILE, 
            `
            todomvc-tests/edit-todos_test.js:
             - "tag:@smoke"
            `);

            // Mock the API response
            server.on({
                method: 'GET',
                path: '/api/test_grep',
                reply: {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        tests: serverTestIds
                    })
                }
            });

            const result = await coveragePipe.prepareRun(`file=${TEMP_COVERAGE_FILE}`);
            expect(result).to.have.members(serverTestIds);
        });

        it('should read coverage file and return matched test from file + server responce', async () => {
            const testId = "@Ttest10";
            const serverTestIds= ['TStest1', 'TStest2'];
            // Create temp coverage file for the test
            fs.writeFileSync(TEMP_COVERAGE_FILE, 
            `
            todomvc-tests/edit-todos_test.js:
             - "${testId}"
             - "tag:@smoke"
            `);

            // Mock the API response
            server.on({
                method: 'GET',
                path: '/api/test_grep',
                reply: {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        tests: serverTestIds
                    })
                }
            });

            const result = await coveragePipe.prepareRun(`file=${TEMP_COVERAGE_FILE}`);
            const resArray = serverTestIds.concat(testId.slice(1));

            expect(result).to.have.members(resArray);
        });

        it('should read coverage file and return an empty tests array if no Git match files', async () => {
            const testId = "@Ttest10";
            // Create temp coverage file for this test
            fs.writeFileSync(TEMP_COVERAGE_FILE, 
            `
            todomvc-tests/create-todos_test.js:
             - "${testId}"
            `);

            const result = await coveragePipe.prepareRun(`file=${TEMP_COVERAGE_FILE}`);
            expect(result).to.deep.equal([]);
        });

        it('should read coverage file and return an empty tests array if no tests from server', async () => {
            // Create temp coverage file for this test
            fs.writeFileSync(TEMP_COVERAGE_FILE, 
            `
            todomvc-tests/edit-todos_test.js:
             - "tag:@smoke"
            `);

            // Mock the API response
            server.on({
                method: 'GET',
                path: '/api/test_grep',
                reply: {
                    status: 200,
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({
                        tests: []
                    })
                }
            });

            const result = await coveragePipe.prepareRun(`file=${TEMP_COVERAGE_FILE}`);
            expect(result).to.deep.equal([]);
        });
    });
});

describe('CoveragePipe general class cases.', () => {
    let coveragePipe;
    let originalEnv;

    beforeEach(() => {
        originalEnv = { ...process.env };
        process.env.TESTOMATIO_URL = TESTOMATIO_URL;
        process.env['INPUT_TESTOMATIO-KEY'] = TESTOMATIO;
    });

    afterEach(() => {
        delete process.env.COVERAGE_FILEPATH;
        delete process.env.COVERAGE_BRANCH;
        delete process.env.COVERAGE_BY_DEFAULT_GIT_FILE;

        coveragePipe = undefined;
    });

    describe('Coverage class - diff branch tests', () => {
        it('by default we use git diff = "master" (COVERAGE_BRANCH)', async () => {
            const branchName = "master";
            
            // Coverage pipe preparation
            process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
            process.env.COVERAGE_BRANCH = branchName;
    
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.branch).to.equal(branchName);
        });

        it('user try to use any other diff = "test" (COVERAGE_BRANCH)', async () => {
            const branchName = "my-test";

            // Coverage pipe preparation
            process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
            process.env.COVERAGE_BRANCH = branchName;
    
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.branch).to.equal(branchName);
        });

        it('by default we use diff = "master" in case if NO provided (COVERAGE_BRANCH)', async () => {
            // Coverage pipe preparation
            process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
    
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.branch).to.equal("master");
        });
    });

    describe('Coverage class - file tests', () => {
        it('if COVERAGE_FILEPATH setup -> pipe is enabled', async () => {
            const branchName = "master";
            
            // Coverage pipe preparation
            process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
            process.env.COVERAGE_BRANCH = branchName;
    
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.isEnabled).to.equal(true);
        });

        it('if COVERAGE_FILEPATH is empty -> pipe is disabled', async () => {   
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.isEnabled).to.equal(false);
        });

        it('if COVERAGE_FILEPATH is empty -> pipe is disabled', async () => {
            const branchName = "master";
            
            // Coverage pipe preparation
            process.env.COVERAGE_BRANCH = branchName;
    
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.isEnabled).to.equal(false);
        });

        it('in prod version COVERAGE_BY_DEFAULT_GIT_FILE should be all time false', async () => {
            const branchName = "master";
            
            // Coverage pipe preparation
            process.env.COVERAGE_FILEPATH = TEMP_COVERAGE_FILE;
            process.env.COVERAGE_BRANCH = branchName;
    
            coveragePipe = new CoveragePipe({
                apiKey: TESTOMATIO,
                testomatioUrl: TESTOMATIO_URL,
                batchMode: 'disabled'
            });

            expect(coveragePipe.isDefaultGitChanges).to.equal(false);
        });
    });
});