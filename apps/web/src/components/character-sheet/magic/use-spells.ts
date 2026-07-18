'use client';
import { useEffect, useState, useCallback } from 'react';
import {
  fetchMagicData,
  listSpellSlots,
  insertSpellSlots,
  updateSlotTotals,
  updateSlotUsage,
  resetSpellsForRest,
  insertPreparation,
  updatePreparationCast,
  insertCharacterSpell,
  updateSpellMemorized,
  deleteCharacterSpell,
  type DBSpellSlot,
  type DBPreparation,
  type DBSpell,
} from '@/lib/api/spells';
import type { SlotsData } from './types';

interface UseSpellsArgs {
  characterId: string;
  spellcaster: boolean;
  isGlamour: boolean;
  slotsData: SlotsData | null;
  readOnly?: boolean;
  /** Kindred grants an innate glamour (Elf/Grimalkin) — load the book even for non-casters. */
  innateGlamours?: boolean;
}

/**
 * Magic tab state: spell slots, today's preparations, and the spell book.
 * Loads all three in parallel, auto-initialises / re-syncs `spell_slots`
 * rows, and applies optimistic local updates alongside Supabase writes —
 * matching the original inline behavior.
 */
export function useSpells({ characterId, spellcaster, isGlamour, slotsData, readOnly, innateGlamours }: UseSpellsArgs) {
  const [dbSlots, setDbSlots] = useState<DBSpellSlot[]>([]);
  const [preparations, setPreparations] = useState<DBPreparation[]>([]);
  const [spells, setSpells] = useState<DBSpell[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Data loading & slot initialisation ───────────────────────────────────────
  const loadData = useCallback(async () => {
    const { slots: fetched, preparations: prepData, spells: spellData } =
      await fetchMagicData(characterId);

    let slots = fetched;

    // Auto-initialise spell_slots rows on first open for non-glamour casters
    if (slots.length === 0 && spellcaster && !isGlamour && slotsData && !readOnly) {
      const inserts = Object.entries(slotsData)
        .filter(([k]) => !isNaN(Number(k)) && ((slotsData as Record<string, number>)[k] ?? 0) > 0)
        .map(([rank, total]) => ({
          character_id: characterId,
          spell_rank: Number(rank),
          slots_total: total as number,
          slots_used: 0,
        }));
      if (inserts.length > 0) {
        const newSlots = await insertSpellSlots(characterId, inserts);
        if (newSlots === null) {
          // Another tab won the race (23505 duplicate key) — fetch what's already there
          slots = await listSpellSlots(characterId);
        } else {
          slots = newSlots;
        }
      }
    } else if (slots.length > 0 && spellcaster && !isGlamour && slotsData && !readOnly) {
      // Re-sync slots_total after level-up: update any rank whose total has changed
      const updates = slots
        .filter(s => {
          const expected = (slotsData as Record<string, number>)[String(s.spell_rank)] ?? 0;
          return s.slots_total !== expected;
        })
        .map(s => ({
          id: s.id,
          slots_total: (slotsData as Record<string, number>)[String(s.spell_rank)] ?? 0,
          // Clamp slots_used to the new total
          slots_used: Math.min(s.slots_used, (slotsData as Record<string, number>)[String(s.spell_rank)] ?? 0),
        }));
      if (updates.length > 0) {
        await Promise.all(
          updates.map(u => updateSlotTotals(characterId, u.id, u.slots_total, u.slots_used))
        );
        slots = slots.map(s => {
          const upd = updates.find(u => u.id === s.id);
          return upd ? { ...s, slots_total: upd.slots_total, slots_used: upd.slots_used } : s;
        });
      }
    }

    setDbSlots(slots);
    setPreparations(prepData);
    setSpells(spellData);
    setLoading(false);
  }, [characterId, spellcaster, isGlamour, slotsData, readOnly]);

  useEffect(() => {
    if (!spellcaster && !innateGlamours) { setLoading(false); return; }
    loadData();
  }, [spellcaster, innateGlamours, loadData]);

  // ── Helpers ──────────────────────────────────────────────────────────────────
  /** How many preparation slots are still free for a given rank */
  function freeSlots(rank: number): number {
    const slot = dbSlots.find(s => s.spell_rank === rank);
    if (!slot) return 0;
    const prepared = preparations.filter(p => p.slot_rank === rank).length;
    return slot.slots_total - prepared;
  }

  const ranksWithFreeSlots = dbSlots
    .filter(s => freeSlots(s.spell_rank) > 0)
    .map(s => s.spell_rank);

  // ── Slot circles ─────────────────────────────────────────────────────────────
  async function toggleSlot(slot: DBSpellSlot, isUsed: boolean) {
    const newUsed = isUsed
      ? Math.max(0, slot.slots_used - 1)
      : Math.min(slot.slots_total, slot.slots_used + 1);
    setDbSlots(prev => prev.map(s => s.id === slot.id ? { ...s, slots_used: newUsed } : s));
    await updateSlotUsage(characterId, slot.id, newUsed);
  }

  // ── Rest ─────────────────────────────────────────────────────────────────────
  async function handleRest() {
    await resetSpellsForRest(characterId);
    setPreparations([]);
    setDbSlots(prev => prev.map(s => ({ ...s, slots_used: 0 })));
  }

  // ── Preparations ─────────────────────────────────────────────────────────────
  async function castPreparation(prep: DBPreparation) {
    await updatePreparationCast(characterId, prep.id, true);
    setPreparations(prev => prev.map(p => p.id === prep.id ? { ...p, is_cast: true } : p));
    const slot = dbSlots.find(s => s.spell_rank === prep.slot_rank);
    if (slot) {
      const newUsed = Math.min(slot.slots_total, slot.slots_used + 1);
      await updateSlotUsage(characterId, slot.id, newUsed);
      setDbSlots(prev => prev.map(s => s.id === slot.id ? { ...s, slots_used: newUsed } : s));
    }
  }

  async function restorePreparation(prep: DBPreparation) {
    await updatePreparationCast(characterId, prep.id, false);
    setPreparations(prev => prev.map(p => p.id === prep.id ? { ...p, is_cast: false } : p));
    const slot = dbSlots.find(s => s.spell_rank === prep.slot_rank);
    if (slot) {
      const newUsed = Math.max(0, slot.slots_used - 1);
      await updateSlotUsage(characterId, slot.id, newUsed);
      setDbSlots(prev => prev.map(s => s.id === slot.id ? { ...s, slots_used: newUsed } : s));
    }
  }

  /** Returns true on success so the form can close itself. */
  async function addPreparation(rank: number, name: string): Promise<boolean> {
    const data = await insertPreparation(characterId, {
      slot_rank: rank, spell_name: name,
    });
    if (data) {
      setPreparations(prev => [...prev, data]);
      return true;
    }
    return false;
  }

  // ── Spell book ───────────────────────────────────────────────────────────────
  async function toggleMemorized(spell: DBSpell) {
    const newVal = !spell.is_memorized;
    setSpells(prev => prev.map(s => s.id === spell.id ? { ...s, is_memorized: newVal } : s));
    await updateSpellMemorized(characterId, spell.id, newVal);
  }

  async function deleteSpell(id: string) {
    setSpells(prev => prev.filter(s => s.id !== id));
    await deleteCharacterSpell(characterId, id);
  }

  /** Returns true on success so the form can close itself. */
  async function addSpell(rank: number, name: string, kind?: 'spell' | 'glamour' | 'rune'): Promise<boolean> {
    const resolvedKind = kind ?? (isGlamour ? 'glamour' : 'spell');
    const payload = {
      character_id: characterId,
      spell_name: name,
      spell_level: resolvedKind === 'spell' ? rank : 0,
      is_memorized: false,
      kind: resolvedKind,
    };
    const data = await insertCharacterSpell(characterId, payload);
    if (data) {
      setSpells(prev => [...prev, data]);
      return true;
    }
    return false;
  }

  return {
    dbSlots,
    preparations,
    spells,
    loading,
    freeSlots,
    ranksWithFreeSlots,
    toggleSlot,
    handleRest,
    castPreparation,
    restorePreparation,
    addPreparation,
    toggleMemorized,
    deleteSpell,
    addSpell,
  };
}
