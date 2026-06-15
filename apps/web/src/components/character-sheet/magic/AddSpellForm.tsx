'use client';
import { useState, useMemo } from 'react';
import { getSpellsForClass } from '@dolmenwood/rules-engine';
import type { SpellEntry } from '@dolmenwood/rules-engine';
import { INPUT_STYLE, SELECT_STYLE } from './types';

interface Props {
  characterClass: string;
  isGlamour: boolean;
  validRanks: number[];
  onAdd: (rank: number, name: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Add-spell-to-book form. Field state lives here and resets on each open,
 * because the section mounts the form fresh each time it is shown.
 */
export function AddSpellForm({ characterClass, isGlamour, validRanks, onAdd, onClose }: Props) {
  const [newSpellRank, setNewSpellRank] = useState<number>(validRanks[0] ?? 1);
  const [newSpellName, setNewSpellName] = useState<string>('__other__');
  const [newSpellCustom, setNewSpellCustom] = useState<string>('');

  const newSpellOptions: SpellEntry[] = useMemo(
    () => isGlamour
      ? getSpellsForClass(characterClass)
      : getSpellsForClass(characterClass, newSpellRank),
    [isGlamour, characterClass, newSpellRank]
  );

  async function addSpell() {
    const name = newSpellName === '__other__' ? newSpellCustom.trim() : newSpellName;
    if (!name) return;
    const ok = await onAdd(newSpellRank, name);
    if (ok) onClose();
  }

  return (
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
          onClick={onClose}
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
  );
}
