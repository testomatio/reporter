Feature('Simple Tests');

Scenario('should always pass', ({ I }) => {
  // Simple assertion that always passes
  const result = 1 + 1;
  I.expectEqual(result, 2);
});

Scenario('should always fail', ({ I }) => {
  // Simple assertion that always fails
  const result = 1 + 1;
  I.expectEqual(result, 3); // This should fail intentionally
});