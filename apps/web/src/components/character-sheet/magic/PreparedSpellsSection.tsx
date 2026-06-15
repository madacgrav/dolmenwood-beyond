'use client';
import { useState } from 'react';
import type { DBPreparation } from '@/lib/data/spells';
import { SECTION_HEADER } from './types';
import { PrepareSpellForm } from './PrepareSpellForm';

interface Props {
  characterClass: string;
  preparations: DBPreparation[];
  ranksWithFreeSlots: number[];
  freeSlots: (rank: number) => number;
  readOnly?: boolean;
  onAdd: (rank: number, name: string) => Promise<boolean>;
  onCast: (prep: DBPreparation) => void;
  onRestore: (prep: DBPreparation) => void;
}

/** Section 2: today's prepared spells with cast/restore, plus the prepare form. */
export function PreparedSpellsSection({
  characterClass, preparations, ranksWithFreeSlots, freeSlots, readOnly, onAdd, onCast, onRestore,
}: Props) {
  const [showPrepareForm, setShowPrepareForm] = useState(false);

  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={SECTION_HEADER}>Today&apos;s Prepared Spells ({preparations.length})</h3>
        {ranksWithFreeSlots.length > 0 && !readOnly && (
          <button
            onClick={() => setShowPrepareForm(o => !o)}
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

      {/* Prepare form — remounts on each open, so field state starts fresh */}
      {!readOnly && showPrepareForm && (
        <PrepareSpellForm
          characterClass={characterClass}
          ranksWithFreeSlots={ranksWithFreeSlots}
          freeSlots={freeSlots}
          onAdd={onAdd}
          onClose={() => setShowPrepareForm(false)}
        />
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
            {!readOnly && (prep.is_cast ? (
              <button
                onClick={() => onRestore(prep)}
                title="Restore spell"
                style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--color-text-muted)', fontSize: '1rem', padding: '0.25rem 0.5rem', minHeight: '44px', minWidth: '44px' }}
                aria-label={`Restore ${prep.spell_name}`}
              >
                ↩
              </button>
            ) : (
              <button
                onClick={() => onCast(prep)}
                title="Cast spell"
                style={{ background: 'none', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', color: 'var(--color-gold)', fontSize: '1rem', padding: '0.25rem 0.5rem', minHeight: '44px', minWidth: '44px' }}
                aria-label={`Cast ${prep.spell_name}`}
              >
                ⚡
              </button>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
