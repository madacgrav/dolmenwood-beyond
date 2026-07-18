'use client';
import type { KindredTrait } from '@dolmenwood/rules-engine';
import { SECTION_HEADER } from './types';

interface Props {
  kindred: string;
  traits: KindredTrait[];
}

/** Quasi-magical kindred abilities: trait cards; glamour/knack pickers arrive in later phases. */
export function KindredAbilitiesSection({ kindred, traits }: Props) {
  return (
    <section>
      <h3 style={{ ...SECTION_HEADER, marginBottom: '0.75rem' }}>Kindred Abilities — {kindred}</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {traits.map(t => (
          <div key={t.name} style={{
            backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)',
            borderRadius: '8px', padding: '0.625rem 0.875rem',
          }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--color-text)' }}>{t.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>{t.description}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
