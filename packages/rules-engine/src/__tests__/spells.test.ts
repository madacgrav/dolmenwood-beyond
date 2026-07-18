import { describe, it, expect } from 'vitest';
import { getSpellSlots, isSpellcaster, SPELLCASTING_CLASSES, getSpellsForClass, getRunesForClass, classHasRunes, getRuneTier } from '../spells';

describe('Spell Slots', () => {
  it('Cleric level 1 has no spell slots', () => {
    const slots = getSpellSlots('Cleric', 1);
    expect(slots).not.toBeNull();
    expect(Object.keys(slots!).length).toBe(0);
  });

  it('Cleric level 2 has exactly 1 rank-1 slot', () => {
    const slots = getSpellSlots('Cleric', 2);
    expect(slots![1]).toBe(1);
  });

  it('Cleric level 15 has rank-1 through rank-5 slots (5 ranks only, no rank-6)', () => {
    const slots = getSpellSlots('Cleric', 15);
    expect(slots).not.toBeNull();
    expect(slots![1]).toBeGreaterThan(0);
    expect(slots![5]).toBeGreaterThan(0);
    expect(slots![6]).toBeUndefined(); // Cleric maxRank is 5
  });

  it('Friar level 1 has rank 1 slots', () => {
    const slots = getSpellSlots('Friar', 1);
    expect(slots![1]).toBeGreaterThan(0);
  });

  it('Magician level 1 has exactly 1 rank-1 slot', () => {
    const slots = getSpellSlots('Magician', 1);
    expect(slots![1]).toBe(1);
  });

  it('Magician level 11 has rank-6 slots', () => {
    const slots = getSpellSlots('Magician', 11);
    expect(slots![6]).toBe(1);
  });

  it('Bard is a spellcaster with rank 1-3 slots', () => {
    expect(isSpellcaster('Bard')).toBe(true);
    const slots = getSpellSlots('Bard', 1);
    expect(slots).not.toBeNull();
    // Bard level 1 has no slots (starts at level 2)
    expect(Object.keys(slots!).length).toBe(0);
    const slots2 = getSpellSlots('Bard', 2);
    expect(slots2![1]).toBe(1);
  });

  it('Enchanter returns glamour count not slot rows', () => {
    const slots = getSpellSlots('Enchanter', 1);
    expect(slots).not.toBeNull();
    expect('glamours' in slots!).toBe(true);
    expect((slots as { glamours: number }).glamours).toBe(1);
  });

  it('Fighter is not a spellcaster', () => {
    expect(isSpellcaster('Fighter')).toBe(false);
  });

  it('Cleric is a spellcaster', () => {
    expect(isSpellcaster('Cleric')).toBe(true);
  });

  it('returns null for non-spellcasting class', () => {
    expect(getSpellSlots('Fighter', 1)).toBeNull();
  });

  it('SPELLCASTING_CLASSES contains expected casters including Bard', () => {
    expect(SPELLCASTING_CLASSES).toContain('Cleric');
    expect(SPELLCASTING_CLASSES).toContain('Magician');
    expect(SPELLCASTING_CLASSES).toContain('Friar');
    expect(SPELLCASTING_CLASSES).toContain('Bard');
    expect(SPELLCASTING_CLASSES).toContain('Enchanter');
  });
});

describe('getSpellsForClass', () => {
  it('returns all Magician spells when no rank filter (60+ entries)', () => {
    const spells = getSpellsForClass('Magician');
    expect(spells.length).toBeGreaterThan(50);
    spells.forEach(s => expect(typeof s.rank).toBe('number'));
  });

  it('filters Magician to rank-1 only (11 spells)', () => {
    const spells = getSpellsForClass('Magician', 1);
    expect(spells).toHaveLength(11);
    spells.forEach(s => expect(s.rank).toBe(1));
  });

  it('filters Magician to rank-6 (12 spells)', () => {
    const spells = getSpellsForClass('Magician', 6);
    expect(spells).toHaveLength(12);
    spells.forEach(s => expect(s.rank).toBe(6));
  });

  it('Cleric has no rank-6 spells (maxRank is 5)', () => {
    const spells = getSpellsForClass('Cleric', 6);
    expect(spells).toHaveLength(0);
  });

  it('Friar rank-4 spells are accessible', () => {
    const spells = getSpellsForClass('Friar', 4);
    expect(spells.length).toBeGreaterThan(0);
    spells.forEach(s => expect(s.rank).toBe(4));
  });

  it('Bard rank-3 spells are accessible', () => {
    const spells = getSpellsForClass('Bard', 3);
    expect(spells).toHaveLength(5);
    spells.forEach(s => expect(s.rank).toBe(3));
  });

  it('Enchanter returns all glamours (no rank filter)', () => {
    const spells = getSpellsForClass('Enchanter');
    expect(spells.length).toBeGreaterThan(15);
    spells.forEach(s => expect(s.rank).toBe('glamour'));
  });

  it('Enchanter with rank filter returns empty (glamours are unranked)', () => {
    const spells = getSpellsForClass('Enchanter', 1);
    expect(spells).toHaveLength(0);
  });

  it('unknown class returns empty array', () => {
    expect(getSpellsForClass('Fighter')).toHaveLength(0);
    expect(getSpellsForClass('')).toHaveLength(0);
    expect(getSpellsForClass('Knight')).toHaveLength(0);
  });

  it('rank=0 correctly returns empty (not all spells)', () => {
    // rank === 0 should return [] because no rank key is 0 in the JSON
    const spells = getSpellsForClass('Magician', 0);
    expect(spells).toHaveLength(0);
  });

  it('rank=undefined returns all ranks (not filtered)', () => {
    const all = getSpellsForClass('Cleric');
    const rank1 = getSpellsForClass('Cleric', 1);
    expect(all.length).toBeGreaterThan(rank1.length);
  });

  it('spell entries have name and rank fields', () => {
    const spells = getSpellsForClass('Magician', 1);
    const first = spells[0]!;
    expect(typeof first.name).toBe('string');
    expect(first.name.length).toBeGreaterThan(0);
    expect(first.rank).toBe(1);
  });
});


describe('Spell Slots', () => {
  it('Cleric level 1 has no spell slots', () => {
    const slots = getSpellSlots('Cleric', 1);
    expect(slots).not.toBeNull();
    expect(Object.keys(slots!).length).toBe(0);
  });

  it('Cleric level 2 has rank 1 slots', () => {
    const slots = getSpellSlots('Cleric', 2);
    expect(slots![1]).toBeGreaterThan(0);
  });

  it('Friar level 1 has rank 1 slots', () => {
    const slots = getSpellSlots('Friar', 1);
    expect(slots![1]).toBeGreaterThan(0);
  });

  it('Magician level 1 has rank 1 slots', () => {
    const slots = getSpellSlots('Magician', 1);
    expect(slots![1]).toBeGreaterThan(0);
  });

  it('Fighter is not a spellcaster', () => {
    expect(isSpellcaster('Fighter')).toBe(false);
  });

  it('Cleric is a spellcaster', () => {
    expect(isSpellcaster('Cleric')).toBe(true);
  });

  it('returns null for non-spellcasting class', () => {
    expect(getSpellSlots('Fighter', 1)).toBeNull();
  });

  it('SPELLCASTING_CLASSES contains expected casters', () => {
    expect(SPELLCASTING_CLASSES).toContain('Cleric');
    expect(SPELLCASTING_CLASSES).toContain('Magician');
    expect(SPELLCASTING_CLASSES).toContain('Friar');
  });
});

describe('getRunesForClass', () => {
  it('returns 18 Enchanter runes, 6 per tier, in tier order', () => {
    const runes = getRunesForClass('Enchanter');
    expect(runes).toHaveLength(18);
    expect(runes.filter(r => r.tier === 'lesser')).toHaveLength(6);
    expect(runes.filter(r => r.tier === 'greater')).toHaveLength(6);
    expect(runes.filter(r => r.tier === 'mighty')).toHaveLength(6);
    expect(runes[0]).toEqual({ name: 'Deathly Blossom', tier: 'lesser' });
  });

  it('returns [] for non-rune classes', () => {
    expect(getRunesForClass('Magician')).toEqual([]);
    expect(getRunesForClass('Fighter')).toEqual([]);
  });
});

describe('classHasRunes / getRuneTier', () => {
  it('only Enchanter has runes', () => {
    expect(classHasRunes('Enchanter')).toBe(true);
    expect(classHasRunes('Magician')).toBe(false);
  });

  it('looks up tier by name, null for unknown', () => {
    expect(getRuneTier('Enchanter', 'Fairy Gold')).toBe('greater');
    expect(getRuneTier('Enchanter', 'Rune of Death')).toBe('mighty');
    expect(getRuneTier('Enchanter', 'Homebrew Rune')).toBeNull();
  });
});
