const { test, expect } = require('@playwright/test');

test('should always pass', { 
  annotation: { type: 'status', description: 'reliable' }
}, async () => {
  // Simple assertion that always passes
  expect(1 + 1).toBe(2);
});

test('should always fail', {
  annotation: { type: 'bug', description: 'intentional failure for testing' }
}, async () => {
  // Simple assertion that always fails
  expect(1 + 1).toBe(3);
});

test('test with multiple annotations', {
  annotation: [
    { type: 'feature', description: 'core-functionality' },
    { type: 'priority', description: 'high' }
  ]
}, async () => {
  expect(true).toBe(true);
});