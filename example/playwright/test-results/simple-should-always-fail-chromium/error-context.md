# Test info

- Name: should always fail
- Location: /home/davert/projects/testomatio/reporter/example/playwright/tests/simple.spec.js:10:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 3
Received: 2
    at /home/davert/projects/testomatio/reporter/example/playwright/tests/simple.spec.js:14:17
```

# Test source

```ts
   1 | const { test, expect } = require('@playwright/test');
   2 |
   3 | test('should always pass', { 
   4 |   annotation: { type: 'status', description: 'reliable' }
   5 | }, async () => {
   6 |   // Simple assertion that always passes
   7 |   expect(1 + 1).toBe(2);
   8 | });
   9 |
  10 | test('should always fail', {
  11 |   annotation: { type: 'bug', description: 'intentional failure for testing' }
  12 | }, async () => {
  13 |   // Simple assertion that always fails
> 14 |   expect(1 + 1).toBe(3);
     |                 ^ Error: expect(received).toBe(expected) // Object.is equality
  15 | });
  16 |
  17 | test('test with multiple annotations', {
  18 |   annotation: [
  19 |     { type: 'feature', description: 'core-functionality' },
  20 |     { type: 'priority', description: 'high' }
  21 |   ]
  22 | }, async () => {
  23 |   expect(true).toBe(true);
  24 | });
```