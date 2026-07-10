'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  listInventory,
  updateItemLocation,
  deleteInventoryItem,
  type InventoryItem as DBInventoryItem,
} from '@/lib/data/inventory';
import { fetchBankBalance as fetchBankBalanceQuery } from '@/lib/data/bank';
import { fetchCoins, saveCoins as saveCoinsQuery, type Coins } from '@/lib/api/characters';

/**
 * Core inventory tab state: items, coin purse, bank balance, and the
 * current viewer's user id (for the owner check). Item mutations apply
 * optimistic local updates before/alongside the Supabase write, matching
 * the original inline behavior.
 */
export function useInventory(characterId: string) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<DBInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coins, setCoins] = useState<Coins>({ gp: 0, sp: 0, cp: 0 });
  const [bankBalance, setBankBalance] = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const fetchBankBalance = useCallback(async () => {
    setBankBalance(await fetchBankBalanceQuery(supabase, characterId));
  }, [characterId, supabase]);

  useEffect(() => {
    async function fetchAll() {
      const [mapped, charCoins] = await Promise.all([
        listInventory(supabase, characterId),
        fetchCoins(characterId),
      ]);
      // TODO(phase3b): owner id comes back with the embedded-inventory API;
      // until then the sheet renders as owner (the API is owner-scoped anyway).
      setCurrentUserId(null);
      setItems(mapped);
      setCoins(charCoins);
      setLoading(false);
    }
    fetchAll();
    fetchBankBalance();
  }, [characterId, supabase, fetchBankBalance]);

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
    await updateItemLocation(supabase, item.id, next);
  }

  async function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id));
    await deleteInventoryItem(supabase, id);
  }

  return {
    supabase,
    items, setItems,
    loading,
    coins, setCoins,
    bankBalance, fetchBankBalance,
    currentUserId,
    saveCoins, handleCoinChange,
    toggleLocation, deleteItem,
  };
}
