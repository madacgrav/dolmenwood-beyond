'use client';

import type { Character } from '@dolmenwood/types';
import type { LevelUpFeature } from '@dolmenwood/rules-engine';

export function ConfirmStep({
  character,
  hpGain,
  features,
  saving,
  onConfirm,
}: {
  character: Character;
  hpGain: number;
  features: LevelUpFeature[];
  saving: boolean;
  onConfirm: () => void;
}){
  const newLevel = character.level + 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h3 style={{
        margin: 0, fontSize: '1rem', fontWeight: '700',
        fontFamily: 'var(--font-display), Georgia, serif',
        color: 'var(--color-text)', textAlign: 'center',
      }}>
        Ready to Level Up!
      </h3>

      <div style={{
        backgroundColor: 'var(--color-surface)',
        borderRadius: '10px', border: '1px solid var(--color-border)',
        overflow: 'hidden',
      }}>
        {[
          { label: 'Level', value: `${character.level} → ${newLevel}` },
          { label: 'Max HP', value: `${character.hpMax} → ${character.hpMax + hpGain} (+${hpGain})` },
          { label: 'Current HP', value: `${character.hpCurrent} → ${character.hpCurrent + hpGain} (+${hpGain})` },
          ...(features.length > 0
            ? [{ label: 'New Features', value: features.map(f => f.name).join(', ') }]
            : []),
        ].map((row, i, arr) => (
          <div
            key={i}
            style={{
              padding: '0.75rem 0.875rem',
              display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
              borderBottom: i < arr.length - 1 ? '1px solid var(--color-border)' : 'none',
              gap: '0.5rem',
            }}
          >
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', flexShrink: 0 }}>{row.label}</span>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--color-text)', textAlign: 'right' }}>{row.value}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onConfirm}
        disabled={saving}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: saving ? 'var(--color-border)' : 'var(--color-gold)',
          color: saving ? 'var(--color-text-muted)' : 'white',
          border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700',
          cursor: saving ? 'not-allowed' : 'pointer',
          transition: 'background-color 0.2s',
          minHeight: '44px',
        }}
      >
        {saving ? 'Saving…' : '🏆 Complete Level Up'}
      </button>
    </div>
  );
}
