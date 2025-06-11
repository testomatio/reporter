const assert = require('assert');

Feature('Simple Tests');

Scenario('should always pass', () => {
  // Simple assertion that always passes
  const result = 1 + 1;
  assert.equal(result, 2, 'Basic math should work');
});

Scenario('should always fail', () => {
  // Simple assertion that always fails
  const result = 1 + 1;
  assert.equal(result, 3, 'This should fail intentionally');
});