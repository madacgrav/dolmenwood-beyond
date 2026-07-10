'use client';
import type { DBSpellSlot } from '@/lib/api/spells';
import { SECTION_HEADER, type SlotsData } from './types';

interface Props {
  isGlamour: boolean;
  slotsData: SlotsData | null;
  level: number;
  dbSlots: DBSpellSlot[];
  readOnly?: boolean;
  onToggleSlot: (slot: DBSpellSlot, isUsed: boolean) => void;
  onRest: () => void;
}

/** Section 1: spell-slot tally circles per rank, or the glamours-known box. */
export function SpellSlotsSection({ isGlamour, slotsData, level, dbSlots, readOnly, onToggleSlot, onRest }: Props) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
        <h3 style={SECTION_HEADER}>
          {isGlamour ? 'Glamour Circles' : 'Spell Slots'}
        </h3>
        {!isGlamour && !readOnly && (
          <button
            onClick={onRest}
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
            Glamours known at Level {level}
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
                      onClick={() => !readOnly && onToggleSlot(slot, used)}
                      disabled={readOnly}
                      style={{
                        background: 'none', border: 'none',
                        cursor: readOnly ? 'default' : 'pointer', padding: 0,
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
  );
}
