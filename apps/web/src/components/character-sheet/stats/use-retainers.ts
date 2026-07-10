'use client';
import { useState, useEffect } from 'react';
import { createCharacter } from '@/lib/api/characters';
import {
  listActiveRetainers,
  insertRetainer,
  updateRetainerHP as updateRetainerHPRow,
  deleteRetainer,
  markRetainerPromoted,
  type DBRetainer,
} from '@/lib/api/retainers';
import type { NewRetainerState } from './types';

export function useRetainers(characterId: string, loyaltyBase: number) {
  const [retainers, setRetainers] = useState<DBRetainer[]>([]);
  const [retainerLoading, setRetainerLoading] = useState(true);
  const [showAddRetainer, setShowAddRetainer] = useState(false);
  const [newRetainer, setNewRetainer] = useState<NewRetainerState>({
    name: '', kindred: 'Human', character_class: 'Fighter', level: 1,
    ac: 10, hp_current: 4, hp_max: 4, attack_bonus: 0,
    morale: 7, loyalty: loyaltyBase, wage_type: 'daily', wage_amount: 1,
  });
  const [expandedRetainer, setExpandedRetainer] = useState<string | null>(null);
  const [promotingRetainer, setPromotingRetainer] = useState<string | null>(null);
  const [promoteLoading, setPromoteLoading] = useState(false);
  const [promoteSuccess, setPromoteSuccess] = useState<{ name: string; charId: string } | null>(null);
  const [promoteError, setPromoteError] = useState<string>('');

  useEffect(() => {
    listActiveRetainers(characterId).then(data => {
      setRetainers(data);
      setRetainerLoading(false);
    });
  }, [characterId]);

  async function addRetainer() {
    if (!newRetainer.name.trim()) return;
    const data = await insertRetainer(characterId, {
      ...newRetainer,
      name: newRetainer.name.trim(),
    });
    if (data) {
      setRetainers(prev => [...prev, data]);
      setNewRetainer({
        name: '', kindred: 'Human', character_class: 'Fighter', level: 1,
        ac: 10, hp_current: 4, hp_max: 4, attack_bonus: 0,
        morale: 7, loyalty: loyaltyBase, wage_type: 'daily', wage_amount: 1,
      });
      setShowAddRetainer(false);
    }
  }

  async function promoteRetainer(r: DBRetainer) {
    setPromoteLoading(true);
    try {
      // Promotion creates a fresh PC from the retainer's combat stats; the
      // owner comes from the session server-side.
      const { id: newCharId, error: insertErr } = await createCharacter({
        name: r.name,
        kindred: r.kindred,
        characterClass: r.character_class,
        alignment: 'neutral',
        level: r.level,
        xp: 0,
        abilityScores: { str: 10, int: 10, wis: 10, dex: 10, con: 10, cha: 10 },
        hpCurrent: r.hp_current,
        hpMax: r.hp_max,
      });
      if (insertErr || !newCharId) {
        setPromoteError(insertErr ?? 'Failed to promote retainer. Please try again.');
        setPromoteLoading(false);
        return;
      }
      await markRetainerPromoted(characterId, r.id);
      setRetainers(prev => prev.filter(x => x.id !== r.id));
      setPromotingRetainer(null);
      setPromoteSuccess({ name: r.name, charId: newCharId });
      setTimeout(() => setPromoteSuccess(null), 6000);
    } finally {
      setPromoteLoading(false);
    }
  }

  function handlePromoteClick(id: string) {
    setExpandedRetainer(id);
    setPromotingRetainer(id);
    setPromoteError('');
  }

  async function updateRetainerHP(id: string, delta: number) {
    const r = retainers.find(x => x.id === id);
    if (!r) return;
    const hp = Math.max(0, Math.min(r.hp_max, r.hp_current + delta));
    setRetainers(prev => prev.map(x => x.id === id ? { ...x, hp_current: hp } : x));
    await updateRetainerHPRow(characterId, id, hp);
  }

  async function dismissRetainer(id: string) {
    if (!confirm('Dismiss this retainer?')) return;
    setRetainers(prev => prev.filter(x => x.id !== id));
    await deleteRetainer(characterId, id);
  }

  return {
    retainers,
    retainerLoading,
    showAddRetainer, setShowAddRetainer,
    newRetainer, setNewRetainer,
    expandedRetainer, setExpandedRetainer,
    promotingRetainer, setPromotingRetainer,
    promoteLoading,
    promoteSuccess, setPromoteSuccess,
    promoteError,
    addRetainer,
    promoteRetainer,
    handlePromoteClick,
    updateRetainerHP,
    dismissRetainer,
  };
}
