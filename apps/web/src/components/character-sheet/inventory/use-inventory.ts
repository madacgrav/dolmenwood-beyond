'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  listInventory,
  updateItemLocation,
  updateItemQuantity,
  deleteInventoryItem,
  type InventoryItem as DBInventoryItem,
} from '@/lib/api/inventory';
import { fetchBankBalance as fetchBankBalanceQuery } from '@/lib/api/bank';
import { fetchCoins, saveCoins as saveCoinsQuery, type Coins } from '@/lib/api/characters';

/**
 * Core inventory tab state: items, coin purse, and bank balance. Item
 * mutations apply optimistic local updates alongside the server write,
 * matching the original inline behavior.
 */
export function useInventory(characterId: string) {
  const [items, setItems] = useState<DBInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState<Coins>({ gp: 0, sp: 0, cp: 0 });
  const [bankBalance, setBankBalance] = useState(0);

  const fetchBankBalance = useCallback(async () => {
    setBankBalance(await fetchBankBalanceQuery(characterId));
  }, [characterId]);

  useEffect(() => {
    async function fetchAll() {
      const [mapped, charCoins] = await Promise.all([
        listInventory(characterId),
        fetchCoins(characterId),
      ]);
      setItems(mapped);
      setCoins(charCoins);
      setLoading(false);
    }
    fetchAll();
    fetchBankBalance();
  }, [characterId, fetchBankBalance]);

  async function saveCoins(updated: Coins) {
    await saveCoinsQuery(characterId, updated);
  }

  function handleCoinChange(coin: 'gp' | 'sp' | 'cp', value: string) {
    const n = Math.max(0, parseInt(value) || 0);
    const updated = { ...coins, [coin]: n };
    setCoins(updated);
    saveCoins(updated);
  }

  async function toggleLocation(item: DBInventoryItem) {
    const cycle: DBInventoryItem['location'][] = ['stowed', 'equipped', 'tiny'];
    const next = cycle[(cycle.indexOf(item.location) + 1) % cycle.length]!;
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, location: next } : i));
    await updateItemLocation(characterId, item.id, next);
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await deleteInventoryItem(characterId, id);
  }

  async function setItemQuantity(id: string, quantity: number) {
    const q = Math.max(0, Math.floor(quantity) || 0);
    setItems(prev => prev.map(i => i.id === id ? { ...i, quantity: q } : i));
    await updateItemQuantity(characterId, id, q);
  }

  return {
    items, setItems,
    loading,
    coins, setCoins,
    bankBalance, fetchBankBalance,
    saveCoins, handleCoinChange,
    toggleLocation, deleteItem, setItemQuantity,
  };
}
