'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { fetchAccount } from '@/lib/data/account';
import type { Account } from '@/lib/data/account';
import { ProfileSection } from './components/ProfileSection';
import { NotificationsSection } from './components/NotificationsSection';
import { InviteCodeSection } from './components/InviteCodeSection';
import { AppearanceSection } from './components/AppearanceSection';
import { OfflineModeSection } from './components/OfflineModeSection';
import { OptionalRulesSection } from './components/OptionalRulesSection';
import { DataSection } from './components/DataSection';
import { SignOutSection } from './components/SignOutSection';
import { DangerZoneSection } from './components/DangerZoneSection';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    async function loadAccount() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/sign-in'); return; }

      const data = await fetchAccount(supabase, user.id);
      if (data) {
        setAccount(data);
        setDisplayName(data.display_name ?? '');
      }
    }

    loadAccount();
  }, [router, supabase]);

  return (
    <div style={{ padding: '1.25rem', paddingTop: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Settings
      </h1>

      <ProfileSection
        supabase={supabase}
        account={account}
        displayName={displayName}
        setDisplayName={setDisplayName}
        onAccountChange={setAccount}
      />
      <NotificationsSection supabase={supabase} account={account} onAccountChange={setAccount} />
      <InviteCodeSection account={account} />
      <AppearanceSection />
      <OfflineModeSection />
      <OptionalRulesSection />
      <DataSection supabase={supabase} />
      <SignOutSection supabase={supabase} />
      <DangerZoneSection supabase={supabase} />
    </div>
  );
}
