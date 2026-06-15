import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for the spell tables: `spell_slots`,
 * `spell_preparations`, and `character_spells`.
 *
 * Rows are kept snake_case (matching the DB) because the magic UI
 * consumes them as-is, same as inventory.ts.
 */

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
}

export interface MagicData {
  slots: DBSpellSlot[];
  preparations: DBPreparation[];
  spells: DBSpell[];
}

/** Parallel fetch of slots + preparations + spells (single round-trip batch). */
export async function fetchMagicData(
  supabase: SupabaseClient,
  characterId: string,
): Promise<MagicData> {
  const [
    { data: slotData },
    { data: prepData },
    { data: spellData },
  ] = await Promise.all([
    supabase.from('spell_slots').select('*').eq('character_id', characterId).order('spell_rank'),
    supabase.from('spell_preparations').select('*').eq('character_id', characterId).order('created_at'),
    supabase.from('character_spells').select('*').eq('character_id', characterId).order('spell_level'),
  ]);
  return {
    slots: (slotData ?? []) as DBSpellSlot[],
    preparations: (prepData ?? []) as DBPreparation[],
    spells: (spellData ?? []) as DBSpell[],
  };
}

export async function listSpellSlots(
  supabase: SupabaseClient,
  characterId: string,
): Promise<DBSpellSlot[]> {
  const { data } = await supabase
    .from('spell_slots')
    .select('*')
    .eq('character_id', characterId)
    .order('spell_rank');
  return (data ?? []) as DBSpellSlot[];
}

/**
 * Insert initial slot rows for a character.
 * Returns null on error (e.g. 23505 duplicate key when another tab won the race).
 */
export async function insertSpellSlots(
  supabase: SupabaseClient,
  inserts: Record<string, unknown>[],
): Promise<DBSpellSlot[] | null> {
  const { data, error } = await supabase
    .from('spell_slots')
    .insert(inserts)
    .select();
  if (error) return null;
  return (data ?? []) as DBSpellSlot[];
}

export async function updateSlotTotals(
  supabase: SupabaseClient,
  id: string,
  slots_total: number,
  slots_used: number,
): Promise<void> {
  await supabase.from('spell_slots').update({ slots_total, slots_used }).eq('id', id);
}

export async function updateSlotUsage(
  supabase: SupabaseClient,
  id: string,
  slots_used: number,
): Promise<void> {
  await supabase.from('spell_slots').update({ slots_used }).eq('id', id);
}

/** End-of-day rest: delete all preparations and zero out slot usage. */
export async function resetSpellsForRest(
  supabase: SupabaseClient,
  characterId: string,
): Promise<void> {
  await Promise.all([
    supabase.from('spell_preparations').delete().eq('character_id', characterId),
    supabase.from('spell_slots').update({ slots_used: 0 }).eq('character_id', characterId),
  ]);
}

export async function insertPreparation(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<DBPreparation | null> {
  const { data, error } = await supabase
    .from('spell_preparations')
    .insert(payload)
    .select()
    .single();
  if (error || !data) return null;
  return data as DBPreparation;
}

export async function updatePreparationCast(
  supabase: SupabaseClient,
  id: string,
  is_cast: boolean,
): Promise<void> {
  await supabase.from('spell_preparations').update({ is_cast }).eq('id', id);
}

export async function insertCharacterSpell(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<DBSpell | null> {
  const { data, error } = await supabase
    .from('character_spells')
    .insert(payload)
    .select()
    .single();
  if (error || !data) return null;
  return data as DBSpell;
}

export async function updateSpellMemorized(
  supabase: SupabaseClient,
  id: string,
  is_memorized: boolean,
): Promise<void> {
  await supabase.from('character_spells').update({ is_memorized }).eq('id', id);
}

export async function deleteCharacterSpell(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('character_spells').delete().eq('id', id);
}
