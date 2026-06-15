'use client';
import { useState } from 'react';
import type { CharacterWithNotes } from '@dolmenwood/types';

interface Props {
  character: CharacterWithNotes;
  readOnly: boolean;
  hpEditOpen: boolean;
  onToggle: () => void;
  onUpdate: (updates: Partial<CharacterWithNotes>) => void | Promise<void>;
}

export function HPBar({ character, readOnly, hpEditOpen, onToggle, onUpdate }: Props) {
  const [hpInputVal, setHpInputVal] = useState('');

  const hpPct = character.hpMax > 0 ? Math.max(0, Math.min(1, character.hpCurrent / character.hpMax)) : 0;
  const hpColor = hpPct > 0.66 ? 'var(--color-primary)' : hpPct > 0.33 ? 'var(--color-gold)' : 'var(--color-danger)';

  function adjustHP(delta: number) {
    const newHP = Math.max(0, Math.min(character.hpMax, character.hpCurrent + delta));
    onUpdate({ hpCurrent: newHP });
  }

  function commitHpInput() {
    const val = parseInt(hpInputVal, 10);
    if (!isNaN(val)) onUpdate({ hpCurrent: Math.max(0, Math.min(character.hpMax, val)) });
    setHpInputVal('');
    onToggle();
  }

  return (
    <>
      {/* HP bar */}
      <div
        style={{ cursor: readOnly ? 'default' : 'pointer', marginBottom: '0.5rem' }}
        onClick={() => { if (!readOnly) onToggle(); }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '3px' }}>
          <span style={{ color: hpColor, fontWeight: '600' }}>
            ❤️ {character.hpCurrent} / {character.hpMax} HP
          </span>
          {!readOnly && <span style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem' }}>tap to edit</span>}
        </div>
        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-border)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${hpPct * 100}%`, backgroundColor: hpColor, borderRadius: '4px', transition: 'width 0.3s, background-color 0.3s' }} />
        </div>
      </div>

      {/* HP edit controls */}
      {!readOnly && hpEditOpen && (
        <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          {([-5, -1, 1, 5] as const).map(d => (
            <button
              key={d}
              onClick={() => adjustHP(d)}
              style={{
                padding: '0.25rem 0.625rem', borderRadius: '6px', border: '1px solid var(--color-border)',
                backgroundColor: d < 0 ? 'color-mix(in srgb, var(--color-danger) 15%, var(--color-bg))' : 'color-mix(in srgb, var(--color-primary) 15%, var(--color-bg))',
                color: d < 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                cursor: 'pointer', fontSize: '0.85rem', fontWeight: '700', minHeight: '44px',
              }}
            >
              {d > 0 ? `+${d}` : d}
            </button>
          ))}
          <input
            type="number"
            placeholder="set HP"
            value={hpInputVal}
            onChange={e => setHpInputVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && commitHpInput()}
            style={{
              width: '70px', padding: '0.25rem 0.5rem', borderRadius: '6px',
              border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)', fontSize: '0.85rem', minHeight: '44px',
            }}
          />
          <button
            onClick={commitHpInput}
            style={{ padding: '0.25rem 0.625rem', borderRadius: '6px', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: '0.85rem', minHeight: '44px' }}
          >
            ✓
          </button>
        </div>
      )}
    </>
  );
}
