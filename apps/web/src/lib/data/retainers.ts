import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for `retainers` rows.
 *
 * Rows are kept snake_case (matching the DB) because the stats UI
 * consumes them as-is; the shared type + queries here replace the
 * inline supabase calls that used to live in StatsTab.
 */

export interface DBRetainer {
  id: string;
  name: string;
  kindred: string;
  character_class: string;
  level: number;
  ac: number;
  hp_current: number;
  hp_max: number;
  attack_bonus: number;
  morale: number;
  loyalty: number;
  wage_type: 'daily' | 'share';
  wage_amount: number;
}

/** Retainers still in service (not yet promoted to a full PC). */
export async function listActiveRetainers(
  supabase: SupabaseClient,
  ownerCharacterId: string,
): Promise<DBRetainer[]> {
  const { data } = await supabase
    .from('retainers')
    .select('*')
    .eq('owner_character_id', ownerCharacterId)
    .eq('is_promoted_to_pc', false)
    .order('created_at');
  return (data ?? []) as DBRetainer[];
}

export async function insertRetainer(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<DBRetainer | null> {
  const { data, error } = await supabase
    .from('retainers')
    .insert(payload)
    .select()
    .single();
  if (error || !data) return null;
  return data as DBRetainer;
}

export async function updateRetainerHP(
  supabase: SupabaseClient,
  id: string,
  hpCurrent: number,
): Promise<void> {
  await supabase.from('retainers').update({ hp_current: hpCurrent }).eq('id', id);
}

export async function markRetainerPromoted(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('retainers').update({ is_promoted_to_pc: true }).eq('id', id);
}

export async function deleteRetainer(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('retainers').delete().eq('id', id);
}
