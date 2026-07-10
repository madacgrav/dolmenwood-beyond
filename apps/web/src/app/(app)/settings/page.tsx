'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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

  const [account, setAccount] = useState<Account | null>(null);
  const [displayName, setDisplayName] = useState('');

  useEffect(() => {
    async function loadAccount() {
      const res = await fetch('/api/account');
      if (res.status === 401) { router.push('/sign-in'); return; }
      if (!res.ok) return;
      const data: Account = await res.json();
      setAccount(data);
      setDisplayName(data.display_name ?? '');
    }

    loadAccount();
  }, [router]);

  return (
    <div style={{ padding: '1.25rem', paddingTop: '1.5rem', maxWidth: '600px', margin: '0 auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display), Georgia, serif', color: 'var(--color-primary)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Settings
      </h1>

      <ProfileSection
        account={account}
        displayName={displayName}
        setDisplayName={setDisplayName}
        onAccountChange={setAccount}
      />
      <NotificationsSection account={account} onAccountChange={setAccount} />
      <InviteCodeSection account={account} />
      <AppearanceSection />
      <OfflineModeSection />
      <OptionalRulesSection />
      <DataSection />
      <SignOutSection />
      <DangerZoneSection />
    </div>
  );
}
