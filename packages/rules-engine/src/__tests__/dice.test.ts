import { describe, it, expect } from 'vitest';
import { rollDie, rollMultiple, roll3d6, rollAbilityScores, parseDiceNotation, rollFromNotation, rollDamage } from '../dice';

describe('Dice', () => {
  it('rollDie returns value in range [1, sides]', () => {
    for (let i = 0; i < 100; i++) {
      const result = rollDie(6);
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(6);
    }
  });

  it('rollMultiple returns correct count', () => {
    expect(rollMultiple(3, 6)).toHaveLength(3);
  });

  it('roll3d6 returns value between 3 and 18', () => {
    for (let i = 0; i < 20; i++) {
      const result = roll3d6();
      expect(result).toBeGreaterThanOrEqual(3);
      expect(result).toBeLessThanOrEqual(18);
    }
  });

  it('rollAbilityScores returns 6 values', () => {
    expect(rollAbilityScores()).toHaveLength(6);
  });

  it('parseDiceNotation parses 2d6', () => {
    expect(parseDiceNotation('2d6')).toEqual({ count: 2, sides: 6 });
  });

  it('parseDiceNotation parses 1d20', () => {
    expect(parseDiceNotation('1d20')).toEqual({ count: 1, sides: 20 });
  });

  it('parseDiceNotation throws on invalid input', () => {
    expect(() => parseDiceNotation('invalid')).toThrow();
  });

  it('rollFromNotation returns value in expected range for 1d6', () => {
    const result = rollFromNotation('1d6');
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(6);
  });
});

describe('rollDamage', () => {
  it('returns 0 for invalid notation', () => {
    expect(rollDamage('invalid')).toBe(0);
    expect(rollDamage('')).toBe(0);
  });
  it('result for 1d6 is between 1 and 6', () => {
    const result = rollDamage('1d6');
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(6);
  });
  it('result for 2d6 is between 2 and 12', () => {
    const result = rollDamage('2d6');
    expect(result).toBeGreaterThanOrEqual(2);
    expect(result).toBeLessThanOrEqual(12);
  });
  it('applies positive modifier', () => {
    // 1d1+3 always equals 4
    const result = rollDamage('1d1+3');
    expect(result).toBe(4);
  });
  it('applies negative modifier', () => {
    // 1d1-1 always equals 0
    const result = rollDamage('1d1-1');
    expect(result).toBe(0);
  });
  it('handles case-insensitive notation', () => {
    const result = rollDamage('1D6');
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(6);
  });
});
