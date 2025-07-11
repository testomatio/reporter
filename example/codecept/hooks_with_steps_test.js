Feature('Hooks with Steps Test @hooks-steps');

BeforeSuite(({ I }) => {
  console.log('BeforeSuite: Setting up test environment with steps');
  // Add some Expect helper steps in BeforeSuite
  I.expectEqual(1, 1);
  I.expectTrue(true);
});

AfterSuite(({ I }) => {
  console.log('AfterSuite: Cleaning up test environment with steps');
  // Add some Expect helper steps in AfterSuite
  I.expectEqual(2, 2);
  I.expectFalse(false);
});

Before(({ I }) => {
  console.log('Before: Setting up individual test with steps');
  // Add some Expect helper steps in Before
  I.expectEqual('setup', 'setup');
  I.expectTrue(!!global);
});

After(({ I }) => {
  console.log('After: Cleaning up individual test with steps');
  // Add some Expect helper steps in After
  I.expectEqual('cleanup', 'cleanup');
  I.expectContain('test cleanup', 'cleanup');
});

Scenario('Test that demonstrates hook steps', ({ I }) => {
  console.log('Running main test');
  I.expectEqual(1 + 1, 2);
  I.expectTrue(true);
  I.expectContain('main test', 'test');
});