Feature('BeforeSuite Bug Demo @beforesuite-bug');

// This BeforeSuite fails - should affect test execution but not mark individual tests as failed
BeforeSuite(() => {
  console.log('BeforeSuite: About to fail intentionally');
  
  // Use assert to ensure failure
  const assert = require('assert');
  assert.equal(1, 2, 'BeforeSuite intentionally fails');
});

// These tests may not run due to BeforeSuite failure, but if they do run and pass,
// they should NOT be marked as failed due to the BeforeSuite failure
Scenario('Test after failing BeforeSuite', ({ I }) => {
  I.expectEqual(1, 1);
});

Scenario('Another test after failing BeforeSuite', ({ I }) => {
  I.expectEqual(2, 2);
});