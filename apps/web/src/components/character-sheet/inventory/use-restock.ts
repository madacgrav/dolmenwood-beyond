'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  insertInventoryItem,
  updateItemQuantity,
  type InventoryItem as DBInventoryItem,
} from '@/lib/data/inventory';
import type { Coins } from '@/lib/data/characters';
import { RESTOCK_ITEMS, totalSpOnHand, deductSp } from './restock-data';

/**
 * State + purchase logic for the restock bottom sheet. Merges quantities
 * into existing inventory rows (matched case-insensitively by name) and
 * deducts the total cost from the coin purse.
 */
export function useRestock({ supabase, characterId, items, setItems, coins, setCoins, saveCoins }: {
  supabase: SupabaseClient;
  characterId: string;
  items: DBInventoryItem[];
  setItems: Dispatch<SetStateAction<DBInventoryItem[]>>;
  coins: Coins;
  setCoins: Dispatch<SetStateAction<Coins>>;
  saveCoins: (updated: Coins) => Promise<void>;
}) {
  const [showRestock, setShowRestock] = useState(false);
  const [restockQtys, setRestockQtys] = useState<Record<string, number>>({});
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState(false);
  const [restockError, setRestockError] = useState('');

  function openRestock() {
    setShowRestock(true);
    setRestockError('');
    setRestockSuccess(false);
    setRestockQtys({});
  }

  function restockTotalSp(): number {
    return RESTOCK_ITEMS.reduce((sum, entry) => {
      const qty = restockQtys[entry.name] ?? 0;
      return sum + qty * entry.priceSp;
    }, 0);
  }

  async function handleRestock(forceConfirm = false) {
    const totalSp = restockTotalSp();
    if (totalSp === 0) return;
    const available = totalSpOnHand(coins);
    if (totalSp > available && !forceConfirm) {
      setRestockError('insufficient');
      return;
    }
    setRestockLoading(true);
    setRestockError('');
    try {
      for (const entry of RESTOCK_ITEMS) {
        const qty = restockQtys[entry.name] ?? 0;
        if (qty <= 0) continue;
        const totalQty = qty * entry.unit;
        const existing = items.find(
          i => i.item_name.toLowerCase() === entry.name.toLowerCase(),
        );
        if (existing) {
          const newQty = existing.quantity + totalQty;
          await updateItemQuantity(supabase, existing.id, newQty);
          setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: newQty } : i));
        } else {
          const mapped = await insertInventoryItem(supabase, {
            character_id: characterId,
            item_name: entry.name,
            item_type: entry.category === 'ammo' ? 'consumable' : 'gear',
            quantity: totalQty,
            weight_coins: 0,
            location: 'stowed',
          });
          if (mapped) setItems(prev => [...prev, mapped]);
        }
      }
      if (totalSp > 0) {
        const newCoins = deductSp(coins, totalSp);
        await saveCoins(newCoins);
        setCoins(newCoins);
      }
      setRestockQtys({});
      setRestockSuccess(true);
      setTimeout(() => {
        setRestockSuccess(false);
        setShowRestock(false);
      }, 1500);
    } catch {
      setRestockError('error');
    }
    setRestockLoading(false);
  }

  return {
    showRestock, setShowRestock, openRestock,
    restockQtys, setRestockQtys,
    restockLoading, restockSuccess, restockError,
    restockTotalSp, handleRestock,
  };
}

export type RestockController = ReturnType<typeof useRestock>;
