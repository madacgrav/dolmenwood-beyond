'use client';

import type { LevelUpFeature } from '@dolmenwood/rules-engine';

export function FeaturesStep({
  features,
  newLevel,
  onContinue,
}: {
  features: LevelUpFeature[];
  newLevel: number;
  onContinue: () => void;
}){
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <h3 style={{
        margin: 0, fontSize: '1rem', fontWeight: '700',
        fontFamily: 'var(--font-display), Georgia, serif',
        color: 'var(--color-text)', textAlign: 'center',
      }}>
        New at Level {newLevel}
      </h3>

      {features.length === 0 ? (
        <div style={{
          padding: '1.5rem', textAlign: 'center',
          backgroundColor: 'var(--color-surface)',
          borderRadius: '10px', border: '1px solid var(--color-border)',
          color: 'var(--color-text-muted)', fontSize: '0.9rem',
        }}>
          No new class features at this level.
        </div>
      ) : (
        features.map((f, i) => (
          <div
            key={i}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-surface)',
              borderRadius: '10px',
              border: '1px solid var(--color-border)',
              borderLeft: '3px solid var(--color-gold)',
            }}
          >
            <div style={{
              fontSize: '0.875rem', fontWeight: '700',
              fontFamily: 'var(--font-display), Georgia, serif',
              color: 'var(--color-text)', marginBottom: '0.25rem',
            }}>
              ✦ {f.name}
            </div>
            <div style={{ fontSize: '0.825rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
              {f.description}
            </div>
          </div>
        ))
      )}

      <button
        onClick={onContinue}
        style={{
          width: '100%', padding: '0.875rem',
          backgroundColor: 'var(--color-primary)',
          color: 'white', border: 'none', borderRadius: '10px',
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '1rem', fontWeight: '700', cursor: 'pointer',
          minHeight: '44px',
        }}
      >
        Continue →
      </button>
    </div>
  );
}
