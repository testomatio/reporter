const assert = require('assert');

describe('Sample mocha suite', () => {
  it('Sample mocha test @T7af2c281', () => {
    assert.equal([1, 2, 3].indexOf(4), -1);
  });
});

describe('Sample mocha suite 2', () => {
  it('Sample mocha test 2 @T6603c29e', () => {
    assert.equal(1, 1);
  });
});
