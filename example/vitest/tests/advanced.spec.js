import { describe, it, expect } from 'vitest';

describe('Advanced Test Scenarios', () => {
  it('test with timeout', async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    expect(true).toBe(true);
  }, 5000);

  it('test with error details', () => {
    const error = new Error('Custom error message');
    expect(() => {
      throw error;
    }).toThrow('Custom error message');
  });

  it.skip('skipped test should not run', () => {
    // This test should be skipped
    expect(false).toBe(true);
  });

  it('test with multiple expectations', () => {
    const obj = { name: 'test', value: 123 };
    expect(obj).toBeDefined();
    expect(obj.name).toBe('test');
    expect(obj.value).toBeGreaterThan(100);
  });
});

describe('Nested Describes', () => {
  describe('Level 1', () => {
    describe('Level 2', () => {
      it('deeply nested test', () => {
        expect('nested').toBeTruthy();
      });
    });

    it('level 1 test', () => {
      expect(1).toBe(1);
    });
  });
});
