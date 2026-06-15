'use client';
import { useState, useMemo } from 'react';
import { getSpellsForClass } from '@dolmenwood/rules-engine';
import type { SpellEntry } from '@dolmenwood/rules-engine';
import { INPUT_STYLE, SELECT_STYLE } from './types';

interface Props {
  characterClass: string;
  ranksWithFreeSlots: number[];
  freeSlots: (rank: number) => number;
  onAdd: (rank: number, name: string) => Promise<boolean>;
  onClose: () => void;
}

/**
 * Prepare-a-spell form. Field state lives here and resets on each open,
 * because the section mounts the form fresh each time it is shown.
 */
export function PrepareSpellForm({ characterClass, ranksWithFreeSlots, freeSlots, onAdd, onClose }: Props) {
  const [prepRank, setPrepRank] = useState<number>(ranksWithFreeSlots[0] ?? 1);
  const [prepSpellName, setPrepSpellName] = useState<string>('__other__');
  const [prepCustomName, setPrepCustomName] = useState<string>('');

  const prepSpells: SpellEntry[] = useMemo(
    () => getSpellsForClass(characterClass, prepRank),
    [characterClass, prepRank]
  );

  async function addPreparation() {
    const name = prepSpellName === '__other__' ? prepCustomName.trim() : prepSpellName;
    if (!name) return;
    const ok = await onAdd(prepRank, name);
    if (ok) onClose();
  }

  return (
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
          onClick={onClose}
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
  );
}
