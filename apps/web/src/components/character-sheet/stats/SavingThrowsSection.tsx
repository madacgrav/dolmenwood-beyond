'use client';
import { getSaveTargets } from '@dolmenwood/rules-engine';
import { sectionHead } from './shared';

const SAVE_NAMES = [
  { key: 'doom', label: 'Death / Doom' },
  { key: 'ray', label: 'Wands / Rays' },
  { key: 'hold', label: 'Paralysis / Hold' },
  { key: 'blast', label: 'Breath / Blast' },
  { key: 'spell', label: 'Spells / Rods' },
] as const;

interface Props {
  saves: ReturnType<typeof getSaveTargets>;
}

export function SavingThrowsSection({ saves }: Props) {
  if (!saves) return null;
  return (
    <section>
      <h3 style={sectionHead}>
        Saving Throws
      </h3>
      <div style={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '10px', overflow: 'hidden' }}>
        {SAVE_NAMES.map(({ key, label }, i) => (
          <div
            key={key}
            style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '0.625rem 0.875rem',
              borderBottom: i < SAVE_NAMES.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <span style={{ fontSize: '0.85rem', color: 'var(--color-text)' }}>{label}</span>
            <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--color-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {(saves as Record<string, number>)[key]}+
            </span>
          </div>
        ))}
      </div>
      <p style={{ margin: '0.375rem 0 0', fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
        Roll d20 equal to or above target number to succeed.
      </p>
    </section>
  );
}
