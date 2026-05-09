import { describe, it, expect } from 'vitest';
import { getXPModifier, applyXPModifiers, canLevelUpAfterGain } from '../xp';

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

  it('returns 0 for empty array (no prime abilities)', () => {
    expect(getXPModifier([])).toBe(0);
  });
});

describe('applyXPModifiers', () => {
  const baseScores = { str: 15, dex: 14, con: 12, int: 13, wis: 13, cha: 10 };

  it('returns base unchanged for non-Human with +5% ability modifier', () => {
    // Fighter primes: Str. Score 15 → +5% mod, Breggle kindred → 0% bonus
    // 100 * 1.05 = 105
    const result = applyXPModifiers(100, 'Fighter', { str: 15 }, 'Breggle');
    expect(result).toBe(105);
  });

  it('returns base unchanged when base is 0', () => {
    expect(applyXPModifiers(0, 'Fighter', baseScores, 'Human')).toBe(0);
  });

  it('returns base unchanged when base is negative', () => {
    expect(applyXPModifiers(-50, 'Fighter', baseScores, 'Human')).toBe(-50);
  });

  it('applies Human +10% kindred bonus on top of ability modifier', () => {
    // Fighter prime: Str. Score 13 → +5% ability mod; Human +10% kindred = +15%
    // 200 * 1.15 = 230
    const result = applyXPModifiers(200, 'Fighter', { str: 13 }, 'Human');
    expect(result).toBe(230);
  });

  it('applies negative ability mod correctly', () => {
    // Fighter prime: Str. Score 5 → −20%
    // 100 * 0.80 = 80
    const result = applyXPModifiers(100, 'Fighter', { str: 5 }, 'Breggle');
    expect(result).toBe(80);
  });

  it('applies -20% ability mod for missing prime ability key (fallback to 0)', () => {
    // Fighter prime is Str; passing empty record → score defaults to 0 (≤5 tier) → -20% mod
    // 100 * 0.80 = 80
    const result = applyXPModifiers(100, 'Fighter', {}, 'Breggle');
    expect(result).toBe(80);
  });

  it('uses lowest prime for multi-prime class (Friar WIS+INT: lowest drives −20%)', () => {
    // Friar primes: WIS, INT. WIS=15 (+5%), INT=5 (−20%). Lowest = −20%.
    // Math.round(100 * 0.80) = 80
    const result = applyXPModifiers(100, 'Friar', { wis: 15, int: 5 }, 'Breggle');
    expect(result).toBe(80);
  });

  it('uses lowest prime for multi-prime class (Hunter CON+DEX: lowest is +5%)', () => {
    // Hunter primes: CON, DEX. CON=16 (+10%), DEX=13 (+5%). Lowest = +5%.
    // Math.round(200 * 1.05) = 210
    const result = applyXPModifiers(200, 'Hunter', { con: 16, dex: 13 }, 'Breggle');
    expect(result).toBe(210);
  });
});

describe('canLevelUpAfterGain', () => {
  it('returns false when current XP + gain is below threshold', () => {
    expect(canLevelUpAfterGain(1000, 100, 2000)).toBe(false);
  });

  it('returns true when current XP + gain exactly meets threshold', () => {
    expect(canLevelUpAfterGain(1900, 100, 2000)).toBe(true);
  });

  it('returns true when current XP + gain exceeds threshold', () => {
    expect(canLevelUpAfterGain(2000, 500, 2000)).toBe(true);
  });

  it('returns true when current XP + gain exactly equals threshold (zero gain edge case)', () => {
    // Already at threshold with 0 additional gain
    expect(canLevelUpAfterGain(2000, 0, 2000)).toBe(true);
  });

  it('returns false when threshold is 0 (max level)', () => {
    expect(canLevelUpAfterGain(99999, 1000, 0)).toBe(false);
  });
});
