Feature('Hooks Test Suite @hooks');

BeforeSuite(() => {
  console.log('BeforeSuite: Setting up test environment');
  global.suiteData = { initialized: true, timestamp: Date.now() };
});

AfterSuite(() => {
  console.log('AfterSuite: Cleaning up test environment');
  delete global.suiteData;
});

Before(() => {
  console.log('Before: Setting up individual test');
  global.testData = { testStarted: true, id: Math.random() };
});

After(() => {
  console.log('After: Cleaning up individual test');
  delete global.testData;
});

Scenario('Test that passes in Before hook', ({ I, test }) => {
  console.log('Running test:', test.title);
  I.expectTrue(!!global.suiteData);
  I.expectTrue(!!global.testData);
  I.expectEqual(1 + 1, 2);
});

Scenario('Test that fails after Before hook', ({ I, test }) => {
  console.log('Running test:', test.title);
  I.expectTrue(!!global.suiteData);
  I.expectTrue(!!global.testData);
  I.expectEqual(1 + 1, 3); // This should fail intentionally
});

Scenario('Test hook execution order', ({ I, test }) => {
  console.log('Checking hook execution order in:', test.title);
  // Verify that BeforeSuite ran before Before
  I.expectTrue(global.suiteData.initialized);
  I.expectTrue(global.testData.testStarted);
  
  // Verify timing
  const now = Date.now();
  I.expectTrue(global.suiteData.timestamp < now);
});

// Test that demonstrates failing in Before hook
Scenario('Test with failing Before hook preparation', ({ I, test }) => {
  console.log('Verifying Before hook preparation in:', test.title);
  // This will test what happens when setup data is missing
  if (!global.testData) {
    throw new Error('Before hook did not run properly');
  }
  I.expectTrue(true); // Test passes if Before hook worked
});

// Test skipped with hooks
xScenario('Skipped test with hooks', ({ I, test }) => {
  console.log('This should never log:', test.title);
  // This should be skipped but hooks should still execute
  I.expectEqual(1, 2); // This should never run
});