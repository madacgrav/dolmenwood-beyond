'use client';
import { useState } from 'react';
import type { DBSpell } from '@/lib/api/spells';
import { SECTION_HEADER } from './types';
import { AddSpellForm } from './AddSpellForm';

interface Props {
  characterClass: string;
  isGlamour: boolean;
  validRanks: number[];
  spells: DBSpell[];
  readOnly?: boolean;
  onAdd: (rank: number, name: string) => Promise<boolean>;
  onToggleMemorized: (spell: DBSpell) => void;
  onDelete: (id: string) => void;
}

/** Section 3: spell book / glamours known, with memorized toggles and the add form. */
export function SpellBookSection({
  characterClass, isGlamour, validRanks, spells, readOnly, onAdd, onToggleMemorized, onDelete,
}: Props) {
  const [showAddSpellForm, setShowAddSpellForm] = useState(false);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={SECTION_HEADER}>
          {isGlamour ? 'Glamours Known' : 'Spell Book'} ({spells.length})
        </h3>
        {!readOnly && (
        <button
          onClick={() => setShowAddSpellForm(o => !o)}
          style={{
            padding: '0.25rem 0.75rem', borderRadius: '6px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontSize: '0.75rem', fontWeight: '600', cursor: 'pointer', minHeight: '36px',
          }}
        >
          + Add Spell
        </button>
        )}
      </div>

      {/* Add spell form — remounts on each open, so field state starts fresh */}
      {!readOnly && showAddSpellForm && (
        <AddSpellForm
          characterClass={characterClass}
          isGlamour={isGlamour}
          validRanks={validRanks}
          onAdd={onAdd}
          onClose={() => setShowAddSpellForm(false)}
        />
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
              onChange={() => !readOnly && onToggleMemorized(spell)}
              disabled={readOnly}
              style={{ width: '20px', height: '20px', cursor: readOnly ? 'default' : 'pointer', accentColor: 'var(--color-gold)' }}
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
            {!readOnly && (
            <button
              onClick={() => onDelete(spell.id)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--color-danger)', fontSize: '1rem',
                padding: '0.25rem', minHeight: '44px', minWidth: '44px',
              }}
              aria-label={`Delete ${spell.spell_name}`}
            >
              ✕
            </button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
