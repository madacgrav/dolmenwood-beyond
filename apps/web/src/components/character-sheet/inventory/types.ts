import type { CSSProperties } from 'react';
import type { ArmorBulk } from '@dolmenwood/types';
import type { InventoryItem as DBInventoryItem } from '@/lib/api/inventory';

export interface CatalogItem {
  id: string;
  name: string;
  item_type: string;
  weight: number;
  cost_gp: number | null;
  weapon_damage_dice: string | null;
  armor_ac_bonus: number | null;
  is_shield: boolean;
  armor_bulk: ArmorBulk | null;
  notes: string | null;
}

export const ITEM_TYPES = ['weapon', 'armour', 'gear', 'consumable', 'other'] as const;
export type ItemType = typeof ITEM_TYPES[number];

export const LOCATION_LABELS: Record<string, string> = {
  equipped: '⚔️ Equipped',
  stowed: '🎒 Stowed',
  tiny: '🔮 Tiny',
};

export const sectionHead: CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

/** Draft state for the add-item form (AC bonus kept as string until submit). */
export interface NewItemDraft {
  item_name: string;
  item_type: ItemType;
  quantity: number;
  weight_coins: number;
  location: DBInventoryItem['location'];
  weapon_damage_dice: string;
  armor_ac_bonus: string;
  is_shield: boolean;
  armor_bulk: ArmorBulk | null;
}
