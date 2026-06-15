import { describe, it, expect } from 'vitest';
import { getAttackBonus, getSaveTargets, getXPThreshold, getHitDie, getPrimeAbilities, getXPThresholdForNextLevel, ALL_CLASSES, getLevelUpFeatures } from '../advancement';

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

  it('getXPThresholdForNextLevel returns 0 for a character at max level (15)', () => {
    // Level 16 doesn't exist — threshold returns 0, which is the max-level sentinel
    expect(getXPThresholdForNextLevel('Fighter', 15)).toBe(0);
  });

  it('returns null for unknown class', () => {
    expect(getSaveTargets('Unknown', 1)).toBeNull();
    expect(getAttackBonus('Unknown', 1)).toBe(0);
  });
});

describe('getLevelUpFeatures', () => {
  it('detects attack bonus increase for Fighter (pinned: level 2→3 gains +2)', () => {
    // Fighter attack bonus: level 2 = +1, level 3 = +2
    const changes = getLevelUpFeatures('Fighter', 2, 3);
    const ab = changes.find(c => c.name === 'Attack Bonus Improves');
    expect(ab).toBeDefined();
    expect(ab!.description).toContain('+2');
  });

  it('detects saving throw improvement for Fighter', () => {
    let foundSaveImprovement = false;
    for (let lvl = 1; lvl <= 9; lvl++) {
      const changes = getLevelUpFeatures('Fighter', lvl, lvl + 1);
      if (changes.some(c => c.name === 'Saving Throws Improve')) {
        foundSaveImprovement = true;
        break;
      }
    }
    expect(foundSaveImprovement).toBe(true);
  });

  it('returns empty array for unknown class', () => {
    const changes = getLevelUpFeatures('Unknown', 1, 2);
    expect(changes).toEqual([]);
  });

  it('returns LevelUpFeature objects with name and description', () => {
    // Fighter 1→2 should have some changes
    const changes = getLevelUpFeatures('Fighter', 1, 2);
    changes.forEach(c => {
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('description');
      expect(typeof c.name).toBe('string');
      expect(typeof c.description).toBe('string');
    });
  });

  it('detects spell slot expansion for Magician (pinned: level 1→2 gains rank-1 slots)', () => {
    const changes = getLevelUpFeatures('Magician', 1, 2);
    const slot = changes.find(c => c.name === 'Spell Slots Expand');
    expect(slot).toBeDefined();
    expect(slot!.description).toContain('Rank 1');
  });

  it('detects glamour increase for Enchanter', () => {
    // Enchanter uses glamours (not spell slots)
    let foundGlamour = false;
    for (let lvl = 1; lvl <= 9; lvl++) {
      const changes = getLevelUpFeatures('Enchanter', lvl, lvl + 1);
      if (changes.some(c => c.name === 'Glamours Known')) {
        foundGlamour = true;
        break;
      }
    }
    expect(foundGlamour).toBe(true);
  });

  it('detects acBonus increase for Friar', () => {
    // Find a Friar level where the unarmed AC bonus improves
    let foundAcBonus = false;
    for (let lvl = 1; lvl <= 9; lvl++) {
      const changes = getLevelUpFeatures('Friar', lvl, lvl + 1);
      if (changes.some(c => c.name === 'Unarmed AC Bonus Improves')) {
        foundAcBonus = true;
        break;
      }
    }
    expect(foundAcBonus).toBe(true);
  });

  it('returns empty array when nothing changes between levels (Fighter 10→11)', () => {
    const changes = getLevelUpFeatures('Fighter', 10, 11);
    expect(changes).toEqual([]);
  });
});
