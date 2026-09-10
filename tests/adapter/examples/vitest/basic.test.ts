import { expect, test } from 'vitest';

test('test example pass', () => {
  expect(1 + 1).toBe(2);
});

test('test examplefail ', () => {
  expect(1 + 2).toBe(2);
});

// TODO: vitest is only works with import syntax; implement after moving reporter to esm
