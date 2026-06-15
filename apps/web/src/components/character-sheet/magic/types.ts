import type { CSSProperties } from 'react';

/** Return shape of `getSpellSlots` — rank → slot count, or `{ glamours: n }`. */
export type SlotsData = Record<string | number, number>;

export const SECTION_HEADER: CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};

export const INPUT_STYLE: CSSProperties = {
  padding: '0.5rem 0.75rem',
  borderRadius: '8px',
  border: '1px solid var(--color-border)',
  backgroundColor: 'var(--color-bg)',
  color: 'var(--color-text)',
  fontSize: '0.9rem',
  minHeight: '44px',
  width: '100%',
  boxSizing: 'border-box',
};

export const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: 'pointer',
};
