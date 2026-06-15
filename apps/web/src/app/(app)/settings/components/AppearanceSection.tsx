'use client';

import { useState } from 'react';
import { sectionStyle, sectionHeaderStyle } from './styles';

export function AppearanceSection() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window === 'undefined') return 'system';
    return (localStorage.getItem('dolmenwood-theme') as 'light' | 'dark' | 'system') ?? 'system';
  });

  function handleThemeChange(t: 'light' | 'dark' | 'system') {
    setTheme(t);
    localStorage.setItem('dolmenwood-theme', t);
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else if (t === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Appearance</h2>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            onClick={() => handleThemeChange(t)}
            style={{
              flex: 1,
              padding: '0.625rem',
              borderRadius: '8px',
              cursor: 'pointer',
              backgroundColor: theme === t ? 'var(--color-primary)' : 'var(--color-surface)',
              color: theme === t ? 'white' : 'var(--color-text)',
              border: `1px solid ${theme === t ? 'var(--color-primary)' : 'var(--color-border)'}`,
              fontWeight: '500',
              textTransform: 'capitalize',
              fontSize: '0.875rem',
              minHeight: '44px',
            }}
          >
            {t === 'light' ? '☀️ Light' : t === 'dark' ? '🌙 Dark' : '⚙️ System'}
          </button>
        ))}
      </div>
    </section>
  );
}
