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
    const artifact = path.resolve(process.cwd(), 'file/path/artifact2.txt');
    testomat.artifact(artifact);
    const artifacts = artifactStorage.get('@TA0000003');
    expect(artifacts[0]).to.deep.equal(artifact);
  });

  it('save multiple artifacts @TA0000004', () => {
    const artifacts = ['artifact1.txt', 'artifact2.txt'];
    testomat.artifact(artifacts[0]);
    testomat.artifact(artifacts[1]);
    const retrievedArtifacts = artifactStorage.get('@TA0000004');
    expect(retrievedArtifacts).to.deep.equal(artifacts);
  });

  it('save artifact with name and type @TA0000005', () => {
    const artifact = {
      name: 'artifact name 1',
      type: 'log',
      path: 'file/path/artifact1.txt',
    };
    testomat.artifact(artifact);
    const artifacts = artifactStorage.get('@TA0000005');
    expect(artifacts[0].name).to.equal(artifact.name);
    expect(artifacts[0].type).to.equal(artifact.type);
    expect(artifacts[0].path).to.equal(artifact.path);
  });
});
