import { describe, it, expect } from 'vitest';
import { getMaxRetainers, getRetainerLoyaltyBase, getMagicResistance } from '../retainers';

describe('Retainers', () => {
  it('CHA 12 gives max 3 retainers', () => expect(getMaxRetainers(12)).toBe(3));
  it('CHA 18 gives max 6 retainers', () => expect(getMaxRetainers(18)).toBe(6));
  it('CHA 3 gives max 0 retainers (floor)', () => expect(getMaxRetainers(3)).toBe(0));
  it('CHA 12 gives loyalty base 7', () => expect(getRetainerLoyaltyBase(12)).toBe(7));
  it('CHA 18 gives loyalty base 10', () => expect(getRetainerLoyaltyBase(18)).toBe(10));
  it('getMagicResistance WIS 12 no bonus is 0', () => expect(getMagicResistance(12)).toBe(0));
  it('getMagicResistance WIS 16 is +2', () => expect(getMagicResistance(16)).toBe(2));
  it('getMagicResistance WIS 16 with kindred bonus 1 is 3', () => expect(getMagicResistance(16, 1)).toBe(3));
});
