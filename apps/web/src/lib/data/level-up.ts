import type { SupabaseClient } from '@supabase/supabase-js';
import type { LevelUpFeature } from '@dolmenwood/rules-engine';

/**
 * Single source of truth for the `level_up` RPC, following the
 * `lib/data/inventory.ts` style (supabase first param, plain data in/out).
 */

export interface LevelUpParams {
  characterId: string;
  newLevel: number;
  hpGain: number;
  hpRoll: number;
  features: LevelUpFeature[];
  xpThreshold: number;
}

/** Calls the `level_up` RPC. Returns an error message, or null on success. */
export async function levelUpCharacter(
  supabase: SupabaseClient,
  { characterId, newLevel, hpGain, hpRoll, features, xpThreshold }: LevelUpParams,
): Promise<string | null> {
  const { error } = await supabase.rpc('level_up', {
    p_character_id:  characterId,
    p_new_level:     newLevel,
    p_hp_gain:       hpGain,
    p_hp_roll:       hpRoll,
    p_changes:       features.map(f => ({ field: f.name, oldValue: '', newValue: f.description })),
    p_xp_threshold:  xpThreshold,
  });
  return error ? error.message : null;
}
