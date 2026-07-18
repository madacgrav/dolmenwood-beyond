import { requireAccountId } from '@/lib/auth/session';
import { assertCharacterOwner, badRequest, notFound } from '@/lib/authz';
import type { ArmorBulk } from '@dolmenwood/types';
import type { CharacterDoc, InventoryEntryDoc } from '@/lib/cosmos/types';
import type { InventoryItem, ItemLocation } from '@/lib/api/inventory';
import { mutateOwnedCharacterDoc } from './characters';

/**
 * Server-only inventory access: entries are embedded in the character doc
 * (pk /ownerId), so every operation is an owner-asserted read or an
 * ETag-guarded mutation of that one document.
 */

function entryToItem(characterId: string, e: InventoryEntryDoc): InventoryItem {
  return {
    id: e.id,
    character_id: characterId,
    item_name: e.itemName,
    item_type: e.itemType,
    quantity: e.quantity,
    weight_coins: e.weightCoins,
    notes: e.notes ?? undefined,
    location: e.location,
    weapon_damage_dice: e.weaponDamageDice,
    armor_ac_bonus: e.armorAcBonus,
    is_shield: e.isShield ?? false,
    armor_bulk: e.armorBulk ?? null,
  };
}

const LOCATION_ORDER: Record<string, number> = { equipped: 0, stowed: 1, tiny: 2 };

function sortedEntries(doc: CharacterDoc): InventoryEntryDoc[] {
  // Preserve the old list ordering: by location, then item type.
  return [...(doc.inventory ?? [])].sort(
    (a, b) =>
      (LOCATION_ORDER[a.location] ?? 9) - (LOCATION_ORDER[b.location] ?? 9) ||
      a.itemType.localeCompare(b.itemType),
  );
}

export async function listInventory(characterId: string): Promise<InventoryItem[]> {
  const me = await requireAccountId();
  const doc = await assertCharacterOwner(me, characterId);
  return sortedEntries(doc).map((e) => entryToItem(characterId, e));
}

export interface NewInventoryEntryInput {
  item_name: string;
  item_type: string;
  quantity?: number;
  weight_coins?: number;
  notes?: string | null;
  location?: ItemLocation;
  weapon_damage_dice?: string | null;
  armor_ac_bonus?: number | null;
  is_shield?: boolean;
  armor_bulk?: ArmorBulk | null;
  catalog_item_id?: string | null;
}

export async function addInventoryItem(
  characterId: string,
  input: NewInventoryEntryInput,
): Promise<InventoryItem> {
  const name = String(input.item_name ?? '').trim();
  if (!name) throw badRequest('item_name is required');
  const entry: InventoryEntryDoc = {
    id: crypto.randomUUID(),
    itemName: name,
    itemType: String(input.item_type ?? 'gear'),
    quantity: Math.max(1, Number(input.quantity) || 1),
    weightCoins: Math.max(0, Number(input.weight_coins) || 0),
    notes: input.notes ?? null,
    location: (['equipped', 'stowed', 'tiny'] as const).includes(input.location as ItemLocation)
      ? (input.location as ItemLocation)
      : 'stowed',
    weaponDamageDice: input.weapon_damage_dice ?? null,
    armorAcBonus: input.armor_ac_bonus ?? null,
    isShield: input.is_shield ?? false,
    armorBulk: input.armor_bulk ?? null,
    catalogItemId: input.catalog_item_id ?? null,
  };
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.inventory = [...(doc.inventory ?? []), entry];
  });
  return entryToItem(characterId, entry);
}

export async function updateInventoryEntry(
  characterId: string,
  itemId: string,
  patch: { quantity?: number; location?: ItemLocation; notes?: string | null },
): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    const entry = (doc.inventory ?? []).find((e) => e.id === itemId);
    if (!entry) throw notFound('inventory item');
    if (patch.quantity !== undefined) entry.quantity = Math.max(0, Number(patch.quantity) || 0);
    if (patch.location !== undefined) {
      if (!(['equipped', 'stowed', 'tiny'] as const).includes(patch.location)) {
        throw badRequest('invalid location');
      }
      entry.location = patch.location;
    }
    if (patch.notes !== undefined) {
      const n = patch.notes === null ? null : String(patch.notes).trim().slice(0, 500);
      entry.notes = n && n.length ? n : null;
    }
  });
}

export async function removeInventoryItem(characterId: string, itemId: string): Promise<void> {
  await mutateOwnedCharacterDoc(characterId, (doc) => {
    doc.inventory = (doc.inventory ?? []).filter((e) => e.id !== itemId);
  });
}

/** Sum of equipped armor bonuses on an already-loaded doc (used by the roster). */
export function equippedArmorBonusOf(doc: CharacterDoc): number {
  return (doc.inventory ?? [])
    .filter((e) => e.location === 'equipped')
    .reduce((sum, e) => sum + (e.armorAcBonus ?? 0), 0);
}
