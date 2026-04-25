import { describe, it, expect } from 'vitest';
import { ALL_KINDREDS, getKindredACBonus, getKindredLanguages, getKindredTraits, getKindredData, isClassAllowedForKindred } from '../kindreds';

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
});
