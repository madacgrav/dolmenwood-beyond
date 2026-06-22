import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Single source of truth for `character_inventory` rows.
 *
 * Rows are kept snake_case (matching the DB) because the inventory UI
 * consumes them as-is; the shared type + mapper here replaces the
 * hand-copied casts that used to live in InventoryTab and CombatTab.
 */

export type ItemLocation = 'equipped' | 'stowed' | 'tiny';

export interface InventoryItem {
  id: string;
  character_id: string;
  item_name: string;
  item_type: string;
  quantity: number;
  weight_coins: number;
  notes?: string;
  location: ItemLocation;
  weapon_damage_dice?: string | null;
  armor_ac_bonus?: number | null;
}

export interface AmmoItem {
  id: string;
  item_name: string;
  quantity: number;
}

export interface EquippedWeapon {
  id: string;
  item_name: string;
  weapon_damage_dice: string | null;
}

export function mapInventoryRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    character_id: row.character_id as string,
    item_name: row.item_name as string,
    item_type: row.item_type as string,
    quantity: row.quantity as number,
    weight_coins: row.weight_coins as number,
    notes: row.notes as string | undefined,
    location: ((row.location as string) ?? 'stowed') as ItemLocation,
    weapon_damage_dice: row.weapon_damage_dice as string | null | undefined,
    armor_ac_bonus: row.armor_ac_bonus as number | null | undefined,
  };
}

export async function listInventory(
  supabase: SupabaseClient,
  characterId: string,
): Promise<InventoryItem[]> {
  const { data } = await supabase
    .from('character_inventory')
    .select('*')
    .eq('character_id', characterId)
    .order('location')
    .order('item_type');
  return (data ?? []).map(mapInventoryRow);
}

/** Ammo = item_type 'ammo' plus legacy name-pattern matches. */
export async function listAmmo(
  supabase: SupabaseClient,
  characterId: string,
): Promise<AmmoItem[]> {
  const { data } = await supabase
    .from('character_inventory')
    .select('id, item_name, quantity')
    .eq('character_id', characterId)
    .or('item_type.eq.ammo,item_name.ilike.%Arrow%,item_name.ilike.%Quarrel%,item_name.ilike.%Stone%,item_name.ilike.%Bolt%');
  return (data ?? []).map((r: Record<string, unknown>) => ({
    id: r.id as string,
    item_name: r.item_name as string,
    quantity: r.quantity as number,
  }));
}

export async function listEquippedWeapons(
  supabase: SupabaseClient,
  characterId: string,
): Promise<EquippedWeapon[]> {
  const { data } = await supabase
    .from('character_inventory')
    .select('id, item_name, weapon_damage_dice')
    .eq('character_id', characterId)
    .eq('item_type', 'weapon')
    .eq('location', 'equipped');
  return (data ?? []) as EquippedWeapon[];
}

export async function insertInventoryItem(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<InventoryItem | null> {
  const { data, error } = await supabase
    .from('character_inventory')
    .insert(payload)
    .select()
    .single();
  if (error || !data) return null;
  return mapInventoryRow(data as Record<string, unknown>);
}

export async function updateItemQuantity(
  supabase: SupabaseClient,
  id: string,
  quantity: number,
): Promise<void> {
  await supabase.from('character_inventory').update({ quantity }).eq('id', id);
}

export async function updateItemLocation(
  supabase: SupabaseClient,
  id: string,
  location: ItemLocation,
): Promise<void> {
  await supabase.from('character_inventory').update({ location }).eq('id', id);
}

export async function deleteInventoryItem(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  await supabase.from('character_inventory').delete().eq('id', id);
}

/** Sum of armor_ac_bonus over a character's equipped items. */
export async function fetchEquippedArmorBonus(
  supabase: SupabaseClient,
  characterId: string,
): Promise<number> {
  const { data } = await supabase
    .from('character_inventory')
    .select('armor_ac_bonus')
    .eq('character_id', characterId)
    .eq('location', 'equipped');
  return (data ?? []).reduce(
    (sum, r: Record<string, unknown>) => sum + ((r.armor_ac_bonus as number) ?? 0),
    0,
  );
}

/** Batched: equipped armor bonus per character id (one query for the roster). */
export async function fetchEquippedArmorBonuses(
  supabase: SupabaseClient,
  characterIds: string[],
): Promise<Record<string, number>> {
  if (characterIds.length === 0) return {};
  const { data } = await supabase
    .from('character_inventory')
    .select('character_id, armor_ac_bonus')
    .in('character_id', characterIds)
    .eq('location', 'equipped');
  const map: Record<string, number> = {};
  for (const r of (data ?? []) as Record<string, unknown>[]) {
    const id = r.character_id as string;
    map[id] = (map[id] ?? 0) + ((r.armor_ac_bonus as number) ?? 0);
  }
  return map;
}
