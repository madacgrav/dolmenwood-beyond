import { describe, it, expect } from 'vitest';
import { getAbilityModifier } from '../ability-modifiers';

describe('getAbilityModifier', () => {
  it('returns -3 for score 3', () => expect(getAbilityModifier(3)).toBe(-3));
  it('returns -2 for scores 4-5', () => {
    expect(getAbilityModifier(4)).toBe(-2);
    expect(getAbilityModifier(5)).toBe(-2);
  });
  it('returns -1 for scores 6-8', () => {
    expect(getAbilityModifier(6)).toBe(-1);
    expect(getAbilityModifier(8)).toBe(-1);
  });
  it('returns 0 for scores 9-12', () => {
    expect(getAbilityModifier(9)).toBe(0);
    expect(getAbilityModifier(12)).toBe(0);
  });
  it('returns +1 for scores 13-15', () => {
    expect(getAbilityModifier(13)).toBe(1);
    expect(getAbilityModifier(15)).toBe(1);
  });
  it('returns +2 for scores 16-17', () => {
    expect(getAbilityModifier(16)).toBe(2);
    expect(getAbilityModifier(17)).toBe(2);
  });
  it('returns +3 for score 18', () => expect(getAbilityModifier(18)).toBe(3));
});
