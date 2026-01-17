const { describe, it, expect } = require('@jest/globals');

describe('Example Test Suite', () => {
  it('should pass a basic test', () => {
    expect(true).toBe(true);
  });

  it('should add numbers correctly', () => {
    const sum = (a, b) => a + b;
    expect(sum(2, 3)).toBe(5);
  });
});



