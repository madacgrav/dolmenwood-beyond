import spellSlotData from './data/spell-slots.json';
import spellData from './data/spells.json';

// ─── Spell name lookup ────────────────────────────────────────────────────────

export interface SpellEntry {
  name: string;
  rank: number | 'glamour';
}

/**
 * Returns all spells available to a class, optionally filtered by rank.
 * For Enchanter (glamour class) all spells are returned with rank 'glamour'.
 */
export function getSpellsForClass(className: string, rank?: number): SpellEntry[] {
  const classSpells = (spellData as Record<string, Record<string, string[]>>)[className];
  if (!classSpells) return [];

  // Glamour classes store spells under a 'glamours' key
  if (classSpells['glamours']) {
    return classSpells['glamours'].map(name => ({ name, rank: 'glamour' as const }));
  }

  const results: SpellEntry[] = [];
  for (const [key, spells] of Object.entries(classSpells)) {
    const r = parseInt(key.replace('rank', ''), 10);
    if (!isNaN(r) && (!rank || r === rank)) {
      spells.forEach(name => results.push({ name, rank: r }));
    }
  }
  return results;
}


export type SpellcastingClass = keyof typeof spellSlotData;

export interface SpellSlotRow {
  level: number;
  rank1: number;
  rank2: number;
  rank3: number;
  rank4: number;
  rank5: number;
  rank6?: number;
}

export function getSpellSlots(className: string, level: number): Record<string | number, number> | null {
  const classEntry = (spellSlotData as Record<string, { slotsPerLevel?: SpellSlotRow[]; glamoursKnownByLevel?: number[] }>)[className];
  if (!classEntry) return null;

  if (classEntry.glamoursKnownByLevel) {
    return { glamours: classEntry.glamoursKnownByLevel[level - 1] ?? 0 };
  }

  const row = classEntry.slotsPerLevel?.find((r) => r.level === level);
  if (!row) return null;

  const slots: Record<number, number> = {};
  for (let rank = 1; rank <= 6; rank++) {
    const val = (row as unknown as Record<string, number>)[`rank${rank}`];
    if (val !== undefined && val > 0) slots[rank] = val;
  }
  return slots;
}

export function isSpellcaster(className: string): boolean {
  return className in spellSlotData;
}

export const SPELLCASTING_CLASSES = Object.keys(spellSlotData) as SpellcastingClass[];
