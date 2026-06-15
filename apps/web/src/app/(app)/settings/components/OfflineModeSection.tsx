'use client';

import { useState } from 'react';
import { sectionStyle, sectionHeaderStyle } from './styles';

export function OfflineModeSection() {
  const [offlineMode, setOfflineMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('dolmenwood-offline') === 'true';
  });

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Offline Mode</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: '0.875rem', color: 'var(--color-text)' }}>Cache characters for offline use</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.125rem' }}>Stores your characters locally for offline viewing</div>
        </div>
        <button
          onClick={() => {
            const next = !offlineMode;
            setOfflineMode(next);
            localStorage.setItem('dolmenwood-offline', String(next));
          }}
          aria-label={offlineMode ? 'Disable offline mode' : 'Enable offline mode'}
          style={{ width: '52px', height: '28px', borderRadius: '14px', border: 'none', cursor: 'pointer', backgroundColor: offlineMode ? 'var(--color-primary)' : 'var(--color-border)', position: 'relative', transition: 'background-color 0.2s', flexShrink: 0 }}
        >
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', backgroundColor: 'white', position: 'absolute', top: '3px', left: offlineMode ? '27px' : '3px', transition: 'left 0.2s' }} />
        </button>
      </div>
    </section>
  );
}
