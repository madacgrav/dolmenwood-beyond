'use client';
import { useState, useEffect, useRef } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  listCharacterMounts,
  insertMount,
  updateMountHP,
  deleteMount as deleteMountRow,
  type DBMount,
} from '@/lib/data/mounts';
import type { NewMountState } from './types';

export function useMounts(supabase: SupabaseClient, characterId: string, characterClass: string) {
  const [mounts, setMounts] = useState<DBMount[]>([]);
  const [mountsLoading, setMountsLoading] = useState(true);
  const [showAddMount, setShowAddMount] = useState(false);
  const [newMount, setNewMount] = useState<NewMountState>({
    name: '',
    mount_type: 'Horse',
    speed: 40,
    has_full_stats: characterClass === 'Knight',
    ac: 14,
    hp_max: 12,
    attack_bonus: 2,
    morale: 7,
  });
  const [mountSaving, setMountSaving] = useState(false);
  const hpTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    listCharacterMounts(supabase, characterId).then(ms => {
      setMounts(ms);
      setMountsLoading(false);
    });
  }, [characterId, supabase]);

  function adjustMountHP(mount: DBMount, delta: number) {
    const current = mount.hp_current ?? 0;
    const max = mount.hp_max ?? 0;
    const next = Math.max(0, Math.min(max, current + delta));
    setMounts(prev => prev.map(m => m.id === mount.id ? { ...m, hp_current: next } : m));
    if (hpTimers.current[mount.id]) clearTimeout(hpTimers.current[mount.id]);
    hpTimers.current[mount.id] = setTimeout(async () => {
      await updateMountHP(supabase, mount.id, next);
    }, 500);
  }

  async function addMount() {
    if (!newMount.name.trim()) return;
    setMountSaving(true);
    const payload: Record<string, unknown> = {
      owner_id: characterId,  // character UUID - matches RLS expectation
      owner_type: 'character',
      character_id: characterId,
      name: newMount.name.trim(),
      mount_type: newMount.mount_type,
      speed: newMount.speed,
      has_full_stats: newMount.has_full_stats,
    };
    if (newMount.has_full_stats) {
      payload.ac = newMount.ac;
      payload.hp_current = newMount.hp_max;
      payload.hp_max = newMount.hp_max;
      payload.attack_bonus = newMount.attack_bonus;
      payload.morale = newMount.morale;
    }
    const data = await insertMount(supabase, payload);
    if (data) {
      setMounts(prev => [...prev, data]);
      setShowAddMount(false);
      setNewMount({
        name: '',
        mount_type: 'Horse',
        speed: 40,
        has_full_stats: characterClass === 'Knight',
        ac: 14,
        hp_max: 12,
        attack_bonus: 2,
        morale: 7,
      });
    }
    setMountSaving(false);
  }

  async function deleteMount(id: string) {
    if (!confirm('Remove this mount?')) return;
    setMounts(prev => prev.filter(m => m.id !== id));
    await deleteMountRow(supabase, id);
  }

  return {
    mounts,
    mountsLoading,
    showAddMount,
    setShowAddMount,
    newMount,
    setNewMount,
    mountSaving,
    adjustMountHP,
    addMount,
    deleteMount,
  };
}
