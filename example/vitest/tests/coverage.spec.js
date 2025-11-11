import { describe, it, expect } from 'vitest';
import { add, subtract, multiply, divide, isEven, isPositive } from '../src/calculator.js';

describe('Calculator Coverage Test', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });

  it('should subtract two numbers', () => {
    expect(subtract(5, 3)).toBe(2);
  });

  it('should multiply two numbers', () => {
    expect(multiply(3, 4)).toBe(12);
  });

  it('should divide two numbers', () => {
    expect(divide(10, 2)).toBe(5);
  });

  it('should check if number is even', () => {
    expect(isEven(4)).toBe(true);
    expect(isEven(3)).toBe(false);
  });

  // Note: not testing divide by zero and isPositive to show partial coverage
});
