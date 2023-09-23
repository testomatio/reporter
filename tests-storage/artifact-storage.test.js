const artifactStorage = require('../lib/storages/artifactStorage');
const { expect } = require('chai');
const { testomat } = require('../lib/reporter');

describe('Artifact storage', () => {
  it('artifact function is defined @TA0000001', () => {
    expect(testomat.artifact).to.exist;
  });

  it('save artifact with relative filepath @TA0000002', () => {
    const artifact = 'test.txt';
    testomat.artifact(artifact);
    const artifacts = artifactStorage.get('@TA0000002');
    console.warn('ARTIFACTS:', artifacts);
    // expect(artifacts).to.deep.equal([artifact]);
  });
});
