Feature('AfterSuite Bug Demo @aftersuite-bug');

// These tests should all PASS individually
Scenario('First passing test', ({ I }) => {
  I.expectEqual(1 + 1, 2);
});

Scenario('Second passing test', ({ I }) => {
  I.expectEqual(2 + 2, 4);
});

Scenario('Third passing test', ({ I }) => {
  I.expectEqual(3 + 3, 6);
});

// This AfterSuite fails - BUG: causes all above tests to be marked as failed
AfterSuite(() => {
  console.log('AfterSuite: About to fail intentionally');
  
  // Use assert to ensure failure (Expect helper not available in hooks)
  const assert = require('assert');
  assert.equal(1, 2, 'AfterSuite intentionally fails - this should NOT affect individual test results');
});