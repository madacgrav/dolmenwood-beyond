'use client';
import type { ReactNode } from 'react';

interface Props {
  emoji: string;
  headline: string;
  message?: string;
  cta?: { label: string; onClick: () => void };
  /** Secondary path rendered below the CTA (e.g. an invite-code link/form). */
  escapeHatch?: ReactNode;
}

/** Standard empty state: emoji · display headline · muted line · one CTA. */
export function EmptyState({ emoji, headline, message, cta, escapeHatch }: Props) {
  return (
    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
      <div style={{ fontSize: '3rem', marginBottom: '1rem' }} aria-hidden="true">{emoji}</div>
      <h2 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', margin: '0 0 0.5rem' }}>
        {headline}
      </h2>
      {message && (
        <p style={{ color: 'var(--color-text-muted)', maxWidth: '300px', margin: '0 auto 1.5rem', lineHeight: 1.5 }}>
          {message}
        </p>
      )}
      {cta && (
        <button
          onClick={cta.onClick}
          style={{
            padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none',
            backgroundColor: 'var(--color-primary)', color: 'white',
            fontWeight: '600', fontSize: '0.95rem', cursor: 'pointer', minHeight: '44px',
          }}
        >
          {cta.label}
        </button>
      )}
      {escapeHatch && <div style={{ marginTop: '1rem' }}>{escapeHatch}</div>}
    </div>
  );
}
