'use client';

import { signOut } from 'next-auth/react';

export function SignOutSection() {
  async function handleSignOut() {
    await signOut({ callbackUrl: '/sign-in' });
  }

  return (
    <section style={{ padding: '1.5rem 0 0.75rem' }}>
      <button
        onClick={handleSignOut}
        style={{ width: '100%', padding: '0.875rem', backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)', color: 'var(--color-danger)', border: `1px solid var(--color-danger)`, borderRadius: '8px', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', minHeight: '44px' }}
      >
        Sign Out
      </button>
    </section>
  );
}
