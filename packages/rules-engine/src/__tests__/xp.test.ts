import { describe, it, expect } from 'vitest';
import { getXPModifier } from '../xp';

describe('getXPModifier', () => {
  it('returns -20 for lowest prime score of 3', () => {
    expect(getXPModifier([3])).toBe(-20);
  });

  it('returns -20 at the upper boundary of tier 1 (score 5)', () => {
    expect(getXPModifier([5])).toBe(-20);
  });

  it('returns -10 at score 6', () => {
    expect(getXPModifier([6])).toBe(-10);
  });

  it('returns -10 at the upper boundary of tier 2 (score 8)', () => {
    expect(getXPModifier([8])).toBe(-10);
  });

  it('returns 0 at score 9', () => {
    expect(getXPModifier([9])).toBe(0);
  });

  it('returns 0 at the upper boundary of tier 3 (score 12)', () => {
    expect(getXPModifier([12])).toBe(0);
  });

  it('returns +5 at score 13', () => {
    expect(getXPModifier([13])).toBe(5);
  });

  it('returns +5 at the upper boundary of tier 4 (score 15)', () => {
    expect(getXPModifier([15])).toBe(5);
  });

  it('returns +10 at score 16', () => {
    expect(getXPModifier([16])).toBe(10);
  });

  it('returns +10 at the maximum score 18', () => {
    expect(getXPModifier([18])).toBe(10);
  });

  it('uses the LOWEST prime score when multiple are provided', () => {
    expect(getXPModifier([18, 3])).toBe(-20);
  });

  it('uses lowest of multiple primes (two +5 tier scores)', () => {
    expect(getXPModifier([15, 13])).toBe(5);
  });

  it('three primes: lowest drives the result', () => {
    expect(getXPModifier([18, 16, 8])).toBe(-10);
  });
});
