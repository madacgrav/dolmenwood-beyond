'use client';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Character } from '@dolmenwood/types';
import { getSpellSlots, isSpellcaster, getSpellsForClass } from '@dolmenwood/rules-engine';
import type { SpellEntry } from '@dolmenwood/rules-engine';

interface DBSpellSlot {
  id: string;
  character_id: string;
  spell_rank: number;
  slots_total: number;
  slots_used: number;
}

interface DBPreparation {
  id: string;
  character_id: string;
  slot_rank: number;
  spell_name: string;
  is_cast: boolean;
  created_at: string;
}

interface DBSpell {
  id: string;
  character_id: string;
  spell_name: string;
  spell_level: number;
  is_memorized: boolean;
  notes?: string;
}

interface Props { character: Character; characterId: string; }

const SECTION_HEADER: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

const INPUT_STYLE: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
  minHeight: '44px',
  width: '100%',
  boxSizing: 'border-box',
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
};

export function MagicTab({ character, characterId }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const spellcaster = isSpellcaster(character.characterClass);
  const slotsData = useMemo(
    () => (spellcaster ? getSpellSlots(character.characterClass, character.level) : null),
    [spellcaster, character.characterClass, character.level]
  );
  const isGlamour = slotsData !== null && 'glamours' in slotsData;

  // ── State ────────────────────────────────────────────────────────────────────
  const [dbSlots, setDbSlots] = useState<DBSpellSlot[]>([]);
  const [preparations, setPreparations] = useState<DBPreparation[]>([]);
  const [spells, setSpells] = useState<DBSpell[]>([]);
  const [loading, setLoading] = useState(true);

  // Prepare-spell form
  const [showPrepareForm, setShowPrepareForm] = useState(false);
  const [prepRank, setPrepRank] = useState<number>(1);
  const [prepSpellName, setPrepSpellName] = useState<string>('__other__');
  const [prepCustomName, setPrepCustomName] = useState<string>('');

  // Add-to-spell-book form
  const [showAddSpellForm, setShowAddSpellForm] = useState(false);
  const [newSpellRank, setNewSpellRank] = useState<number>(1);
  const [newSpellName, setNewSpellName] = useState<string>('__other__');
  const [newSpellCustom, setNewSpellCustom] = useState<string>('');

  // ── Data loading & slot initialisation ───────────────────────────────────────
  const loadData = useCallback(async () => {
    const [
      { data: slotData },
      { data: prepData },
      { data: spellData },
    ] = await Promise.all([
      supabase.from('spell_slots').select('*').eq('character_id', characterId).order('spell_rank'),
      supabase.from('spell_preparations').select('*').eq('character_id', characterId).order('created_at'),
      supabase.from('character_spells').select('*').eq('character_id', characterId).order('spell_level'),
    ]);

    let slots = (slotData ?? []) as DBSpellSlot[];

    // Auto-initialise spell_slots rows on first open for non-glamour casters
    if (slots.length === 0 && spellcaster && !isGlamour && slotsData) {
      const inserts = Object.entries(slotsData)
        .filter(([k]) => !isNaN(Number(k)) && ((slotsData as Record<string, number>)[k] ?? 0) > 0)
        .map(([rank, total]) => ({
          character_id: characterId,
          spell_rank: Number(rank),
          slots_total: total as number,
          slots_used: 0,
        }));
      if (inserts.length > 0) {
        const { data: newSlots } = await supabase.from('spell_slots').insert(inserts).select();
        slots = (newSlots ?? []) as DBSpellSlot[];
      }
    }

    setDbSlots(slots);
    setPreparations((prepData ?? []) as DBPreparation[]);
    setSpells((spellData ?? []) as DBSpell[]);
    setLoading(false);
  }, [supabase, characterId, spellcaster, isGlamour, slotsData]);

  useEffect(() => {
    if (!spellcaster) { setLoading(false); return; }
    loadData();
  }, [spellcaster, loadData]);

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

  // Valid spell ranks the class can learn at current level
  const validRanks: number[] = useMemo(() => {
    if (!slotsData || isGlamour) return [];
    return Object.keys(slotsData)
      .map(Number)
      .filter(r => !isNaN(r));
  }, [slotsData, isGlamour]);

  // ── Slot circles ─────────────────────────────────────────────────────────────
  async function toggleSlot(slot: DBSpellSlot, index: number, isUsed: boolean) {
    const newUsed = isUsed
      ? Math.max(0, slot.slots_used - 1)
      : Math.min(slot.slots_total, slot.slots_used + 1);
    setDbSlots(prev => prev.map(s => s.id === slot.id ? { ...s, slots_used: newUsed } : s));
    await supabase.from('spell_slots').update({ slots_used: newUsed }).eq('id', slot.id);
  }

  // ── Rest ─────────────────────────────────────────────────────────────────────
  async function handleRest() {
    await Promise.all([
      supabase.from('spell_preparations').delete().eq('character_id', characterId),
      supabase.from('spell_slots').update({ slots_used: 0 }).eq('character_id', characterId),
    ]);
    setPreparations([]);
    setDbSlots(prev => prev.map(s => ({ ...s, slots_used: 0 })));
  }

  // ── Preparations ─────────────────────────────────────────────────────────────
  async function castPreparation(prep: DBPreparation) {
    await supabase.from('spell_preparations').update({ is_cast: true }).eq('id', prep.id);
    setPreparations(prev => prev.map(p => p.id === prep.id ? { ...p, is_cast: true } : p));
    const slot = dbSlots.find(s => s.spell_rank === prep.slot_rank);
    if (slot) {
      const newUsed = Math.min(slot.slots_total, slot.slots_used + 1);
      await supabase.from('spell_slots').update({ slots_used: newUsed }).eq('id', slot.id);
      setDbSlots(prev => prev.map(s => s.id === slot.id ? { ...s, slots_used: newUsed } : s));
    }
  }

  async function restorePreparation(prep: DBPreparation) {
    await supabase.from('spell_preparations').update({ is_cast: false }).eq('id', prep.id);
    setPreparations(prev => prev.map(p => p.id === prep.id ? { ...p, is_cast: false } : p));
    const slot = dbSlots.find(s => s.spell_rank === prep.slot_rank);
    if (slot) {
      const newUsed = Math.max(0, slot.slots_used - 1);
      await supabase.from('spell_slots').update({ slots_used: newUsed }).eq('id', slot.id);
      setDbSlots(prev => prev.map(s => s.id === slot.id ? { ...s, slots_used: newUsed } : s));
    }
  }

  async function addPreparation() {
    const name = prepSpellName === '__other__' ? prepCustomName.trim() : prepSpellName;
    if (!name) return;
    const { data, error } = await supabase
      .from('spell_preparations')
      .insert({ character_id: characterId, slot_rank: prepRank, spell_name: name, is_cast: false })
      .select()
      .single();
    if (!error && data) {
      setPreparations(prev => [...prev, data as DBPreparation]);
      setShowPrepareForm(false);
      setPrepSpellName('__other__');
      setPrepCustomName('');
    }
  }

  // ── Spell book ───────────────────────────────────────────────────────────────
  async function toggleMemorized(spell: DBSpell) {
    const newVal = !spell.is_memorized;
    setSpells(prev => prev.map(s => s.id === spell.id ? { ...s, is_memorized: newVal } : s));
    await supabase.from('character_spells').update({ is_memorized: newVal }).eq('id', spell.id);
  }

  async function deleteSpell(id: string) {
    setSpells(prev => prev.filter(s => s.id !== id));
    await supabase.from('character_spells').delete().eq('id', id);
  }

  async function addSpell() {
    const name = newSpellName === '__other__' ? newSpellCustom.trim() : newSpellName;
    if (!name) return;
    const payload = {
      character_id: characterId,
      spell_name: name,
      spell_level: isGlamour ? 0 : newSpellRank,
      is_memorized: false,
    };
    const { data, error } = await supabase.from('character_spells').insert(payload).select().single();
    if (!error && data) {
      setSpells(prev => [...prev, data as DBSpell]);
      setNewSpellName('__other__');
      setNewSpellCustom('');
      setShowAddSpellForm(false);
    }
  }

  // ── Spell lists for dropdowns ────────────────────────────────────────────────
  const glamourSpells: SpellEntry[] = useMemo(
    () => getSpellsForClass('Enchanter'),
    []
  );

  const prepSpells: SpellEntry[] = useMemo(
    () => getSpellsForClass(character.characterClass, prepRank),
    [character.characterClass, prepRank]
  );

  const newSpellOptions: SpellEntry[] = useMemo(
    () => isGlamour
      ? glamourSpells
      : getSpellsForClass(character.characterClass, newSpellRank),
    [isGlamour, glamourSpells, character.characterClass, newSpellRank]
  );

  // ── Rendering ────────────────────────────────────────────────────────────────
  if (!spellcaster) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--color-text-muted)' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🚫</div>
        <p style={{ fontSize: '0.95rem' }}>This class has no magical abilities.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ height: '52px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '5rem' }}>

      {/* ── Section 1: Spell Slots / Glamour Circles ── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={SECTION_HEADER}>
            {isGlamour ? 'Glamour Circles' : 'Spell Slots'}
          </h3>
          {!isGlamour && (
            <button
              onClick={handleRest}
              style={{
                padding: '0.25rem 0.75rem', borderRadius: '6px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'transparent', color: 'var(--color-text-muted)',
                fontSize: '0.75rem', cursor: 'pointer', minHeight: '36px',
              }}
            >
              🌙 Rest
            </button>
          )}
        </div>

        {isGlamour ? (
          <div style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '10px', padding: '0.875rem',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ color: 'var(--color-text)' }}>
              Glamours known at Level {character.level}
            </span>
            <span style={{
              fontSize: '1.75rem', fontWeight: '700',
              color: 'var(--color-gold)', fontFamily: 'var(--font-display), Georgia, serif',
            }}>
              {(slotsData as Record<string, number>).glamours}
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
            {dbSlots.map(slot => {
              const circles = Array.from({ length: slot.slots_total }, (_, i) => i < slot.slots_used);
              return (
                <div key={slot.spell_rank} style={{
                  backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
                  borderRadius: '10px', padding: '0.625rem 0.875rem',
                  display: 'flex', alignItems: 'center', gap: '0.75rem',
                }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', minWidth: '44px' }}>
                    Rank {slot.spell_rank}
                  </span>
                  <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap', flex: 1 }}>
                    {circles.map((used, i) => (
                      <button
                        key={i}
                        onClick={() => toggleSlot(slot, i, used)}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                          fontSize: '1.35rem', color: used ? 'var(--color-gold)' : 'var(--color-border)',
                          minHeight: '44px', minWidth: '28px',
                          lineHeight: 1,
                        }}
                        aria-label={used ? `Restore rank ${slot.spell_rank} slot ${i + 1}` : `Use rank ${slot.spell_rank} slot ${i + 1}`}
                      >
                        {used ? '●' : '○'}
                      </button>
                    ))}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {slot.slots_used}/{slot.slots_total}
                  </span>
                </div>
              );
            })}
            {dbSlots.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No spell slots at this level.
              </p>
            )}
          </div>
        )}
      </section>

      {/* ── Section 2: Today's Prepared Spells (non-Enchanter only) ── */}
      {!isGlamour && (
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={SECTION_HEADER}>Today&apos;s Prepared Spells ({preparations.length})</h3>
            {ranksWithFreeSlots.length > 0 && (
              <button
                onClick={() => {
                  setPrepRank(ranksWithFreeSlots[0]!);
                  setPrepSpellName('__other__');
                  setPrepCustomName('');
                  setShowPrepareForm(o => !o);
                }}
                style={{
                  padding: '0.25rem 0.75rem', borderRadius: '6px', border: 'none',
                  backgroundColor: 'var(--color-primary)', color: 'white',
                  fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', minHeight: '36px',
                }}
              >
                + Prepare Spell
              </button>
            )}
          </div>

          {/* Prepare form */}
          {showPrepareForm && (
            <div style={{
              backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)',
              borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem',
              display: 'flex', flexDirection: 'column', gap: '0.625rem',
            }}>
              <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text)' }}>
                Prepare a Spell
              </h4>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Rank</label>
                <select
                  value={prepRank}
                  onChange={e => { setPrepRank(Number(e.target.value)); setPrepSpellName('__other__'); setPrepCustomName(''); }}
                  style={SELECT_STYLE}
                >
                  {ranksWithFreeSlots.map(r => (
                    <option key={r} value={r}>Rank {r} ({freeSlots(r)} free)</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Spell</label>
                <select
                  value={prepSpellName}
                  onChange={e => setPrepSpellName(e.target.value)}
                  style={SELECT_STYLE}
                >
                  {prepSpells.map(s => (
                    <option key={s.name} value={s.name}>{s.name}</option>
                  ))}
                  <option value="__other__">Other (type manually)…</option>
                </select>
              </div>

              {prepSpellName === '__other__' && (
                <input
                  type="text"
                  placeholder="Spell name"
                  value={prepCustomName}
                  onChange={e => setPrepCustomName(e.target.value)}
                  style={INPUT_STYLE}
                />
              )}

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setShowPrepareForm(false)}
                  style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}
                >
                  Cancel
                </button>
                <button
                  onClick={addPreparation}
                  style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', minHeight: '44px' }}
                >
                  Add to Preparation
                </button>
              </div>
            </div>
          )}

          {preparations.length === 0 && !showPrepareForm && (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '1.5rem 0' }}>
              No spells prepared today.
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {preparations.map(prep => (
              <div key={prep.id} style={{
                backgroundColor: 'var(--color-surface)',
                border: `1px solid ${prep.is_cast ? 'var(--color-border)' : 'var(--color-gold)'}`,
                borderRadius: '8px', padding: '0.625rem 0.875rem',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                opacity: prep.is_cast ? 0.6 : 1,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text)', textDecoration: prep.is_cast ? 'line-through' : 'none' }}>
                    {prep.spell_name}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                    Rank {prep.slot_rank} · {prep.is_cast ? 'Cast' : 'Prepared'}
                  </div>
                </div>
                {prep.is_cast ? (
                  <button
                    onClick={() => restorePreparation(prep)}
                    title="Restore spell"
                    style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1rem', padding: '0.25rem 0.5rem', minHeight: '44px', minWidth: '44px' }}
                    aria-label={`Restore ${prep.spell_name}`}
                  >
                    ↩
                  </button>
                ) : (
                  <button
                    onClick={() => castPreparation(prep)}
                    title="Cast spell"
                    style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--color-gold)', fontSize: '1rem', padding: '0.25rem 0.5rem', minHeight: '44px', minWidth: '44px' }}
                    aria-label={`Cast ${prep.spell_name}`}
                  >
                    ⚡
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Section 3: Spell Book / Glamours Known ── */}
      <section>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h3 style={SECTION_HEADER}>
            {isGlamour ? 'Glamours Known' : 'Spell Book'} ({spells.length})
          </h3>
          <button
            onClick={() => {
              setNewSpellRank(validRanks[0] ?? 1);
              setNewSpellName('__other__');
              setNewSpellCustom('');
              setShowAddSpellForm(o => !o);
            }}
            style={{
              padding: '0.25rem 0.75rem', borderRadius: '6px', border: 'none',
              backgroundColor: 'var(--color-primary)', color: 'white',
              fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', minHeight: '36px',
            }}
          >
            + Add Spell
          </button>
        </div>

        {/* Add spell form */}
        {showAddSpellForm && (
          <div style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)',
            borderRadius: '10px', padding: '1rem', marginBottom: '0.75rem',
            display: 'flex', flexDirection: 'column', gap: '0.625rem',
          }}>
            <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text)' }}>
              {isGlamour ? 'Add Glamour' : 'Add Spell to Book'}
            </h4>

            {!isGlamour && validRanks.length > 0 && (
              <div>
                <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Rank</label>
                <select
                  value={newSpellRank}
                  onChange={e => { setNewSpellRank(Number(e.target.value)); setNewSpellName('__other__'); setNewSpellCustom(''); }}
                  style={SELECT_STYLE}
                >
                  {validRanks.map(r => <option key={r} value={r}>Rank {r}</option>)}
                </select>
              </div>
            )}

            <div>
              <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Spell Name</label>
              <select
                value={newSpellName}
                onChange={e => setNewSpellName(e.target.value)}
                style={SELECT_STYLE}
              >
                {newSpellOptions.map(s => (
                  <option key={s.name} value={s.name}>{s.name}</option>
                ))}
                <option value="__other__">Other (type manually)…</option>
              </select>
            </div>

            {newSpellName === '__other__' && (
              <input
                type="text"
                placeholder="Spell name"
                value={newSpellCustom}
                onChange={e => setNewSpellCustom(e.target.value)}
                style={INPUT_STYLE}
              />
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowAddSpellForm(false)}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', cursor: 'pointer', fontSize: '0.9rem', minHeight: '44px' }}
              >
                Cancel
              </button>
              <button
                onClick={addSpell}
                style={{ flex: 1, padding: '0.625rem', borderRadius: '8px', border: 'none', backgroundColor: 'var(--color-primary)', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', minHeight: '44px' }}
              >
                Add
              </button>
            </div>
          </div>
        )}

        {spells.length === 0 && !showAddSpellForm && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            {isGlamour ? 'No glamours recorded. Tap + Add Spell.' : 'No spells in book. Tap + Add Spell.'}
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {spells.map(spell => (
            <div key={spell.id} style={{
              backgroundColor: 'var(--color-surface)',
              border: `1px solid ${spell.is_memorized ? 'var(--color-gold)' : 'var(--color-border)'}`,
              borderRadius: '8px', padding: '0.625rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <input
                type="checkbox"
                checked={spell.is_memorized}
                onChange={() => toggleMemorized(spell)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-gold)' }}
                aria-label={`Toggle memorized: ${spell.spell_name}`}
              />
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: '0.9rem',
                  fontWeight: spell.is_memorized ? '700' : '400',
                  color: spell.is_memorized ? 'var(--color-text)' : 'var(--color-text-muted)',
                }}>
                  {spell.spell_name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {isGlamour || spell.spell_level === 0 ? 'Glamour' : `Rank ${spell.spell_level}`}
                  {spell.is_memorized && ' · Memorized'}
                </div>
              </div>
              <button
                onClick={() => deleteSpell(spell.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-danger)', fontSize: '1rem',
                  padding: '0.25rem', minHeight: '44px', minWidth: '44px',
                }}
                aria-label={`Delete ${spell.spell_name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
