// Simple calculator module for testing code coverage
export function add(a, b) {
  return a + b;
}

export function subtract(a, b) {
  return a - b;
}

export function multiply(a, b) {
  return a * b;
}

export function divide(a, b) {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

export function isEven(n) {
  return n % 2 === 0;
}

export function isPositive(n) {
  return n > 0;
}
