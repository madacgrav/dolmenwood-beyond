import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for `mounts` rows.
 *
 * Rows are kept snake_case (matching the DB) because the combat UI
 * consumes them as-is; the shared type + queries here replace the
 * inline supabase calls that used to live in CombatTab.
 */

export interface DBMount {
  id: string;
  owner_id: string;
  owner_type: string;
  character_id: string | null;
  campaign_id: string | null;
  name: string;
  mount_type: string;
  speed: number;
  has_full_stats: boolean;
  ac: number | null;
  hp_current: number | null;
  hp_max: number | null;
  attack_bonus: number | null;
  morale: number | null;
  created_at: string;
}

export async function listCharacterMounts(
  supabase: SupabaseClient,
  characterId: string,
): Promise<DBMount[]> {
  const { data } = await supabase
    .from('mounts')
    .select('*')
    .eq('character_id', characterId)
    .eq('owner_type', 'character')
    .order('created_at');
  return (data ?? []) as DBMount[];
}

export async function insertMount(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<DBMount | null> {
  const { data, error } = await supabase
    .from('mounts')
    .insert(payload)
    .select()
    .single();
  if (error || !data) return null;
  return data as DBMount;
}

export async function updateMountHP(
  supabase: SupabaseClient,
  id: string,
  hpCurrent: number,
): Promise<void> {
  await supabase.from('mounts').update({ hp_current: hpCurrent }).eq('id', id);
}

export async function deleteMount(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('mounts').delete().eq('id', id);
}
