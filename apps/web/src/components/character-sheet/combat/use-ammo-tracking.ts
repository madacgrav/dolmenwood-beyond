'use client';
import { useState, useCallback, useEffect } from 'react';
import { calcAmmoRecovery } from '@dolmenwood/rules-engine';
import { listAmmo, updateItemQuantity, type AmmoItem } from '@/lib/api/inventory';

export function useAmmoTracking(characterId: string) {
  const [ammoItems, setAmmoItems] = useState<AmmoItem[]>([]);
  const [battleOpen, setBattleOpen] = useState(false);
  const [battleAmmoId, setBattleAmmoId] = useState<string | null>(null);
  const [battleStartQty, setBattleStartQty] = useState(0);
  const [battleCurrentQty, setBattleCurrentQty] = useState(0);
  const [battleResult, setBattleResult] = useState<{ recovered: number } | null>(null);
  const [battleEnding, setBattleEnding] = useState(false);

  const fetchAmmo = useCallback(async () => {
    setAmmoItems(await listAmmo(characterId));
  }, [characterId]);

  useEffect(() => {
    fetchAmmo();
  }, [fetchAmmo]);

  async function adjustAmmo(item: AmmoItem, delta: number) {
    const next = Math.max(0, item.quantity + delta);
    setAmmoItems(prev => prev.map(a => a.id === item.id ? { ...a, quantity: next } : a));
    await updateItemQuantity(characterId, item.id, next);
  }

  function openBattle(item: AmmoItem) {
    setBattleAmmoId(item.id);
    setBattleStartQty(item.quantity);
    setBattleCurrentQty(item.quantity);
    setBattleResult(null);
    setBattleEnding(false);
    setBattleOpen(true);
  }

  async function fireShotInBattle() {
    if (battleCurrentQty <= 0) return;
    const next = battleCurrentQty - 1;
    setBattleCurrentQty(next);
    if (battleAmmoId) {
      await updateItemQuantity(characterId, battleAmmoId, next);
      setAmmoItems(prev => prev.map(a => a.id === battleAmmoId ? { ...a, quantity: next } : a));
    }
  }

  async function endBattle() {
    setBattleEnding(true);
    const shotsUsed = battleStartQty - battleCurrentQty;
    const recovered = calcAmmoRecovery(shotsUsed);
    if (recovered > 0 && battleAmmoId) {
      const finalQty = battleCurrentQty + recovered;
      await updateItemQuantity(characterId, battleAmmoId, finalQty);
      setAmmoItems(prev => prev.map(a => a.id === battleAmmoId ? { ...a, quantity: finalQty } : a));
      setBattleCurrentQty(finalQty);
    }
    setBattleResult({ recovered });
    setBattleEnding(false);
  }

  function closeBattle() {
    setBattleOpen(false);
    setBattleAmmoId(null);
    setBattleResult(null);
  }

  return {
    ammoItems,
    adjustAmmo,
    battleOpen,
    battleAmmoId,
    battleStartQty,
    battleCurrentQty,
    battleResult,
    battleEnding,
    openBattle,
    fireShotInBattle,
    endBattle,
    closeBattle,
  };
}
