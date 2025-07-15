Feature('Comprehensive Test Suite @comprehensive');

// Test that passes
Scenario('Test that passes', ({ I }) => {
  const result = 2 + 2;
  I.expectEqual(result, 4);
});

// Test that fails
Scenario('Test that fails', ({ I }) => {
  const result = 2 + 2;
  I.expectEqual(result, 5); // This should fail intentionally
});

// Test that is skipped
xScenario('Test that is skipped', ({ I }) => {
  // This test should be skipped
  I.expectEqual(1, 2); // This should never run
});

// Test with data-driven format
Data(['{ "input": 2, "expected": 4 }', '{ "input": 3, "expected": 6 }', '{ "input": 5, "expected": 10 }'])
  .Scenario('Test with multiple data sets', ({ I, current }) => {
    const data = JSON.parse(current);
    const result = data.input * 2;
    I.expectEqual(result, data.expected);
  });

// Test with multiple steps
Scenario('Test with multiple steps', ({ I, test }) => {
  console.log('Current test:', test.title);
  
  // Step 1
  const step1 = 1 + 1;
  I.expectEqual(step1, 2);

  // Step 2
  const step2 = step1 * 2;
  I.expectEqual(step2, 4);

  // Step 3
  const step3 = step2 + step1;
  I.expectEqual(step3, 6);
});

// Test that throws an error
Scenario('Test that throws error', ({ I, test }) => {
  console.log('About to throw error in test:', test.title);
  throw new Error('This is an intentional error for testing');
});

// Test with async operation
Scenario('Test with async operation', async ({ I, test }) => {
  console.log('Running async test:', test.title);
  await new Promise(resolve => setTimeout(resolve, 100));
  const result = 'async';
  I.expectEqual(result, 'async');
});

// Test with different assertion types
Scenario('Test with various assertions', ({ I }) => {
  I.expectEqual(5, 5);
  I.expectNotEqual(3, 4);
  I.expectTrue(true);
  I.expectFalse(false);
});

// Test that demonstrates expectContain
Scenario('Test with string assertions', ({ I }) => {
  const message = 'Hello CodeceptJS world';
  I.expectContain(message, 'CodeceptJS');
  I.expectNotContain(message, 'Playwright');
});
