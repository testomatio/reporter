const artifactStorage = require('../lib/storages/artifactStorage');
const { expect } = require('chai');
const { fileSystem } = require('../lib/util');
const path = require('path');
const { testomat } = require('../lib/reporter');
const { TESTOMAT_TMP_STORAGE } = require('../lib/constants');

describe('Artifact storage', () => {
  before(() => {
    fileSystem.clearDir(TESTOMAT_TMP_STORAGE.mainDir);
  });

  it('artifact function is defined @TA0000001', () => {
    expect(testomat.artifact).to.exist;
  });

  it('save artifact with relative filepath @TA0000002', () => {
    const artifact = '../../relative/filepath/artifact1.txt';
    testomat.artifact(artifact);
    const artifacts = artifactStorage.get('@TA0000002');
    expect(artifacts[0]).to.deep.equal(artifact);
  });

  it('save artifact with absolute filepath @TA0000003', () => {
    const artifact = path.resolve(process.cwd(), 'file/path/arifact2.txt');;
    testomat.artifact(artifact);
    const artifacts = artifactStorage.get('@TA0000003');
    expect(artifacts[0]).to.deep.equal(artifact);
  });
});
