'use client';

import { useState } from 'react';
import type { Account } from '@/lib/data/account';
import { sectionStyle, sectionHeaderStyle, inputStyle } from './styles';

interface ProfileSectionProps {
  account: Account | null;
  displayName: string;
  setDisplayName: (value: string) => void;
  onAccountChange: (updater: (prev: Account | null) => Account | null) => void;
}

export function ProfileSection({
  account,
  displayName,
  setDisplayName,
  onAccountChange,
}: ProfileSectionProps) {
  const [savingName, setSavingName] = useState(false);
  const [saveNameMsg, setSaveNameMsg] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function handleSaveName() {
    if (!account) return;
    setSavingName(true);
    setSaveNameMsg('');
    const res = await fetch('/api/account', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    });
    setSavingName(false);
    if (!res.ok) {
      setSaveNameMsg('Failed to save.');
    } else {
      onAccountChange((prev) => prev ? { ...prev, display_name: displayName } : prev);
      setSaveNameMsg('Saved!');
      setTimeout(() => setSaveNameMsg(''), 2000);
    }
  }

  async function handleChangePassword() {
    if (!account?.email) return;
    setResetSent(false);
    await fetch('/api/auth/reset-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: account.email }),
    });
    setResetSent(true);
    setTimeout(() => setResetSent(false), 4000);
  }

  const initials = displayName.charAt(0).toUpperCase() || '?';

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Profile</h2>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '1.5rem', fontFamily: 'var(--font-display), Georgia, serif', flexShrink: 0 }}>
          {initials}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.25rem' }}>Display Name</div>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <button
          onClick={handleSaveName}
          disabled={savingName}
          style={{ padding: '0.5rem 1rem', backgroundColor: 'var(--color-primary)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.875rem', minHeight: '44px', opacity: savingName ? 0.7 : 1 }}
        >
          {savingName ? 'Saving…' : 'Save Name'}
        </button>
        {saveNameMsg && (
          <span style={{ fontSize: '0.875rem', color: saveNameMsg === 'Saved!' ? 'var(--color-primary)' : 'var(--color-danger)' }}>
            {saveNameMsg}
          </span>
        )}
      </div>

      <div style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        {account?.email ?? '—'}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: '0.5rem' }}>
        <button
          onClick={handleChangePassword}
          style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontSize: '0.875rem', textDecoration: 'underline', padding: 0, minHeight: '44px' }}
        >
          {resetSent ? 'Reset email sent!' : 'Change Password'}
        </button>
      </div>
    </section>
  );
}
