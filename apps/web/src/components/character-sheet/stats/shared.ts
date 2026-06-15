import type { CSSProperties } from 'react';

export function formatMod(mod: number) { return mod >= 0 ? `+${mod}` : `${mod}`; }

export const sectionHead: CSSProperties = {
  margin: '0 0 0.75rem',
  fontFamily: 'var(--font-display), Georgia, serif',
  fontSize: '0.9rem',
  color: 'var(--color-text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
};
