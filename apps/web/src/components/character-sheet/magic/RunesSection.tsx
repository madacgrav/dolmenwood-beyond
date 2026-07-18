'use client';
import { useMemo, useState } from 'react';
import type { DBSpell } from '@/lib/api/spells';
import { getRunesForClass, getRuneTier, type RuneTier } from '@dolmenwood/rules-engine';
import { SECTION_HEADER, INPUT_STYLE, SELECT_STYLE } from './types';

interface Props {
  characterClass: string;
  runes: DBSpell[];
  readOnly?: boolean;
  onAdd: (name: string) => Promise<boolean>;
  onDelete: (id: string) => void;
}

const TIER_LABEL: Record<RuneTier, string> = {
  lesser: 'Lesser Rune',
  greater: 'Greater Rune',
  mighty: 'Mighty Rune',
};

/** Fairy runes known, with the add form. Runes are tiered but slotless — no memorization. */
export function RunesSection({ characterClass, runes, readOnly, onAdd, onDelete }: Props) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRuneName, setNewRuneName] = useState<string>('__other__');
  const [newRuneCustom, setNewRuneCustom] = useState<string>('');

  const runeOptions = useMemo(() => getRunesForClass(characterClass), [characterClass]);
  const tiers: RuneTier[] = ['lesser', 'greater', 'mighty'];

  async function addRune() {
    const name = newRuneName === '__other__' ? newRuneCustom.trim() : newRuneName;
    if (!name) return;
    const ok = await onAdd(name);
    if (ok) {
      setShowAddForm(false);
      setNewRuneName('__other__');
      setNewRuneCustom('');
    }
  }

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={SECTION_HEADER}>Runes Known ({runes.length})</h3>
        {!readOnly && (
        <button
          onClick={() => setShowAddForm(o => !o)}
          style={{
            padding: '0.25rem 0.75rem', borderRadius: '6px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', minHeight: '36px',
          }}
        >
          + Add Rune
        </button>
        )}
      </div>

      {!readOnly && showAddForm && (
        <div style={{
          backgroundColor: 'var(--color-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '8px', padding: '0.875rem', marginBottom: '0.75rem',
        }}>
          <label style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.25rem' }}>Rune</label>
          <select
            value={newRuneName}
            onChange={e => setNewRuneName(e.target.value)}
            style={SELECT_STYLE}
          >
            {tiers.map(tier => (
              <optgroup key={tier} label={`${TIER_LABEL[tier]}s`}>
                {runeOptions.filter(r => r.tier === tier).map(r => (
                  <option key={r.name} value={r.name}>{r.name}</option>
                ))}
              </optgroup>
            ))}
            <option value="__other__">Other…</option>
          </select>
          {newRuneName === '__other__' && (
            <input
              type="text"
              placeholder="Rune name"
              value={newRuneCustom}
              onChange={e => setNewRuneCustom(e.target.value)}
              style={{ ...INPUT_STYLE, marginTop: '0.5rem' }}
            />
          )}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              onClick={addRune}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '6px', border: 'none',
                backgroundColor: 'var(--color-primary)', color: 'white',
                fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', minHeight: '40px',
              }}
            >
              Add
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              style={{
                flex: 1, padding: '0.5rem', borderRadius: '6px',
                border: '1px solid var(--color-border)', backgroundColor: 'transparent',
                color: 'var(--color-text-muted)', fontSize: '0.8rem', cursor: 'pointer', minHeight: '40px',
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {runes.length === 0 && !showAddForm && (
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>
          No runes known. Tap + Add Rune.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {runes.map(rune => {
          const tier = getRuneTier(characterClass, rune.spell_name);
          return (
            <div key={rune.id} style={{
              backgroundColor: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '8px', padding: '0.625rem 0.875rem',
              display: 'flex', alignItems: 'center', gap: '0.75rem',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9rem', color: 'var(--color-text)' }}>
                  {rune.spell_name}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  {tier ? TIER_LABEL[tier] : 'Rune'}
                </div>
              </div>
              {!readOnly && (
              <button
                onClick={() => onDelete(rune.id)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--color-danger)', fontSize: '1rem',
                  padding: '0.25rem', minHeight: '44px', minWidth: '44px',
                }}
                aria-label={`Delete ${rune.spell_name}`}
              >
                ✕
              </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
