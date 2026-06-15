'use client';

import { useRouter } from 'next/navigation';
import type { SupabaseClient } from '@supabase/supabase-js';

interface SignOutSectionProps {
  supabase: SupabaseClient;
}

export function SignOutSection({ supabase }: SignOutSectionProps) {
  const router = useRouter();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/sign-in');
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
