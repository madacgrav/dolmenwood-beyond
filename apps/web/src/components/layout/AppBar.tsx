'use client';

import { useRouter } from 'next/navigation';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { usePageHeaderValue } from './PageHeaderContext';

export function AppBar() {
  const router = useRouter();
  const { title, back, action } = usePageHeaderValue();

  return (
    <header style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '52px', zIndex: 50,
      backgroundColor: 'var(--color-surface)', borderBottom: '1px solid var(--color-border)',
      display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center',
      gap: '0.25rem', padding: '0 0.5rem 0 0.25rem',
    }}>
      {back ? (
        <button
          onClick={() => (back === true ? router.back() : router.push(back))}
          aria-label="Back"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '1.25rem',
            minWidth: '44px', minHeight: '44px',
          }}
        >
          ←
        </button>
      ) : (
        <span style={{ width: '0.5rem' }} />
      )}

      <span style={{
        fontFamily: 'var(--font-display), Georgia, serif',
        fontSize: '1rem', fontWeight: 700, color: 'var(--color-text)',
        textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis',
        whiteSpace: 'nowrap', minWidth: 0,
      }}>
        {title ?? ''}
      </span>

      {/* Contextual action slot; relative + visible overflow so dropdowns can anchor */}
      <div style={{ position: 'relative', overflow: 'visible', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
        {action ?? null}
      </div>

      <NotificationBell />
    </header>
  );
}
