import { describe, it, expect } from 'vitest';
import { ALL_KINDREDS, getKindredACBonus, getKindredLanguages, getKindredTraits, getKindredData, isClassAllowedForKindred, getKindredXPBonus, getKindredMagicResistance, hasInnateGlamours, getMagicalKindredTraits, hasKnacks } from '../kindreds';
import { getMagicResistance } from '../retainers';

describe('Kindreds', () => {
  it('covers all 6 kindreds', () => {
    expect(ALL_KINDREDS).toHaveLength(6);
  });

  it('Breggle has AC bonus', () => {
    expect(getKindredACBonus('Breggle')).toBeGreaterThan(0);
  });

  it('all kindreds have native languages', () => {
    ALL_KINDREDS.forEach((k) => {
      expect(getKindredLanguages(k).length).toBeGreaterThan(0);
    });
  });

  it('all kindreds have traits', () => {
    ALL_KINDREDS.forEach((k) => {
      expect(getKindredTraits(k).length).toBeGreaterThan(0);
    });
  });

  it('returns null for unknown kindred', () => {
    expect(getKindredData('Unknown')).toBeNull();
    expect(getKindredACBonus('Unknown')).toBe(0);
  });

  it('isClassAllowedForKindred returns true for unknown kindred', () => {
    expect(isClassAllowedForKindred('Unknown', 'Fighter')).toBe(true);
  });

  describe('getKindredXPBonus', () => {
    it('returns 10 for Human (Spirited trait)', () => {
      expect(getKindredXPBonus('Human')).toBe(10);
    });

    it('returns 0 for Breggle', () => {
      expect(getKindredXPBonus('Breggle')).toBe(0);
    });

    it('returns 0 for Elf', () => {
      expect(getKindredXPBonus('Elf')).toBe(0);
    });

    it('returns 0 for Grimalkin', () => {
      expect(getKindredXPBonus('Grimalkin')).toBe(0);
    });

    it('returns 0 for Mossling', () => {
      expect(getKindredXPBonus('Mossling')).toBe(0);
    });

    it('returns 0 for Woodgrue', () => {
      expect(getKindredXPBonus('Woodgrue')).toBe(0);
    });

    it('returns 0 for unknown kindred', () => {
      expect(getKindredXPBonus('Unknown')).toBe(0);
    });
  });

  describe('getKindredMagicResistance', () => {
    it('returns 2 for Elf', () => {
      expect(getKindredMagicResistance('Elf')).toBe(2);
    });

    it('returns 2 for Grimalkin', () => {
      expect(getKindredMagicResistance('Grimalkin')).toBe(2);
    });

    it('returns 0 for Human', () => {
      expect(getKindredMagicResistance('Human')).toBe(0);
    });

    it('returns 0 for unknown kindred', () => {
      expect(getKindredMagicResistance('Unknown')).toBe(0);
    });

    it('combines with WIS modifier via getMagicResistance', () => {
      // WIS 16 = +2 modifier, Elf kindred bonus +2 = +4 total
      expect(getMagicResistance(16, getKindredMagicResistance('Elf'))).toBe(4);
    });
  });
});

describe('hasInnateGlamours', () => {
  it('true for Elf and Grimalkin, false otherwise', () => {
    expect(hasInnateGlamours('Elf')).toBe(true);
    expect(hasInnateGlamours('Grimalkin')).toBe(true);
    expect(hasInnateGlamours('Human')).toBe(false);
    expect(hasInnateGlamours('Breggle')).toBe(false);
  });
});

describe('getMagicalKindredTraits', () => {
  it('returns Glamours for Elf', () => {
    expect(getMagicalKindredTraits('Elf').map(t => t.name)).toEqual(['Glamours']);
  });
  it('returns Glamours and Shape-Shifting for Grimalkin', () => {
    expect(getMagicalKindredTraits('Grimalkin').map(t => t.name).sort()).toEqual(['Glamours', 'Shape-Shifting']);
  });
  it('returns Mad Revelry for Woodgrue', () => {
    expect(getMagicalKindredTraits('Woodgrue').map(t => t.name)).toEqual(['Mad Revelry']);
  });
  it('returns Knacks for Mossling', () => {
    expect(getMagicalKindredTraits('Mossling').map(t => t.name)).toEqual(['Knacks']);
  });
  it('returns empty for Human and Breggle', () => {
    expect(getMagicalKindredTraits('Human')).toEqual([]);
    expect(getMagicalKindredTraits('Breggle')).toEqual([]);
  });
});

describe('hasKnacks', () => {
  it('is true only for Mossling', () => {
    expect(hasKnacks('Mossling')).toBe(true);
    expect(hasKnacks('Elf')).toBe(false);
    expect(hasKnacks('Human')).toBe(false);
  });
});
