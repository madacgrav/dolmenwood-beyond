import { describe, it, expect } from 'vitest';
import { getSpellSlots, isSpellcaster, SPELLCASTING_CLASSES } from '../spells';

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
