const assert = require('assert');

describe('Sample mocha suite', () => {
  it('Sample mocha test', () => {
    assert.equal([1, 2, 3].indexOf(4), 0);
  });
});

describe('Sample mocha suite 2', () => {
  it('Sample mocha test 2', () => {
    assert.equal(1, 1);
  });
});
