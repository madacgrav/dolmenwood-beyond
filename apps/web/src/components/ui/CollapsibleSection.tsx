'use client';
import { useState, type ReactNode } from 'react';

interface Props {
  title: string;
  /** Shown as "N more" next to the closed heading. */
  count?: number;
  defaultOpen?: boolean;
  emoji?: string;
  children: ReactNode;
}

/**
 * Progressive-disclosure wrapper: secondary sections collapse behind their
 * heading. Nothing is removed — collapsed content is one tap away.
 */
export function CollapsibleSection({ title, count, defaultOpen = false, emoji, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          minHeight: '44px',
        }}
      >
        <span style={{
          fontFamily: 'var(--font-display), Georgia, serif',
          fontSize: '0.9rem',
          color: 'var(--color-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span aria-hidden="true" style={{ fontSize: '0.75rem' }}>{open ? '▾' : '▸'}</span>
          {emoji && <span aria-hidden="true">{emoji}</span>}
          {title}
        </span>
        {!open && count !== undefined && count > 0 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            {count} more
          </span>
        )}
      </button>
      {open && <div className="collapsible-body" style={{ marginTop: '0.25rem' }}>{children}</div>}
    </section>
  );
}
