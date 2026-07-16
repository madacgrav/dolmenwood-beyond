'use client';
import { useEffect, useState } from 'react';
import { insertInventoryItem, type InventoryItem as DBInventoryItem } from '@/lib/api/inventory';
import { ITEM_TYPES, type CatalogItem, type ItemType, type NewItemDraft } from './types';

const EMPTY_DRAFT: NewItemDraft = {
  item_name: '', item_type: 'gear', quantity: 1, weight_coins: 0,
  location: 'stowed', weapon_damage_dice: '', armor_ac_bonus: '',
  is_shield: false, armor_bulk: null,
};

/**
 * State + handlers for the add-item flow (custom entry and catalog picker).
 * Lives at the tab level so drafts and search text persist while the form
 * is closed and reopened, exactly as before the extraction.
 */
export function useAddItem({ characterId, onItemAdded }: {
  characterId: string;
  onItemAdded: (item: DBInventoryItem) => void;
}) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<'custom' | 'catalog'>('custom');
  const [newItem, setNewItem] = useState<NewItemDraft>(EMPTY_DRAFT);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
  const [catalogSearch, setCatalogSearch] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(false);

  useEffect(() => {
    if (addMode !== 'catalog') return;
    setCatalogLoading(true);
    // Catalog is served from Cosmos via the server route (no browser DB access).
    fetch('/api/catalog')
      .then((res) => (res.ok ? res.json() : []))
      .then((docs: {
        id: string; name: string; itemType: string; weight: number;
        costGp: number | null; weaponDamageDice: string | null;
        armorAcBonus: number | null; isShield?: boolean;
        armorBulk?: CatalogItem['armor_bulk']; notes: string | null;
      }[]) => {
        setCatalogItems(docs.map((d) => ({
          id: d.id,
          name: d.name,
          item_type: d.itemType,
          weight: d.weight,
          cost_gp: d.costGp,
          weapon_damage_dice: d.weaponDamageDice,
          armor_ac_bonus: d.armorAcBonus,
          is_shield: d.isShield ?? false,
          armor_bulk: d.armorBulk ?? null,
          notes: d.notes,
        })));
        setCatalogLoading(false);
      })
      .catch(() => setCatalogLoading(false));
  }, [addMode]);

  function selectCatalogItem(cat: CatalogItem) {
    const mappedType = cat.item_type === 'armor' ? 'armour' : cat.item_type as ItemType;
    setNewItem({
      item_name: cat.name,
      item_type: ITEM_TYPES.includes(mappedType as ItemType) ? mappedType as ItemType : 'gear',
      quantity: 1,
      weight_coins: cat.weight,
      location: cat.item_type === 'armor' || cat.item_type === 'weapon' ? 'equipped' : 'stowed',
      weapon_damage_dice: cat.weapon_damage_dice ?? '',
      armor_ac_bonus: cat.armor_ac_bonus != null ? String(cat.armor_ac_bonus) : '',
      is_shield: cat.is_shield,
      armor_bulk: cat.armor_bulk,
    });
    setAddMode('custom');
  }

  async function addItem() {
    if (!newItem.item_name.trim()) return;
    const payload: Record<string, unknown> = {
      character_id: characterId,
      item_name: newItem.item_name.trim(),
      item_type: newItem.item_type,
      quantity: newItem.quantity,
      weight_coins: newItem.weight_coins,
      location: newItem.location,
    };
    if (newItem.weapon_damage_dice.trim()) payload.weapon_damage_dice = newItem.weapon_damage_dice.trim();
    const acBonus = parseInt(newItem.armor_ac_bonus);
    if (!isNaN(acBonus)) payload.armor_ac_bonus = acBonus;
    if (newItem.is_shield) payload.is_shield = true;
    if (newItem.armor_bulk) payload.armor_bulk = newItem.armor_bulk;
    const mapped = await insertInventoryItem(payload);
    if (mapped) {
      onItemAdded(mapped);
      setNewItem(EMPTY_DRAFT);
      setShowAddForm(false);
    }
  }

  return {
    showAddForm, setShowAddForm,
    addMode, setAddMode,
    newItem, setNewItem,
    catalogItems, catalogSearch, setCatalogSearch, catalogLoading,
    selectCatalogItem, addItem,
  };
}

export type AddItemController = ReturnType<typeof useAddItem>;
