'use client';

import { useState } from 'react';
import type { Account } from '@/lib/data/account';
import { sectionStyle, sectionHeaderStyle } from './styles';

interface InviteCodeSectionProps {
  account: Account | null;
}

export function InviteCodeSection({ account }: InviteCodeSectionProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!account?.invite_code) return;
    await navigator.clipboard.writeText(account.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <section style={sectionStyle}>
      <h2 style={sectionHeaderStyle}>Invite Code</h2>
      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
        Share this code with friends to invite them to your campaigns.
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <div style={{ flex: 1, padding: '0.75rem', backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: '8px', fontFamily: 'monospace', fontSize: '1.25rem', letterSpacing: '0.15em', color: 'var(--color-gold)', textAlign: 'center' }}>
          {account?.invite_code ?? '------'}
        </div>
        <button
          onClick={handleCopy}
          style={{ padding: '0.75rem', backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', cursor: 'pointer', minHeight: '44px', minWidth: '44px', fontSize: '1.125rem' }}
          aria-label="Copy invite code"
        >
          {copied ? '✓' : '📋'}
        </button>
      </div>
    </section>
  );
}
