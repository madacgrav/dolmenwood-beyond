/**
 * Client-side wrappers over /api/characters/[id]/magic, plus the snake_case
 * UI shapes the magic components were built against. Mutations go through a
 * single op-dispatch POST — the embedded arrays live on one document, so
 * splitting them across REST resources would buy nothing.
 */

import type { DwDate } from '@dolmenwood/rules-engine';

export interface DBSpellSlot {
  id: string;
  character_id: string;
  spell_rank: number;
  slots_total: number;
  slots_used: number;
}

export interface DBPreparation {
  id: string;
  character_id: string;
  slot_rank: number;
  spell_name: string;
  is_cast: boolean;
  created_at: string;
}

export interface DBSpell {
  id: string;
  character_id: string;
  spell_name: string;
  spell_level: number;
  is_memorized: boolean;
  notes?: string;
  kind?: 'spell' | 'glamour' | 'rune';
}

export interface MagicData {
  slots: DBSpellSlot[];
  preparations: DBPreparation[];
  spells: DBSpell[];
}

async function magicOp<T>(characterId: string, body: Record<string, unknown>): Promise<T | null> {
  const res = await fetch(`/api/characters/${characterId}/magic`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchMagicData(characterId: string): Promise<MagicData> {
  const res = await fetch(`/api/characters/${characterId}/magic`);
  if (!res.ok) return { slots: [], preparations: [], spells: [] };
  return res.json();
}

export async function listSpellSlots(characterId: string): Promise<DBSpellSlot[]> {
  return (await fetchMagicData(characterId)).slots;
}

/**
 * Initialise slot rows. Returns null when slots already exist (another tab
 * won the race) — callers then re-list, matching the old 23505 semantics.
 */
export async function insertSpellSlots(
  characterId: string,
  inserts: Record<string, unknown>[],
): Promise<DBSpellSlot[] | null> {
  const result = await magicOp<{ alreadyInitialized?: boolean; slots: DBSpellSlot[] }>(
    characterId,
    { op: 'initSlots', slots: inserts },
  );
  if (!result || result.alreadyInitialized) return null;
  return result.slots;
}

export async function updateSlotTotals(
  characterId: string,
  slotId: string,
  slots_total: number,
  slots_used: number,
): Promise<void> {
  await magicOp(characterId, { op: 'updateSlotTotals', slotId, slots_total, slots_used });
}

export async function updateSlotUsage(
  characterId: string,
  slotId: string,
  slots_used: number,
): Promise<void> {
  await magicOp(characterId, { op: 'updateSlotUsage', slotId, slots_used });
}

/** End-of-day rest: delete all preparations and zero out slot usage.
 *  Pass the campaign's in-world date to stamp `lastRestDate` on the character. */
export async function resetSpellsForRest(characterId: string, restDate?: DwDate): Promise<void> {
  await magicOp(characterId, restDate ? { op: 'rest', restDate } : { op: 'rest' });
}

export async function insertPreparation(
  characterId: string,
  payload: Record<string, unknown>,
): Promise<DBPreparation | null> {
  return magicOp<DBPreparation>(characterId, { op: 'addPreparation', ...payload });
}

export async function updatePreparationCast(
  characterId: string,
  prepId: string,
  is_cast: boolean,
): Promise<void> {
  await magicOp(characterId, { op: 'setPreparationCast', prepId, is_cast });
}

export async function insertCharacterSpell(
  characterId: string,
  payload: Record<string, unknown>,
): Promise<DBSpell | null> {
  return magicOp<DBSpell>(characterId, { op: 'addSpell', ...payload });
}

export async function updateSpellMemorized(
  characterId: string,
  spellId: string,
  is_memorized: boolean,
): Promise<void> {
  await magicOp(characterId, { op: 'setSpellMemorized', spellId, is_memorized });
}

export async function deleteCharacterSpell(characterId: string, spellId: string): Promise<void> {
  await magicOp(characterId, { op: 'deleteSpell', spellId });
}
