'use client';
import { useEffect, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { insertInventoryItem, type InventoryItem as DBInventoryItem } from '@/lib/data/inventory';
import { ITEM_TYPES, type CatalogItem, type ItemType, type NewItemDraft } from './types';

const EMPTY_DRAFT: NewItemDraft = {
  item_name: '', item_type: 'gear', quantity: 1, weight_coins: 0,
  location: 'stowed', weapon_damage_dice: '', armor_ac_bonus: '',
};

/**
 * State + handlers for the add-item flow (custom entry and catalog picker).
 * Lives at the tab level so drafts and search text persist while the form
 * is closed and reopened, exactly as before the extraction.
 */
export function useAddItem({ supabase, characterId, onItemAdded }: {
  supabase: SupabaseClient;
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
    supabase.from('catalog_items').select('id, name, item_type, weight, cost_gp, weapon_damage_dice, armor_ac_bonus, notes')
      .order('name')
      .then(({ data }) => {
        setCatalogItems((data ?? []) as CatalogItem[]);
        setCatalogLoading(false);
      });
  }, [addMode, supabase]);

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
    const mapped = await insertInventoryItem(supabase, payload);
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
