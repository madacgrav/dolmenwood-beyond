'use client';
import { useState, type Dispatch, type SetStateAction } from 'react';
import {
  insertInventoryItem,
  updateItemQuantity,
  type InventoryItem as DBInventoryItem,
} from '@/lib/api/inventory';
import type { Coins } from '@/lib/api/characters';
import { RESTOCK_ITEMS, totalSpOnHand, deductSp } from './restock-data';
import { canonicalName } from '@/lib/inventory/consumables';

/**
 * State + purchase logic for the restock bottom sheet. Merges quantities
 * into existing inventory rows (matched case-insensitively by name) and
 * deducts the total cost from the coin purse.
 */
export function useRestock({ characterId, items, setItems, coins, setCoins, saveCoins }: {
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
    let succeededSp = 0;
    let anyFailed = false;
    try {
      for (const entry of RESTOCK_ITEMS) {
        const qty = restockQtys[entry.name] ?? 0;
        if (qty <= 0) continue;
        // Alias-aware: a new "Arrow" purchase merges into an existing "Arrows" row.
        const existing = items.find(
          i => canonicalName(i.item_name) === canonicalName(entry.name),
        );
        if (existing) {
          const newQty = existing.quantity + qty;
          const ok = await updateItemQuantity(characterId, existing.id, newQty);
          if (!ok) { anyFailed = true; continue; }
          setItems(prev => prev.map(i => i.id === existing.id ? { ...i, quantity: newQty } : i));
        } else {
          const mapped = await insertInventoryItem({
            character_id: characterId,
            item_name: entry.name,
            item_type: entry.category === 'ammo' ? 'ammo' : 'gear',
            quantity: qty,
            weight_coins: entry.weightCoins,
            location: 'stowed',
          });
          if (!mapped) { anyFailed = true; continue; }
          setItems(prev => [...prev, mapped]);
        }
        succeededSp += qty * entry.priceSp;
      }
      // Only charge for items that actually wrote.
      if (succeededSp > 0) {
        const newCoins = deductSp(coins, succeededSp);
        await saveCoins(newCoins);
        setCoins(newCoins);
      }
      if (anyFailed) {
        setRestockError('error');
      } else {
        setRestockQtys({});
        setRestockSuccess(true);
        setTimeout(() => {
          setRestockSuccess(false);
          setShowRestock(false);
        }, 1500);
      }
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
