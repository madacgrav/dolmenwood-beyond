import spellSlotData from './data/spell-slots.json';
import spellData from './data/spells.json';
import runeData from './data/runes.json';

// ─── Spell name lookup ────────────────────────────────────────────────────────

export interface SpellEntry {
  name: string;
  rank: number | 'glamour';
}

/**
 * Returns all spells available to a class, optionally filtered by rank.
 * For glamour classes (Enchanter), spells are returned with rank 'glamour'
 * only when no rank filter is applied (glamours are unranked).
 */
export function getSpellsForClass(className: string, rank?: number): SpellEntry[] {
  const classSpells = (spellData as Record<string, Record<string, string[]>>)[className];
  if (!classSpells) return [];

  // Glamour classes store spells under a 'glamours' key.
  // Glamours are unranked — a numeric rank filter returns nothing.
  if (classSpells['glamours']) {
    if (rank !== undefined) return [];
    return classSpells['glamours'].map(name => ({ name, rank: 'glamour' as const }));
  }

  const results: SpellEntry[] = [];
  for (const [key, spells] of Object.entries(classSpells)) {
    const r = parseInt(key.replace('rank', ''), 10);
    if (!isNaN(r) && (rank === undefined || r === rank)) {
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
  rank4?: number;
  rank5?: number;
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

// ─── Fairy runes ──────────────────────────────────────────────────────────────

export type RuneTier = 'lesser' | 'greater' | 'mighty';

export interface RuneEntry {
  name: string;
  tier: RuneTier;
}

const RUNE_TIERS: RuneTier[] = ['lesser', 'greater', 'mighty'];

/** All fairy runes a class can learn, flattened in tier order. [] for non-rune classes. */
export function getRunesForClass(className: string): RuneEntry[] {
  const entry = (runeData as Record<string, Partial<Record<RuneTier, string[]>>>)[className];
  if (!entry) return [];
  return RUNE_TIERS.flatMap(tier => (entry[tier] ?? []).map(name => ({ name, tier })));
}

export function classHasRunes(className: string): boolean {
  return getRunesForClass(className).length > 0;
}

/** Tier of a known rune name, or null for free-text/unknown runes. */
export function getRuneTier(className: string, runeName: string): RuneTier | null {
  return getRunesForClass(className).find(r => r.name === runeName)?.tier ?? null;
}

export const SPELLCASTING_CLASSES = Object.keys(spellSlotData) as SpellcastingClass[];
