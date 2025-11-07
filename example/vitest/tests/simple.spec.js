import { describe, it, expect } from 'vitest';

describe('Simple Tests', () => {
  it('should always pass', () => {
    // Simple assertion that always passes
    expect(1 + 1).toBe(2);
  });

  it('should always fail', () => {
    // Simple assertion that always fails
    expect(1 + 1).toBe(3);
  });

  it('test with async operation', async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });
});

describe('Math Operations', () => {
  it('should add numbers correctly', () => {
    expect(2 + 2).toBe(4);
    expect(10 + 5).toBe(15);
  });

  it('should multiply numbers correctly', () => {
    expect(3 * 4).toBe(12);
    expect(5 * 5).toBe(25);
  });
});
