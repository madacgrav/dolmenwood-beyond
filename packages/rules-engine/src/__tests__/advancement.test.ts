import { describe, it, expect } from 'vitest';
import { getAttackBonus, getSaveTargets, getXPThreshold, getHitDie, getPrimeAbilities, getXPThresholdForNextLevel, ALL_CLASSES } from '../advancement';

describe('Class Advancement', () => {
  it('covers all 9 classes', () => {
    expect(ALL_CLASSES).toHaveLength(9);
    expect(ALL_CLASSES).toContain('Fighter');
    expect(ALL_CLASSES).toContain('Magician');
    expect(ALL_CLASSES).toContain('Cleric');
  });

  it('Fighter level 1 attack bonus is correct', () => {
    expect(getAttackBonus('Fighter', 1)).toBe(1);
  });

  it('Magician level 1 has correct saves', () => {
    const saves = getSaveTargets('Magician', 1);
    expect(saves).not.toBeNull();
    expect(saves!.doom).toBeGreaterThan(0);
    expect(saves!.spell).toBeGreaterThan(0);
  });

  it('Fighter XP threshold for level 2 is greater than 0', () => {
    expect(getXPThreshold('Fighter', 2)).toBeGreaterThan(0);
  });

  it('all classes have a hit die', () => {
    ALL_CLASSES.forEach((cls) => {
      expect(getHitDie(cls)).toMatch(/d\d+/);
    });
  });

  it('all classes have prime abilities', () => {
    ALL_CLASSES.forEach((cls) => {
      expect(getPrimeAbilities(cls).length).toBeGreaterThan(0);
    });
  });

  it('XP threshold for next level is greater than current', () => {
    expect(getXPThresholdForNextLevel('Fighter', 1)).toBeGreaterThan(getXPThreshold('Fighter', 1));
  });

  it('returns null for unknown class', () => {
    expect(getSaveTargets('Unknown', 1)).toBeNull();
    expect(getAttackBonus('Unknown', 1)).toBe(0);
  });
});
