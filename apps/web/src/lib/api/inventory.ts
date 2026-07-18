/**
 * Client-side wrappers over /api/characters/[id]/inventory, plus the
 * snake_case UI shapes the inventory/combat components were built against
 * (kept from the Supabase era to avoid churn).
 */
import type { ArmorBulk } from '@dolmenwood/types';

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
  is_shield?: boolean;
  armor_bulk?: ArmorBulk | null;
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

export async function listInventory(characterId: string): Promise<InventoryItem[]> {
  const res = await fetch(`/api/characters/${characterId}/inventory`);
  if (!res.ok) return [];
  const body = await res.json();
  return body.items ?? [];
}

/** Ammo = item_type 'ammo' plus legacy name-pattern matches (was a DB ilike filter). */
const AMMO_NAME_PATTERN = /arrow|quarrel|stone|bolt/i;

export async function listAmmo(characterId: string): Promise<AmmoItem[]> {
  const items = await listInventory(characterId);
  return items
    .filter((i) => i.item_type === 'ammo' || AMMO_NAME_PATTERN.test(i.item_name))
    .map((i) => ({ id: i.id, item_name: i.item_name, quantity: i.quantity }));
}

export async function listEquippedWeapons(characterId: string): Promise<EquippedWeapon[]> {
  const items = await listInventory(characterId);
  return items
    .filter((i) => i.item_type === 'weapon' && i.location === 'equipped')
    .map((i) => ({ id: i.id, item_name: i.item_name, weapon_damage_dice: i.weapon_damage_dice ?? null }));
}

/** Payload keeps the snake_case add-form shape (character_id included). */
export async function insertInventoryItem(
  payload: Record<string, unknown>,
): Promise<InventoryItem | null> {
  const characterId = payload.character_id as string;
  const res = await fetch(`/api/characters/${characterId}/inventory`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function updateItemQuantity(
  characterId: string,
  itemId: string,
  quantity: number,
): Promise<void> {
  await fetch(`/api/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quantity }),
  });
}

export async function updateItemLocation(
  characterId: string,
  itemId: string,
  location: ItemLocation,
): Promise<void> {
  await fetch(`/api/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location }),
  });
}

export async function updateItemNotes(
  characterId: string,
  itemId: string,
  notes: string | null,
): Promise<void> {
  await fetch(`/api/characters/${characterId}/inventory/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  });
}

export async function deleteInventoryItem(characterId: string, itemId: string): Promise<void> {
  await fetch(`/api/characters/${characterId}/inventory/${itemId}`, { method: 'DELETE' });
}
