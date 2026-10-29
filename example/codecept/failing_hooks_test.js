Feature('Failing Hooks Test Suite @failing-hooks');

// This demonstrates tests where hooks themselves fail
BeforeSuite(() => {
  console.log('BeforeSuite: This will run normally');
  global.failingHooksData = { setup: true };
});

Before(() => {
  console.log('Before: This might fail for some tests');

  // Simulate a failing Before hook for certain tests
  const currentTest = global.currentTestTitle;
  if (currentTest && currentTest.includes('failing Before')) {
    throw new Error('Before hook failed intentionally');
  }

  global.beforeHookRan = true;
});

After(() => {
  console.log('After: Cleaning up after test');

  // Simulate a failing After hook for certain tests
  const currentTest = global.currentTestTitle;
  if (currentTest && currentTest.includes('failing After')) {
    global.afterHookFailed = true;
    throw new Error('After hook failed intentionally');
  }

  delete global.beforeHookRan;
  delete global.currentTestTitle;
});

AfterSuite(() => {
  console.log('AfterSuite: This will run normally');
  delete global.failingHooksData;
  delete global.afterHookFailed;
});

Scenario('Normal test with working hooks', ({ I, test }) => {
  global.currentTestTitle = test.title;
  console.log('Running normal test:', test.title);
  I.expectTrue(!!global.failingHooksData);
  I.expectTrue(!!global.beforeHookRan);
  I.expectEqual(2 + 2, 4);
});

Scenario('Test with failing Before hook', ({ I, test }) => {
  global.currentTestTitle = test.title;
  console.log('Running test that should have failing Before hook:', test.title);
  // This test should be affected by the failing Before hook
  // The test itself might not run or might run with incomplete setup
  I.expectEqual(1 + 1, 2);
});

Scenario('Test with failing After hook', ({ I, test }) => {
  global.currentTestTitle = test.title;
  console.log('Running test that will have failing After hook:', test.title);
  I.expectEqual(3 + 3, 6);
});

Scenario('Test after hook failures', ({ I, test }) => {
  global.currentTestTitle = test.title;
  console.log('Running test after previous hook failures:', test.title);
  // This test should still run despite previous hook failures
  I.expectTrue(!!global.failingHooksData);
  I.expectEqual(4 + 4, 8);
});
