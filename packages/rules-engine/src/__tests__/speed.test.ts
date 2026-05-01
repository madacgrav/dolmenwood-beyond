import { describe, it, expect } from 'vitest';
import { calculateSpeed } from '../speed';

describe('calculateSpeed', () => {
  it('returns 40 for 0 coins (unencumbered)', () => {
    expect(calculateSpeed(0)).toBe(40);
  });

  it('returns 40 at the 400 coin boundary', () => {
    expect(calculateSpeed(400)).toBe(40);
  });

  it('returns 30 at 401 coins', () => {
    expect(calculateSpeed(401)).toBe(30);
  });

  it('returns 30 at the 600 coin boundary', () => {
    expect(calculateSpeed(600)).toBe(30);
  });

  it('returns 20 at 601 coins', () => {
    expect(calculateSpeed(601)).toBe(20);
  });

  it('returns 20 at the 800 coin boundary', () => {
    expect(calculateSpeed(800)).toBe(20);
  });

  it('returns 10 at 801 coins', () => {
    expect(calculateSpeed(801)).toBe(10);
  });

  it('returns 10 for extreme weight', () => {
    expect(calculateSpeed(9999)).toBe(10);
  });
});
