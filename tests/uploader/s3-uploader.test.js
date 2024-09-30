const { clear } = require('console');
const S3Uploader = require('../../lib/uploader');
const { expect } = require('chai');
const fs = require('fs');
const os = require('os');
const path = require('path');

function getFilePathWithUploadsList(runId) {
  const tempFilePath = path.join(os.tmpdir(), `testomatio.run.${runId}.json`);
  if (!fs.existsSync(tempFilePath)) {
    fs.writeFileSync(tempFilePath, '');
  }
  return tempFilePath;
}

describe('reset config', () => {
  it('should reset config', () => {
    const uploader = new S3Uploader();
    uploader.resetConfig();
    expect(uploader.config).to.be.undefined;
    expect(uploader.isEnabled).to.be.undefined;
  });
});

describe('get config', () => {
  it('should get config', () => {
    const uploader = new S3Uploader();
    const config = uploader.getConfig();
    expect(config).to.be.an('object');
  });

  it('should return cached config', () => {
    const uploader = new S3Uploader();
    uploader.config = { S3_BUCKET: 'test' };
    const config = uploader.getConfig();
    expect(config).to.be.an('object');
    expect(config.S3_BUCKET).to.equal('test');
  });
});

describe('get masked config', () => {
  it('should get masked config', () => {
    const uploader = new S3Uploader();
    const config = uploader.getMaskedConfig();
    expect(config).to.be.an('object');
  });

  it('should mask secret access key', () => {
    const uploader = new S3Uploader();
    uploader.config = { S3_SECRET_ACCESS_KEY: 'test' };
    const config = uploader.getMaskedConfig();
    expect(config.S3_SECRET_ACCESS_KEY).to.equal('***');
  });

  it('should mask access key id', () => {
    const uploader = new S3Uploader();
    uploader.config = { S3_ACCESS_KEY_ID: 'test' };
    const config = uploader.getMaskedConfig();
    expect(config.S3_ACCESS_KEY_ID).to.equal('***');
  });
});

describe('check enabled', () => {
  it('should not be enabled if S3_BUCKET is not set', () => {
    const uploader = new S3Uploader();
    uploader.config = { S3_BUCKET: '' };
    const enabled = uploader.checkEnabled();
    expect(enabled).to.be.false;
  });

  it('should be enabled if S3_BUCKET is set', () => {
    const uploader = new S3Uploader();
    uploader.config = { S3_BUCKET: 'test' };
    const enabled = uploader.checkEnabled();
    expect(enabled).to.be.true;
  });

  it('should not be enabled if TESTOMATIO_DISABLE_ARTIFACTS is set', () => {
    const uploader = new S3Uploader();
    uploader.config = { S3_BUCKET: 'test', TESTOMATIO_DISABLE_ARTIFACTS: '1' };
    const enabled = uploader.checkEnabled();
    expect(enabled).to.be.false;
  });
});

describe('log storage', () => {
  it('should enable log storage', () => {
    const uploader = new S3Uploader();
    uploader.enableLogStorage();
    expect(uploader.storeEnabled).to.be.true;
  });

  it('should disable log storage', () => {
    const uploader = new S3Uploader();
    uploader.disbleLogStorage();
    expect(uploader.storeEnabled).to.be.false;
  });
});

describe('storeUploadedFile', () => {
  let filePathWithUploadsList;
  let fileContent;
  const runId = 'testRunId1';
  const rid = 'testRid1';

  before(() => {
    filePathWithUploadsList = getFilePathWithUploadsList(runId);
    // clear file content
  });
  beforeEach(() => {
    fs.writeFileSync(filePathWithUploadsList, '');
  });

  it('should store uploaded file', () => {
    const uploader = new S3Uploader();
    uploader.storeUploadedFile('file/path/1', runId, rid);
    fileContent = fs.readFileSync(filePathWithUploadsList, 'utf8');
    const absoluteArtifactPath = path.resolve('file/path/1');
    expect(fileContent).to.equal(`{"rid":"${rid}","file":"${absoluteArtifactPath}","uploaded":false}\n`);
  });

  it('should store multiple uploaded files', () => {
    const uploader = new S3Uploader();
    uploader.storeUploadedFile('file/path/1', runId, rid);
    uploader.storeUploadedFile('file/path/2', runId, rid);
    fileContent = fs.readFileSync(filePathWithUploadsList, 'utf8');
    const absoluteArtifact1Path = path.resolve('file/path/1');
    const absoluteArtifact2Path = path.resolve('file/path/2');
    expect(fileContent).to.equal(
      `{"rid":"${rid}","file":"${absoluteArtifact1Path}","uploaded":false}\n{"rid":"${rid}","file":"${absoluteArtifact2Path}","uploaded":false}\n`,
    );
  });

  // it.only('should not store duplicate uploaded files', () => {
  //   const uploader = new S3Uploader();
  //   uploader.storeUploadedFile('file/path/1', runId, rid);
  //   fileContent = fs.readFileSync(filePathWithUploadsList, 'utf8');
  //   const absoluteArtifact1Path = path.resolve('file/path/1');
  //   const absoluteArtifact2Path = path.resolve('file/path/2');
  //   expect(fileContent).to.equal(
  //     `{"rid":"${rid}","file":"${absoluteArtifact1Path}","uploaded":false}\n{"rid":"${rid}","file":"${absoluteArtifact2Path}","uploaded":false}\n`,
  //   );
  // });

  it('should store uploaded file with uploaded=true', () => {
    const uploader = new S3Uploader();
    uploader.storeUploadedFile('file/path/3', runId, rid, true);
    fileContent = fs.readFileSync(filePathWithUploadsList, 'utf8');
    const absoluteArtifactPath = path.resolve('file/path/3');
    expect(fileContent).to.equal(`{"rid":"${rid}","file":"${absoluteArtifactPath}","uploaded":true}\n`);
  });

  it('should store uploaded file with uploaded=false', () => {
    const uploader = new S3Uploader();
    uploader.storeUploadedFile('file/path/4', runId, rid, false);
    fileContent = fs.readFileSync(filePathWithUploadsList, 'utf8');
    const absoluteArtifactPath = path.resolve('file/path/4');
    expect(fileContent).to.equal(`{"rid":"${rid}","file":"${absoluteArtifactPath}","uploaded":false}\n`);
  });

  it('should not store uploaded file if storage is disabled', () => {
    const uploader = new S3Uploader();
    uploader.storeEnabled = false;
    uploader.storeUploadedFile('file/path/4', runId, rid);
    fileContent = fs.readFileSync(filePathWithUploadsList, 'utf8');
    expect(fileContent).to.equal('');
  });
});

describe('readUploadedFiles', () => {
  const runId = 'testRunId2';
  let filePathWithUploadsList;

  before(() => {
    filePathWithUploadsList = getFilePathWithUploadsList(runId);
    // clear file content
    fs.writeFileSync(filePathWithUploadsList, '');
  });

  it('should read uploaded files', () => {
    const uploader = new S3Uploader();
    uploader.storeUploadedFile('some/file/path.txt', runId, 'testRid1');

    const files = uploader.readUploadedFiles(runId);
    expect(files).to.be.an('array');
    expect(files).to.have.lengthOf(1);
  });

  it('should parse uploaded files', () => {
    const uploader = new S3Uploader();
    uploader.storeUploadedFile('some/file/path.txt', runId, 'testRid1');
    const files = uploader.readUploadedFiles(runId);
    expect(files[0].rid).to.equal('testRid1');
    expect(files[0].file).to.equal(path.resolve('some/file/path.txt'));
    expect(files[0].uploaded).to.be.false;
  });
});

describe('upload file by path', () => {
  const runId = 'testRunId3';
  let filePathWithUploadsList;

  before(() => {
    filePathWithUploadsList = getFilePathWithUploadsList(runId);
    // clear file content
    fs.writeFileSync(filePathWithUploadsList, '');
  });

  it('should store file when uploading by path', async () => {
    const uploader = new S3Uploader();
    const filePath = path.resolve('tests/uploader/test-file.txt');
    await uploader.uploadFileByPath(filePath, [runId, 'testRid1', 'test-file.txt']);

    const files = uploader.readUploadedFiles(runId);
    expect(files).to.have.lengthOf(1);
    expect(files[0].rid).to.equal('testRid1');
    expect(files[0].file).to.equal(filePath);
    expect(files[0].uploaded).to.be.false;
  });
});
