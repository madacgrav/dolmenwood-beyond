import spellSlotData from './data/spell-slots.json';

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
