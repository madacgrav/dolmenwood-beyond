'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Character } from '@dolmenwood/types';
import { getSpellSlots, isSpellcaster } from '@dolmenwood/rules-engine';

interface DBSpell {
  id: string;
  character_id: string;
  spell_name: string;
  spell_level: number;
  is_memorized: boolean;
  notes?: string;
}

interface Props { character: Character; characterId: string; }

export function MagicTab({ character, characterId }: Props) {
  const supabase = createClient();
  const [spells, setSpells] = useState<DBSpell[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newSpell, setNewSpell] = useState({ spell_name: '', spell_level: 1 });

  const spellcaster = isSpellcaster(character.characterClass);
  const slots = spellcaster ? getSpellSlots(character.characterClass, character.level) : null;

  useEffect(() => {
    if (!spellcaster) { setLoading(false); return; }
    async function fetchSpells() {
      const { data } = await supabase
        .from('character_spells')
        .select('*')
        .eq('character_id', characterId)
        .order('spell_level');
      setSpells((data ?? []) as DBSpell[]);
      setLoading(false);
    }
    fetchSpells();
  }, [characterId, spellcaster, supabase]);

  async function toggleMemorized(spell: DBSpell) {
    const newVal = !spell.is_memorized;
    setSpells(prev => prev.map(s => s.id === spell.id ? { ...s, is_memorized: newVal } : s));
    await supabase.from('character_spells').update({ is_memorized: newVal }).eq('id', spell.id);
  }

  async function addSpell() {
    if (!newSpell.spell_name.trim()) return;
    const payload = { ...newSpell, character_id: characterId, is_memorized: false };
    const { data, error } = await supabase.from('character_spells').insert(payload).select().single();
    if (!error && data) {
      setSpells(prev => [...prev, data as DBSpell]);
      setNewSpell({ spell_name: '', spell_level: 1 });
      setShowAddForm(false);
    }
  }

  async function deleteSpell(id: string) {
    setSpells(prev => prev.filter(s => s.id !== id));
    await supabase.from('character_spells').delete().eq('id', id);
  }

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
        {[1, 2, 3].map(i => <div key={i} style={{ height: '52px', borderRadius: '8px', backgroundColor: 'var(--color-surface)', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
      </div>
    );
  }

  const isGlamour = slots !== null && 'glamours' in slots;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Spell slots / glamours */}
      {slots && (
        <section>
          <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {isGlamour ? 'Glamours Known' : 'Spell Slots'}
          </h3>
          {isGlamour ? (
            <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-text)' }}>Glamours known at Level {character.level}</span>
              <span style={{ fontSize: '1.75rem', fontWeight: '700', color: 'var(--color-gold)', fontFamily: 'var(--font-display), Georgia, serif' }}>{(slots as Record<string, number>).glamours}</span>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {Object.entries(slots).map(([rank, count]) => (
                <div key={rank} style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.5rem 0.75rem', textAlign: 'center', minWidth: '56px' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Rank {rank}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-gold)' }}>{count}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Spell list */}
      <section>
        <h3 style={{ margin: '0 0 0.75rem', fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {isGlamour ? 'Glamour List' : 'Spell Book'} ({spells.length})
        </h3>
        {spells.length === 0 && !showAddForm && (
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
            No spells yet. Tap ⊕ to add.
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {spells.map(spell => (
            <div key={spell.id} style={{ backgroundColor: 'var(--color-surface)', border: `1px solid ${spell.is_memorized ? 'var(--color-gold)' : 'var(--color-border)'}`, borderRadius: '8px', padding: '0.625rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input
                type="checkbox"
                checked={spell.is_memorized}
                onChange={() => toggleMemorized(spell)}
                style={{ width: '20px', height: '20px', cursor: 'pointer', accentColor: 'var(--color-gold)' }}
                aria-label={`Toggle memorized: ${spell.spell_name}`}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', fontWeight: spell.is_memorized ? '700' : '400', color: spell.is_memorized ? 'var(--color-text)' : 'var(--color-text-muted)' }}>
                  {spell.spell_name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {isGlamour ? 'Glamour' : `Rank ${spell.spell_level}`}
                  {spell.is_memorized && ' · Memorized'}
                </div>
              </div>
              <button
                onClick={() => deleteSpell(spell.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-danger)', fontSize: '1rem', padding: '0.25rem', minHeight: '36px', minWidth: '36px' }}
                aria-label={`Delete ${spell.spell_name}`}
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Add spell form */}
        {showAddForm && (
          <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-primary)', borderRadius: '10px', padding: '1rem', marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <h4 style={{ margin: 0, fontFamily: 'var(--font-display), Georgia, serif', fontSize: '0.9rem', color: 'var(--color-text)' }}>Add Spell</h4>
            <input
              type="text"
              placeholder="Spell name"
              value={newSpell.spell_name}
              onChange={e => setNewSpell(p => ({ ...p, spell_name: e.target.value }))}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', minHeight: '44px' }}
            />
            {!isGlamour && (
              <div>
                <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Spell Rank</label>
                <input
                  type="number" min={1} max={6}
                  value={newSpell.spell_level}
                  onChange={e => setNewSpell(p => ({ ...p, spell_level: Math.max(1, Math.min(6, parseInt(e.target.value) || 1)) }))}
                  style={{ padding: '0.5rem', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)', fontSize: '0.9rem', width: '80px', minHeight: '44px' }}
                />
              </div>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowAddForm(false)}
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
      </section>

      {/* FAB */}
      <button
        onClick={() => setShowAddForm(o => !o)}
        style={{
          position: 'fixed', bottom: '96px', right: '1.25rem',
          width: '56px', height: '56px', borderRadius: '50%',
          backgroundColor: 'var(--color-primary)', color: 'white',
          border: 'none', cursor: 'pointer',
          fontSize: '1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 40,
        }}
        aria-label="Add spell"
      >
        ⊕
      </button>
    </div>
  );
}
