import { describe, it, expect } from 'vitest';
import { calcAmmoRecovery } from '../combat';

describe('calcAmmoRecovery', () => {
  it('returns 0 when no shots fired', () => {
    expect(calcAmmoRecovery(0)).toBe(0);
  });
  it('returns 0 for 1 shot (floor of 0.5)', () => {
    expect(calcAmmoRecovery(1)).toBe(0);
  });
  it('returns 1 for 2 shots', () => {
    expect(calcAmmoRecovery(2)).toBe(1);
  });
  it('returns 1 for 3 shots', () => {
    expect(calcAmmoRecovery(3)).toBe(1);
  });
  it('returns 5 for 10 shots', () => {
    expect(calcAmmoRecovery(10)).toBe(5);
  });
  it('clamps negative inputs to 0', () => {
    expect(calcAmmoRecovery(-3)).toBe(0);
  });
  it('handles large numbers', () => {
    expect(calcAmmoRecovery(100)).toBe(50);
  });
});
